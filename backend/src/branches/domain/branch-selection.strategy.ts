import type { Coordinates } from '../../shared/geo/coordinates.js';
import type { Branch } from './branch.js';

export interface BranchCandidate {
  branch: Branch;
  stock: ReadonlyMap<string, number>;
}

export interface RequestedItem {
  productId: string;
  quantity: number;
}

export interface BranchSelectionRequest {
  items: ReadonlyArray<RequestedItem>;
  destination: Coordinates;
}

export interface IBranchSelectionStrategy {
  selectBranch(
    request: BranchSelectionRequest,
    candidates: ReadonlyArray<BranchCandidate>,
  ): Branch;
}

// inyeccion, en ts no ay interfaces en runtime
export const BRANCH_SELECTION_STRATEGY = Symbol('IBranchSelectionStrategy');
