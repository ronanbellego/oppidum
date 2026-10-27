/**
 * Ordre dans lequel les postes de travail sont pourvus. Les secteurs passent dans l'ordre de SECT ;
 * à l'intérieur d'un secteur, SUB fait passer les bâtiments de distribution avant les producteurs,
 * pour qu'un grenier plein n'affame pas le marché.
 */
export const SECT = ['Tribut', 'Vivres', 'Artisanat', 'Défense', 'Vie du clan'] as const;

/** Secteur de chaque bâtiment employeur (indice dans SECT). */
export const PRIO: Record<string, number> = {
  port: 0, chief: 0,
  farm: 1, pigs: 1, granary: 1, market: 1,
  wood: 2, quarry: 2, mine: 2, brew: 2, forge: 2, store: 2,
  tower: 3, barracks: 3,
  grove: 4, bard: 4, trade: 4, t_taranis: 4, t_belenos: 4, t_epona: 4, menhirs: 4, tumulus: 4, heroes: 4,
};

/** Rang à l'intérieur d'un secteur ; les bâtiments absents passent en dernier (rang 3). */
export const SUB: Record<string, number> = { market: 0, granary: 1, store: 1 };
