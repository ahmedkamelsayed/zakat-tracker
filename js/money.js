// ─── Money Zakat Logic ────────────────────────────────────────

const CURRENCY_SYMBOLS = {
  EGP: 'ج.م', SAR: 'ر.س', AED: 'د.إ', USD: '$', EUR: '€', GBP: '£', KWD: 'د.ك'
};

let moneyEntries = JSON.parse(localStorage.getItem('zakat_money_entries') || '[]');
let moneyNisab = parseFloat(localStorage.getItem('zakat_money_nisab_value') || '0');
let mainCurrency = localStorage.getItem('zakat_money_currency') || 'EGP';

// Init
document.getElementById('mDate').value = new Date().toISOString().slice(0, 10);
document.getElementById('mainCurrency').value = mainCurrency;
document.getElementById('moneyNisab').value = moneyNisab ? Math.round(moneyNisab) : 0;

document.getElementById('mainCurrency').addEventListener('change', function () {
  mainCurrency = this.value;
  localStorage.setItem('zakat_money_currency', mainCurrency);
  updateMoneyNisab();
});

// ─── Nisab Calculation ────────────────────────────────────────
// Nisab for money = 85 grams of 24k gold price in the chosen currency
async function updateMoneyNisab() {
  const btn = document.querySelector('.price-setting .btn-fetch');
  if (btn) { btn.classList.add('loading'); btn.textContent = '⏳ جاري...'; }

  try {
    const pricePerGram = await GoldAPI.getPriceInCurrency(mainCurrency);
    if (pricePerGram) {
      moneyNisab = pricePerGram * NISAB_GRAMS;
      document.getElementById('moneyNisab').value = Math.round(moneyNisab);
      localStorage.setItem('zakat_money_nisab_value', moneyNisab);
      renderMoney();
      showToast('تم تحديث النصاب: ' + Math.round(moneyNisab).toLocaleString('ar-EG') + ' ' + CURRENCY_SYMBOLS[mainCurrency], 'success');
    } else {
      showToast('لم نتمكن من حساب النصاب. أدخل سعر الذهب يدوياً في صفحة الذهب.', 'error');
    }
  } catch (e) {
    showToast('خطأ: ' + e.message, 'error');
  }

  if (btn) { btn.classList.remove('loading'); btn.textContent = '🔄 حساب النصاب'; }
}

// Allow manual nisab override
document.getElementById('moneyNisab').addEventListener('dblclick', function () {
  this.removeAttribute('readonly');
  this.focus();
});

document.getElementById('moneyNisab').addEventListener('blur', function () {
  this.setAttribute('readonly', '');
  moneyNisab = parseFloat(this.value) || 0;
  localStorage.setItem('zakat_money_nisab_value', moneyNisab);
  renderMoney();
});

// ─── Compute ──────────────────────────────────────────────────
function computeMoney() {
  const sorted = [...moneyEntries].sort((a, b) => new Date(a.date) - new Date(b.date));

  // For simplicity, convert all to main currency using stored rates or 1:1 if same
  let cumulative = 0;
  let nisabIndex = -1;
  let nisabDate = null;

  const rows = sorted.map((e, i) => {
    const amount = e.type === 'expense' ? -Math.abs(e.amount) : Math.abs(e.amount);
    // Simple: assume same currency for now, or use rate
    const amountInMain = amount * getExchangeRate(e.currency, mainCurrency);
    cumulative += amountInMain;
    if (cumulative < 0) cumulative = 0;

    const row = {
      ...e,
      amountInMain: Math.abs(amountInMain),
      signedAmount: amountInMain,
      cumulative: +cumulative.toFixed(2),
      rowIndex: i
    };

    if (nisabIndex === -1 && cumulative >= moneyNisab && moneyNisab > 0) {
      nisabIndex = i;
      nisabDate = e.date;
      row.isNisabRow = true;
    }

    return row;
  });

  // Zakat calculation
  rows.forEach((row, i) => {
    if (row.cumulative < moneyNisab && !row.isNisabRow) {
      row.zakat1 = 0;
      row.zakat2 = 0;
      row.zakatDueDate = null;
    } else if (moneyNisab <= 0) {
      row.zakat1 = 0;
      row.zakat2 = 0;
      row.zakatDueDate = null;
    } else {
      row.zakatDueDate = addOneHijriYear(row.date);

      // Scenario 1: this row's contribution * 2.5%
      if (row.isNisabRow) {
        row.zakat1 = row.cumulative * 0.025;
      } else if (row.type === 'expense') {
        row.zakat1 = 0; // Withdrawals don't add zakat
      } else {
        row.zakat1 = row.amountInMain * 0.025;
      }

      // Scenario 2: accumulated with monthly penalty
      let s2 = 0;
      const rowDate = new Date(row.date + 'T12:00:00');

      for (let j = 0; j <= i; j++) {
        if (rows[j].cumulative < moneyNisab && !rows[j].isNisabRow) continue;
        if (rows[j].zakat1 <= 0) continue;
        s2 += rows[j].zakat1;
        if (j < i) {
          const prevDate = new Date(rows[j].date + 'T12:00:00');
          const monthsDiff = hijriMonthsDiff(prevDate, rowDate);
          if (monthsDiff > 0) {
            s2 += (rows[j].zakat1 / 12) * monthsDiff;
          }
        }
      }
      row.zakat2 = s2;
    }
  });

  return { rows, nisabDate, nisabIndex };
}

