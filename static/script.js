// ================================
//   NAIVE BAYES LAB — script.js
// ================================

let uploadedFile = null;
const COLORS = ['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

// ---- Navigation ----
function showSection(id) {
  const el = document.getElementById(id);
  if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.remove('active');
    if (b.getAttribute('onclick') && b.getAttribute('onclick').includes(`'${id}'`)) {
      b.classList.add('active');
    }
  });
}

// ---- File Handling ----
function handleFile(input) {
  const file = input.files[0];
  if (!file) return;
  uploadedFile = file;
  const status = document.getElementById('fileStatus');
  status.style.display = 'block';
  status.textContent = `✔ Loaded: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  document.getElementById('runBtn').disabled = false;

  const zone = document.getElementById('uploadZone');
  zone.style.borderColor = 'var(--yes)';
  zone.querySelector('.upload-icon').textContent = '✔';
}

// Drag and drop
const zone = document.getElementById('uploadZone');
zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--accent)'; });
zone.addEventListener('dragleave', () => { zone.style.borderColor = 'var(--border)'; });
zone.addEventListener('drop', e => {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.csv')) {
    uploadedFile = file;
    handleFile({ files: [file] });
  }
});

// ---- Download Sample ----
function downloadSample() {
  window.location.href = '/download-sample';
}

// ---- Demo Mode ----
function loadDemo() {
  const csvContent = `Outlook,Temperature,Humidity,Wind,Play
Sunny,Hot,High,Weak,No
Sunny,Hot,High,Strong,No
Overcast,Hot,High,Weak,Yes
Rainy,Mild,High,Weak,Yes
Rainy,Cool,Normal,Weak,Yes
Rainy,Cool,Normal,Strong,No
Overcast,Cool,Normal,Strong,Yes
Sunny,Mild,High,Weak,No
Sunny,Cool,Normal,Weak,Yes
Rainy,Mild,Normal,Weak,Yes
Sunny,Mild,Normal,Strong,Yes
Overcast,Mild,High,Strong,Yes
Overcast,Hot,Normal,Weak,Yes
Rainy,Mild,High,Strong,No`;

  const blob = new Blob([csvContent], { type: 'text/csv' });
  uploadedFile = new File([blob], 'tennis_demo.csv', { type: 'text/csv' });
  const status = document.getElementById('fileStatus');
  status.style.display = 'block';
  status.textContent = '✔ Demo dataset loaded: tennis_demo.csv (14 rows)';
  document.getElementById('runBtn').disabled = false;

  const z = document.getElementById('uploadZone');
  z.style.borderColor = 'var(--yes)';
  z.querySelector('.upload-icon').textContent = '✔';

  // Auto-run after brief delay
  setTimeout(runModel, 400);
}

let currentMode = 'upload';

// ---- Input Mode Tabs ----
function switchTab(mode) {
  currentMode = mode;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
    btn.style.background = 'transparent';
    btn.style.color = 'var(--text2)';
  });
  event.target.classList.add('active');
  event.target.style.background = 'var(--surface)';
  event.target.style.color = 'var(--text)';

  document.getElementById('tab-upload').style.display = mode === 'upload' ? 'block' : 'none';
  document.getElementById('tab-manual').style.display = mode === 'manual' ? 'block' : 'none';

  if (mode === 'manual') {
    generateGrid();
  }
}

function generateGrid() {
  const rows = parseInt(document.getElementById('gridRows').value);
  const cols = parseInt(document.getElementById('gridCols').value);
  const container = document.getElementById('gridContainer');
  
  if (rows < 2 || cols < 2) return;

  let html = '<table class="data-table" id="manualGrid" style="width:auto"><thead><tr>';
  html += '<th>#</th>';
  for (let c = 1; c < cols; c++) {
    html += `<th><input type="text" value="Feature${c}" style="width:80px; padding:0.2rem; background:transparent; border:1px solid var(--border); color:inherit" class="grid-header"></th>`;
  }
  html += `<th><input type="text" value="Label" style="width:80px; padding:0.2rem; background:transparent; border:1px solid var(--border); color:inherit" class="grid-header"></th>`;
  html += '</tr></thead><tbody>';

  for (let r = 0; r < rows; r++) {
    html += `<tr><td>${r + 1}</td>`;
    for (let c = 0; c < cols; c++) {
      const isLabel = (c === cols - 1);
      const val = isLabel ? (r % 2 === 0 ? 'ClassA' : 'ClassB') : Math.floor(Math.random()*100);
      html += `<td><input type="text" value="${val}" style="width:80px; padding:0.2rem; background:var(--bg); border:1px solid var(--border); color:inherit" class="grid-cell"></td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  container.innerHTML = html;
  
  document.getElementById('runBtn').disabled = false;
}

