// ─── Money Zakat Logic ────────────────────────────────────────

const CURRENCY_SYMBOLS = {
  EGP: 'ج.م', SAR: 'ر.س', AED: 'د.إ', USD: '$', EUR: '€', GBP: '£', KWD: 'د.ك'
};

let moneyEntries = JSON.parse(localStorage.getItem('zakat_money_entries') || '[]');
let moneyNisab = parseFloat(localStorage.getItem('zakat_money_nisab_value') || '0');
let exchangeRates = JSON.parse(localStorage.getItem('zakat_exchange_rates') || '{}');
// rates are stored as { USD: 50, EUR: 55, SAR: 13.3, ... } meaning 1 unit = X EGP

// Init
document.getElementById('mDate').value = new Date().toISOString().slice(0, 10);
document.getElementById('moneyNisab').value = moneyNisab ? Math.round(moneyNisab) : 0;

// ─── Exchange Rates ───────────────────────────────────────────
async function fetchExchangeRates() {
  try {
    const resp = await fetch('https://open.er-api.com/v6/latest/EGP');
    if (!resp.ok) throw new Error('rate fetch failed');
    const data = await resp.json();
    if (data.rates) {
      // We need: 1 USD = ? EGP → that's 1 / data.rates.USD
      // because data.rates gives 1 EGP = X USD
      const ratesInEGP = { EGP: 1 };
      for (const [code, rateFromEGP] of Object.entries(data.rates)) {
        if (rateFromEGP > 0) {
          ratesInEGP[code] = +(1 / rateFromEGP).toFixed(4);
        }
      }
      exchangeRates = ratesInEGP;
      localStorage.setItem('zakat_exchange_rates', JSON.stringify(exchangeRates));
      localStorage.setItem('zakat_exchange_rates_time', Date.now().toString());
      return true;
    }
  } catch (e) {
    console.warn('Exchange rate fetch failed:', e.message);
  }
  return false;
}

// Convert amount from any currency to EGP
function toEGP(amount, currency) {
  if (currency === 'EGP') return amount;
  const rate = exchangeRates[currency];
  if (rate && rate > 0) return amount * rate;
  // No rate available — return as-is with a warning
  return amount;
}

function getExchangeRateDisplay(currency) {
  if (currency === 'EGP') return 1;
  return exchangeRates[currency] || null;
}

// ─── Nisab Calculation ────────────────────────────────────────
// Nisab = 85g × gold 24k price in EGP
// Try: 1) goldPrice from gold page localStorage, 2) fetch from API
async function calcNisabAuto() {
  const nisabDisplay = document.getElementById('moneyNisab');
  const statusEl = document.getElementById('nisabStatus');

  // Method 1: use gold price from gold page
  let goldPrice = parseFloat(localStorage.getItem('zakat_price') || '0');

  // Method 2: fetch if not available or zero
  if (!goldPrice) {
    try {
      const price = await GoldAPI.fetchPrice();
      if (price) goldPrice = price;
    } catch (e) {
      console.warn('Gold price fetch failed:', e.message);
    }
  }

  if (goldPrice > 0) {
    moneyNisab = goldPrice * NISAB_GRAMS;
    nisabDisplay.value = Math.round(moneyNisab);
    localStorage.setItem('zakat_money_nisab_value', moneyNisab.toString());
    if (statusEl) {
      statusEl.textContent = `(85 جم × ${goldPrice.toLocaleString('ar-EG')} ج.م = ${Math.round(moneyNisab).toLocaleString('ar-EG')} ج.م)`;
    }
    return true;
  }

  if (statusEl) statusEl.textContent = '(أدخل سعر الذهب في صفحة زكاة الذهب)';
  return false;
}

// Manual nisab override on double click
document.getElementById('moneyNisab').addEventListener('dblclick', function () {
  this.removeAttribute('readonly');
  this.focus();
});

document.getElementById('moneyNisab').addEventListener('blur', function () {
  this.setAttribute('readonly', '');
  moneyNisab = parseFloat(this.value) || 0;
  localStorage.setItem('zakat_money_nisab_value', moneyNisab.toString());
  renderMoney();
});

