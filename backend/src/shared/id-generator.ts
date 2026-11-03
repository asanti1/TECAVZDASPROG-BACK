export interface IIdGenerator {
  newId(): string;
}

export const ID_GENERATOR = Symbol('IIdGenerator');
