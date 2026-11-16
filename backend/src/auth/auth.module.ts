import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TOKEN_VERIFIER } from '../shared/auth/token-verifier.js';
import { DatabaseModule } from '../shared/infrastructure/postgres/database.module.js';
import { AuthController } from './api/auth.controller.js';
import { JwtAuthGuard } from './api/jwt-auth.guard.js';
import { RolesGuard } from './api/roles.guard.js';
import { AuthService } from './application/auth.service.js';
import { CREDENTIALS_REPOSITORY } from './domain/credentials.js';
import { PASSWORD_HASHER } from './domain/password-hasher.js';
import { TOKEN_ISSUER } from './domain/token-issuer.js';
import { JwtTokenService } from './infrastructure/jwt-token-service.js';
import { PostgresCredentialsRepository } from './infrastructure/postgres-credentials.repository.js';
import { ScryptPasswordHasher } from './infrastructure/scrypt-password-hasher.js';

function jwtOptions() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Falta la variable JWT_SECRET (la clave con la que se firman los tokens)');
  }
  return {
    secret,
    signOptions: {
      expiresIn: Number(process.env.JWT_EXPIRES_IN_SECONDS ?? 28800),
    },
  };
}

@Global()
@Module({
  imports: [
    DatabaseModule,
    JwtModule.registerAsync({ useFactory: jwtOptions }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtTokenService,
    { provide: TOKEN_ISSUER, useExisting: JwtTokenService },
    { provide: TOKEN_VERIFIER, useExisting: JwtTokenService },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    { provide: CREDENTIALS_REPOSITORY, useClass: PostgresCredentialsRepository },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [TOKEN_VERIFIER],
})
export class AuthModule { }