// Simple exchange rate (stored or 1:1 for same currency)
function getExchangeRate(from, to) {
  if (from === to) return 1;
  // Use stored rates if available
  const rates = JSON.parse(localStorage.getItem('zakat_exchange_rates') || '{}');
  if (rates[from] && rates[to]) {
    return rates[to] / rates[from];
  }
  return 1; // Fallback
}

// ─── Render ───────────────────────────────────────────────────
function renderMoney() {
  const { rows, nisabDate } = computeMoney();
  const tbody = document.getElementById('moneyBody');
  const tfoot = document.getElementById('moneyFoot');
  const sym = CURRENCY_SYMBOLS[mainCurrency] || mainCurrency;

  // Filters
  const filterCurrency = document.getElementById('mFilterCurrency')?.value || '';
  const filterType = document.getElementById('mFilterType')?.value || '';

  let filtered = rows;
  if (filterCurrency) filtered = filtered.filter(r => r.currency === filterCurrency);
  if (filterType) filtered = filtered.filter(r => r.type === filterType);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12"><div class="empty-state"><div class="icon">💵</div><p>${rows.length === 0 ? 'ابدأ بإضافة أول مبلغ مالي' : 'لا توجد نتائج'}</p></div></td></tr>`;
    tfoot.innerHTML = '';
    updateMoneySummary(rows, nisabDate);
    return;
  }

  tbody.innerHTML = filtered.map((row, i) => {
    const isNisab = row.isNisabRow;
    const hijriStr = getHijriString(row.date);
    const typeLabel = row.type === 'income' ? '<span style="color:var(--green)">إيداع</span>' : '<span style="color:var(--red)">سحب</span>';

    const zakatDueStr = row.zakatDueDate
      ? `<div class="greg-date">${row.zakatDueDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</div><div class="hijri-date">${getHijriString(row.zakatDueDate)}</div>`
      : '<span class="val-zero">—</span>';

    const z1 = row.zakat1 > 0 ? `<span class="val-gold">${row.zakat1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span>` : '<span class="val-zero">0</span>';
    const z2 = row.zakat2 > 0 ? `<span class="val-green">${row.zakat2.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span>` : '<span class="val-zero">0</span>';

    return `
      <tr class="${isNisab ? 'nisab-row' : ''} fade-in">
        <td>${i + 1}</td>
        <td><strong>${row.desc || '—'}</strong>${isNisab ? '<br><span class="nisab-badge">★ يوم النصاب</span>' : ''}</td>
        <td>${row.amount.toLocaleString('ar-EG')} ${CURRENCY_SYMBOLS[row.currency] || row.currency}</td>
        <td>${row.currency}</td>
        <td>${typeLabel}</td>
        <td>${row.cumulative.toLocaleString('ar-EG')} ${sym}</td>
        <td><div class="greg-date">${formatGreg(row.date)}</div></td>
        <td><div class="hijri-date">${hijriStr}</div></td>
        <td>${zakatDueStr}</td>
        <td>${z1}</td>
        <td>${z2}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-edit" onclick="openMoneyEdit('${row.id}')">✏️</button>
          <button class="btn btn-danger" onclick="deleteMoneyEntry('${row.id}')">🗑</button>
        </td>
      </tr>`;
  }).join('');

  // Totals
  const totalZ1 = rows.reduce((s, r) => s + (r.zakat1 || 0), 0);
  const totalZ2 = rows.length > 0 ? (rows[rows.length - 1].zakat2 || 0) : 0;
  const totalCum = rows.length > 0 ? rows[rows.length - 1].cumulative : 0;

  tfoot.innerHTML = `
    <tr class="totals-row">
      <td colspan="5" style="text-align:right">المجموع</td>
      <td>${totalCum.toLocaleString('ar-EG')} ${sym}</td>
      <td colspan="3"></td>
      <td>${totalZ1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ${sym}</td>
      <td>${totalZ2.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ${sym}</td>
      <td></td>
    </tr>`;

  updateMoneySummary(rows, nisabDate);
  renderMoneyAnnual(rows);
  renderMoneyChart(rows);
}

