// @ts-nocheck — à typer (en cours).
import { RES } from '../data/resources';
import { A } from '../app/state';
import { W } from './projection';
import { OUT, P, ln, sh } from './kit';

function smoke(x, y, z, time, c) {
  for (let k = 0; k < 4; k++) {
    const ph = (time / 1800 + k / 4) % 1;
    const [px, py] = W(x, y, z + ph * 34);
    A.g.fillStyle = c === 'k' ? `rgba(90,88,84,${0.42 * (1 - ph)})` : `rgba(215,210,198,${0.38 * (1 - ph)})`;
    A.g.beginPath();
    A.g.arc(px + Math.sin(ph * 5 + k) * 5 + ph * 6, py, 3 + ph * 7, 0, 7);
    A.g.fill();
  }
}
function figure(px, py, ph, body, kind) {
  A.g.fillStyle = 'rgba(0,0,0,.28)';
  A.g.beginPath();
  A.g.ellipse(px + 1.5, py, 4.5, 1.8, 0, 0, 7);
  A.g.fill();
  const sw = Math.sin(ph) * 2.2;
  ln([px - 1, py - 5], [px - 1 + sw, py], '#3a2614', 1.4);
  ln([px + 1, py - 5], [px + 1 - sw, py], '#3a2614', 1.4);
  const long = kind === 'druid' || kind === 'priest';
  P(
    [
      [px - 3, py - 12],
      [px + 3, py - 12],
      [px + 3.8, long ? py - 1 : py - 4.5],
      [px - 3.8, long ? py - 1 : py - 4.5],
    ],
    body,
  );
  P(
    [
      [px, py - 12],
      [px + 3, py - 12],
      [px + 3.8, long ? py - 1 : py - 4.5],
      [px, long ? py - 1 : py - 4.5],
    ],
    'rgba(0,0,0,.2)',
  );
  ln([px - 3.2, py - 7.5], [px + 3.4, py - 7.5], '#3a2614', 0.9);
  A.g.fillStyle = '#e2c4a0';
  A.g.beginPath();
  A.g.arc(px, py - 14.5, 2.5, 0, 7);
  A.g.fill();
  A.g.fillStyle = kind === 'druid' ? '#f2f0e8' : '#8a5a2a';
  A.g.beginPath();
  A.g.arc(px, py - 15.4, 2.6, Math.PI, 0);
  A.g.fill();
  if (kind === 'druid') {
    ln([px + 4, py], [px + 5, py - 19], '#6b4626', 1.1);
    A.g.fillStyle = '#d9e8a0';
    A.g.beginPath();
    A.g.arc(px + 5, py - 19, 1.5, 0, 7);
    A.g.fill();
  } else if (kind === 'market') {
    A.g.fillStyle = '#a7834e';
    A.g.beginPath();
    A.g.ellipse(px, py - 18, 4.5, 2, 0, 0, 7);
    A.g.fill();
    A.g.fillStyle = '#e2c25e';
    A.g.beginPath();
    A.g.arc(px - 1, py - 19.5, 1.4, 0, 7);
    A.g.arc(px + 1.5, py - 19.5, 1.3, 0, 7);
    A.g.fill();
  } else if (kind === 'bard') {
    A.g.strokeStyle = '#d9a24a';
    A.g.lineWidth = 1;
    A.g.beginPath();
    A.g.moveTo(px + 3, py - 6);
    A.g.lineTo(px + 7, py - 13);
    A.g.lineTo(px + 4, py - 12);
    A.g.closePath();
    A.g.stroke();
  } else if (kind === 'tax') {
    A.g.fillStyle = '#d9a24a';
    A.g.beginPath();
    A.g.arc(px + 3.8, py - 6, 1.8, 0, 7);
    A.g.fill();
  } else if (kind === 'immigrant') {
    A.g.fillStyle = '#8c7a5c';
    A.g.beginPath();
    A.g.ellipse(px - 3, py - 10, 3, 3.6, 0, 0, 7);
    A.g.fill();
    ln([px - 5, py - 13], [px + 2, py - 11], '#5a3a1e', 0.8);
  }
}
function cartFig(px, py, ph, res) {
  A.g.fillStyle = 'rgba(0,0,0,.28)';
  A.g.beginPath();
  A.g.ellipse(px + 6, py, 9, 2.4, 0, 0, 7);
  A.g.fill();
  P(
    [
      [px + 1, py - 9],
      [px + 12, py - 9],
      [px + 12, py - 4],
      [px + 1, py - 4],
    ],
    '#7a5232',
    OUT,
    0.6,
  );
  A.g.fillStyle = RES[res].c;
  A.g.beginPath();
  A.g.ellipse(px + 6.5, py - 10, 5, 2.4, 0, 0, 7);
  A.g.fill();
  A.g.strokeStyle = '#3a2614';
  A.g.lineWidth = 1.2;
  A.g.beginPath();
  A.g.arc(px + 8, py - 3, 3, 0, 7);
  A.g.stroke();
  ln([px + 1, py - 7], [px - 2, py - 8], '#5a3a1e', 1);
  figure(px - 4, py, ph, '#7b5a38', 'cart');
}
function unitFig(u, px, py, ph) {
  const en = u.k === 'enemy';
  figure(px, py, ph, en ? '#5d6b3c' : '#3f66a3', 'soldier');
  if (en) {
    ln([px + 3, py - 2], [px + 5, py - 21], '#6b4626', 1);
    P(
      [
        [px + 4.2, py - 21],
        [px + 5.8, py - 21],
        [px + 5, py - 24.5],
      ],
      '#cfd3d8',
    );
    A.g.fillStyle = '#7a5232';
    A.g.beginPath();
    A.g.ellipse(px - 3.6, py - 8, 3.2, 4.2, 0, 0, 7);
    A.g.fill();
    A.g.strokeStyle = '#3a2614';
    A.g.lineWidth = 0.6;
    A.g.stroke();
  } else {
    A.g.fillStyle = '#d9c27a';
    A.g.beginPath();
    A.g.ellipse(px - 3.6, py - 8, 2.6, 5, 0, 0, 7);
    A.g.fill();
    A.g.strokeStyle = '#b4553f';
    A.g.lineWidth = 1;
    A.g.stroke();
    ln([px + 3, py - 7], [px + 6, py - 15], '#d8dde2', 1.3);
  }
  if (u.hp < u.max) {
    A.g.fillStyle = 'rgba(0,0,0,.6)';
    A.g.fillRect(px - 6, py - 29, 12, 2.6);
    A.g.fillStyle = en ? '#de6a4e' : '#86b86a';
    A.g.fillRect(px - 6, py - 29, 12 * Math.max(0, u.hp / u.max), 2.6);
  }
}
function shipFig(px, py, s, hull, sail, time, ph) {
  const b = Math.sin(time / 700 + ph) * 1.6;
  py += b;
  A.g.fillStyle = 'rgba(20,36,46,.35)';
  A.g.beginPath();
  A.g.ellipse(px + 3 * s, py + 3 * s, 26 * s, 6 * s, 0, 0, 7);
  A.g.fill();
  const H = [
    [px - 24 * s, py - 12 * s],
    [px - 18 * s, py - 2 * s],
    [px + 16 * s, py - 2 * s],
    [px + 24 * s, py - 13 * s],
    [px + 18 * s, py - 7 * s],
    [px - 17 * s, py - 7 * s],
  ];
  P([H[0], H[5], H[4], H[3], H[2], H[1]], hull);
  P([H[5], H[4], H[3], [px + 22 * s, py - 14 * s], [px - 22 * s, py - 13 * s]], sh(hull, 1.25));
  P(
    [
      [px - 24 * s, py - 12 * s],
      [px - 27 * s, py - 22 * s],
      [px - 22 * s, py - 13 * s],
    ],
    sh(hull, 0.85),
  );
  P(
    [
      [px + 24 * s, py - 13 * s],
      [px + 27 * s, py - 24 * s],
      [px + 22 * s, py - 14 * s],
    ],
    sh(hull, 0.85),
  );
  ln([px, py - 8 * s], [px, py - 46 * s], '#3a2a1c', 1.6 * s);
  P(
    [
      [px - 13 * s, py - 42 * s],
      [px + 13 * s, py - 43 * s],
      [px + 12 * s, py - 18 * s],
      [px - 12 * s, py - 17 * s],
    ],
    sail,
  );
  P(
    [
      [px, py - 42.5 * s],
      [px + 13 * s, py - 43 * s],
      [px + 12 * s, py - 18 * s],
      [px, py - 17.5 * s],
    ],
    sh(sail, 0.82),
  );
  for (const y of [-36, -29, -22]) ln([px - 12.5 * s, py + y * s], [px + 12.5 * s, py + (y - 0.6) * s], sh(sail, 0.6), 0.5);
}

export { cartFig, figure, shipFig, smoke, unitFig };
