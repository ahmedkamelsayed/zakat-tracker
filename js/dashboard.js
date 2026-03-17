// ─── Dashboard Logic ──────────────────────────────────────────
// Read-only overview of all zakat types. Does NOT modify data.

function renderDashboard() {
  var goldPrice = ZakatStore.getGoldPrice();
  var goldEntries = ZakatStore.getGoldEntries();
  var moneyEntries = ZakatStore.getMoneyEntries();
  var stocks = ZakatStore.getStockEntries();
  var rates = ZakatStore.getExchangeRates();

  // ─── Gold calculations ───────────────────────────────────
  var totalGoldW24 = 0;
  for (var g = 0; g < goldEntries.length; g++) {
    totalGoldW24 += (goldEntries[g].grams * goldEntries[g].karat) / 24;
  }
  var goldValueEGP = totalGoldW24 * goldPrice;

  var goldZakatDue = 0;
  if (totalGoldW24 >= NISAB_GRAMS) {
    goldZakatDue = goldValueEGP * 0.025;
  }

  // ─── Money calculations ──────────────────────────────────
  var moneyTotalEGP = 0;
  for (var m = 0; m < moneyEntries.length; m++) {
    var me = moneyEntries[m];
    var mRate = me.currency === 'EGP' ? 1 : (rates[me.currency] || 1);
    var mVal = me.amount * mRate;
    moneyTotalEGP += me.type === 'expense' ? -mVal : mVal;
  }
  if (moneyTotalEGP < 0) moneyTotalEGP = 0;

  var moneyNisab = ZakatStore.getMoneyNisab();
  var moneyZakatDue = 0;
  if (moneyNisab > 0 && moneyTotalEGP >= moneyNisab) {
    moneyZakatDue = moneyTotalEGP * 0.025;
  }

  // ─── Stocks calculations ─────────────────────────────────
  var stocksTotalEGP = 0;
  var stocksZakatDue = 0;
  for (var s = 0; s < stocks.length; s++) {
    var st = stocks[s];
    var sValue = st.shares * st.pricePerShare;
    var sRate = st.currency === 'EGP' ? 1 : (rates[st.currency] || 1);
    var sValueEGP = sValue * sRate;
    stocksTotalEGP += sValueEGP;

    if (st.purpose === 'trading') {
      stocksZakatDue += sValueEGP * 0.025;
    } else if (st.dividendAmount) {
      stocksZakatDue += (st.dividendAmount * sRate) * 0.025;
    }
  }

  // ─── Totals ──────────────────────────────────────────────
  var totalWealth = goldValueEGP + moneyTotalEGP + stocksTotalEGP;
  var totalDebts = DebtsManager.getTotalDebtsEGP();
  var netWealth = totalWealth - totalDebts;
  var totalZakatDue = goldZakatDue + moneyZakatDue + stocksZakatDue;
  var totalPaid = PaymentsManager.getTotalPaid();
  var remaining = Math.max(0, totalZakatDue - totalPaid);

  // ─── Nisab combined check ────────────────────────────────
  var nisabEGP = moneyNisab > 0 ? moneyNisab : (goldPrice * NISAB_GRAMS);
  var nisabPct = nisabEGP > 0 ? Math.min(100, (totalWealth / nisabEGP) * 100) : 0;
  var reachedNisab = totalWealth >= nisabEGP && nisabEGP > 0;

  // ─── Update DOM ──────────────────────────────────────────
  var fmt = function (n) { return n.toLocaleString('ar-EG', { maximumFractionDigits: 0 }); };

  document.getElementById('dGoldValue').textContent = fmt(goldValueEGP) + ' ج.م';
  document.getElementById('dGoldWeight').textContent = totalGoldW24.toFixed(2) + ' جم عيار 24';

  document.getElementById('dMoneyValue').textContent = fmt(moneyTotalEGP) + ' ج.م';
  document.getElementById('dMoneyCount').textContent = moneyEntries.length + ' معاملة';

  document.getElementById('dStocksValue').textContent = fmt(stocksTotalEGP) + ' ج.م';
  document.getElementById('dStocksCount').textContent = stocks.length + ' أصل';

  document.getElementById('dTotalWealth').textContent = fmt(totalWealth) + ' ج.م';
  document.getElementById('dNetWorth').textContent = 'صافي بعد الديون: ' + fmt(netWealth) + ' ج.م';

  document.getElementById('dNisabStatus').textContent = reachedNisab ? 'بلغ النصاب' : 'لم يبلغ النصاب';
  document.getElementById('dNisabFill').style.width = nisabPct + '%';
  document.getElementById('dNisabSub').textContent = nisabEGP > 0
    ? (reachedNisab
      ? 'تجاوزت النصاب بـ ' + fmt(totalWealth - nisabEGP) + ' ج.م'
      : 'متبقي ' + fmt(nisabEGP - totalWealth) + ' ج.م للنصاب')
    : 'حدّث سعر الذهب أولا';

  document.getElementById('dTotalZakatDue').textContent = fmt(totalZakatDue) + ' ج.م';

  document.getElementById('dTotalPaid').textContent = fmt(totalPaid) + ' ج.م';
  document.getElementById('dPaidCount').textContent = PaymentsManager.getAll().length + ' دفعة';

  document.getElementById('dRemaining').textContent = fmt(remaining) + ' ج.م';

  var debtCount = 0;
  var allDebts = DebtsManager.getAll();
  for (var di = 0; di < allDebts.length; di++) {
    if (allDebts[di].type === 'owed_by_me') debtCount++;
  }
  document.getElementById('dTotalDebts').textContent = fmt(Math.max(0, totalDebts)) + ' ج.م';
  document.getElementById('dDebtCount').textContent = debtCount + ' دين';
  document.getElementById('dNetWealth').textContent = fmt(netWealth) + ' ج.م';

  // ─── Due Dates ───────────────────────────────────────────
  renderDueDates(goldEntries, moneyEntries, rates);

  // ─── Recent Payments ─────────────────────────────────────
  renderRecentPayments();

  // ─── Chart ───────────────────────────────────────────────
  renderWealthChart(goldValueEGP, moneyTotalEGP, stocksTotalEGP, Math.max(0, totalDebts));
}