// ─── Compute ──────────────────────────────────────────────────
function computeMoney() {
  const sorted = [...moneyEntries].sort((a, b) => new Date(a.date) - new Date(b.date));

  let cumulative = 0; // always in EGP
  let nisabIndex = -1;
  let nisabDate = null;

  const rows = sorted.map((e, i) => {
    const amountEGP = toEGP(e.amount, e.currency);
    const signed = e.type === 'expense' ? -Math.abs(amountEGP) : Math.abs(amountEGP);
    cumulative += signed;
    if (cumulative < 0) cumulative = 0;

    const row = {
      ...e,
      amountEGP: Math.abs(amountEGP),
      signedEGP: signed,
      rate: getExchangeRateDisplay(e.currency),
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

      // Scenario 1
      if (row.isNisabRow) {
        row.zakat1 = row.cumulative * 0.025;
      } else if (row.type === 'expense') {
        row.zakat1 = 0;
      } else {
        row.zakat1 = row.amountEGP * 0.025;
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

// ─── Render ───────────────────────────────────────────────────
function renderMoney() {
  const { rows, nisabDate } = computeMoney();
  const tbody = document.getElementById('moneyBody');
  const tfoot = document.getElementById('moneyFoot');

  // Filters
  const filterCurrency = document.getElementById('mFilterCurrency')?.value || '';
  const filterType = document.getElementById('mFilterType')?.value || '';

  let filtered = rows;
  if (filterCurrency) filtered = filtered.filter(r => r.currency === filterCurrency);
  if (filterType) filtered = filtered.filter(r => r.type === filterType);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14"><div class="empty-state"><div class="icon">💵</div><p>${rows.length === 0 ? 'ابدأ بإضافة أول مبلغ مالي' : 'لا توجد نتائج'}</p></div></td></tr>`;
    tfoot.innerHTML = '';
    updateMoneySummary(rows, nisabDate);
    return;
  }

  tbody.innerHTML = filtered.map((row, i) => {
    const isNisab = row.isNisabRow;
    const hijriStr = getHijriString(row.date);
    const typeLabel = row.type === 'income'
      ? '<span style="color:var(--green)">إيداع</span>'
      : '<span style="color:var(--red)">سحب</span>';

    const zakatDueStr = row.zakatDueDate
      ? `<div class="greg-date">${row.zakatDueDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</div><div class="hijri-date">${getHijriString(row.zakatDueDate)}</div>`
      : '<span class="val-zero">—</span>';

    const z1 = row.zakat1 > 0
      ? `<span class="val-gold">${row.zakat1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span>`
      : '<span class="val-zero">0</span>';
    const z2 = row.zakat2 > 0
      ? `<span class="val-green">${row.zakat2.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span>`
      : '<span class="val-zero">0</span>';

    // Rate display
    const rateStr = row.currency === 'EGP' ? '—' : (row.rate ? row.rate.toLocaleString('ar-EG') : '⚠️');

    // EGP equivalent
    const egpStr = row.currency === 'EGP'
      ? row.amount.toLocaleString('ar-EG')
      : `<strong>${row.amountEGP.toLocaleString('ar-EG', { maximumFractionDigits: 0 })}</strong>`;

    return `
      <tr class="${isNisab ? 'nisab-row' : ''} fade-in">
        <td>${i + 1}</td>
        <td><strong>${row.desc || '—'}</strong>${isNisab ? '<br><span class="nisab-badge">★ يوم النصاب</span>' : ''}</td>
        <td>${row.amount.toLocaleString('ar-EG')} ${CURRENCY_SYMBOLS[row.currency] || row.currency}</td>
        <td>${row.currency}</td>
        <td>${rateStr}</td>
        <td>${egpStr} ج.م</td>
        <td>${typeLabel}</td>
        <td>${row.cumulative.toLocaleString('ar-EG')} ج.م</td>
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
  const totalEGP = rows.reduce((s, r) => s + (r.type === 'income' ? r.amountEGP : -r.amountEGP), 0);

  tfoot.innerHTML = `
    <tr class="totals-row">
      <td colspan="5" style="text-align:right">المجموع</td>
      <td>${Math.max(0, totalEGP).toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م</td>
      <td></td>
      <td>${totalCum.toLocaleString('ar-EG')} ج.م</td>
      <td colspan="3"></td>
      <td>${totalZ1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</td>
      <td>${totalZ2.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</td>
      <td></td>
    </tr>`;

  updateMoneySummary(rows, nisabDate);
  renderMoneyAnnual(rows);
  renderMoneyChart(rows);
}

function updateMoneySummary(rows, nisabDate) {
  const totalCum = rows.length > 0 ? rows[rows.length - 1].cumulative : 0;
  const totalZ1 = rows.reduce((s, r) => s + (r.zakat1 || 0), 0);
  const pct = moneyNisab > 0 ? Math.min(100, (totalCum / moneyNisab) * 100) : 0;

  document.getElementById('mTotalSavings').textContent = totalCum.toLocaleString('ar-EG') + ' ج.م';
  document.getElementById('mNisabFill').style.width = pct + '%';

  if (moneyNisab <= 0) {
    document.getElementById('mNisabProgress').textContent = 'جاري حساب النصاب...';
  } else {
    document.getElementById('mNisabProgress').textContent = totalCum >= moneyNisab
      ? `✅ تجاوزت النصاب بـ ${(totalCum - moneyNisab).toLocaleString('ar-EG')} ج.م`
      : `متبقي ${(moneyNisab - totalCum).toLocaleString('ar-EG')} ج.م للنصاب`;
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

  document.getElementById('mTotalZakat').textContent = totalZ1.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
}

// ─── Annual Summary ───────────────────────────────────────────
function renderMoneyAnnual(rows) {
  const section = document.getElementById('mAnnualSummary');
  const body = document.getElementById('mAnnualBody');
  if (!section || !body) return;

  if (rows.length === 0) { section.style.display = 'none'; return; }

  const yearMap = {};
  rows.forEach(r => {
    const hy = getHijriYear(r.date);
    if (!yearMap[hy]) yearMap[hy] = { count: 0, income: 0, expense: 0, zakat1: 0 };
    yearMap[hy].count++;
    if (r.type === 'income') yearMap[hy].income += r.amountEGP;
    else yearMap[hy].expense += r.amountEGP;
    yearMap[hy].zakat1 += r.zakat1 || 0;
  });

  body.innerHTML = Object.keys(yearMap).sort().map(y => {
    const d = yearMap[y];
    return `<tr>
      <td>${y} هـ</td>
      <td>${d.count}</td>
      <td>${d.income.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م</td>
      <td>${d.expense.toLocaleString('ar-EG', { maximumFractionDigits: 0 })} ج.م</td>
      <td>${d.zakat1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} ج.م</td>
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
    { label: 'التراكمي (ج.م)', data: cumData, color: '#5B9BD5' }
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

  // Warn if no exchange rate for this currency
  if (currency !== 'EGP' && !exchangeRates[currency]) {
    showToast('تنبيه: لا يوجد سعر صرف لـ ' + currency + '. سيتم التحويل بسعر 1:1', 'error');
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

  const headers = ['الوصف', 'المبلغ', 'العملة', 'سعر الصرف', 'القيمة بالجنيه', 'النوع', 'التراكمي', 'التاريخ', 'التاريخ الهجري', 'زكاة س1', 'زكاة س2'];
  const csv = [headers.join(','), ...rows.map(r => [
    r.desc, r.amount, r.currency, r.rate || 1, r.amountEGP.toFixed(2),
    r.type === 'income' ? 'إيداع' : 'سحب',
    r.cumulative, r.date, getHijriString(r.date),
    (r.zakat1 || 0).toFixed(2), (r.zakat2 || 0).toFixed(2)
  ].join(','))].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zakat-money.csv';
  a.click();
}

// ─── Refresh Rates Button ─────────────────────────────────────
async function refreshRates() {
  const btn = document.getElementById('refreshRatesBtn');
  if (btn) { btn.classList.add('loading'); btn.textContent = '⏳ جاري...'; }

  const ok = await fetchExchangeRates();
  if (ok) {
    showToast('تم تحديث أسعار الصرف بنجاح', 'success');
    renderMoney();
  } else {
    showToast('فشل تحديث أسعار الصرف', 'error');
  }

  if (btn) { btn.classList.remove('loading'); btn.textContent = '🔄 تحديث الأسعار'; }
}

// ─── Init ─────────────────────────────────────────────────────
initSortableTable('moneyTable', renderMoney);

// Auto-init on page load: fetch rates + calculate nisab
(async function initMoney() {
  // Show loading state
  document.getElementById('mNisabProgress').textContent = 'جاري تحميل البيانات...';

  // 1. Fetch exchange rates (if stale or missing)
  const ratesTime = parseInt(localStorage.getItem('zakat_exchange_rates_time') || '0');
  const ratesAge = Date.now() - ratesTime;
  if (!exchangeRates.USD || ratesAge > 6 * 60 * 60 * 1000) { // refresh every 6 hours
    await fetchExchangeRates();
  }

  // 2. Calculate nisab automatically
  await calcNisabAuto();

  // 3. Render
  renderMoney();
})();
