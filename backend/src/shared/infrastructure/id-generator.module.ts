import { Module } from '@nestjs/common';
import { ID_GENERATOR } from '../id-generator.js';
import { RandomUuidGenerator } from './random-uuid-generator.js';

@Module({
  providers: [{ provide: ID_GENERATOR, useClass: RandomUuidGenerator }],
  exports: [ID_GENERATOR],
})

export class IdGeneratorModule {}
