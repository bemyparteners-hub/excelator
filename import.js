/* import.js
   Gestion import CSV/XLSX/XLSB et détection de colonnes. */

async function importFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();

  // Fallback hors-ligne : les CSV peuvent être lus sans librairie externe.
  if (!window.XLSX && extension === 'csv') {
    const text = await file.text();
    const matrix = parseCsvText(text);
    const normalized = normalizeMatrix(matrix);
    return {
      fileName: file.name,
      extension,
      sheetName: 'CSV',
      columns: normalized.columns,
      rows: normalized.rows
    };
  }

  const buffer = await file.arrayBuffer();

  if (!window.XLSX) {
    throw new Error('La librairie SheetJS n’est pas chargée. Le CSV fonctionne hors ligne, mais XLS/XLSX/XLSB nécessite SheetJS ou une version locale de la librairie.');
  }

  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: true,
    raw: false
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) throw new Error('Le fichier ne contient aucune feuille lisible.');

  const worksheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

  const normalized = normalizeMatrix(matrix);
  if (!normalized.columns.length) throw new Error('Impossible de détecter une ligne d’en-têtes.');

  return {
    fileName: file.name,
    extension,
    sheetName: firstSheetName,
    columns: normalized.columns,
    rows: normalized.rows
  };
}


function parseCsvText(text) {
  const delimiter = detectCsvDelimiter(text);
  const rows = [];
  let row = [];
  let value = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      value += '"';
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === delimiter && !inQuotes) {
      row.push(value);
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(value);
      rows.push(row);
      row = [];
      value = '';
      continue;
    }

    value += char;
  }

  if (value || row.length) {
    row.push(value);
    rows.push(row);
  }

  return rows;
}

function detectCsvDelimiter(text) {
  const firstLine = text.split(/\r?\n/).find(line => line.trim()) || '';
  const candidates = [';', ',', '\t'];
  return candidates
    .map(delimiter => ({ delimiter, count: firstLine.split(delimiter).length }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function normalizeMatrix(matrix) {
  const usefulRows = matrix.filter(row => row.some(cell => String(cell).trim() !== ''));
  if (!usefulRows.length) return { columns: [], rows: [] };

  const headerIndex = detectHeaderRow(usefulRows);
  const headers = usefulRows[headerIndex].map((cell, index) => {
    const value = String(cell || '').trim();
    return value || `Colonne ${index + 1}`;
  });

  const uniqueHeaders = makeUniqueHeaders(headers);
  const dataRows = usefulRows.slice(headerIndex + 1).map(row => {
    const object = {};
    uniqueHeaders.forEach((header, index) => {
      object[header] = row[index] ?? '';
    });
    return object;
  }).filter(row => Object.values(row).some(value => String(value).trim() !== ''));

  return { columns: uniqueHeaders, rows: dataRows };
}

function detectHeaderRow(rows) {
  // On cherche la première ligne qui ressemble à une ligne d'en-têtes :
  // beaucoup de textes non vides et peu de valeurs numériques pures.
  let bestIndex = 0;
  let bestScore = -Infinity;

  rows.slice(0, 20).forEach((row, index) => {
    const cells = row.map(cell => String(cell || '').trim()).filter(Boolean);
    if (!cells.length) return;

    const textCount = cells.filter(cell => Number.isNaN(Number(cell.replace(',', '.')))).length;
    const uniqueCount = new Set(cells.map(cell => cell.toLowerCase())).size;
    const keywordBonus = cells.some(cell => /ref|part|qty|quant|description|surface|weight|poids|material|mati/i.test(cell)) ? 5 : 0;
    const score = textCount * 2 + uniqueCount + keywordBonus - index * 0.2;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function makeUniqueHeaders(headers) {
  const counts = {};
  return headers.map(header => {
    const clean = header || 'Colonne';
    const lower = clean.toLowerCase();
    counts[lower] = (counts[lower] || 0) + 1;
    return counts[lower] === 1 ? clean : `${clean} ${counts[lower]}`;
  });
}

function normalizeHeader(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9$_]+/g, ' ')
    .trim();
}

function guessColumnMapping(columns) {
  const mapping = {};
  const normalizedColumns = columns.map(column => ({ column, normalized: normalizeHeader(column) }));

  INTERNAL_FIELDS_FOR_MAPPING.forEach(field => {
    let best = '';
    let bestScore = 0;

    normalizedColumns.forEach(({ column, normalized }) => {
      field.aliases.forEach(alias => {
        const normalizedAlias = normalizeHeader(alias);
        let score = 0;
        if (normalized === normalizedAlias) score = 100;
        else if (normalized.includes(normalizedAlias)) score = 70;
        else if (normalizedAlias.includes(normalized)) score = 40;

        if (score > bestScore) {
          bestScore = score;
          best = column;
        }
      });
    });

    mapping[field.key] = bestScore >= 40 ? best : '';
  });

  return mapping;
}

function applyMappingToRows(sourceRows, mapping, settings) {
  return sourceRows.map(sourceRow => {
    const row = makeEmptyRow();

    Object.entries(mapping).forEach(([fieldKey, sourceColumn]) => {
      if (!sourceColumn) return;
      const value = sourceRow[sourceColumn];
      row[fieldKey] = value;
    });

    row.quantity = parseNumber(row.quantity, 1) || 1;
    row.material = normalizeMaterial(row.material || inferMaterialFromText(`${row.designation} ${row.finish}`));
    row.thickness = parseThickness(row.thickness || row.designation || row.material) || row.thickness || 1.5;
    row.surfaceUnit = parseNumber(row.surfaceUnit, 0);
    row.weightUnit = parseNumber(row.weightUnit, 0);
    row.length = parseNumber(row.length, 0);
    row.developed = parseNumber(row.developed, 0);
    row.marginCoeff = settings.defaultMarginCoeff;

    const finishText = String(`${row.finish} ${row.designation}`).toLowerCase();
    row.postLacquer = /post|laquage|thermolaqu/i.test(finishText);
    row.preLacquer = /pre|pré|prelaqu/i.test(finishText);

    return calculateRow(row, settings);
  });
}

function inferMaterialFromText(text) {
  const lower = String(text || '').toLowerCase();
  if (lower.includes('inox')) return 'Inox';
  if (lower.includes('alu') || lower.includes('aluminium')) return 'Aluminium';
  if (lower.includes('acier') || lower.includes('steel') || lower.includes('galva')) return 'Acier';
  return 'Acier';
}

function parseThickness(value) {
  const text = String(value || '').toLowerCase();
  const fractional = text.match(/(\d{1,2})\s*\/\s*10/);
  if (fractional) return parseNumber(fractional[1]) / 10;

  const mm = text.match(/(\d+(?:[,.]\d+)?)\s*mm/);
  if (mm) return parseNumber(mm[1]);

  return parseNumber(value, 0);
}
