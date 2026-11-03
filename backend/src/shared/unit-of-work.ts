export interface IUnitOfWork {
  runInTransaction<T>(work: () => Promise<T>): Promise<T>;
}

export const UNIT_OF_WORK = Symbol('IUnitOfWork');
