/* chiffrage.js
   Formules de chiffrage pures et persistance des paramètres métier.
   Compatible navigateur et Node (pour les tests). */

const DEVIS_PARAMS_STORAGE_KEY = 'devis-params-v1';

const DEFAULT_DEVIS_PARAMS = {
  materials: [
    { code: 'GA20/10', priceM2: 19.50 },
    { code: 'AC15', priceM2: 13.50 },
    { code: 'AC10', priceM2: 8.50 }
  ],
  coeffChute: 0.9,
  coeffTransport: 0.88,
  coeffMarge: 0.7,
  prixMoSec: 0.017,
  prixPliageM2: 15.00
};

function toNum(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function cloneDefaultParams() {
  return {
    ...DEFAULT_DEVIS_PARAMS,
    materials: DEFAULT_DEVIS_PARAMS.materials.map(m => ({ ...m }))
  };
}

function mergeParams(saved) {
  const base = cloneDefaultParams();
  if (!saved || typeof saved !== 'object') return base;
  const merged = { ...base, ...saved };
  if (Array.isArray(saved.materials)) {
    merged.materials = saved.materials
      .filter(m => m && (m.code !== undefined))
      .map(m => ({ code: String(m.code), priceM2: toNum(m.priceM2, 0) }));
  } else {
    merged.materials = base.materials;
  }
  ['coeffChute', 'coeffTransport', 'coeffMarge', 'prixMoSec', 'prixPliageM2'].forEach(k => {
    merged[k] = toNum(saved[k], base[k]);
  });
  return merged;
}

function findMaterialPrice(code, params) {
  if (!code) return null;
  const target = String(code).trim().toLowerCase();
  if (!target) return null;
  const list = (params && params.materials) || [];
  const found = list.find(m => String(m.code).trim().toLowerCase() === target);
  return found ? toNum(found.priceM2, 0) : null;
}

function computeChiffrage(row, params) {
  const longueur = toNum(row.length, 0);
  const developpe = toNum(row.developed, 0);
  const quantity = Math.max(toNum(row.quantity, 1), 0);
  const nbPlis = Math.max(toNum(row.bends, 0), 0);
  const tempsParPliSec = Math.max(toNum(row.tempsParPliSec, 0), 0);
  const soudureCost = Math.max(toNum(row.soudureCost, 0), 0);

  let surfaceUnit = toNum(row.surfaceUnit, 0);
  if (!surfaceUnit && longueur && developpe) {
    surfaceUnit = (longueur * developpe) / 1000000;
  }
  const surfaceTotal = surfaceUnit * quantity;

  const matPrice = findMaterialPrice(row.material, params);
  const matPriceSafe = matPrice == null ? 0 : matPrice;
  const coeffChute = toNum(params && params.coeffChute, 1) || 1;
  const coeffTransport = toNum(params && params.coeffTransport, 1) || 1;
  const coeffMarge = toNum(params && params.coeffMarge, 1) || 1;
  const prixPliageM2 = toNum(params && params.prixPliageM2, 0);
  const prixMoSec = toNum(params && params.prixMoSec, 0);

  const mat = surfaceUnit * matPriceSafe / coeffChute;
  const pl = surfaceUnit * prixPliageM2;
  const mo = nbPlis * tempsParPliSec * prixMoSec;
  const pr = (mat + mo + soudureCost + pl) / coeffTransport;
  const pvUnit = pr / coeffMarge;
  const pvTot = pvUnit * quantity;

  return {
    surfaceUnit,
    surfaceTotal,
    mat,
    pl,
    mo,
    soudureCost,
    pr,
    pvUnit,
    pvTot,
    materialKnown: matPrice != null
  };
}

function calculateChiffrageTotals(rows, params) {
  return (rows || []).reduce((acc, row) => {
    const c = computeChiffrage(row, params);
    const qty = Math.max(toNum(row.quantity, 1), 0);
    acc.matTotal += c.mat * qty;
    acc.moTotal += c.mo * qty;
    acc.plTotal += c.pl * qty;
    acc.soudureTotal += c.soudureCost * qty;
    acc.prTotal += c.pr * qty;
    acc.pvTotalHT += c.pvTot;
    return acc;
  }, { matTotal: 0, moTotal: 0, plTotal: 0, soudureTotal: 0, prTotal: 0, pvTotalHT: 0 });
}

function loadDevisParams() {
  if (typeof localStorage === 'undefined') return cloneDefaultParams();
  try {
    const raw = localStorage.getItem(DEVIS_PARAMS_STORAGE_KEY);
    if (!raw) return cloneDefaultParams();
    return mergeParams(JSON.parse(raw));
  } catch (e) {
    return cloneDefaultParams();
  }
}

function saveDevisParams(params) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(DEVIS_PARAMS_STORAGE_KEY, JSON.stringify(params));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEVIS_PARAMS_STORAGE_KEY,
    DEFAULT_DEVIS_PARAMS,
    cloneDefaultParams,
    mergeParams,
    findMaterialPrice,
    computeChiffrage,
    calculateChiffrageTotals,
    loadDevisParams,
    saveDevisParams
  };
}