// ---- Run Model ----
async function runModel() {
  let fileToUpload = uploadedFile;

  if (currentMode === 'manual') {
    // Serialize grid to CSV
    const table = document.getElementById('manualGrid');
    if (!table) return;
    
    let csvStr = '';
    const headers = Array.from(table.querySelectorAll('.grid-header')).map(inp => inp.value || 'F');
    csvStr += headers.join(',') + '\n';

    const tbodyRows = table.querySelectorAll('tbody tr');
    tbodyRows.forEach(row => {
      const inputs = Array.from(row.querySelectorAll('.grid-cell')).map(inp => inp.value || '0');
      csvStr += inputs.join(',') + '\n';
    });

    const blob = new Blob([csvStr], { type: 'text/csv' });
    fileToUpload = new File([blob], 'manual_data.csv', { type: 'text/csv' });
  }

  if (!fileToUpload) return;

  const loading = showLoading();

  try {
    const formData = new FormData();
    formData.append('file', fileToUpload);

    const response = await fetch('/predict', { method: 'POST', body: formData });
    const data = await response.json();

    hideLoading(loading);

    if (data.error) {
      alert('Error: ' + data.error);
      return;
    }

    renderResults(data);
    document.getElementById('labResults').style.display = 'flex';
    document.getElementById('labResults').scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (e) {
    hideLoading(loading);
    alert('Network error. Make sure Flask server is running.');
  }
}

// ---- Render Results ----
function renderResults(data) {
  // Accuracy
  document.getElementById('accuracyNum').textContent = data.accuracy;
  document.getElementById('accuracyMeta').innerHTML =
    `${data.total_samples} samples<br>${data.classes.length} classes: ${data.classes.join(', ')}<br>Features: ${data.feature_names.join(', ')}`;

  // Algorithm Steps
  const stepsEl = document.getElementById('algorithmSteps');
  stepsEl.innerHTML = '';
  data.steps.forEach((step, i) => {
    const div = document.createElement('div');
    div.className = 'algo-step';
    let bodyHtml = '';

    if (step.data === 'detailed_calculations' && step.calculations) {
      // Detailed per-sample calculations
      bodyHtml = renderDetailedCalculations(step.calculations, data.classes, data.feature_names);
    } else if (typeof step.data === 'string') {
      bodyHtml = `<p>${step.data}</p>`;
    } else if (i === 0) {
      // Prior probabilities
      bodyHtml = Object.entries(step.data).map(([cls, info]) =>
        `<div class="prob-row" style="margin-bottom:8px">
          <span style="min-width:120px">${cls}: ${info.count}/${data.total_samples} = ${info.prior}</span>
          <div class="bar"><div class="fill ${cls === data.classes[0] ? 'yes-fill' : 'no-fill'}" style="width:${Math.round(info.prior * 100)}%">${Math.round(info.prior * 100)}%</div></div>
        </div>`
      ).join('');
    } else if (i === 1) {
      // Likelihoods
      bodyHtml = `<table class="data-table"><thead><tr><th>Class</th>${data.feature_names.map(f => `<th>${f}</th>`).join('')}</tr></thead><tbody>`;
      Object.entries(step.data).forEach(([cls, feats]) => {
        bodyHtml += `<tr><td style="font-weight:700;color:var(--accent)">${cls}</td>`;
        data.feature_names.forEach(f => {
          bodyHtml += `<td>${feats[f] ? `μ=${feats[f].mean}<br>σ=${feats[f].std}` : '-'}</td>`;
        });
        bodyHtml += '</tr>';
      });
      bodyHtml += '</tbody></table>';
    }

    div.innerHTML = `
      <div class="algo-step-header">
        <span class="algo-step-num">S${i + 1}</span>
        <span class="algo-step-title">${step.title}</span>
      </div>
      <div class="algo-step-body">${bodyHtml}</div>`;
    stepsEl.appendChild(div);
  });

  // Confusion Matrix
  renderConfusionMatrix(data.confusion_matrix, data.classes);

  // Probability chart
  renderProbChart(data.results, data.classes);

  // Results table
  renderTable(data);
}

// ---- Confusion Matrix ----
function renderConfusionMatrix(cm, classes) {
  const wrap = document.getElementById('confusionMatrix');
  const n = classes.length;

  let html = `<table class="cm-table">
    <tr><td class="cm-header-cell"></td>
    ${classes.map(c => `<td class="cm-header-cell"><strong>Pred: ${c}</strong></td>`).join('')}
    </tr>`;

  cm.forEach((row, i) => {
    html += `<tr><td class="cm-header-cell"><strong>Act: ${classes[i]}</strong></td>`;
    row.forEach((val, j) => {
      html += `<td><div class="cm-cell ${i === j ? 'diag' : 'off'}">${val}</div></td>`;
    });
    html += '</tr>';
  });

  html += '</table>';
  wrap.innerHTML = html;
}

// ---- Probability Bar Chart ----
function renderProbChart(results, classes) {
  const wrap = document.getElementById('probChart');
  wrap.innerHTML = '';

  results.slice(0, 30).forEach((r, i) => {
    const div = document.createElement('div');
    div.className = 'prob-sample';

    const segs = classes.map((cls, ci) =>
      `<div class="prob-bar-seg" style="width:${Math.round((r.probabilities[cls] || 0) * 100)}%;background:${COLORS[ci % COLORS.length]}">
        ${Math.round((r.probabilities[cls] || 0) * 100) > 12 ? Math.round((r.probabilities[cls] || 0) * 100) + '%' : ''}
      </div>`
    ).join('');

    const labelColor = r.correct ? 'var(--yes)' : 'var(--no)';
    div.innerHTML = `
      <span class="prob-sample-id">#${r.index}</span>
      <div class="prob-bar-group">${segs}</div>
      <span class="prob-sample-label" style="color:${labelColor}">${r.predicted}</span>`;
    wrap.appendChild(div);
  });

  // Legend
  const legend = document.createElement('div');
  legend.style.cssText = 'display:flex;gap:1rem;margin-top:0.75rem;flex-wrap:wrap;font-size:11px;color:var(--text2)';
  classes.forEach((cls, i) => {
    legend.innerHTML += `<span><span style="display:inline-block;width:12px;height:12px;background:${COLORS[i % COLORS.length]};border-radius:2px;margin-right:4px;vertical-align:middle"></span>${cls}</span>`;
  });
  wrap.appendChild(legend);
}

// ---- Results Table ----
function renderTable(data) {
  const thead = document.getElementById('resultsHead');
  const tbody = document.getElementById('resultsBody');

  // Headers
  thead.innerHTML = `<tr>
    <th>#</th>
    ${data.feature_names.map(f => `<th>${f}</th>`).join('')}
    <th>${data.target_name} (Actual)</th>
    <th>Predicted</th>
    <th>Correct?</th>
    ${data.classes.map((c, i) => `<th style="color:${COLORS[i % COLORS.length]}">P(${c})</th>`).join('')}
  </tr>`;

  tbody.innerHTML = data.results.map(r => {
    const rowClass = r.correct ? 'correct-row' : 'wrong-row';
    const tick = r.correct ? `<span style="color:var(--yes)">✔</span>` : `<span style="color:var(--no)">✘</span>`;
    const featCells = data.feature_names.map(f => `<td>${r.features[f] || '-'}</td>`).join('');
    const probCells = data.classes.map(c => `<td>${r.probabilities[c] !== undefined ? r.probabilities[c] : '-'}</td>`).join('');
    const predColor = r.correct ? 'yes' : 'no';
    return `<tr class="${rowClass}">
      <td>${r.index}</td>
      ${featCells}
      <td>${r.actual}</td>
      <td class="${predColor}">${r.predicted}</td>
      <td style="text-align:center">${tick}</td>
      ${probCells}
    </tr>`;
  }).join('');
}

// ---- Loading Overlay ----
function showLoading() {
  const div = document.createElement('div');
  div.className = 'loading-overlay';
  div.innerHTML = '<div class="spinner"></div>';
  document.body.appendChild(div);
  return div;
}

function hideLoading(el) {
  if (el && el.parentNode) el.parentNode.removeChild(el);
}

// ---- Init ----
document.addEventListener('DOMContentLoaded', () => {
  // Show hero on load
  document.getElementById('hero').style.display = '';

  // Scroll Reveal Animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
      }
    });
  }, { threshold: 0.1 });

  // Add scroll-reveal class to cards and watch them
  const revealClasses = ['.learn-card', '.example-block', '.type-card', '.help-card', '.algo-step', '.cm-wrap'];
  revealClasses.forEach(selector => {
    document.querySelectorAll(selector).forEach((el, index) => {
      el.classList.add('scroll-reveal');
      el.style.transitionDelay = `${(index % 4) * 0.1}s`; // Add slight staggering
      observer.observe(el);
    });
  });
});

