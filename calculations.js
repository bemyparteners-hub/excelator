/* calculations.js
   Toutes les formules métier sont centralisées ici.
   C'est le fichier principal à modifier si les règles de prix changent. */

const DEFAULT_SETTINGS = {
  steelPriceKg: 1.45,
  aluminiumPriceKg: 4.20,
  inoxPriceKg: 5.80,
  defaultLaquagePriceM2: 18.00,
  preLaquagePriceM2: 8.00,
  costPerBend: 1.60,
  punchingCost: 18.00,
  weldingCost: 25.00,
  baseLaborCost: 12.00,
  defaultMarginCoeff: 1.45,
  tvaRate: 20,
  steelDensity: 7850,
  aluminiumDensity: 2700,
  inoxDensity: 8000
};

const FIELD_DEFINITIONS = [
  { key: 'reference', label: 'Référence pièce', type: 'text' },
  { key: 'designation', label: 'Désignation', type: 'text' },
  { key: 'quantity', label: 'Quantité', type: 'number' },
  { key: 'material', label: 'Matière', type: 'select', options: ['Acier', 'Aluminium', 'Inox', 'Autre'] },
  { key: 'thickness', label: 'Épaisseur mm', type: 'number' },
  { key: 'finish', label: 'Finition', type: 'text' },
  { key: 'ral', label: 'RAL / couleur', type: 'text' },
  { key: 'length', label: 'Longueur mm', type: 'number' },
  { key: 'developed', label: 'Développé mm', type: 'number' },
  { key: 'surfaceUnit', label: 'Surface unit. m²', type: 'number' },
  { key: 'surfaceTotal', label: 'Surface totale m²', type: 'readonly' },
  { key: 'weightUnit', label: 'Poids unit. kg', type: 'number' },
  { key: 'weightTotal', label: 'Poids total kg', type: 'readonly' },
  { key: 'bends', label: 'Nb plis', type: 'number' },
  { key: 'punching', label: 'Poinçonnage', type: 'boolean' },
  { key: 'welding', label: 'Soudure', type: 'boolean' },
  { key: 'postLacquer', label: 'Post-laquage', type: 'boolean' },
  { key: 'preLacquer', label: 'Pré-laquage', type: 'boolean' },
  { key: 'materialCost', label: 'Coût matière', type: 'readonlyMoney' },
  { key: 'lacquerCost', label: 'Coût laquage', type: 'readonlyMoney' },
  { key: 'laborCost', label: 'Coût MO', type: 'readonlyMoney' },
  { key: 'marginCoeff', label: 'Coef. marge', type: 'number' },
  { key: 'unitPrice', label: 'PU HT', type: 'readonlyMoney' },
  { key: 'totalHT', label: 'Total HT', type: 'readonlyMoney' },
  { key: 'internalComment', label: 'Commentaire interne', type: 'text' }
];

const INTERNAL_FIELDS_FOR_MAPPING = [
  { key: 'reference', label: 'Référence pièce', aliases: ['reference', 'référence', 'ref', 'part no', 'part number', 'item', 'code'] },
  { key: 'designation', label: 'Désignation', aliases: ['designation', 'désignation', 'description', 'name', 'nom', 'libelle', 'libellé'] },
  { key: 'quantity', label: 'Quantité', aliases: ['quantity', 'quantité', 'qty', 'cf$_qty', 'qte', 'qté', 'nb'] },
  { key: 'material', label: 'Matière', aliases: ['material', 'matiere', 'matière', 'material code', 'mat', 'nuance'] },
  { key: 'thickness', label: 'Épaisseur', aliases: ['thickness', 'épaisseur', 'epaisseur', 'thick', 'epr', 'ép'] },
  { key: 'finish', label: 'Finition', aliases: ['finishing', 'finishing code', 'finish', 'finition', 'traitement', 'surface treatment'] },
  { key: 'ral', label: 'RAL / couleur', aliases: ['ral', 'color', 'colour', 'couleur', 'teinte'] },
  { key: 'length', label: 'Longueur', aliases: ['length', 'longueur', 'long', 'l', 'lg'] },
  { key: 'developed', label: 'Développé', aliases: ['developed', 'développé', 'developpe', 'width', 'largeur', 'dev', 'dl'] },
  { key: 'surfaceUnit', label: 'Surface unitaire', aliases: ['surface', 'area', 'surface unit', 'unit area', 'm2'] },
  { key: 'weightUnit', label: 'Poids unitaire', aliases: ['weight', 'poids', 'mass', 'masse', 'kg'] },
  { key: 'internalComment', label: 'Commentaire client', aliases: ['comment', 'commentaire', 'remark', 'note', 'remarks'] }
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

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 1 || value === '1') return true;
  const text = String(value || '').trim().toLowerCase();
  return ['oui', 'yes', 'y', 'true', 'vrai', 'x', 'ok'].includes(text);
}

