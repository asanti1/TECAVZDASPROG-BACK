import type { Order } from '../domain/order.js';

export function presentOrder(order: Order) {
  return {
    id: order.id,
    type: order.type,
    status: order.status,
    originBranchId: order.originBranchId,
    destinationBranchId: order.destinationBranchId,
    customerId: order.customerId,
    deliveryAddress: order.deliveryAddress,
    items: order.items,
    tripId: order.tripId,
    createdAt: order.createdAt.toISOString(),
  };
}
