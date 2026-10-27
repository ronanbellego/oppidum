/** Couleurs d'Armorique : marcheurs, terrains, encre du trait, matériaux des bâtiments. */

/** Tunique de chaque marcheur (le prêtre prend la couleur de son dieu). */
export const WALK: Record<string, string> = { priest: '#ddd', market: '#d9a24a', druid: '#efeee6', bard: '#c0583f', tax: '#6a8cc4', immigrant: '#a59a88', cart: '#7b5a38' };

/** Terrains : g prairie, l lande, f forêt, r rochers, w mer profonde, s haut-fond. */
export const TCOL: Record<string, string> = { g: '#7b9467', l: '#7f7a66', f: '#4b5a45', r: '#8f837d', w: '#2f4a58', s: '#46666f' };

/** Encre du trait de crayon. */
export const INK = '#2a241c';

/** Matériaux des bâtiments : chaux, granit rose, ardoise, chaume, bois, guède, ajonc… */
export const AC = {
  chaux: '#f3ede1', granit: '#d9bdb1', granitD: '#b99d93', ardoise: '#687c96', chaume: '#d9b062', bois: '#8e6847', boisC: '#b48a5c',
  guede: '#4a7db8', ajonc: '#ecc63f', bruyere: '#a676aa', ocre: '#cc5b3e', mousse: '#6ea56f', terre: '#b8a07a', pave: '#d3c8b6', fer: '#7d8896', mer: '#4f9aa0',
} as const;
