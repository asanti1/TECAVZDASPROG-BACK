import { IsEnum } from 'class-validator';
import { UserRole } from '../domain/user.js';

export class ListUsersQuery {
  @IsEnum(UserRole)
  role!: UserRole;
}
