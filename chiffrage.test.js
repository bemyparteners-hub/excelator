/* chiffrage.test.js
   Tests unitaires Node pour les formules de chiffrage.
   Lancement : `node chiffrage.test.js` */

const {
  DEFAULT_DEVIS_PARAMS,
  cloneDefaultParams,
  mergeParams,
  findMaterialPrice,
  computeChiffrage,
  calculateChiffrageTotals
} = require('./chiffrage.js');

let passed = 0;
let failed = 0;
const failures = [];

function approx(actual, expected, tol) {
  return Math.abs(actual - expected) <= tol;
}

function assertEq(label, actual, expected, tol = 0.005) {
  const ok = typeof expected === 'number'
    ? approx(actual, expected, tol)
    : actual === expected;
  if (ok) {
    passed++;
  } else {
    failed++;
    failures.push(`${label}: expected ${expected}, got ${actual}`);
  }
}

const params = cloneDefaultParams();

// 1. Lookup matière
assertEq('findMaterialPrice AC15', findMaterialPrice('AC15', params), 13.5);
assertEq('findMaterialPrice ac15 (case-insensitive)', findMaterialPrice('ac15', params), 13.5);
assertEq('findMaterialPrice GA20/10', findMaterialPrice('GA20/10', params), 19.5);
assertEq('findMaterialPrice inconnu', findMaterialPrice('XYZ', params), null);
assertEq('findMaterialPrice vide', findMaterialPrice('', params), null);

// 2. Validation Excel : ligne AC15, longueur 1581, dvlp 245, qty 1, 4 plis × 55s
const row1 = {
  material: 'AC15',
  length: 1581,
  developed: 245,
  quantity: 1,
  bends: 4,
  tempsParPliSec: 55,
  soudureCost: 0
};
const c1 = computeChiffrage(row1, params);
assertEq('Surface unit AC15 1581x245', c1.surfaceUnit, 0.387345, 0.0001);
assertEq('Surface tot AC15 qty=1', c1.surfaceTotal, 0.387345, 0.0001);
assertEq('MAT AC15 = surface × 13.50 / 0.9', c1.mat, 5.810, 0.005);
assertEq('PL AC15 = surface × 15', c1.pl, 5.810, 0.005);
assertEq('MO AC15 = 4 × 55 × 0.017', c1.mo, 3.74, 0.005);
assertEq('PR AC15 = (MAT+MO+SOUD+PL) / 0.88', c1.pr, 17.455, 0.01);
assertEq('PV unit AC15 = PR / 0.7', c1.pvUnit, 24.94, 0.01);
assertEq('PV tot AC15 (qty=1)', c1.pvTot, 24.94, 0.01);
assertEq('Matière connue', c1.materialKnown, true);

// 3. Quantité > 1 : surface_tot = surface × qty et pv_tot = pv_unit × qty
const row2 = { ...row1, quantity: 2 };
const c2 = computeChiffrage(row2, params);
assertEq('Surface tot qty=2', c2.surfaceTotal, 0.774690, 0.0001);
assertEq('MAT inchangé (unitaire)', c2.mat, c1.mat, 0.0001);
assertEq('PV tot qty=2', c2.pvTot, c1.pvUnit * 2, 0.01);

// 4. Soudure manuelle prise en compte dans PR
const row3 = { ...row1, soudureCost: 4.4 };
const c3 = computeChiffrage(row3, params);
const expectedPr3 = (c1.mat + c1.mo + 4.4 + c1.pl) / params.coeffTransport;
assertEq('Soudure -> PR augmenté', c3.pr, expectedPr3, 0.001);

// 5. Matière inconnue : MAT = 0 et flag materialKnown false
const row4 = { ...row1, material: 'INCONNU' };
const c4 = computeChiffrage(row4, params);
assertEq('MAT matière inconnue = 0', c4.mat, 0);
assertEq('materialKnown false', c4.materialKnown, false);

// 6. Sans données plis ni temps -> MO = 0
const row5 = { ...row1, bends: 0, tempsParPliSec: 0 };
const c5 = computeChiffrage(row5, params);
assertEq('MO = 0 sans données', c5.mo, 0);

// 7. Surface fournie directement (pas de longueur/dvlp)
const row6 = { material: 'AC15', surfaceUnit: 0.5, quantity: 1, bends: 0, tempsParPliSec: 0 };
const c6 = computeChiffrage(row6, params);
assertEq('Surface fournie utilisée', c6.surfaceUnit, 0.5);
assertEq('MAT = 0.5 × 13.50 / 0.9', c6.mat, 7.5, 0.001);

// 8. Modification d'un coefficient répercutée
const customParams = { ...cloneDefaultParams(), coeffMarge: 0.5 };
const c7 = computeChiffrage(row1, customParams);
const expectedPv7 = c1.pr / 0.5;
assertEq('PV unit suit coeffMarge', c7.pvUnit, expectedPv7, 0.01);

// 9. Totaux multi-lignes
const totals = calculateChiffrageTotals([row1, { ...row1, quantity: 3 }], params);
assertEq('Totaux MAT (1 + 3 × unitaire)', totals.matTotal, c1.mat * 4, 0.01);
assertEq('Totaux PV HT', totals.pvTotalHT, c1.pvUnit * 4, 0.01);

// 10. Format / parsing des nombres FR ("1 581", "0,5")
const row8 = { material: 'AC15', length: '1 581', developed: '245', quantity: '1', bends: '4', tempsParPliSec: '55' };
const c8 = computeChiffrage(row8, params);
assertEq('Parse nombres FR (longueur)', c8.surfaceUnit, 0.387345, 0.0001);

// 11. mergeParams conserve les valeurs sauvegardées valides
const merged = mergeParams({
  materials: [{ code: 'TOTO', priceM2: 7 }],
  coeffMarge: 0.5
});
assertEq('mergeParams: matières remplacées', merged.materials.length, 1);
assertEq('mergeParams: coeffMarge écrasé', merged.coeffMarge, 0.5);
assertEq('mergeParams: defaults conservés (chute)', merged.coeffChute, DEFAULT_DEVIS_PARAMS.coeffChute);

// Rapport
console.log(`\n${passed} passed, ${failed} failed`);
if (failed) {
  failures.forEach(f => console.log(`  ✗ ${f}`));
  process.exit(1);
}
