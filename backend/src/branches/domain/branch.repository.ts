import type { BranchCandidate } from './branch-selection.strategy.js';
import type { Branch } from './branch.js';

export interface IBranchRepository {
  findById(id: string): Promise<Branch | null>;
  findAll(): Promise<Branch[]>;
  findCandidatesWithStock(productIds: ReadonlyArray<string>): Promise<BranchCandidate[]>;
}

export const BRANCH_REPOSITORY = Symbol('IBranchRepository');