// ---- Interactive Manual Example ----
function updateExample() {
  const oEl = document.getElementById('ex-outlook');
  if (!oEl) return;
  const o = oEl.value;
  const t = document.getElementById('ex-temp').value;
  const h = document.getElementById('ex-hum').value;
  const w = document.getElementById('ex-wind').value;

  const data = {
    Yes: { total: 9, 
           Sunny: 2, Overcast: 4, Rainy: 3,
           Hot: 2, Mild: 4, Cool: 3,
           High: 3, Normal: 6,
           Weak: 6, Strong: 3 },
    No: { total: 5,
          Sunny: 3, Overcast: 0, Rainy: 2,
          Hot: 2, Mild: 2, Cool: 1,
          High: 4, Normal: 1,
          Weak: 2, Strong: 3 }
  };

  const pYes = (9/14) * (data.Yes[o]/9) * (data.Yes[t]/9) * (data.Yes[h]/9) * (data.Yes[w]/9);
  const pNo = (5/14) * (data.No[o]/5) * (data.No[t]/5) * (data.No[h]/5) * (data.No[w]/5);

  document.getElementById('ex-calc-yes').innerHTML = `P(Yes|...) ∝ P(Yes) &times; P(${o}|Yes) &times; P(${t}|Yes) &times; P(${h}|Yes) &times; P(${w}|Yes)<br>= 9/14 &times; ${data.Yes[o]}/9 &times; ${data.Yes[t]}/9 &times; ${data.Yes[h]}/9 &times; ${data.Yes[w]}/9 = ${pYes.toFixed(4)}`;
  
  document.getElementById('ex-calc-no').innerHTML = `P(No|...) ∝ P(No) &times; P(${o}|No) &times; P(${t}|No) &times; P(${h}|No) &times; P(${w}|No)<br>= 5/14 &times; ${data.No[o]}/5 &times; ${data.No[t]}/5 &times; ${data.No[h]}/5 &times; ${data.No[w]}/5 = ${pNo.toFixed(4)}`;

  const finalStr = pYes > pNo ? `<span class="badge-yes">Play = Yes</span>` : `<span class="badge-no">Play = No</span>`;
  document.getElementById('ex-final').innerHTML = `Since ${Math.max(pYes,pNo).toFixed(4)} > ${Math.min(pYes,pNo).toFixed(4)} &rarr; ${finalStr}`;
}

