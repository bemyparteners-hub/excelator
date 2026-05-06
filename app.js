/* app.js
   Orchestration de l'application : UI, état, événements. */

const state = {
  settings: { ...DEFAULT_SETTINGS },
  quoteInfo: {
    quoteNumber: generateQuoteNumber(),
    quoteDate: new Date().toISOString().slice(0, 10),
    clientName: '',
    projectName: '',
    salesName: '',
    validity: '30 jours',
    conditions: 'Prix HT, hors pose et hors transport. Sous réserve de validation technique des plans, quantités et contraintes de fabrication.'
  },
  imported: {
    fileName: '',
    sheetName: '',
    columns: [],
    rows: []
  },
  mapping: {},
  rows: [],
  ui: {
    filterText: '',
    sortKey: '',
    sortDirection: 'asc',
    rowHeight: 40
  }
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
  cacheElements();
  bindEvents();
  initQuoteInfo();
  renderSettings();
  state.rows = calculateRows(createDemoRows(), state.settings);
  renderAll();
  showToast('Exemple chargé. Tu peux importer un fichier client ou modifier les lignes.');
});

function cacheElements() {
  elements.tabs = document.querySelectorAll('.tab');
  elements.panels = document.querySelectorAll('.panel');
  elements.fileInput = document.getElementById('fileInput');
  elements.dropzone = document.getElementById('dropzone');
  elements.importStatus = document.getElementById('importStatus');
  elements.mappingCard = document.getElementById('mappingCard');
  elements.mappingGrid = document.getElementById('mappingGrid');
  elements.previewCard = document.getElementById('previewCard');
  elements.previewTable = document.getElementById('previewTable');
  elements.previewInfo = document.getElementById('previewInfo');
  elements.applyMappingBtn = document.getElementById('applyMappingBtn');
  elements.quoteTable = document.getElementById('quoteTable');
  elements.internalTotals = document.getElementById('internalTotals');
  elements.addRowBtn = document.getElementById('addRowBtn');
  elements.recalculateBtn = document.getElementById('recalculateBtn');
  elements.exportCsvBtn = document.getElementById('exportCsvBtn');
  elements.settingsGrid = document.getElementById('settingsGrid');
  elements.resetSettingsBtn = document.getElementById('resetSettingsBtn');
  elements.quoteDocument = document.getElementById('quoteDocument');
  elements.refreshQuoteBtn = document.getElementById('refreshQuoteBtn');
  elements.printBtn = document.getElementById('printBtn');
  elements.toast = document.getElementById('toast');
  elements.loadDemoBtn = document.getElementById('loadDemoBtn');
  elements.saveLocalBtn = document.getElementById('saveLocalBtn');
  elements.loadLocalBtn = document.getElementById('loadLocalBtn');
  elements.tableFilterInput = document.getElementById('tableFilterInput');
  elements.clearSortBtn = document.getElementById('clearSortBtn');
  elements.rowHeightInput = document.getElementById('rowHeightInput');

  ['quoteNumber', 'quoteDate', 'clientName', 'projectName', 'salesName', 'validity', 'quoteConditions'].forEach(id => {
    elements[id] = document.getElementById(id);
  });
}

