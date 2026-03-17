// ─── Stocks Zakat Logic ───────────────────────────────────────

const CURRENCY_SYMBOLS_S = {
  EGP: 'ج.م', SAR: 'ر.س', AED: 'د.إ', USD: '$', EUR: '€', GBP: '£', KWD: 'د.ك'
};

const TYPE_LABELS = {
  stock: 'سهم',
  fund: 'صندوق',
  sukuk: 'صكوك'
};

const PURPOSE_LABELS = {
  trading: 'متاجرة',
  'long-term': 'استثمار'
};

let stockEntries = ZakatStore.getStockEntries();
let stockExchangeRates = ZakatStore.getExchangeRates();

// Set today as default date
document.getElementById('sDate').value = new Date().toISOString().slice(0, 10);

// ─── Toggle dividend field ───────────────────────────────────
function toggleDividendField() {
  const purpose = document.getElementById('sPurpose').value;
  document.getElementById('dividendGroup').style.display = purpose === 'long-term' ? '' : 'none';
}

// ─── Convert to EGP ──────────────────────────────────────────
function stockToEGP(amount, currency) {
  if (currency === 'EGP') return amount;
  const rate = stockExchangeRates[currency];
  return rate && rate > 0 ? amount * rate : amount;
}

// ─── Compute ─────────────────────────────────────────────────
function computeStocks() {
  return stockEntries.map(s => {
    const totalValue = s.shares * s.pricePerShare;
    const valueEGP = stockToEGP(totalValue, s.currency);
    const dividendEGP = s.dividendAmount ? stockToEGP(s.dividendAmount, s.currency) : 0;

    let zakatDue = 0;
    if (s.purpose === 'trading') {
      zakatDue = valueEGP * 0.025;
    } else {
      // Long-term: zakat on dividends only
      zakatDue = dividendEGP * 0.025;
    }

    return {
      ...s,
      totalValue,
      valueEGP,
      dividendEGP,
      zakatDue
    };
  });
}

// ─── Render ──────────────────────────────────────────────────
function renderStocks() {
  const rows = computeStocks();
  const tbody = document.getElementById('stocksBody');
  const tfoot = document.getElementById('stocksFoot');

  // Filters
  const filterType = document.getElementById('sFilterType')?.value || '';
  const filterPurpose = document.getElementById('sFilterPurpose')?.value || '';

  let filtered = rows;
  if (filterType) filtered = filtered.filter(r => r.type === filterType);
  if (filterPurpose) filtered = filtered.filter(r => r.purpose === filterPurpose);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12"><div class="empty-state"><div class="icon">📈</div><p>${rows.length === 0 ? 'ابدأ بإضافة أول سهم أو استثمار' : 'لا توجد نتائج مطابقة'}</p></div></td></tr>`;
    tfoot.innerHTML = '';
    updateStockSummary(rows);
    renderStocksChart(rows);
    return;
  }

  const fmt = (n) => n.toLocaleString('ar-EG', { maximumFractionDigits: 2 });

  tbody.innerHTML = filtered.map((row, i) => {
    const rateDisplay = row.currency === 'EGP' ? '—' : (stockExchangeRates[row.currency]?.toLocaleString('ar-EG') || '⚠️');

    return `
      <tr class="fade-in">
        <td>${i + 1}</td>
        <td><strong>${row.name}</strong></td>
        <td>${TYPE_LABELS[row.type] || row.type}</td>
        <td><span class="badge ${row.purpose === 'trading' ? 'badge-24' : 'badge-21'}">${PURPOSE_LABELS[row.purpose] || row.purpose}</span></td>
        <td>${row.shares.toLocaleString('ar-EG')}</td>
        <td>${fmt(row.pricePerShare)} ${CURRENCY_SYMBOLS_S[row.currency] || row.currency}</td>
        <td>${fmt(row.totalValue)} ${CURRENCY_SYMBOLS_S[row.currency] || row.currency}</td>
        <td><strong>${fmt(row.valueEGP)}</strong> ج.م</td>
        <td>${row.dividendAmount ? fmt(row.dividendEGP) + ' ج.م' : '<span class="val-zero">—</span>'}</td>
        <td><span class="val-gold">${fmt(row.zakatDue)}</span> ج.م</td>
        <td><div class="greg-date">${formatGreg(row.dateAcquired)}</div><div class="hijri-date">${getHijriString(row.dateAcquired)}</div></td>
        <td style="white-space:nowrap">
          <button class="btn btn-edit" onclick="openStockEdit('${row.id}')">✏️</button>
          <button class="btn btn-danger" onclick="deleteStock('${row.id}')">🗑</button>
        </td>
      </tr>`;
  }).join('');

  // Totals
  const totalValueEGP = rows.reduce((s, r) => s + r.valueEGP, 0);
  const totalZakat = rows.reduce((s, r) => s + r.zakatDue, 0);

  tfoot.innerHTML = `
    <tr class="totals-row">
      <td colspan="7" style="text-align:right">المجموع</td>
      <td>${fmt(totalValueEGP)} ج.م</td>
      <td></td>
      <td>${fmt(totalZakat)} ج.م</td>
      <td colspan="2"></td>
    </tr>`;

  updateStockSummary(rows);
  renderStocksChart(rows);
}

