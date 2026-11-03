import type { Coordinates } from '../../shared/geo/coordinates.js';

export interface Branch {
  id: string;
  name: string;
  location: Coordinates;
}