function updateMoneySummary(rows, nisabDate) {
  const sym = CURRENCY_SYMBOLS[mainCurrency] || mainCurrency;
  const totalCum = rows.length > 0 ? rows[rows.length - 1].cumulative : 0;
  const totalZ1 = rows.reduce((s, r) => s + (r.zakat1 || 0), 0);
  const pct = moneyNisab > 0 ? Math.min(100, (totalCum / moneyNisab) * 100) : 0;

  document.getElementById('mTotalSavings').textContent = totalCum.toLocaleString('ar-EG') + ' ' + sym;
  document.getElementById('mNisabFill').style.width = pct + '%';

  if (moneyNisab <= 0) {
    document.getElementById('mNisabProgress').textContent = 'اضغط "حساب النصاب" لتحديث';
  } else {
    document.getElementById('mNisabProgress').textContent = totalCum >= moneyNisab
      ? `✅ تجاوزت النصاب بـ ${(totalCum - moneyNisab).toLocaleString('ar-EG')} ${sym}`
      : `متبقي ${(moneyNisab - totalCum).toLocaleString('ar-EG')} ${sym} للنصاب`;
  }

  if (nisabDate) {
    document.getElementById('mNisabDate').textContent = formatGreg(nisabDate);
    document.getElementById('mNisabHijri').textContent = getHijriString(nisabDate);
    const dueDate = addOneHijriYear(nisabDate);
    document.getElementById('mZakatDueDate').textContent = dueDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('mZakatDueHijri').textContent = getHijriString(dueDate);
    localStorage.setItem('zakat_money_nisab', JSON.stringify({ date: nisabDate }));
  } else {
    document.getElementById('mNisabDate').textContent = 'لم يبلغ النصاب بعد';
    document.getElementById('mNisabHijri').textContent = '';
    document.getElementById('mZakatDueDate').textContent = '—';
    document.getElementById('mZakatDueHijri').textContent = '';
  }

  document.getElementById('mTotalZakat').textContent = totalZ1.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ' + sym;
}

// ─── Annual Summary ───────────────────────────────────────────
function renderMoneyAnnual(rows) {
  const section = document.getElementById('mAnnualSummary');
  const body = document.getElementById('mAnnualBody');
  if (!section || !body) return;

  if (rows.length === 0) { section.style.display = 'none'; return; }

  const sym = CURRENCY_SYMBOLS[mainCurrency] || mainCurrency;
  const yearMap = {};
  rows.forEach(r => {
    const hy = getHijriYear(r.date);
    if (!yearMap[hy]) yearMap[hy] = { count: 0, income: 0, expense: 0, zakat1: 0 };
    yearMap[hy].count++;
    if (r.type === 'income') yearMap[hy].income += r.amountInMain;
    else yearMap[hy].expense += r.amountInMain;
    yearMap[hy].zakat1 += r.zakat1 || 0;
  });

  body.innerHTML = Object.keys(yearMap).sort().map(y => {
    const d = yearMap[y];
    return `<tr>
      <td>${y} هـ</td>
      <td>${d.count}</td>
      <td>${d.income.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${sym}</td>
      <td>${d.expense.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ${sym}</td>
      <td>${d.zakat1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ${sym}</td>
    </tr>`;
  }).join('');

  section.style.display = 'block';
}