function updateStockSummary(rows) {
  const fmt = (n) => n.toLocaleString('ar-EG', { maximumFractionDigits: 0 });
  const totalValue = rows.reduce((s, r) => s + r.valueEGP, 0);
  const totalZakat = rows.reduce((s, r) => s + r.zakatDue, 0);
  const tradingValue = rows.filter(r => r.purpose === 'trading').reduce((s, r) => s + r.valueEGP, 0);
  const longTermValue = rows.filter(r => r.purpose === 'long-term').reduce((s, r) => s + r.valueEGP, 0);

  document.getElementById('sTotalValue').textContent = fmt(totalValue) + ' ج.م';
  document.getElementById('sTotalCount').textContent = rows.length + ' أصل';
  document.getElementById('sTotalZakat').textContent = fmt(totalZakat) + ' ج.م';
  document.getElementById('sTradingValue').textContent = fmt(tradingValue) + ' ج.م';
  document.getElementById('sLongTermValue').textContent = fmt(longTermValue) + ' ج.م';
}

// ─── Chart ───────────────────────────────────────────────────
function renderStocksChart(rows) {
  const section = document.getElementById('sChartSection');
  if (!section) return;

  if (rows.length < 1) { section.style.display = 'none'; return; }

  const labels = rows.map(r => r.name);
  const data = rows.map(r => +r.valueEGP.toFixed(2));
  const colors = rows.map((_, i) => {
    const palette = ['#C9A84C', '#5B9BD5', '#4CAF7A', '#CF6679', '#9C7BCC', '#E8A742', '#5CC4C4', '#D45B5B'];
    return palette[i % palette.length];
  });

  const canvas = document.getElementById('stocksChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (canvas._chartInstance) canvas._chartInstance.destroy();

  const textColor = getChartTextColor();

  const chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderColor: 'transparent',
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: textColor, font: { family: 'Tajawal', size: 13 }, padding: 16 }
        }
      }
    }
  });

  canvas._chartInstance = chart;
  section.style.display = 'block';
}

