import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { IIdGenerator } from '../id-generator.js';

@Injectable()
export class RandomUuidGenerator implements IIdGenerator {
  newId(): string {
    return randomUUID();
  }
}
