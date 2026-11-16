import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../../shared/auth/decorators.js';
import { UserRole } from '../../shared/auth/role.js';
import { UsersService } from '../application/users.service.js';
import type { User } from '../domain/user.js';
import { ListUsersQuery } from './list-users.query.js';

@Controller('users')
@Roles(UserRole.ADMIN)
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery): Promise<User[]> {
    return this.service.listByRole(query.role);
  }
}
