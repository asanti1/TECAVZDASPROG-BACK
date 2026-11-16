import { NoBranchAvailableError } from '../../shared/errors.js';
import { haversineKm } from '../../shared/geo/haversine.js';
import type { BranchCandidate, BranchSelectionRequest, IBranchSelectionStrategy } from './branch-selection.strategy.js';
import type { Branch } from './branch.js';

export class NearestBranchWithStockStrategy implements IBranchSelectionStrategy {
  selectBranch(
    request: BranchSelectionRequest,
    candidates: ReadonlyArray<BranchCandidate>,
  ): Branch {
    const eligible = candidates.filter((candidate) =>
      request.items.every(
        (item) => (candidate.stock.get(item.productId) ?? 0) >= item.quantity,
      ),
    );

    if (eligible.length === 0) {
      throw new NoBranchAvailableError(
        'Ninguna sucursal tiene stock para cumplir el pedido completo',
      );
    }

    const ranked = eligible
      .map(({ branch }) => ({
        branch,
        distanceKm: haversineKm(branch.location, request.destination),
      })).sort((a, b) => a.distanceKm - b.distanceKm || a.branch.id.localeCompare(b.branch.id));

    return ranked[0].branch;
  }
}
