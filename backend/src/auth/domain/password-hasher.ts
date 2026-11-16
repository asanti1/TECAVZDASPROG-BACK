export interface IPasswordHasher {
  hash(password: string): Promise<string>;
  verify(password: string, stored: string): Promise<boolean>;
}

export const PASSWORD_HASHER = Symbol('IPasswordHasher');
