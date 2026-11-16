import { InvalidOrderError, InvalidOrderTransitionError } from '../../shared/errors.js';
import { OrderStatus, OrderType } from './order-status.js';
import { Order, type OrderProps } from './order.js';

const address = { latitude: -34.6, longitude: -58.4 };
const items = [{ productId: 'p1', quantity: 2 }];

const customerOrder = (overrides: Partial<OrderProps> = {}): Order =>
  new Order({
    id: 'o1',
    type: OrderType.CUSTOMER,
    originBranchId: 'b1',
    customerId: 'c1',
    deliveryAddress: address,
    items,
    ...overrides,
  });

const interBranchOrder = (overrides: Partial<OrderProps> = {}): Order =>
  new Order({
    id: 'o2',
    type: OrderType.INTER_BRANCH,
    originBranchId: 'b1',
    destinationBranchId: 'b2',
    items,
    ...overrides,
  });

describe('Order: creación y validaciones', () => {
  it('crea un pedido CUSTOMER válido, pendiente y sin viaje', () => {
    const order = customerOrder();
    expect(order.status).toBe(OrderStatus.PENDING);
    expect(order.tripId).toBeNull();
  });

  it('crea un pedido INTER_BRANCH válido', () => {
    expect(interBranchOrder().destinationBranchId).toBe('b2');
  });

  it.each([
    ['CUSTOMER sin dirección', () => customerOrder({ deliveryAddress: null })],
    ['INTER_BRANCH con destino igual al origen', () => interBranchOrder({ destinationBranchId: 'b1' })],
    ['sin productos', () => customerOrder({ items: [] })],
    ['cantidad cero', () => customerOrder({ items: [{ productId: 'p1', quantity: 0 }] })],
    ['producto repetido', () => customerOrder({
      items: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p1', quantity: 2 }]
    })],
  ])('rechaza %s', (_label, build) => { expect(build).toThrow(InvalidOrderError) });

  it('copia los items: modificar el arreglo original no altera el pedido', () => {
    const source = [{ productId: 'p1', quantity: 2 }];
    const order = customerOrder({ items: source });
    source[0].quantity = 99;
    expect(order.items[0].quantity).toBe(2);
  });
});

describe('Order: máquina de estados', () => {
  it('recorre pending -> assigned -> in_trip -> delivered', () => {
    const order = customerOrder();
    order.assignToTrip('t1');
    expect(order.status).toBe(OrderStatus.ASSIGNED);
    expect(order.tripId).toBe('t1');
    order.startTrip();
    expect(order.status).toBe(OrderStatus.IN_TRIP);
    order.markDelivered();
    expect(order.status).toBe(OrderStatus.DELIVERED);
    expect(order.tripId).toBe('t1');
  });

  const orderIn = (status: OrderStatus): Order =>
    customerOrder({
      status,
      tripId: status === OrderStatus.PENDING ? null : 't1',
    });

  it.each([
    ['asignar', OrderStatus.IN_TRIP, (o: Order) => o.assignToTrip('t9')],
    ['iniciar', OrderStatus.PENDING, (o: Order) => o.startTrip()],
    ['entregar', OrderStatus.ASSIGNED, (o: Order) => o.markDelivered()],
  ])('no se puede %s desde %s', (_name, status, transition) => {
    const order = orderIn(status);
    expect(() => transition(order)).toThrow(InvalidOrderTransitionError);
    expect(order.status).toBe(status);
  });

  it('una transición inválida no modifica el viaje asignado', () => {
    const order = orderIn(OrderStatus.ASSIGNED);
    expect(() => order.assignToTrip('otro')).toThrow(InvalidOrderTransitionError);
    expect(order.tripId).toBe('t1');
  });
});
