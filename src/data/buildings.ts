import type { BuildingDef } from './types';

/** Bâtiments et outils, par identifiant. */

export const B: Record<string, BuildingDef> = {
  inspect:{n:'Observer',c:'#a5a38d',d:"Cliquez sur un bâtiment pour voir son état. Faites glisser pour déplacer la vue, molette ou pincement pour zoomer."},
  road:{n:'Chemin',cost:2,c:'#b39563',d:"Faites glisser pour tracer. Porteurs et marcheurs ne circulent que sur les chemins. 4 st. à travers bois, 20 st. pour un pont."},
  demolish:{n:'Démolir',cost:0,c:'#de6a4e',d:"Faites glisser pour raser une zone. Rien n'est remboursé."},
  hut:{n:'Hutte',cost:10,s:1,c:'#c9a24e',d:"Parcelle d'habitation. Les familles arrivent par le chemin d'entrée à l'ouest. La maison grandit selon ce qu'elle reçoit."},
  well:{n:'Puits',cost:15,s:1,jobs:0,c:'#7f9bb5',d:"Donne l'eau aux maisons dans un rayon de 3 cases. Nécessaire pour passer en maison de torchis."},
  farm:{n:'Champ de blé',cost:40,s:2,jobs:4,out:'ble',batch:10,time:40,c:'#d9b44a',d:"Produit du blé. Un porteur l'emmène au grenier par les chemins."},
  pigs:{n:'Porcherie',cost:50,s:2,jobs:4,out:'porc',batch:8,time:42,c:'#e3a0a0',d:"Élève des porcs. Une demeure noble veut du blé et du porc."},
  granary:{n:'Grenier',cost:60,s:2,jobs:2,store:['ble','porc'],cap:400,c:'#a07c52',d:"Stocke blé et porc (400 unités). Le marché s'y approvisionne."},
  market:{n:'Marché',cost:50,s:2,jobs:2,roam:'market',c:'#c9923f',d:"Une marchande parcourt les chemins et livre nourriture, cervoise et torques aux maisons à 2 cases."},
  wood:{n:'Bûcheron',cost:25,s:1,jobs:3,out:'bois',batch:6,time:40,near:'forest',c:'#94643a',d:"Coupe du bois. Doit se trouver à 2 cases d'une forêt."},
  mine:{n:'Mine de fer',cost:60,s:2,jobs:4,out:'fer',batch:5,time:50,near:'rock',c:'#9aa0aa',d:"Extrait du minerai de fer. Doit toucher des rochers."},
  brew:{n:'Brasserie',cost:70,s:2,jobs:4,inp:{ble:6},out:'cervoise',batch:6,time:30,c:'#d58c2c',d:"Brasse la cervoise avec 6 blé pris au grenier. Les longues maisons en réclament."},
  forge:{n:'Forge',cost:90,s:2,jobs:5,inp:{fer:4,bois:2},out:'torques',batch:3,time:60,c:'#f0c419',d:"Forge des torques avec 4 fer et 2 bois. Indispensables aux demeures nobles."},
  store:{n:'Entrepôt',cost:60,s:2,jobs:2,store:['bois','fer','pierre','cervoise','torques'],cap:400,c:'#8f7350',d:"Stocke bois, fer, pierre, cervoise et torques (400 unités)."},
  grove:{n:'Nemeton',cost:80,s:2,jobs:2,roam:'druid',c:'#e8e6dc',d:"Bois sacré. Un druide visite les maisons : culte requis pour la longue maison, et faveur de Toutatis."},
  bard:{n:'Cercle des bardes',cost:60,s:2,jobs:3,roam:'bard',c:'#c0583f',d:"Un barde chante les exploits du clan dans les rues. Requis pour la demeure noble."},
  chief:{n:'Maison du chef',cost:100,s:2,jobs:3,roam:'tax',c:'#6a8cc4',d:"Un collecteur passe dans les rues et lève le tribut des maisons qu'il croise."},
  trade:{n:'Comptoir',cost:120,s:2,jobs:3,c:'#4f78b0',d:"Les marchands grecs de Massalia achètent chaque mois les surplus que vous cochez (au-delà de 30 unités)."},
  port:{n:'Port',cost:0,s:2,jobs:3,c:'#5a7a8c',d:"Le port du clan. Les familles y débarquent, et les navires marchands y accostent chaque mois pour acheter vos surplus."},
  quarry:{n:'Carrière',cost:50,s:1,jobs:3,out:'pierre',batch:6,time:45,near:'rock',c:'#b0aa98',d:"Taille des blocs de pierre. Doit toucher des rochers. La pierre sert aux monuments."},
  wall:{n:'Rempart',cost:6,c:'#8c7f66',d:"Faites glisser pour élever un murus gallicus (6 st. par case). Tracé sur un chemin, il devient une porte (15 st.) que vos marcheurs franchissent et que l'ennemi doit enfoncer."},
  tower:{n:'Tour de guet',cost:45,s:1,jobs:2,c:'#7a5a38',d:"Ses archers tirent sur les pillards à 4 cases."},
  barracks:{n:'Caserne',cost:120,s:2,jobs:4,c:'#9c4a3a',d:"Arme un guerrier avec 2 fer pris à l'entrepôt, jusqu'à 6. Les guerriers attaquent les pillards puis rentrent."},
  t_taranis:{n:'Temple de Taranis',cost:150,s:2,jobs:3,roam:'priest',god:'taranis',c:'#7d93b8',d:"Fanum du dieu du tonnerre. Son prêtre assure le culte des maisons. Satisfait, Taranis foudroie les pillards."},
  t_belenos:{n:'Temple de Bélénos',cost:150,s:2,jobs:3,roam:'priest',god:'belenos',c:'#e0b43c',d:"Fanum du dieu solaire. Son prêtre assure le culte. Satisfait, Bélénos offre des moissons abondantes."},
  t_epona:{n:"Temple d'Épona",cost:150,s:2,jobs:3,roam:'priest',god:'epona',c:'#b0643a',d:"Fanum de la déesse des chevaux. Son prêtre assure le culte. Satisfaite, elle attire les familles et fait monter les prix de vente."},
  menhirs:{n:'Alignement de menhirs',cost:200,s:3,jobs:8,mon:{pierre:80,bois:20},c:'#a8a497',d:"Monument, 3×3. Il faut 80 pierre et 20 bois. Achevé, il élève la faveur de tous les dieux et assure le culte des maisons à 7 cases."},
  tumulus:{n:'Tumulus royal',cost:250,s:3,jobs:8,mon:{pierre:40,bois:50,torques:10},c:'#7d9a52',d:"Monument, 3×3. Il faut 40 pierre, 50 bois et 10 torques. Achevé, le tribut rapporte un quart de plus et le chômage ne freine plus les arrivées."},
  heroes:{n:'Sanctuaire des héros',cost:250,s:3,jobs:8,mon:{pierre:30,bois:30,fer:30},c:'#c8b07a',d:"Monument, 3×3, orné de trophées d'armes. Il faut 30 pierre, 30 bois et 30 fer. Achevé, vos guerriers frappent plus fort et résistent mieux."}
};
/** Couleur de chaque dieu (prêtres, temples). */
export const GODC: Record<string, string> = {taranis:'#7d93b8',belenos:'#e0b43c',epona:'#b0643a'};
/** Groupes de la barre de construction. */
export const TOOLS: [string, string[]][] = [
  ['Terrain',['inspect','road','demolish']],
  ['Habitat',['hut','well']],
  ['Vivres',['farm','pigs','granary','market']],
  ['Artisanat',['wood','quarry','mine','brew','forge','store']],
  ['Défense',['wall','tower','barracks']],
  ['Sacré',['grove','t_taranis','t_belenos','t_epona']],
  ['Vie du clan',['bard','chief']],
  ['Monuments',['menhirs','tumulus','heroes']]
];

