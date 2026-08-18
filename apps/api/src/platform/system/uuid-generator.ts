import { randomUUID } from 'node:crypto';
import type { IdGenerator } from '../../shared/identifiers';

export class UuidGenerator implements IdGenerator {
  generate(): string {
    return randomUUID();
  }
}
