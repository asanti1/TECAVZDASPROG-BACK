import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { CurrentUser, Roles } from '../../shared/auth/decorators.js';
import { UserRole } from '../../shared/auth/role.js';
import { assertCanAccessTrip, canAccessTrip } from '../application/trip-access.js';
import { TripsService } from '../application/trips.service.js';
import { CreateTripDto } from './create-trip.dto.js';
import { presentTrip, presentTripRoute } from './trip.presenter.js';


@Controller('trips')
@Roles(UserRole.ADMIN, UserRole.DELIVERY_PERSON)
export class TripsController {
  constructor(private readonly service: TripsService) { }

  @Post()
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateTripDto) {
    return presentTrip(await this.service.createTrip(dto));
  }

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const trips = await this.service.listTrips();
    return trips.filter((trip) => canAccessTrip(user, trip)).map(presentTrip);
  }

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return presentTrip(await this.owned(id, user));
  }

  @Get(':id/route')
  async route(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    return presentTripRoute(await this.owned(id, user));
  }

  @Post(':id/start')
  @HttpCode(HttpStatus.OK)
  async start(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.owned(id, user);
    return presentTrip(await this.service.startTrip(id, new Date()));
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  async complete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    await this.owned(id, user);
    return presentTrip(await this.service.completeTrip(id));
  }

  @Post(':id/request-routes')
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.ACCEPTED)
  async requestRoutes(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.service.requestRoutesAgain(id);
  }

  private async owned(id: string, user: AuthenticatedUser) {
    const trip = await this.service.getTrip(id);
    assertCanAccessTrip(user, trip);
    return trip;
  }
}
