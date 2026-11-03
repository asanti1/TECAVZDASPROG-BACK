import { haversineKm } from './haversine.js';

describe('haversineKm', () => {
  it('es 0 entre un punto y sí mismo', () => {
    const p = { latitude: -34.6, longitude: -58.4 };
    expect(haversineKm(p, p)).toBe(0);
  });

  it('un grado de longitud sobre el ecuador son ~111.19 km', () => {
    const a = { latitude: 0, longitude: 0 };
    const b = { latitude: 0, longitude: 1 };
    expect(haversineKm(a, b)).toBeCloseTo(111.19, 1);
  });

  it('es simétrica', () => {
    const a = { latitude: -34.6, longitude: -58.4 };
    const b = { latitude: -36.6, longitude: -64.3 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 10);
  });
});