// ─── CRUD ────────────────────────────────────────────────────
function addStock() {
  const name = document.getElementById('sName').value.trim();
  const type = document.getElementById('sType').value;
  const purpose = document.getElementById('sPurpose').value;
  const shares = parseInt(document.getElementById('sShares').value);
  const pricePerShare = parseFloat(document.getElementById('sPrice').value);
  const currency = document.getElementById('sCurrency').value;
  const dateAcquired = document.getElementById('sDate').value;
  const dividendAmount = parseFloat(document.getElementById('sDividend').value) || 0;

  if (!name || !shares || !pricePerShare || !dateAcquired) {
    showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
    return;
  }

  stockEntries.push({
    id: Date.now().toString(),
    name, type, purpose, shares, pricePerShare, currency, dateAcquired, dividendAmount
  });

  saveStocks();
  renderStocks();
  showToast('تمت الإضافة بنجاح');

  // Reset form
  document.getElementById('sName').value = '';
  document.getElementById('sShares').value = '';
  document.getElementById('sPrice').value = '';
  document.getElementById('sDividend').value = '';
}

function deleteStock(id) {
  if (!confirm('هل تريد حذف هذا الاستثمار؟')) return;
  stockEntries = stockEntries.filter(s => s.id !== id);
  saveStocks();
  renderStocks();
}

function clearAllStocks() {
  if (!confirm('هل تريد مسح جميع بيانات الأسهم؟')) return;
  stockEntries = [];
  saveStocks();
  renderStocks();
}

function saveStocks() {
  ZakatStore.setStockEntries(stockEntries);
}

// ─── Edit Modal ──────────────────────────────────────────────
function openStockEdit(id) {
  const s = stockEntries.find(x => x.id === id);
  if (!s) return;
  document.getElementById('seId').value = id;
  document.getElementById('seName').value = s.name;
  document.getElementById('seType').value = s.type;
  document.getElementById('sePurpose').value = s.purpose;
  document.getElementById('seShares').value = s.shares;
  document.getElementById('sePrice').value = s.pricePerShare;
  document.getElementById('seCurrency').value = s.currency;
  document.getElementById('seDate').value = s.dateAcquired;
  document.getElementById('seDividend').value = s.dividendAmount || '';
  document.getElementById('stockEditModal').classList.add('show');
}

function closeStockModal() {
  document.getElementById('stockEditModal').classList.remove('show');
}

function saveStockEdit() {
  const id = document.getElementById('seId').value;
  const idx = stockEntries.findIndex(x => x.id === id);
  if (idx === -1) return;

  stockEntries[idx] = {
    ...stockEntries[idx],
    name: document.getElementById('seName').value,
    type: document.getElementById('seType').value,
    purpose: document.getElementById('sePurpose').value,
    shares: parseInt(document.getElementById('seShares').value),
    pricePerShare: parseFloat(document.getElementById('sePrice').value),
    currency: document.getElementById('seCurrency').value,
    dateAcquired: document.getElementById('seDate').value,
    dividendAmount: parseFloat(document.getElementById('seDividend').value) || 0
  };

  saveStocks();
  renderStocks();
  closeStockModal();
  showToast('تم الحفظ بنجاح');
}

document.getElementById('stockEditModal').addEventListener('click', function (e) {
  if (e.target === this) closeStockModal();
});

// ─── Export CSV ──────────────────────────────────────────────
function exportStocksCSV() {
  const rows = computeStocks();
  if (rows.length === 0) { showToast('لا توجد بيانات', 'error'); return; }

  const headers = ['الاسم', 'النوع', 'الغرض', 'عدد الأسهم', 'سعر السهم', 'العملة', 'القيمة الإجمالية', 'القيمة بالجنيه', 'الأرباح', 'الزكاة', 'تاريخ الشراء'];
  const csv = [headers.join(','), ...rows.map(r => [
    r.name, TYPE_LABELS[r.type], PURPOSE_LABELS[r.purpose],
    r.shares, r.pricePerShare, r.currency,
    r.totalValue.toFixed(2), r.valueEGP.toFixed(2),
    r.dividendAmount || 0, r.zakatDue.toFixed(2), r.dateAcquired
  ].join(','))].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zakat-stocks.csv';
  a.click();
}

// ─── Init ────────────────────────────────────────────────────
initSortableTable('stocksTable', renderStocks);
renderStocks();
