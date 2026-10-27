/** Taille de la carte, en hexagones de côté. */
export const N = 48;
/** Nombre de pas de simulation par mois de jeu. */
export const MONTH = 60;
/** Vitesse de déplacement des marcheurs, en fraction de case par pas. */
export const WS = 0.16;
/** Nombre de pas d'une tournée de marcheur avant le retour au bâtiment. */
export const MAXSTEP = 26;

/** Réglages d'équilibrage regroupés. */
export const BAL = {
  /** Part des habitants qui travaillent. */
  laborShare: 0.5,
  /** Salaire mensuel par travailleur employé, en statères. */
  wage: 0.2,
  /** Taille maximale d'un groupe de migrants. */
  immigrantGroup: 4,
  /** Nombre de mois de tribut qu'une maison peut accumuler. */
  taxCapMonths: 12,
  /** Coût d'une fête en l'honneur des dieux. */
  festival: 200,
  /** Population à partir de laquelle les raids commencent. */
  raidMinPop: 40,
} as const;
