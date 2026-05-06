/* calculations.js
   Schéma des champs ligne, mapping import et orchestration des calculs.
   Les formules pures vivent dans chiffrage.js. */

const DEFAULT_SETTINGS = {
  tvaRate: 20
};

const FIELD_DEFINITIONS = [
  { key: 'reference', label: 'Référence pièce', type: 'text' },
  { key: 'designation', label: 'Désignation', type: 'text' },
  { key: 'quantity', label: 'Quantité', type: 'number' },
  { key: 'material', label: 'Matière (code)', type: 'text' },
  { key: 'thickness', label: 'Épaisseur mm', type: 'number' },
  { key: 'finish', label: 'Finition', type: 'text' },
  { key: 'ral', label: 'RAL / couleur', type: 'text' },
  { key: 'length', label: 'Longueur mm', type: 'number' },
  { key: 'developed', label: 'Développé mm', type: 'number' },
  { key: 'bends', label: 'Nb plis', type: 'number' },
  { key: 'tempsParPliSec', label: 'Temps / pli (s)', type: 'number' },
  { key: 'surfaceUnit', label: 'Surface unit. m²', type: 'readonly' },
  { key: 'surfaceTotal', label: 'Surface totale m²', type: 'readonly' },
  { key: 'mat', label: 'MAT €', type: 'readonlyMoney' },
  { key: 'mo', label: 'MO €', type: 'readonlyMoney' },
  { key: 'soudureCost', label: 'Soudure €', type: 'money' },
  { key: 'pl', label: 'PL €', type: 'readonlyMoney' },
  { key: 'pr', label: 'PR €', type: 'readonlyMoney' },
  { key: 'pvUnit', label: 'PV unit. €', type: 'readonlyMoney' },
  { key: 'pvTot', label: 'PV total €', type: 'readonlyMoney' },
  { key: 'internalComment', label: 'Commentaire interne', type: 'text' }
];

const INTERNAL_FIELDS_FOR_MAPPING = [
  { key: 'reference', label: 'Référence pièce', aliases: ['reference', 'référence', 'ref', 'ref complet', 'part no', 'part number', 'item', 'code', 'numéro', 'numero'] },
  { key: 'designation', label: 'Désignation', aliases: ['designation', 'désignation', 'description', 'name', 'nom', 'libelle', 'libellé', 'info comp'] },
  { key: 'quantity', label: 'Quantité', aliases: ['quantity', 'quantité', 'qty', 'qte', 'qté', 'nb'] },
  { key: 'material', label: 'Matière (code)', aliases: ['material', 'matiere', 'matière', 'mat', 'nuance', 'matériau', 'materiau'] },
  { key: 'thickness', label: 'Épaisseur', aliases: ['thickness', 'épaisseur', 'epaisseur', 'thick', 'epr', 'ép'] },
  { key: 'finish', label: 'Finition', aliases: ['finishing', 'finishing code', 'finish', 'finition', 'traitement', 'info comp'] },
  { key: 'ral', label: 'RAL / couleur', aliases: ['ral', 'color', 'colour', 'couleur', 'teinte'] },
  { key: 'length', label: 'Longueur', aliases: ['length', 'longueur', 'long', 'l', 'lg'] },
  { key: 'developed', label: 'Développé', aliases: ['developed', 'développé', 'developpe', 'dvlp', 'dev', 'dl', 'largeur'] },
  { key: 'bends', label: 'Nb plis', aliases: ['nb plis', 'plis', 'bends', 'bend count'] },
  { key: 'surfaceUnit', label: 'Surface unitaire', aliases: ['surface', 'area', 'surface unit', 'surface uni', 'unit area', 'm2'] },
  { key: 'internalComment', label: 'Commentaire client', aliases: ['comment', 'commentaire', 'remark', 'note', 'remarks', 'info comp'] }
];

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value)
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^0-9.\-]/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : fallback;
}

function formatMoney(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseNumber(value));
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(parseNumber(value));
}

function makeEmptyRow() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`,
    reference: '',
    designation: '',
    quantity: 1,
    material: '',
    thickness: 0,
    finish: '',
    ral: '',
    length: 0,
    developed: 0,
    bends: 0,
    tempsParPliSec: 0,
    soudureCost: 0,
    surfaceUnit: 0,
    surfaceTotal: 0,
    mat: 0,
    mo: 0,
    pl: 0,
    pr: 0,
    pvUnit: 0,
    pvTot: 0,
    materialKnown: true,
    internalComment: ''
  };
}

function calculateRow(inputRow, params) {
  const row = { ...makeEmptyRow(), ...inputRow };
  const c = computeChiffrage(row, params);
  return {
    ...row,
    quantity: Math.max(parseNumber(row.quantity, 1), 0),
    length: parseNumber(row.length, 0),
    developed: parseNumber(row.developed, 0),
    bends: Math.max(parseNumber(row.bends, 0), 0),
    tempsParPliSec: Math.max(parseNumber(row.tempsParPliSec, 0), 0),
    soudureCost: Math.max(parseNumber(row.soudureCost, 0), 0),
    surfaceUnit: c.surfaceUnit,
    surfaceTotal: c.surfaceTotal,
    mat: c.mat,
    mo: c.mo,
    pl: c.pl,
    pr: c.pr,
    pvUnit: c.pvUnit,
    pvTot: c.pvTot,
    materialKnown: c.materialKnown
  };
}

function calculateRows(rows, params) {
  return rows.map(row => calculateRow(row, params));
}

function calculateTotals(rows, params, settings) {
  const calculated = calculateRows(rows, params);
  const subtotals = calculateChiffrageTotals(calculated, params);
  const totalHT = subtotals.pvTotalHT;
  const tva = totalHT * (parseNumber(settings && settings.tvaRate, 0) / 100);
  return {
    rows: calculated,
    matTotal: subtotals.matTotal,
    moTotal: subtotals.moTotal,
    plTotal: subtotals.plTotal,
    soudureTotal: subtotals.soudureTotal,
    prTotal: subtotals.prTotal,
    totalHT,
    tva,
    totalTTC: totalHT + tva
  };
}

function createDemoRows() {
  return [
    {
      ...makeEmptyRow(),
      reference: 'GRO-Bav1-329',
      designation: 'Bav1 - Post laqué 1 face',
      quantity: 1,
      material: 'AC15',
      length: 1581,
      developed: 245,
      bends: 4,
      tempsParPliSec: 55,
      finish: 'Post laqué 1 face'
    },
    {
      ...makeEmptyRow(),
      reference: 'GRO-Bav2-364',
      designation: 'Bav2 - Post laqué 1 face',
      quantity: 2,
      material: 'AC15',
      length: 1581,
      developed: 223,
      bends: 4,
      tempsParPliSec: 55,
      finish: 'Post laqué 1 face'
    },
    {
      ...makeEmptyRow(),
      reference: 'GRO-GA-001',
      designation: 'Tôle galva 20/10',
      quantity: 5,
      material: 'GA20/10',
      length: 2000,
      developed: 300,
      bends: 2,
      tempsParPliSec: 55,
      finish: 'Brut'
    }
  ];
}
