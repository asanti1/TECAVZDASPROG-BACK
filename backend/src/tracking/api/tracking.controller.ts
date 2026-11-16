import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { AuthenticatedUser } from '../../shared/auth/authenticated-user.js';
import { CurrentUser, Roles } from '../../shared/auth/decorators.js';
import { UserRole } from '../../shared/auth/role.js';
import { TrackingService } from '../application/tracking.service.js';
import { presentLocation } from './location.presenter.js';

@Controller('trips')
@Roles(UserRole.ADMIN, UserRole.DELIVERY_PERSON)
export class TrackingController {
  constructor(private readonly tracking: TrackingService) { }

  @Get(':id/location')
  async lastLocation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) {
    const location = await this.tracking.lastLocation(id, user);
    return { tripId: id, lastLocation: location && presentLocation(location) };
  }
}