function bindEvents() {
  elements.tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  elements.fileInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (file) handleFile(file);
  });

  elements.dropzone.addEventListener('dragover', event => {
    event.preventDefault();
    elements.dropzone.classList.add('dragover');
  });

  elements.dropzone.addEventListener('dragleave', () => {
    elements.dropzone.classList.remove('dragover');
  });

  elements.dropzone.addEventListener('drop', event => {
    event.preventDefault();
    elements.dropzone.classList.remove('dragover');
    const file = event.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  elements.applyMappingBtn.addEventListener('click', applyCurrentMapping);
  elements.addRowBtn.addEventListener('click', addRow);
  elements.recalculateBtn.addEventListener('click', () => {
    recalculateRows();
    showToast('Chiffrage recalculé.');
  });
  elements.exportCsvBtn.addEventListener('click', () => exportRowsToCsv(calculateRows(state.rows, state.settings)));
  elements.resetSettingsBtn.addEventListener('click', resetSettings);
  elements.refreshQuoteBtn.addEventListener('click', renderQuote);
  elements.printBtn.addEventListener('click', () => {
    renderQuote();
    switchTab('devis');
    window.print();
  });
  elements.loadDemoBtn.addEventListener('click', () => {
    state.rows = calculateRows(createDemoRows(), state.settings);
    renderAll();
    switchTab('chiffrage');
    showToast('Exemple rechargé.');
  });
  elements.saveLocalBtn.addEventListener('click', () => {
    syncQuoteInfoFromInputs();
    saveStateToLocalStorage(state);
    showToast('Projet sauvegardé dans ce navigateur.');
  });
  elements.loadLocalBtn.addEventListener('click', loadLocalProject);

  elements.tableFilterInput.addEventListener('input', event => {
    state.ui.filterText = event.target.value.trim().toLowerCase();
    renderQuoteTable();
  });
  elements.clearSortBtn.addEventListener('click', () => {
    state.ui.sortKey = '';
    state.ui.sortDirection = 'asc';
    renderQuoteTable();
  });
  elements.rowHeightInput.addEventListener('input', event => {
    state.ui.rowHeight = Number(event.target.value) || 40;
    document.documentElement.style.setProperty('--row-height', `${state.ui.rowHeight}px`);
  });

  Object.entries({
    quoteNumber: 'quoteNumber',
    quoteDate: 'quoteDate',
    clientName: 'clientName',
    projectName: 'projectName',
    salesName: 'salesName',
    validity: 'validity',
    quoteConditions: 'conditions'
  }).forEach(([elementId, stateKey]) => {
    elements[elementId].addEventListener('input', event => {
      state.quoteInfo[stateKey] = event.target.value;
      renderQuote();
    });
  });
}

function switchTab(name) {
  elements.tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.tab === name));
  elements.panels.forEach(panel => panel.classList.toggle('active', panel.id === `tab-${name}`));
  if (name === 'devis') renderQuote();
}

function initQuoteInfo() {
  elements.quoteNumber.value = state.quoteInfo.quoteNumber;
  elements.quoteDate.value = state.quoteInfo.quoteDate;
  elements.clientName.value = state.quoteInfo.clientName;
  elements.projectName.value = state.quoteInfo.projectName;
  elements.salesName.value = state.quoteInfo.salesName;
  elements.validity.value = state.quoteInfo.validity;
  elements.quoteConditions.value = state.quoteInfo.conditions;
}

function syncQuoteInfoFromInputs() {
  state.quoteInfo.quoteNumber = elements.quoteNumber.value;
  state.quoteInfo.quoteDate = elements.quoteDate.value;
  state.quoteInfo.clientName = elements.clientName.value;
  state.quoteInfo.projectName = elements.projectName.value;
  state.quoteInfo.salesName = elements.salesName.value;
  state.quoteInfo.validity = elements.validity.value;
  state.quoteInfo.conditions = elements.quoteConditions.value;
}

async function handleFile(file) {
  setImportStatus('Lecture du fichier en cours...', 'muted');
  try {
    const imported = await importFile(file);
    state.imported = imported;
    state.mapping = guessColumnMapping(imported.columns);
    renderMapping();
    renderPreview();
    setImportStatus(`Fichier importé : ${imported.fileName} — feuille : ${imported.sheetName} — ${imported.rows.length} lignes.`, 'success');
    elements.mappingCard.hidden = false;
    elements.previewCard.hidden = false;
    showToast('Fichier importé. Vérifie le mapping puis applique-le.');
  } catch (error) {
    console.error(error);
    setImportStatus(error.message, 'error');
  }
}

function setImportStatus(message, type) {
  elements.importStatus.textContent = message;
  elements.importStatus.className = `notice ${type}`;
}

function renderMapping() {
  const options = ['<option value="">Ne pas importer</option>']
    .concat(state.imported.columns.map(column => `<option value="${escapeHtml(column)}">${escapeHtml(column)}</option>`))
    .join('');

  elements.mappingGrid.innerHTML = INTERNAL_FIELDS_FOR_MAPPING.map(field => `
    <label>
      ${escapeHtml(field.label)}
      <select data-mapping-key="${field.key}">
        ${options}
      </select>
    </label>
  `).join('');

  elements.mappingGrid.querySelectorAll('select').forEach(select => {
    const key = select.dataset.mappingKey;
    select.value = state.mapping[key] || '';
    select.addEventListener('change', event => {
      state.mapping[key] = event.target.value;
    });
  });
}

