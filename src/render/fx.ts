// @ts-nocheck — affichage et interface extraits de la version mono-fichier ; à typer progressivement.
import { N } from '../core/constants';
import { HX, HY } from '../core/hex';
import { A } from '../app/state';
import { ctx } from '../app/dom';
import { W, ZW } from './projection';
import { ln } from './kit';
import { shipFig } from './units';

/* ---------- défense : remparts, unités, raids (voir sim/defense.ts) ---------- */
const FX = [];
function drawFX(time) {
  for (const f of FX) {
    if (f.k === 'ship' || f.k === 'raider') {
      const d = f.d,
        dx = HX(d) - N / 2,
        dy = HY(d) - N * 0.433,
        n = Math.hypot(dx, dy) || 1;
      let o = 0;
      if (f.k === 'ship') {
        const t = 300 - f.t;
        o = t < 120 ? (1 - t / 120) * 9 : t > 180 ? ((t - 180) / 120) * 9 : 0;
      }
      const [px, py] = W(HX(d) + (dx / n) * o, HY(d) + (dy / n) * o, ZW);
      if (f.k === 'ship') shipFig(px, py, 0.9, '#5a4030', '#9a6a44', time, 1);
      else shipFig(px, py, 0.9, '#33261c', '#4a2e28', time, 2);
      continue;
    }
    if (f.k === 'arrow') {
      const a = W(f.x0, f.y0, 30),
        b = W(f.x1, f.y1, 9),
        t = 1 - f.t / 6;
      const x = a[0] + (b[0] - a[0]) * t,
        y = a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * 10;
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        n = Math.hypot(dx, dy) || 1;
      ln([x, y], [x - (dx / n) * 6, y - (dy / n) * 6], '#f0e6c8', 1.2);
    } else if (f.k === 'bolt') {
      const [bx, by] = W(f.x, f.y);
      ctx.globalAlpha = Math.min(1, f.t / 6);
      A.g.strokeStyle = '#e8f0ff';
      A.g.lineWidth = 2.2;
      A.g.beginPath();
      let x = bx + (((f.t * 37) % 20) - 10),
        y = by - 220;
      A.g.moveTo(x, y);
      while (y < by - 4) {
        y += 22;
        x += ((y * 13) % 17) - 8;
        A.g.lineTo(y > by ? bx : x, Math.min(y, by));
      }
      A.g.stroke();
      A.g.fillStyle = 'rgba(220,235,255,.5)';
      A.g.beginPath();
      A.g.arc(bx, by - 4, 14, 0, 7);
      A.g.fill();
      ctx.globalAlpha = 1;
    } else if (f.k === 'fire') {
      for (let k = 0; k < 5; k++) {
        const ph = (time / 900 + k / 5) % 1;
        const [px, py] = W(f.x, f.y, 8 + ph * 40);
        A.g.fillStyle = `rgba(${k % 2 ? '240,120,40' : '70,66,60'},${0.5 * (1 - ph) * Math.min(1, f.t / 30)})`;
        A.g.beginPath();
        A.g.arc(px + Math.sin(ph * 6 + k) * 8, py, 5 + ph * 10, 0, 7);
        A.g.fill();
      }
    }
  }
}

export { FX, drawFX };
