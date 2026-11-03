import type { Branch } from './branch.js';
import type { BranchCandidate } from './branch-selection.strategy.js';

export interface IBranchRepository {
  findById(id: string): Promise<Branch | null>;
  findCandidatesWithStock(
    productIds: ReadonlyArray<string>,
  ): Promise<BranchCandidate[]>;
}

export const BRANCH_REPOSITORY = Symbol('IBranchRepository');