function renderPreview() {
  const rows = state.imported.rows.slice(0, 8);
  const columns = state.imported.columns.slice(0, 12);
  elements.previewInfo.textContent = `${state.imported.rows.length} lignes détectées. Aperçu des ${rows.length} premières lignes et ${columns.length} premières colonnes.`;

  elements.previewTable.innerHTML = `
    <thead><tr>${columns.map(column => `<th>${escapeHtml(column)}</th>`).join('')}</tr></thead>
    <tbody>
      ${rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>`).join('')}
    </tbody>
  `;
}

function applyCurrentMapping() {
  if (!state.imported.rows.length) {
    showToast('Importe d’abord un fichier client.');
    return;
  }

  state.rows = applyMappingToRows(state.imported.rows, state.mapping, state.settings);
  renderAll();
  switchTab('chiffrage');
  showToast(`${state.rows.length} lignes importées dans le chiffrage.`);
}

function renderAll() {
  recalculateRows();
  renderQuoteTable();
  renderInternalTotals();
  renderQuote();
}

function recalculateRows() {
  state.rows = calculateRows(state.rows, state.settings);
  renderQuoteTable();
  renderInternalTotals();
  renderQuote();
}

function renderQuoteTable() {
  const rowsForDisplay = getDisplayedRows();
  const headers = FIELD_DEFINITIONS.map(field => {
    const isSorted = state.ui.sortKey === field.key;
    const sortClass = isSorted ? (state.ui.sortDirection === 'asc' ? 'sorted-asc' : 'sorted-desc') : '';
    return `<th class="sortable ${sortClass}" data-sort-key="${field.key}">${escapeHtml(field.label)}</th>`;
  }).join('') + '<th>Actions</th>';

  elements.quoteTable.innerHTML = `
    <thead><tr>${headers}</tr></thead>
    <tbody>
      ${rowsForDisplay.map(({ row, rowIndex }) => renderQuoteRow(row, rowIndex)).join('')}
    </tbody>
  `;

  elements.quoteTable.querySelectorAll('th[data-sort-key]').forEach(th => {
    th.addEventListener('click', () => setSort(th.dataset.sortKey));
  });

  elements.quoteTable.querySelectorAll('[data-row-index][data-field]').forEach(input => {
    input.addEventListener('change', handleCellInput);
  });

  elements.quoteTable.querySelectorAll('[data-action="duplicate"]').forEach(button => {
    button.addEventListener('click', () => duplicateRow(Number(button.dataset.rowIndex)));
  });

  elements.quoteTable.querySelectorAll('[data-action="delete"]').forEach(button => {
    button.addEventListener('click', () => deleteRow(Number(button.dataset.rowIndex)));
  });
}

function getDisplayedRows() {
  const normalized = state.rows.map((row, rowIndex) => ({ row, rowIndex }));
  const filtered = state.ui.filterText
    ? normalized.filter(({ row }) => Object.values(row).some(value => String(value ?? '').toLowerCase().includes(state.ui.filterText)))
    : normalized;

  if (!state.ui.sortKey) return filtered;

  return filtered.sort((a, b) => {
    const av = a.row[state.ui.sortKey];
    const bv = b.row[state.ui.sortKey];
    if (typeof av === 'number' && typeof bv === 'number') {
      return state.ui.sortDirection === 'asc' ? av - bv : bv - av;
    }
    const left = String(av ?? '').toLowerCase();
    const right = String(bv ?? '').toLowerCase();
    if (left === right) return 0;
    const order = left > right ? 1 : -1;
    return state.ui.sortDirection === 'asc' ? order : -order;
  });
}

function setSort(key) {
  if (state.ui.sortKey === key) {
    state.ui.sortDirection = state.ui.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    state.ui.sortKey = key;
    state.ui.sortDirection = 'asc';
  }
  renderQuoteTable();
}

function renderQuoteRow(row, rowIndex) {
  const cells = FIELD_DEFINITIONS.map(field => `<td>${renderCell(field, row, rowIndex)}</td>`).join('');
  return `
    <tr>
      ${cells}
      <td class="actions-cell">
        <button class="small-btn" data-action="duplicate" data-row-index="${rowIndex}">Dupliquer</button>
        <button class="small-btn danger" data-action="delete" data-row-index="${rowIndex}">Supprimer</button>
      </td>
    </tr>
  `;
}

function renderCell(field, row, rowIndex) {
  const value = row[field.key];

  if (field.type === 'readonlyMoney') {
    return `<div class="readonly-cell">${formatMoney(value)}</div>`;
  }
  if (field.type === 'readonly') {
    return `<div class="readonly-cell">${formatNumber(value)}</div>`;
  }
  if (field.type === 'select') {
    return `<select data-row-index="${rowIndex}" data-field="${field.key}">
      ${field.options.map(option => `<option value="${escapeHtml(option)}" ${option === value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}
    </select>`;
  }
  if (field.type === 'boolean') {
    return `<select data-row-index="${rowIndex}" data-field="${field.key}">
      <option value="false" ${!value ? 'selected' : ''}>Non</option>
      <option value="true" ${value ? 'selected' : ''}>Oui</option>
    </select>`;
  }
  if (field.type === 'number') {
    return `<input type="number" step="0.01" value="${escapeHtml(value)}" data-row-index="${rowIndex}" data-field="${field.key}" />`;
  }
  return `<input type="text" value="${escapeHtml(value)}" data-row-index="${rowIndex}" data-field="${field.key}" />`;
}