// ─── Upcoming Due Dates ──────────────────────────────────────
function renderDueDates(goldEntries, moneyEntries, rates) {
  var container = document.getElementById('dueDatesList');
  var today = new Date();
  today.setHours(12, 0, 0, 0);
  var dates = [];

  // Gold nisab date
  if (goldEntries.length > 0) {
    var sorted = goldEntries.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
    var cum = 0;
    for (var i = 0; i < sorted.length; i++) {
      cum += (sorted[i].grams * sorted[i].karat) / 24;
      if (cum >= NISAB_GRAMS) {
        var dueDate = addOneHijriYear(sorted[i].date);
        var daysUntil = Math.floor((dueDate - today) / 86400000);
        dates.push({
          type: '🥇 زكاة الذهب',
          dueDate: dueDate,
          daysUntil: daysUntil,
          hijri: getHijriString(dueDate),
          greg: dueDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
        });
        break;
      }
    }
  }

  // Money nisab date
  if (moneyEntries.length > 0) {
    var moneyNisab = ZakatStore.getMoneyNisab();
    if (moneyNisab > 0) {
      var mSorted = moneyEntries.slice().sort(function (a, b) { return new Date(a.date) - new Date(b.date); });
      var mCum = 0;
      for (var j = 0; j < mSorted.length; j++) {
        var e = mSorted[j];
        var rate = e.currency === 'EGP' ? 1 : (rates[e.currency] || 1);
        var val = e.amount * rate;
        mCum += e.type === 'expense' ? -val : val;
        if (mCum >= moneyNisab) {
          var mDueDate = addOneHijriYear(e.date);
          var mDaysUntil = Math.floor((mDueDate - today) / 86400000);
          dates.push({
            type: '💵 زكاة المال',
            dueDate: mDueDate,
            daysUntil: mDaysUntil,
            hijri: getHijriString(mDueDate),
            greg: mDueDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })
          });
          break;
        }
      }
    }
  }

  // Fitr reminder
  var currentHijri = getHijriComponents(today);
  var fitrConfig = ZakatStore.getFitrConfig();
  var currentYearStr = currentHijri.year.toString();
  if (!fitrConfig.records || !fitrConfig.records[currentYearStr] || !fitrConfig.records[currentYearStr].paid) {
    dates.push({
      type: '🌾 زكاة الفطر',
      dueDate: null,
      daysUntil: null,
      hijri: 'قبل صلاة عيد الفطر',
      greg: 'رمضان ' + currentHijri.year + ' هـ'
    });
  }

  if (dates.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:20px"><p>لا توجد مواعيد قادمة</p></div>';
    return;
  }

  dates.sort(function (a, b) {
    if (a.daysUntil === null) return 1;
    if (b.daysUntil === null) return -1;
    return a.daysUntil - b.daysUntil;
  });

  var html = '';
  for (var k = 0; k < dates.length; k++) {
    var d = dates[k];
    var statusClass = '';
    var statusText = '';
    if (d.daysUntil !== null) {
      if (d.daysUntil < 0) {
        statusClass = 'color:var(--red)';
        statusText = 'متأخرة بـ ' + Math.abs(d.daysUntil) + ' يوم';
      } else if (d.daysUntil <= 30) {
        statusClass = 'color:var(--gold-light)';
        statusText = 'بعد ' + d.daysUntil + ' يوم';
      } else {
        statusClass = 'color:var(--green)';
        statusText = 'بعد ' + d.daysUntil + ' يوم';
      }
    }

    html += '<div style="display:flex; align-items:center; justify-content:space-between; padding:12px 0; border-bottom:1px solid var(--border)">';
    html += '<div><strong>' + d.type + '</strong>';
    html += '<div style="font-size:12px; color:var(--text2)">' + d.greg + ' — ' + d.hijri + '</div></div>';
    html += '<div style="font-size:14px; font-weight:600; ' + statusClass + '">' + (statusText || d.hijri) + '</div>';
    html += '</div>';
  }

  container.innerHTML = html;
}

