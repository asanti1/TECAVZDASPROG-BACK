export interface IIdGenerator {
  newId(): string;
}

// en ts las interfaces no existen en runtime.
export const ID_GENERATOR = Symbol('IIdGenerator');