// ─── Chart ────────────────────────────────────────────────────
function renderMoneyChart(rows) {
  const section = document.getElementById('mChartSection');
  if (!section) return;
  if (rows.length < 2) { section.style.display = 'none'; return; }

  const labels = rows.map(r => formatGreg(r.date));
  const cumData = rows.map(r => r.cumulative);

  renderGrowthChart('moneyChart', labels, [
    { label: 'التراكمي (' + mainCurrency + ')', data: cumData, color: '#5B9BD5' }
  ]);

  section.style.display = 'block';
}

// ─── CRUD ─────────────────────────────────────────────────────
function addMoneyEntry() {
  const desc = document.getElementById('mDesc').value.trim();
  const amount = parseFloat(document.getElementById('mAmount').value);
  const currency = document.getElementById('mCurrency').value;
  const type = document.getElementById('mType').value;
  const date = document.getElementById('mDate').value;

  if (!amount || !date) {
    showToast('يرجى إدخال المبلغ والتاريخ', 'error');
    return;
  }

  moneyEntries.push({
    id: Date.now().toString(),
    desc: desc || (type === 'income' ? 'إيداع' : 'سحب'),
    amount, currency, type, date
  });

  saveMoney();
  renderMoney();
  showToast('تمت الإضافة بنجاح');

  document.getElementById('mDesc').value = '';
  document.getElementById('mAmount').value = '';
}

function deleteMoneyEntry(id) {
  if (!confirm('هل تريد حذف هذه المعاملة؟')) return;
  moneyEntries = moneyEntries.filter(e => e.id !== id);
  saveMoney();
  renderMoney();
}

function clearAllMoney() {
  if (!confirm('هل تريد مسح جميع بيانات المال؟')) return;
  moneyEntries = [];
  saveMoney();
  renderMoney();
}

function saveMoney() {
  localStorage.setItem('zakat_money_entries', JSON.stringify(moneyEntries));
}

// ─── Edit Modal ───────────────────────────────────────────────
function openMoneyEdit(id) {
  const e = moneyEntries.find(x => x.id === id);
  if (!e) return;
  document.getElementById('meId').value = id;
  document.getElementById('meDesc').value = e.desc;
  document.getElementById('meAmount').value = e.amount;
  document.getElementById('meCurrency').value = e.currency;
  document.getElementById('meType').value = e.type;
  document.getElementById('meDate').value = e.date;
  document.getElementById('moneyEditModal').classList.add('show');
}

function closeMoneyModal() {
  document.getElementById('moneyEditModal').classList.remove('show');
}

function saveMoneyEdit() {
  const id = document.getElementById('meId').value;
  const idx = moneyEntries.findIndex(x => x.id === id);
  if (idx === -1) return;
  moneyEntries[idx] = {
    ...moneyEntries[idx],
    desc: document.getElementById('meDesc').value,
    amount: parseFloat(document.getElementById('meAmount').value),
    currency: document.getElementById('meCurrency').value,
    type: document.getElementById('meType').value,
    date: document.getElementById('meDate').value,
  };
  saveMoney();
  renderMoney();
  closeMoneyModal();
  showToast('تم الحفظ بنجاح');
}

document.getElementById('moneyEditModal').addEventListener('click', function (e) {
  if (e.target === this) closeMoneyModal();
});

// ─── Export CSV ───────────────────────────────────────────────
function exportMoneyCSV() {
  const { rows } = computeMoney();
  if (rows.length === 0) { showToast('لا توجد بيانات', 'error'); return; }

  const headers = ['الوصف', 'المبلغ', 'العملة', 'النوع', 'التراكمي', 'التاريخ', 'التاريخ الهجري', 'زكاة س1', 'زكاة س2'];
  const csv = [headers.join(','), ...rows.map(r => [
    r.desc, r.amount, r.currency, r.type === 'income' ? 'إيداع' : 'سحب',
    r.cumulative, r.date, getHijriString(r.date),
    (r.zakat1 || 0).toFixed(2), (r.zakat2 || 0).toFixed(2)
  ].join(','))].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zakat-money.csv';
  a.click();
}

// ─── Init ─────────────────────────────────────────────────────
initSortableTable('moneyTable', renderMoney);
renderMoney();

// Auto-fetch nisab on first load if not set
if (!moneyNisab) {
  updateMoneyNisab();
}