document.addEventListener('DOMContentLoaded', updateExample);

// ---- Detailed Per-Sample Calculations ----
function renderDetailedCalculations(calculations, classes, featureNames) {
  let html = '<p style="margin-bottom:1rem;color:var(--text2)">For each sample, we compute: <strong>P(C|X) ∝ P(C) × Π P(xᵢ|C)</strong> using Gaussian PDF. Click any sample to expand its full calculation.</p>';

  calculations.forEach((sc) => {
    const isCorrect = sc.predicted === sc.actual;
    const statusIcon = isCorrect ? '✔' : '✘';
    const statusColor = isCorrect ? 'var(--yes)' : 'var(--no)';
    const featureStr = featureNames.map(f => sc.feature_labels[f]).join(', ');

    html += `<div class="sample-calc-card">
      <div class="sample-calc-header" onclick="toggleSampleCalc(this)">
        <div class="sample-calc-left">
          <span class="sample-calc-num">#${sc.index}</span>
          <span class="sample-calc-features">${featureStr}</span>
        </div>
        <div class="sample-calc-right">
          <span style="color:${statusColor};font-weight:700">${statusIcon} Pred: ${sc.predicted}</span>
          <span class="sample-calc-arrow">▸</span>
        </div>
      </div>
      <div class="sample-calc-body" style="display:none">`;

    // For each class, show the full calculation
    classes.forEach((cls, ci) => {
      const cc = sc.class_calcs[cls];
      const isWinner = cls === sc.predicted;
      const bgClass = isWinner ? 'calc-winner' : '';

      html += `<div class="calc-class-block ${bgClass}">
        <div class="calc-class-title">
          <span class="calc-class-label" style="background:${COLORS[ci % COLORS.length]}">Class: ${cls}</span>
          ${isWinner ? '<span class="calc-winner-badge">★ Winner</span>' : ''}
        </div>`;

      // Step A: Prior
      html += `<div class="calc-line">
          <span class="calc-step-tag">Prior</span>
          <span class="calc-formula">P(${cls}) = <strong>${cc.prior}</strong></span>
        </div>`;

      // Step B: Gaussian likelihood for each feature
      cc.likelihoods.forEach((lk) => {
        const origLabel = sc.feature_labels[lk.feature];
        const labelHint = (origLabel != lk.x && isNaN(origLabel)) ? ` <span style="color:var(--text3)">[${origLabel} → encoded: ${lk.x}]</span>` : '';
        html += `<div class="calc-line">
          <span class="calc-step-tag">P(${lk.feature}|${cls})</span>
          <span class="calc-formula">
            Gaussian(x=${lk.x}${labelHint}, μ=${lk.mean}, σ=${lk.std}) = <strong>${lk.pdf.toExponential(4)}</strong>
          </span>
        </div>`;
      });

      // Step C: Product
      html += `<div class="calc-line calc-product-line">
          <span class="calc-step-tag">Posterior</span>
          <span class="calc-formula">
            P(${cls}) × ${cc.likelihoods.map(lk => `P(${lk.feature}|${cls})`).join(' × ')} = <strong>${cc.raw_posterior.toExponential(6)}</strong>
          </span>
        </div>`;

      // Step D: Normalized
      html += `<div class="calc-line calc-norm-line">
          <span class="calc-step-tag">Normalized</span>
          <span class="calc-formula">P(${cls}|X) = <strong>${(cc.normalized * 100).toFixed(2)}%</strong></span>
        </div>`;

      html += `</div>`; // end calc-class-block
    });

    // Final verdict
    html += `<div class="calc-verdict">
        <span>Prediction: <strong>${sc.predicted}</strong></span>
        <span>Actual: <strong>${sc.actual}</strong></span>
        <span style="color:${statusColor};font-weight:700">${isCorrect ? '✔ Correct' : '✘ Incorrect'}</span>
      </div>`;

    html += `</div></div>`; // end body + card
  });

  return html;
}

function toggleSampleCalc(headerEl) {
  const body = headerEl.nextElementSibling;
  const arrow = headerEl.querySelector('.sample-calc-arrow');
  if (body.style.display === 'none') {
    body.style.display = 'block';
    arrow.textContent = '▾';
    headerEl.parentElement.classList.add('expanded');
  } else {
    body.style.display = 'none';
    arrow.textContent = '▸';
    headerEl.parentElement.classList.remove('expanded');
  }
}
