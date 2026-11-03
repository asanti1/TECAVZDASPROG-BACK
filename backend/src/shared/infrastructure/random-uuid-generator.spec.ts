import { RandomUuidGenerator } from './random-uuid-generator.js';

describe('RandomUuidGenerator', () => {
  it('genera UUID v4 distintos', () => {
    const gen = new RandomUuidGenerator();
    const a = gen.newId();
    const b = gen.newId();
    expect(a).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(a).not.toBe(b);
  });
});
