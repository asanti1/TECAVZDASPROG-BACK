import { BranchNotFoundError } from '../../shared/errors.js';
import { InMemoryBranchRepository, InMemoryDatabase, InMemoryProductRepository } from '../../../test/support/in-memory-database.js';
import { BranchesService } from './branches.service.js';

describe('BranchesService.listBranchProducts', () => {
  const db = new InMemoryDatabase();
  db.addBranch(
    { id: 'b1', name: 'Uno', location: { latitude: 0, longitude: 0 } },
    { p1: 5, p2: 0 },
  );
  db.addBranch(
    { id: 'b2', name: 'Dos', location: { latitude: 1, longitude: 1 } },
    { p1: 9 },
  );
  const service = new BranchesService(new InMemoryBranchRepository(db), new InMemoryProductRepository(db));

  it('devuelve solo los productos con registro de stock en esa sucursal', async () => {
    const products = await service.listBranchProducts('b2');
    expect(products).toEqual([expect.objectContaining({ id: 'p1', quantity: 9 })]);
  });

  it('incluye productos con stock cero de la sucursal', async () => {
    const products = await service.listBranchProducts('b1');
    expect(products.map((p) => [p.id, p.quantity])).toEqual([
      ['p1', 5],
      ['p2', 0],
    ]);
  });

  it('falla si la sucursal no existe', async () => {
    await expect(service.listBranchProducts('nope')).rejects.toBeInstanceOf(BranchNotFoundError);
  });
});
