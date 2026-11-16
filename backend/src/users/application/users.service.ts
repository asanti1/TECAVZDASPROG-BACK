import { Inject, Injectable } from '@nestjs/common';
import type { User, UserRole } from '../domain/user.js';
import type { IUserRepository } from '../domain/user.repository.js';
import { USER_REPOSITORY } from '../domain/user.repository.js';

@Injectable()
export class UsersService {
  constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) { }

  listByRole(role: UserRole): Promise<User[]> {
    return this.users.findByRole(role);
  }
}
