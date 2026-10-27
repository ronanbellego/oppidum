/** Bruit de valeur lissé, sur une grille grossière de sz × sz cellules étirée sur toute la carte. */
import { N } from '../core/constants';

export interface NoiseField {
  sz: number;
  values: number[];
}

/** Tire (sz + 1)² valeurs. L'ordre des tirages compte : il garantit qu'une graine donne toujours la même île. */
export function noiseField(sz: number, rand: () => number): NoiseField {
  const values: number[] = [];
  for (let i = 0; i < (sz + 1) * (sz + 1); i++) values.push(rand());
  return { sz, values };
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Valeur du bruit en (x, y), entre 0 et 1. */
export function sample(f: NoiseField, x: number, y: number): number {
  const { sz, values: a } = f;
  const fx = (x / N) * sz, fy = (y / N) * sz;
  const ix = Math.floor(fx), iy = Math.floor(fy);
  const u = smooth(fx - ix), v = smooth(fy - iy), w = sz + 1;
  return (
    a[iy * w + ix] * (1 - u) * (1 - v) +
    a[iy * w + ix + 1] * u * (1 - v) +
    a[(iy + 1) * w + ix] * (1 - u) * v +
    a[(iy + 1) * w + ix + 1] * u * v
  );
}
