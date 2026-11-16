import { NoDeliveryPersonAvailableError } from '../../shared/errors.js';
import { FewestTripsDeliveryStrategy } from './delivery-assignment.js';

describe('FewestTripsDeliveryStrategy', () => {
  const strategy = new FewestTripsDeliveryStrategy();

  it('elige a quien completó menos viajes', () => {
    const chosen = strategy.select([
      { id: 'a', completedTrips: 4 },
      { id: 'b', completedTrips: 1 },
      { id: 'c', completedTrips: 2 },
    ]);

    expect(chosen.id).toBe('b');
  });

  it('ante un empate gana el id menor, sin importar el orden de entrada', () => {
    const empatados = [
      { id: 'z', completedTrips: 0 },
      { id: 'm', completedTrips: 0 },
    ];

    expect(strategy.select(empatados).id).toBe('m');
    expect(strategy.select([...empatados].reverse()).id).toBe('m');
  });

  it('falla si no hay nadie libre', () => {
    expect(() => strategy.select([])).toThrow(NoDeliveryPersonAvailableError);
  });
});
