/* export.js
   Fonctions d’export CSV, sauvegarde locale et génération HTML du devis client. */

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function exportRowsToCsv(rows, fileName = 'chiffrage.csv') {
  const headers = FIELD_DEFINITIONS.map(field => field.label);
  const keys = FIELD_DEFINITIONS.map(field => field.key);

  const lines = [headers.join(';')];
  rows.forEach(row => {
    const values = keys.map(key => csvValue(row[key]));
    lines.push(values.join(';'));
  });

  downloadTextFile(lines.join('\n'), fileName, 'text/csv;charset=utf-8;');
}

function csvValue(value) {
  const text = String(value ?? '').replace(/"/g, '""');
  return `"${text}"`;
}

function downloadTextFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function renderQuoteDocument(state) {
  const totals = calculateTotals(state.rows, state.settings);
  const quote = state.quoteInfo;
  const rowsHtml = totals.rows.map(row => {
    const finish = [row.material, row.finish, row.ral].filter(Boolean).join(' - ');
    return `
      <tr>
        <td>${escapeHtml(row.reference)}</td>
        <td>${escapeHtml(row.designation)}</td>
        <td class="num">${formatNumber(row.quantity, 0)}</td>
        <td>${escapeHtml(finish)}</td>
        <td class="num">${formatMoney(row.unitPrice)}</td>
        <td class="num">${formatMoney(row.totalHT)}</td>
      </tr>`;
  }).join('');

  const date = quote.quoteDate ? new Date(`${quote.quoteDate}T00:00:00`).toLocaleDateString('fr-FR') : new Date().toLocaleDateString('fr-FR');
  const conditions = quote.conditions || 'Prix HT, hors pose et hors transport. Sous réserve de validation technique des plans et quantités.';

  return `
    <div class="quote-top">
      <div>
        <div class="logo-box">LOGO</div>
        <h3>Votre entreprise</h3>
        <p>Profilage / pliage à froid<br>Acier - Aluminium - Inox</p>
      </div>
      <div class="quote-meta">
        <h2>DEVIS</h2>
        <p><strong>N° :</strong> ${escapeHtml(quote.quoteNumber || 'DEV-XXXX')}</p>
        <p><strong>Date :</strong> ${escapeHtml(date)}</p>
        <p><strong>Validité :</strong> ${escapeHtml(quote.validity || '30 jours')}</p>
      </div>
    </div>

    <div class="quote-parties">
      <div class="quote-box">
        <h3>Client</h3>
        <p><strong>${escapeHtml(quote.clientName || 'Client')}</strong></p>
        <p>Projet : ${escapeHtml(quote.projectName || '-')}</p>
      </div>
      <div class="quote-box">
        <h3>Contact</h3>
        <p>Commercial : ${escapeHtml(quote.salesName || '-')}</p>
        <p>Objet : Chiffrage tôles pliées / profilées</p>
      </div>
    </div>

    <table class="quote-table">
      <thead>
        <tr>
          <th>Référence</th>
          <th>Désignation</th>
          <th>Qté</th>
          <th>Matière / finition</th>
          <th>PU HT</th>
          <th>Total HT</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="6">Aucune ligne de devis.</td></tr>'}
      </tbody>
    </table>

    <div class="quote-summary">
      <div><span>Total HT</span><strong>${formatMoney(totals.totalHT)}</strong></div>
      <div><span>TVA ${formatNumber(state.settings.tvaRate, 0)}%</span><strong>${formatMoney(totals.tva)}</strong></div>
      <div><span>Total TTC</span><strong>${formatMoney(totals.totalTTC)}</strong></div>
    </div>

    <div class="conditions">
      <h3>Conditions</h3>
      ${escapeHtml(conditions)}
    </div>
  `;
}

function saveStateToLocalStorage(state) {
  localStorage.setItem('devis-pliage-state', JSON.stringify(state));
}

function loadStateFromLocalStorage() {
  const raw = localStorage.getItem('devis-pliage-state');
  if (!raw) return null;
  return JSON.parse(raw);
}