function handleCellInput(event) {
  const rowIndex = Number(event.target.dataset.rowIndex);
  const fieldKey = event.target.dataset.field;
  const definition = FIELD_DEFINITIONS.find(field => field.key === fieldKey);
  let value = event.target.value;

  if (definition.type === 'number') value = parseNumber(value, 0);
  if (definition.type === 'boolean') value = value === 'true';

  state.rows[rowIndex][fieldKey] = value;
  state.rows[rowIndex] = calculateRow(state.rows[rowIndex], state.settings);

  renderQuoteTable();
  renderInternalTotals();
  renderQuote();
}

function addRow() {
  state.rows.push(calculateRow(makeEmptyRow(), state.settings));
  renderAll();
}

function duplicateRow(index) {
  const clone = { ...state.rows[index], id: crypto.randomUUID ? crypto.randomUUID() : `row-${Date.now()}` };
  state.rows.splice(index + 1, 0, clone);
  renderAll();
}

function deleteRow(index) {
  state.rows.splice(index, 1);
  renderAll();
}

function renderInternalTotals() {
  const totals = calculateTotals(state.rows, state.settings);
  elements.internalTotals.innerHTML = `
    <div class="total-box"><span>Total HT client</span><strong>${formatMoney(totals.totalHT)}</strong></div>
    <div class="total-box"><span>Coût matière</span><strong>${formatMoney(totals.materialCost)}</strong></div>
    <div class="total-box"><span>Coût laquage</span><strong>${formatMoney(totals.lacquerCost)}</strong></div>
    <div class="total-box"><span>Coût main-d’œuvre</span><strong>${formatMoney(totals.laborCost)}</strong></div>
  `;
}

function renderSettings() {
  const settingLabels = {
    steelPriceKg: 'Prix acier €/kg',
    aluminiumPriceKg: 'Prix aluminium €/kg',
    inoxPriceKg: 'Prix inox €/kg',
    defaultLaquagePriceM2: 'Post-laquage €/m²',
    preLaquagePriceM2: 'Pré-laquage €/m²',
    costPerBend: 'Coût par pli €',
    punchingCost: 'Coût poinçonnage €',
    weldingCost: 'Coût soudure €',
    baseLaborCost: 'Forfait MO / pièce €',
    defaultMarginCoeff: 'Coefficient marge défaut',
    tvaRate: 'TVA %',
    steelDensity: 'Densité acier kg/m³',
    aluminiumDensity: 'Densité alu kg/m³',
    inoxDensity: 'Densité inox kg/m³'
  };

  elements.settingsGrid.innerHTML = Object.entries(settingLabels).map(([key, label]) => `
    <label>
      ${label}
      <input type="number" step="0.01" value="${state.settings[key]}" data-setting-key="${key}" />
    </label>
  `).join('');

  elements.settingsGrid.querySelectorAll('input').forEach(input => {
    input.addEventListener('input', event => {
      const key = event.target.dataset.settingKey;
      state.settings[key] = parseNumber(event.target.value, DEFAULT_SETTINGS[key]);
      recalculateRows();
    });
  });
}

function resetSettings() {
  state.settings = { ...DEFAULT_SETTINGS };
  renderSettings();
  recalculateRows();
  showToast('Paramètres réinitialisés.');
}

function renderQuote() {
  syncQuoteInfoFromInputs();
  elements.quoteDocument.innerHTML = renderQuoteDocument(state);
}

function loadLocalProject() {
  const saved = loadStateFromLocalStorage();
  if (!saved) {
    showToast('Aucun projet sauvegardé dans ce navigateur.');
    return;
  }

  state.settings = { ...DEFAULT_SETTINGS, ...saved.settings };
  state.quoteInfo = { ...state.quoteInfo, ...saved.quoteInfo };
  state.rows = Array.isArray(saved.rows) ? saved.rows : [];
  state.imported = saved.imported || state.imported;
  state.mapping = saved.mapping || state.mapping;

  initQuoteInfo();
  renderSettings();
  renderAll();
  showToast('Projet local rechargé.');
}

function generateQuoteNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `DEV-${y}${m}${d}-001`;
}

let toastTimer = null;
function showToast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.hidden = false;
  toastTimer = setTimeout(() => {
    elements.toast.hidden = true;
  }, 3500);
}
