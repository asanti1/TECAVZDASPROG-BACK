import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Branch } from '../../branches/domain/branch.js';
import type { IBranchRepository } from '../../branches/domain/branch.repository.js';
import { BRANCH_REPOSITORY } from '../../branches/domain/branch.repository.js';
import type { Order } from '../../orders/domain/order.js';
import type { IOrderRepository } from '../../orders/domain/order.repository.js';
import { ORDER_REPOSITORY } from '../../orders/domain/order.repository.js';
import { BranchNotFoundError, InvalidOrderError, InvalidTripError, InvalidTripTransitionError, OrderNotFoundError, TripNotFoundError } from '../../shared/errors.js';
import type { Coordinates } from '../../shared/geo/coordinates.js';
import type { IUnitOfWork } from '../../shared/unit-of-work.js';
import { UNIT_OF_WORK } from '../../shared/unit-of-work.js';
import type { IDeliveryAssignmentStrategy, IDeliveryPeopleAvailability } from '../domain/delivery-assignment.js';
import { DELIVERY_ASSIGNMENT_STRATEGY, DELIVERY_PEOPLE_AVAILABILITY } from '../domain/delivery-assignment.js';
import type { RoutePlan } from '../domain/route-plan.js';
import { TripStatus } from '../domain/trip-status.js';
import type { Trip } from '../domain/trip.js';
import type { ITripRepository } from '../domain/trip.repository.js';
import { TRIP_REPOSITORY } from '../domain/trip.repository.js';
import type { PlanTripStop, PlannedTrip } from './trip-planner.js';
import { TripPlanner } from './trip-planner.js';

export interface CreateTripInput {
  orderIds: ReadonlyArray<string>;
}

@Injectable()
export class TripsService {
  private readonly logger = new Logger(TripsService.name);

  constructor(
    @Inject(TRIP_REPOSITORY) private readonly trips: ITripRepository,
    @Inject(ORDER_REPOSITORY) private readonly orders: IOrderRepository,
    @Inject(BRANCH_REPOSITORY) private readonly branches: IBranchRepository,
    @Inject(UNIT_OF_WORK) private readonly unitOfWork: IUnitOfWork, private readonly planner: TripPlanner,
    @Inject(DELIVERY_PEOPLE_AVAILABILITY) private readonly availability: IDeliveryPeopleAvailability,
    @Inject(DELIVERY_ASSIGNMENT_STRATEGY) private readonly assignment: IDeliveryAssignmentStrategy,
  ) { }

  async createTrip(input: CreateTripInput): Promise<Trip> {
    const orders = await this.requireOrders(input.orderIds);
    const origin = await this.requireBranch(this.commonOrigin(orders));
    const stops = await this.stopsFor(orders);
    const deliveryPerson = this.assignment.select(await this.availability.findAvailable(origin.id));

    const planned = this.planner.planTrip({
      deliveryPersonId: deliveryPerson.id,
      origin,
      stops,
    });

    await this.unitOfWork.runInTransaction(async () => {
      await this.trips.save(planned.trip);
      for (const order of orders) {
        await this.orders.save(order);
      }
    });

    await this.requestRoutesWithoutFailing(planned);
    return planned.trip;
  }

  getTrip(id: string): Promise<Trip> {
    return this.requireTrip(id);
  }

  listTrips(): Promise<Trip[]> {
    return this.trips.findAll();
  }

  async attachRoutePlan(plan: RoutePlan): Promise<boolean> {
    const trip = await this.requireTrip(plan.tripId);
    const attached = trip.attachRoutePlan(plan);
    if (attached) await this.trips.save(trip);

    return attached;
  }

  async requestRoutesAgain(tripId: string): Promise<void> {
    const trip = await this.requireTrip(tripId);
    if (trip.status !== TripStatus.PLANNED || trip.routes.length > 0) {
      throw new InvalidTripTransitionError(`El viaje ${tripId} ya tiene rutas calculadas o ya salió`);
    }
    const origin = await this.requireBranch(trip.originBranchId);
    const stops = await this.stopsFor(await this.requireOrders(trip.orderIds));
    await this.planner.requestRoutes({
      trip,
      request: this.planner.buildRequest(trip.id, origin, stops),
    });
  }

  async startTrip(tripId: string, at: Date): Promise<Trip> {
    const trip = await this.requireTrip(tripId);
    const orders = await this.requireOrders(trip.orderIds);
    trip.start(at);
    orders.forEach((order) => order.startTrip());
    await this.saveTripWithOrders(trip, orders);
    return trip;
  }

  async completeTrip(tripId: string): Promise<Trip> {
    const trip = await this.requireTrip(tripId);
    const orders = await this.requireOrders(trip.orderIds);
    trip.complete();
    orders.forEach((order) => order.markDelivered());
    await this.saveTripWithOrders(trip, orders);
    return trip;
  }

  private saveTripWithOrders(trip: Trip, orders: ReadonlyArray<Order>): Promise<void> {
    return this.unitOfWork.runInTransaction(async () => {
      await this.trips.save(trip);
      for (const order of orders) {
        await this.orders.save(order);
      }
    });
  }

  private async requestRoutesWithoutFailing(planned: PlannedTrip,): Promise<void> {
    try {
      await this.planner.requestRoutes(planned);
    } catch (error) {
      this.logger.error(
        `El viaje ${planned.trip.id} quedó sin pedido de rutas: ${String(error)}`,
      );
    }
  }

  private commonOrigin(orders: ReadonlyArray<Order>): string {
    const origins = new Set(orders.map((order) => order.originBranchId));
    if (origins.size !== 1) {
      throw new InvalidTripError(
        'Los pedidos de un viaje deben salir de la misma sucursal',
      );
    }
    return [...origins][0] as string;
  }

  private async requireTrip(id: string): Promise<Trip> {
    const trip = await this.trips.findById(id);
    if (!trip) {
      throw new TripNotFoundError(`No existe el viaje ${id}`);
    }
    return trip;
  }

  private async requireBranch(id: string): Promise<Branch> {
    const branch = await this.branches.findById(id);
    if (!branch) {
      throw new BranchNotFoundError(`No existe la sucursal ${id}`);
    }
    return branch;
  }

  private async requireOrders(ids: ReadonlyArray<string>): Promise<Order[]> {
    const found = new Map((await this.orders.findByIds(ids)).map((order) => [order.id, order]));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      throw new OrderNotFoundError(`No existen los pedidos: ${missing.join(', ')}`);
    }
    return ids.map((id) => found.get(id) as Order);
  }

  private async stopsFor(orders: ReadonlyArray<Order>): Promise<PlanTripStop[]> {
    const stops: PlanTripStop[] = [];
    for (const order of orders) {
      stops.push({ order, location: await this.locationOf(order) });
    }
    return stops;
  }

  private async locationOf(order: Order): Promise<Coordinates> {
    if (order.deliveryAddress) {
      return {
        latitude: order.deliveryAddress.latitude,
        longitude: order.deliveryAddress.longitude,
      };
    }
    if (order.destinationBranchId === null) {
      throw new InvalidOrderError(`El pedido ${order.id} no tiene destino`);
    }
    return (await this.requireBranch(order.destinationBranchId)).location;
  }
}