function formatMoney(value) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(parseNumber(value));
}

function formatNumber(value, digits = 2) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(parseNumber(value));
}

function normalizeMaterial(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('alu') || text.includes('aluminium')) return 'Aluminium';
  if (text.includes('inox') || text.includes('stainless')) return 'Inox';
  if (text.includes('acier') || text.includes('steel') || text.includes('galva') || text.includes('zinc')) return 'Acier';
  return value || 'Acier';
}

function getMaterialPriceKg(material, settings) {
  const normalized = normalizeMaterial(material);
  if (normalized === 'Aluminium') return parseNumber(settings.aluminiumPriceKg);
  if (normalized === 'Inox') return parseNumber(settings.inoxPriceKg);
  return parseNumber(settings.steelPriceKg);
}

function getDensity(material, settings) {
  const normalized = normalizeMaterial(material);
  if (normalized === 'Aluminium') return parseNumber(settings.aluminiumDensity);
  if (normalized === 'Inox') return parseNumber(settings.inoxDensity);
  return parseNumber(settings.steelDensity);
}

function makeEmptyRow() {
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}-${Math.random()}`,
    reference: '',
    designation: '',
    quantity: 1,
    material: 'Acier',
    thickness: 1.5,
    finish: '',
    ral: '',
    length: 0,
    developed: 0,
    surfaceUnit: 0,
    surfaceTotal: 0,
    weightUnit: 0,
    weightTotal: 0,
    bends: 0,
    punching: false,
    welding: false,
    postLacquer: false,
    preLacquer: false,
    materialCost: 0,
    lacquerCost: 0,
    laborCost: 0,
    marginCoeff: DEFAULT_SETTINGS.defaultMarginCoeff,
    unitPrice: 0,
    totalHT: 0,
    internalComment: ''
  };
}

function estimateWeightUnit(row, settings, surfaceUnit) {
  const explicitWeight = parseNumber(row.weightUnit, 0);
  if (explicitWeight > 0) return explicitWeight;

  const thicknessMm = parseNumber(row.thickness, 0);
  if (!surfaceUnit || !thicknessMm) return 0;

  // Poids estimé = surface m² x épaisseur m x densité kg/m³
  return surfaceUnit * (thicknessMm / 1000) * getDensity(row.material, settings);
}

function calculateRow(inputRow, settings) {
  const row = { ...makeEmptyRow(), ...inputRow };
  const quantity = Math.max(parseNumber(row.quantity, 1), 0);
  const length = parseNumber(row.length, 0);
  const developed = parseNumber(row.developed, 0);
  const mappedSurface = parseNumber(row.surfaceUnit, 0);

  let surfaceUnit = mappedSurface;
  if (!surfaceUnit && length && developed) {
    surfaceUnit = (length * developed) / 1000000;
  }

  const surfaceTotal = surfaceUnit * quantity;
  const weightUnit = estimateWeightUnit(row, settings, surfaceUnit);
  const weightTotal = weightUnit * quantity;

  const materialCost = weightTotal * getMaterialPriceKg(row.material, settings);

  const lacquerRate = parseBoolean(row.postLacquer)
    ? parseNumber(settings.defaultLaquagePriceM2)
    : parseBoolean(row.preLacquer)
      ? parseNumber(settings.preLaquagePriceM2)
      : 0;
  const lacquerCost = surfaceTotal * lacquerRate;

  const bends = Math.max(parseNumber(row.bends, 0), 0);
  const laborUnit = parseNumber(settings.baseLaborCost)
    + bends * parseNumber(settings.costPerBend)
    + (parseBoolean(row.punching) ? parseNumber(settings.punchingCost) : 0)
    + (parseBoolean(row.welding) ? parseNumber(settings.weldingCost) : 0);
  const laborCost = laborUnit * quantity;

  const marginCoeff = parseNumber(row.marginCoeff, settings.defaultMarginCoeff) || settings.defaultMarginCoeff;
  const totalCost = materialCost + lacquerCost + laborCost;
  const totalHT = totalCost * marginCoeff;
  const unitPrice = quantity ? totalHT / quantity : 0;

  return {
    ...row,
    material: normalizeMaterial(row.material),
    quantity,
    length,
    developed,
    surfaceUnit,
    surfaceTotal,
    weightUnit,
    weightTotal,
    bends,
    punching: parseBoolean(row.punching),
    welding: parseBoolean(row.welding),
    postLacquer: parseBoolean(row.postLacquer),
    preLacquer: parseBoolean(row.preLacquer),
    materialCost,
    lacquerCost,
    laborCost,
    marginCoeff,
    unitPrice,
    totalHT
  };
}

function calculateRows(rows, settings) {
  return rows.map(row => calculateRow(row, settings));
}

function calculateTotals(rows, settings) {
  const calculated = calculateRows(rows, settings);
  const totalHT = calculated.reduce((sum, row) => sum + parseNumber(row.totalHT), 0);
  const materialCost = calculated.reduce((sum, row) => sum + parseNumber(row.materialCost), 0);
  const laborCost = calculated.reduce((sum, row) => sum + parseNumber(row.laborCost), 0);
  const lacquerCost = calculated.reduce((sum, row) => sum + parseNumber(row.lacquerCost), 0);
  const tva = totalHT * (parseNumber(settings.tvaRate) / 100);
  return {
    rows: calculated,
    materialCost,
    laborCost,
    lacquerCost,
    totalHT,
    tva,
    totalTTC: totalHT + tva
  };
}

function createDemoRows() {
  return [
    {
      ...makeEmptyRow(),
      reference: 'PR-S-0130.01.13',
      designation: 'Tôle pliée acier prélaqué',
      quantity: 120,
      material: 'Acier',
      thickness: 1.5,
      finish: 'Pré-laqué',
      ral: '7016',
      length: 2500,
      developed: 320,
      bends: 4,
      preLacquer: true,
      marginCoeff: 1.45
    },
    {
      ...makeEmptyRow(),
      reference: 'ASC33-34-SEUIL',
      designation: 'Seuil porte aluminium post-laqué',
      quantity: 42,
      material: 'Aluminium',
      thickness: 2,
      finish: 'Post-laquage',
      ral: '9005',
      length: 1800,
      developed: 240,
      bends: 3,
      postLacquer: true,
      punching: true,
      marginCoeff: 1.50
    },
    {
      ...makeEmptyRow(),
      reference: 'INOX-ANGLE-01',
      designation: 'Cornière inox pliée',
      quantity: 15,
      material: 'Inox',
      thickness: 2,
      finish: 'Brossé',
      ral: '',
      length: 3000,
      developed: 180,
      bends: 1,
      welding: false,
      marginCoeff: 1.55
    }
  ];
}
