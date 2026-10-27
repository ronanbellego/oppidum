/** Définition d'un bâtiment ou d'un outil de la barre de construction. */
export interface BuildingDef {
  /** Nom affiché. */
  n: string;
  /** Description affichée dans l'aide. */
  d: string;
  /** Couleur de la pastille dans la barre d'outils. */
  c: string;
  /** Coût en statères (par case pour les chemins et les remparts). */
  cost?: number;
  /** Taille d'emprise : 1, 2 (trois hexagones) ou 3 (sept hexagones). Absente pour les outils. */
  s?: 1 | 2 | 3;
  /** Postes de travail. */
  jobs?: number;
  /** Ressource produite, taille d'un lot et durée de production en pas. */
  out?: string;
  batch?: number;
  time?: number;
  /** Ressources consommées par lot. */
  inp?: Record<string, number>;
  /** Terrain qui doit se trouver à proximité. */
  near?: 'forest' | 'rock';
  /** Ressources stockées et capacité. */
  store?: string[];
  cap?: number;
  /** Type de marcheur envoyé en tournée. */
  roam?: string;
  /** Dieu honoré par un temple. */
  god?: 'taranis' | 'belenos' | 'epona';
  /** Matériaux nécessaires à un monument. */
  mon?: Record<string, number>;
}

export interface HouseLevel {
  /** Nom du niveau. */
  n: string;
  /** Habitants au plus. */
  cap: number;
  /** Tribut mensuel par habitant, au taux normal. */
  tax: number;
}

export interface Resource {
  n: string;
  /** Couleur de la ressource sur les charrettes et les jauges. */
  c: string;
  /** Prix de vente unitaire aux marchands. */
  p: number;
}
