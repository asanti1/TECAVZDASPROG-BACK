import { Module } from '@nestjs/common';
import { DatabaseModule } from '../shared/infrastructure/postgres/database.module.js';
import { UsersController } from './api/users.controller.js';
import { UsersService } from './application/users.service.js';
import { USER_REPOSITORY } from './domain/user.repository.js';
import { PostgresUserRepository } from './infrastructure/postgres-user.repository.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UsersController],
  providers: [UsersService, { provide: USER_REPOSITORY, useClass: PostgresUserRepository }],
})
export class UsersModule { }