// ─── Recent Payments ─────────────────────────────────────────
function renderRecentPayments() {
  var tbody = document.getElementById('recentPaymentsBody');
  var allPayments = PaymentsManager.getAll();
  // Sort by date descending, take 5
  allPayments.sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
  var recent = allPayments.slice(0, 5);

  if (recent.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5"><div class="empty-state" style="padding:20px"><p>لا توجد مدفوعات بعد</p></div></td></tr>';
    return;
  }

  var typeLabels = {
    gold: '🥇 ذهب',
    money: '💵 مال',
    stocks: '📈 أسهم',
    fitr: '🌾 فطر',
    general: '💰 عام'
  };

  var html = '';
  for (var i = 0; i < recent.length; i++) {
    var p = recent[i];
    html += '<tr class="fade-in">';
    html += '<td>' + (i + 1) + '</td>';
    html += '<td>' + (typeLabels[p.zakatType] || p.zakatType || '💰 عام') + '</td>';
    html += '<td>' + (p.note || '—') + '</td>';
    html += '<td><strong>' + (p.amount || 0).toLocaleString('ar-EG') + ' ج.م</strong></td>';
    html += '<td><div class="greg-date">' + formatGreg(p.date) + '</div></td>';
    html += '</tr>';
  }

  tbody.innerHTML = html;
}

// ─── Wealth Distribution Chart ───────────────────────────────
function renderWealthChart(gold, money, stocks, debts) {
  var section = document.getElementById('dashChartSection');
  var canvas = document.getElementById('wealthChart');
  if (!canvas || typeof Chart === 'undefined') return;

  var total = gold + money + stocks;
  if (total === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  if (canvas._chartInstance) {
    canvas._chartInstance.destroy();
  }

  var textColor = typeof getChartTextColor === 'function' ? getChartTextColor() : '#A89F8C';

  var chart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['الذهب', 'المال النقدي', 'الأسهم', 'الديون'],
      datasets: [{
        data: [gold, money, stocks, debts],
        backgroundColor: [
          '#C9A84C',
          '#5B9BD5',
          '#4CAF7A',
          '#CF6679'
        ],
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
          labels: {
            color: textColor,
            font: { family: 'Tajawal', size: 13 },
            padding: 20
          }
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              var val = context.parsed;
              var pct = total > 0 ? ((val / total) * 100).toFixed(1) : 0;
              return context.label + ': ' + val.toLocaleString('ar-EG') + ' ج.م (' + pct + '%)';
            }
          }
        }
      }
    }
  });

  canvas._chartInstance = chart;
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  renderDashboard();
});
