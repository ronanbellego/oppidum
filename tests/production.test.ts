import { describe, it, expect } from 'vitest';
import { used, freeFor, stockOf, take, putAny, findDepot, fillMarketBasket, MARKET_LOAD } from '../src/sim/stock';
import { workshopStep, RETRY_TICKS } from '../src/sim/production';
import { roadSearch } from '../src/sim/paths';
import { access } from '../src/sim/query';
import { B } from '../src/data/buildings';
import { TER } from '../src/world/terrain';
import { idx } from '../src/core/hex';
import { blankState, addBuilding } from './helpers';

describe('stocks', () => {
  it('additionne et retire dans les dépôts', () => {
    const s = blankState();
    const g1 = addBuilding(s, 'granary', { stock: { ble: 30 } });
    const g2 = addBuilding(s, 'granary', { stock: { ble: 50, porc: 5 } });
    expect(stockOf(s, 'ble')).toBe(80);
    expect(take(s, 'ble', 40)).toBe(true);
    expect(g1.stock.ble).toBe(0);
    expect(g2.stock.ble).toBe(40);
    expect(take(s, 'ble', 100)).toBe(false);
    expect(stockOf(s, 'ble')).toBe(0);
  });

  it('ne range une ressource que dans un dépôt qui l’accepte, sans dépasser sa capacité', () => {
    const s = blankState();
    const g = addBuilding(s, 'granary', { stock: { ble: B.granary.cap! - 10 } });
    const st = addBuilding(s, 'store');
    expect(freeFor(g, 'ble')).toBe(10);
    expect(freeFor(g, 'bois')).toBe(0);
    expect(putAny(s, 'ble', 25)).toBe(15);
    expect(used(g)).toBe(B.granary.cap);
    expect(putAny(s, 'bois', 12)).toBe(0);
    expect(st.stock.bois).toBe(12);
  });

  it('remplit le panier d’une marchande, sans dépasser ce qu’elle porte', () => {
    const s = blankState();
    addBuilding(s, 'granary', { stock: { ble: 200, porc: 10 } });
    addBuilding(s, 'store', { stock: { cervoise: 3 } });
    const c = fillMarketBasket(s)!;
    expect(c).toEqual({ ble: MARKET_LOAD.food, porc: 10, cervoise: 3, torques: 0 });
    expect(stockOf(s, 'ble')).toBe(200 - MARKET_LOAD.food);
    expect(fillMarketBasket(blankState())).toBeNull();
  });
});

describe('chemins et livraisons', () => {
  it('trouve le plus court trajet sur les chemins', () => {
    const s = blankState();
    for (let x = 5; x <= 15; x++) s.road[idx(x, 10)] = 1;
    const r = roadSearch(s, idx(5, 10), i => (i === idx(15, 10) ? 'arrivé' : 0))!;
    expect(r.val).toBe('arrivé');
    expect(r.path).toHaveLength(11);
    expect(roadSearch(s, idx(5, 10), i => (i === idx(20, 20) ? 1 : 0))).toBeNull();
  });

  it('envoie le porteur vers un dépôt relié qui a de la place', () => {
    const s = blankState();
    const farm = addBuilding(s, 'farm', { x: 6, y: 20, road: false });
    const g = addBuilding(s, 'granary', { x: 16, y: 20, road: false });
    for (let x = 4; x <= 20; x++) s.road[idx(x, 22)] = 1;
    const from = access(s, farm);
    expect(from.length).toBeGreaterThan(0);
    expect(findDepot(s, from, 'ble')?.val).toBe(g.id);
    expect(findDepot(s, from, 'bois')).toBeNull();
    g.stock.ble = B.granary.cap!;
    expect(findDepot(s, from, 'ble')).toBeNull();
  });
});

describe('ateliers', () => {
  it('produit un lot au bout du temps prévu quand tous les postes sont pourvus', () => {
    const s = blankState();
    const farm = addBuilding(s, 'farm');
    let shipped = 0;
    for (let k = 0; k < B.farm.time!; k++) if (workshopStep(s, farm, 1)) shipped++;
    expect(shipped).toBe(1);
    expect(farm.hold).toBe(B.farm.batch);
    expect(farm.status).toBe('Au travail');
  });

  it('va deux fois moins vite avec la moitié des ouvriers', () => {
    const s = blankState();
    const farm = addBuilding(s, 'farm');
    for (let k = 0; k < B.farm.time! - 1; k++) workshopStep(s, farm, 0.5);
    expect(farm.hold ?? 0).toBe(0);
    expect(farm.status).toBe('Travaille au ralenti, faute de bras');
  });

  it('ne fait rien sans ouvriers', () => {
    const s = blankState();
    const farm = addBuilding(s, 'farm');
    expect(workshopStep(s, farm, 0)).toBe(false);
    expect(farm.prog ?? 0).toBe(0);
  });

  it('attend ses matières premières, puis les prend au début du lot', () => {
    const s = blankState();
    const brew = addBuilding(s, 'brew');
    workshopStep(s, brew, 1);
    expect(brew.status).toMatch(/En attente de blé/);
    addBuilding(s, 'granary', { stock: { ble: 10 } });
    workshopStep(s, brew, 1);
    expect(stockOf(s, 'ble')).toBe(10 - B.brew.inp!.ble);
    expect(brew.loaded).toBe(true);
  });

  it('exige la ressource naturelle à proximité', () => {
    const s = blankState();
    const wood = addBuilding(s, 'wood', { x: 20, y: 20 });
    workshopStep(s, wood, 1);
    expect(wood.status).toBe('Ressource naturelle hors de portée');
    s.ter[idx(22, 20)] = TER.forest;
    workshopStep(s, wood, 1);
    expect(wood.status).toBe('Au travail');
  });

  it('retente la livraison d’un lot en attente à intervalles réguliers', () => {
    const s = blankState();
    const farm = addBuilding(s, 'farm', { hold: 10, cartOut: false });
    s.tick = RETRY_TICKS * 3;
    expect(workshopStep(s, farm, 1)).toBe(true);
    s.tick++;
    expect(workshopStep(s, farm, 1)).toBe(false);
    farm.cartOut = true;
    s.tick = RETRY_TICKS * 4;
    expect(workshopStep(s, farm, 1)).toBe(false);
  });
});

