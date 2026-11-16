import { NoBranchAvailableError } from '../../shared/errors.js';
import type { BranchCandidate, BranchSelectionRequest } from './branch-selection.strategy.js';
import type { Branch } from './branch.js';
import { NearestBranchWithStockStrategy } from './nearest-branch-with-stock.strategy.js';

const branch = (id: string, latitude: number, longitude: number): Branch => ({
  id,
  name: `Sucursal ${id}`,
  location: { latitude, longitude },
});

const candidate = (b: Branch, stock: Record<string, number>): BranchCandidate => ({
  branch: b,
  stock: new Map(Object.entries(stock)),
});

// El destino es La Pampa. Distancias aproximadas: pampa 2 km, bahia 296 km,
// bsas 578 km, cordoba 578 km (las dos últimas casi empatan: no usarlas para desempatar).
const destination = { latitude: -36.6, longitude: -64.3 };
const pampa = branch('pampa', -36.62, -64.29);
const baires = branch('baires', -34.6, -58.4);
const cordoba = branch('cordoba', -31.4, -64.2);
const bahia = branch('bahia', -38.72, -62.27);

const request = (items: Array<{ productId: string; quantity: number }> ): BranchSelectionRequest => ({ items, destination });

describe('NearestBranchWithStockStrategy', () => {
  const strategy = new NearestBranchWithStockStrategy();

  it('elige la sucursal más cercana cuando todas tienen stock', () => {
    const chosen = strategy.selectBranch(
      request([{ productId: 'x', quantity: 1 }]),
      [
        candidate(baires, { x: 10 }),
        candidate(pampa, { x: 10 }),
        candidate(cordoba, { x: 10 }),
      ],
    );
    expect(chosen.id).toBe('pampa');
  });

  it('descarta la más cercana si no tiene stock y elige la siguiente', () => {
    const chosen = strategy.selectBranch(
      request([{ productId: 'x', quantity: 5 }]),
      [
        candidate(pampa, { x: 4 }),
        candidate(baires, { x: 5 }),
        candidate(bahia, { x: 9 }),
      ],
    );
    // pampa tiene 4 < 5; entre bsas (578 km) y bahia (296 km) gana la más cercana.
    expect(chosen.id).toBe('bahia');
  });

  it('exige stock de TODOS los productos: no hay entregas parciales', () => {
    const chosen = strategy.selectBranch(
      request([
        { productId: 'x', quantity: 1 },
        { productId: 'y', quantity: 1 },
      ]),
      [candidate(pampa, { x: 10 }), candidate(baires, { x: 1, y: 1 })],
    );
    expect(chosen.id).toBe('baires');
  });

  it('un producto ausente del mapa cuenta como stock cero', () => {
    expect(() =>
      strategy.selectBranch(request([{ productId: 'x', quantity: 1 }]), [
        candidate(pampa, {}),
      ]),
    ).toThrow(NoBranchAvailableError);
  });

  it('lanza NoBranchAvailableError si ninguna sucursal alcanza', () => {
    expect(() =>
      strategy.selectBranch(request([{ productId: 'x', quantity: 100 }]), [
        candidate(pampa, { x: 1 }),
        candidate(baires, { x: 2 }),
      ]),
    ).toThrow(NoBranchAvailableError);
  });

  it('lanza NoBranchAvailableError sin candidatas', () => {
    expect(() => strategy.selectBranch(request([{ productId: 'x', quantity: 1 }]), []),
    ).toThrow(NoBranchAvailableError);
  });

  it('ante empate de distancia gana el id menor, sin importar el orden de entrada', () => {
    const a = branch('a', -35, -60);
    const b = branch('b', -35, -60);
    const req = request([{ productId: 'x', quantity: 1 }]);
    const forward = strategy.selectBranch(req, [
      candidate(b, { x: 1 }),
      candidate(a, { x: 1 }),
    ]);
    const backward = strategy.selectBranch(req, [
      candidate(a, { x: 1 }),
      candidate(b, { x: 1 }),
    ]);
    expect(forward.id).toBe('a');
    expect(backward.id).toBe('a');
  });

  it('no modifica el arreglo de candidatas que recibe', () => {
    const candidates = [
      candidate(baires, { x: 1 }),
      candidate(pampa, { x: 1 }),
    ];
    strategy.selectBranch(
      request([{ productId: 'x', quantity: 1 }]),
      candidates,
    );
    expect(candidates.map((c) => c.branch.id)).toEqual(['baires', 'pampa']);
  });
});
