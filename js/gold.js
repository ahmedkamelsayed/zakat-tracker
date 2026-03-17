// ─── Gold Zakat Logic ─────────────────────────────────────────

// ─── Data Store ───────────────────────────────────────────────
let entries = JSON.parse(localStorage.getItem('zakat_entries') || '[]');
let goldPrice = parseFloat(localStorage.getItem('zakat_price') || '8366');
let goldSortState = { col: null, asc: true };

document.getElementById('goldPrice').value = goldPrice;
document.getElementById('goldPrice').addEventListener('input', function () {
  goldPrice = parseFloat(this.value) || 0;
  localStorage.setItem('zakat_price', goldPrice);
  render();
});

// Set today as default date
document.getElementById('fDate').value = new Date().toISOString().slice(0, 10);

// ─── Fetch Gold Price ─────────────────────────────────────────
async function fetchGoldPrice() {
  const btn = document.getElementById('fetchPriceBtn');
  btn.classList.add('loading');
  btn.textContent = '⏳ جاري...';

  try {
    const price = await GoldAPI.fetchPrice();
    if (price) {
      goldPrice = price;
      document.getElementById('goldPrice').value = price;
      localStorage.setItem('zakat_price', price);
      render();
      showToast('تم تحديث السعر: ' + price.toLocaleString('ar-EG') + ' جنيه', 'success');
    } else {
      showToast('لم نتمكن من جلب السعر. أدخله يدوياً.', 'error');
    }
  } catch (e) {
    showToast('خطأ في جلب السعر: ' + e.message, 'error');
  }

  btn.classList.remove('loading');
  btn.textContent = '🔄 تحديث';
}

// ─── Calc Engine ──────────────────────────────────────────────
function getWeight24k(karat, grams) {
  return (grams * karat) / 24;
}

function computeAll() {
  const sorted = [...entries].sort((a, b) => new Date(a.date) - new Date(b.date));

  let cumulative = 0;
  let nisabIndex = -1;
  let nisabDate = null;
  let nisabCumulative = 0;

  const rows = sorted.map((e, i) => {
    const w24 = getWeight24k(e.karat, e.grams);
    cumulative += w24;
    const row = { ...e, w24, cumulative: +cumulative.toFixed(4), rowIndex: i };
    if (nisabIndex === -1 && cumulative >= NISAB_GRAMS) {
      nisabIndex = i;
      nisabDate = e.date;
      nisabCumulative = cumulative;
      row.isNisabRow = true;
    }
    return row;
  });

  rows.forEach((row, i) => {
    if (row.cumulative < NISAB_GRAMS && !row.isNisabRow) {
      row.zakat1 = 0;
      row.zakat2 = 0;
      row.zakatDueDate = null;
    } else {
      row.zakatDueDate = addOneHijriYear(row.date);

      if (row.isNisabRow) {
        row.zakat1 = row.cumulative * goldPrice * 0.025;
      } else {
        row.zakat1 = row.w24 * goldPrice * 0.025;
      }

      let s2 = 0;
      const rowDate = new Date(row.date + 'T12:00:00');

      for (let j = 0; j <= i; j++) {
        if (rows[j].cumulative < NISAB_GRAMS && !rows[j].isNisabRow) continue;
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

  return { rows, nisabDate, nisabCumulative, nisabIndex };
}

// ─── Render ───────────────────────────────────────────────────
function render(sortOverride) {
  if (sortOverride) goldSortState = sortOverride;

  const { rows, nisabDate, nisabCumulative } = computeAll();
  const tbody = document.getElementById('tableBody');
  const tfoot = document.getElementById('tableFoot');

  // Apply filters
  const filterKarat = document.getElementById('filterKarat')?.value;
  const filterSearch = document.getElementById('filterSearch')?.value?.toLowerCase() || '';

  let filtered = rows;
  if (filterKarat) {
    filtered = filtered.filter(r => r.karat === parseInt(filterKarat));
  }
  if (filterSearch) {
    filtered = filtered.filter(r => r.type.toLowerCase().includes(filterSearch));
  }

  // Apply sort
  if (goldSortState.col) {
    filtered.sort((a, b) => {
      let va = a[goldSortState.col], vb = b[goldSortState.col];
      if (goldSortState.col === 'date') { va = new Date(va); vb = new Date(vb); }
      if (typeof va === 'string') return goldSortState.asc ? va.localeCompare(vb) : vb.localeCompare(va);
      return goldSortState.asc ? (va - vb) : (vb - va);
    });
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13"><div class="empty-state"><div class="icon">🥇</div><p>${rows.length === 0 ? 'ابدأ بإضافة أول قطعة ذهب' : 'لا توجد نتائج مطابقة للتصفية'}</p></div></td></tr>`;
    tfoot.innerHTML = '';
    updateSummary(rows, nisabDate, nisabCumulative);
    renderAnnualSummary(rows);
    renderChart(rows);
    return;
  }

  tbody.innerHTML = filtered.map((row, i) => {
    const isNisab = row.isNisabRow;
    const hijriStr = getHijriString(row.date);
    const zakatDueStr = row.zakatDueDate
      ? `<div class="greg-date">${row.zakatDueDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' })}</div><div class="hijri-date">${getHijriString(row.zakatDueDate)}</div>`
      : '<span class="val-zero">—</span>';

    const z1 = row.zakat1 > 0
      ? `<span class="val-gold">${row.zakat1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span>`
      : '<span class="val-zero">0</span>';

    const z2 = row.zakat2 > 0
      ? `<span class="val-green">${row.zakat2.toLocaleString('ar-EG', { maximumFractionDigits: 2 })}</span>`
      : '<span class="val-zero">0</span>';

    const priceDisplay = row.price ? row.price.toLocaleString('ar-EG') : '—';
    const badgeClass = row.karat === 24 ? '24' : row.karat === 18 ? '18' : '21';

    return `
      <tr class="${isNisab ? 'nisab-row' : ''} fade-in" data-id="${row.id}">
        <td>${i + 1}</td>
        <td>
          <strong>${row.type}</strong>
          ${isNisab ? '<br><span class="nisab-badge">★ يوم النصاب</span>' : ''}
        </td>
        <td><span class="badge badge-${badgeClass}">${row.karat}</span></td>
        <td>${row.grams}</td>
        <td><strong>${row.w24.toFixed(3)}</strong></td>
        <td>${row.cumulative.toFixed(3)}</td>
        <td><div class="greg-date">${formatGreg(row.date)}</div></td>
        <td><div class="hijri-date">${hijriStr}</div></td>
        <td>${zakatDueStr}</td>
        <td>${z1}</td>
        <td>${z2}</td>
        <td>${priceDisplay}</td>
        <td style="white-space:nowrap">
          <button class="btn btn-edit" onclick="openEdit('${row.id}')">✏️</button>
          <button class="btn btn-danger" onclick="deleteEntry('${row.id}')">🗑</button>
        </td>
      </tr>`;
  }).join('');

  // Totals (from all rows, not filtered)
  const totalZ1 = rows.reduce((s, r) => s + (r.zakat1 || 0), 0);
  const totalZ2 = rows.length > 0 ? (rows[rows.length - 1].zakat2 || 0) : 0;
  const totalW24 = rows.reduce((s, r) => s + r.w24, 0);

  tfoot.innerHTML = `
    <tr class="totals-row">
      <td colspan="4" style="text-align:right">المجموع</td>
      <td>${totalW24.toFixed(3)} جم</td>
      <td colspan="4"></td>
      <td>${totalZ1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} جنيه</td>
      <td>${totalZ2.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} جنيه</td>
      <td colspan="2"></td>
    </tr>`;

  updateSummary(rows, nisabDate, nisabCumulative);
  renderAnnualSummary(rows);
  renderChart(rows);
}

function updateSummary(rows, nisabDate, nisabCumulative) {
  const totalW24 = rows.reduce((s, r) => s + r.w24, 0);
  const pct = Math.min(100, (totalW24 / NISAB_GRAMS) * 100);
  const totalZ1 = rows.reduce((s, r) => s + (r.zakat1 || 0), 0);

  document.getElementById('totalWeight').textContent = totalW24.toFixed(2) + ' جم';
  document.getElementById('nisabFill').style.width = pct + '%';
  document.getElementById('nisabProgress').textContent =
    totalW24 >= NISAB_GRAMS
      ? `✅ تجاوزت النصاب بـ ${(totalW24 - NISAB_GRAMS).toFixed(2)} جم`
      : `متبقي ${(NISAB_GRAMS - totalW24).toFixed(2)} جم للنصاب`;

  if (nisabDate) {
    document.getElementById('nisabDate').textContent = formatGreg(nisabDate);
    document.getElementById('nisabHijri').textContent = getHijriString(nisabDate);
    const dueDate = addOneHijriYear(nisabDate);
    document.getElementById('zakatDueDate').textContent = dueDate.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('zakatDueHijri').textContent = getHijriString(dueDate);
  } else {
    document.getElementById('nisabDate').textContent = 'لم يبلغ النصاب بعد';
    document.getElementById('nisabHijri').textContent = '';
    document.getElementById('zakatDueDate').textContent = '—';
    document.getElementById('zakatDueHijri').textContent = '';
  }

  document.getElementById('totalZakat1').textContent =
    totalZ1.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' جنيه';
}

// ─── Annual Summary ───────────────────────────────────────────
function renderAnnualSummary(rows) {
  const section = document.getElementById('annualSummary');
  const body = document.getElementById('annualBody');
  if (!section || !body) return;

  if (rows.length === 0) { section.style.display = 'none'; return; }

  const yearMap = {};
  rows.forEach(r => {
    const hy = getHijriYear(r.date);
    if (!yearMap[hy]) yearMap[hy] = { count: 0, w24: 0, zakat1: 0 };
    yearMap[hy].count++;
    yearMap[hy].w24 += r.w24;
    yearMap[hy].zakat1 += r.zakat1 || 0;
  });

  const years = Object.keys(yearMap).sort();
  body.innerHTML = years.map(y => {
    const d = yearMap[y];
    return `<tr>
      <td>${y} هـ</td>
      <td>${d.count}</td>
      <td>${d.w24.toFixed(3)} جم</td>
      <td>${d.zakat1.toLocaleString('ar-EG', { maximumFractionDigits: 2 })} جنيه</td>
    </tr>`;
  }).join('');

  section.style.display = 'block';
}

// ─── Chart ────────────────────────────────────────────────────
function renderChart(rows) {
  const section = document.getElementById('chartSection');
  if (!section) return;

  if (rows.length < 2) { section.style.display = 'none'; return; }

  const sorted = [...rows].sort((a, b) => new Date(a.date) - new Date(b.date));
  const labels = sorted.map(r => formatGreg(r.date));
  const cumData = sorted.map(r => +r.cumulative.toFixed(2));
  const zakatData = sorted.map(r => +(r.zakat1 || 0).toFixed(2));

  renderGrowthChart('goldChart', labels, [
    { label: 'التراكمي (جم عيار 24)', data: cumData, color: '#C9A84C' },
    { label: 'الزكاة المستحقة (جنيه)', data: zakatData, color: '#4CAF7A' }
  ]);

  section.style.display = 'block';
}

// ─── CRUD ─────────────────────────────────────────────────────
function addEntry() {
  const type = document.getElementById('fType').value;
  const karat = parseInt(document.getElementById('fKarat').value);
  const count = parseInt(document.getElementById('fCount').value) || 1;
  const grams = parseFloat(document.getElementById('fGrams').value);
  const price = parseFloat(document.getElementById('fPrice').value) || 0;
  const date = document.getElementById('fDate').value;

  if (!grams || !date) {
    showToast('يرجى إدخال الجرامات والتاريخ', 'error');
    return;
  }

  entries.push({
    id: Date.now().toString(),
    type, karat, count, grams, price, date
  });

  save();
  render();
  showToast('تمت الإضافة بنجاح');

  document.getElementById('fGrams').value = '';
  document.getElementById('fPrice').value = '';
  document.getElementById('fCount').value = '1';
}

function deleteEntry(id) {
  if (!confirm('هل تريد حذف هذه القطعة؟')) return;
  entries = entries.filter(e => e.id !== id);
  save();
  render();
}

function clearAll() {
  if (!confirm('هل تريد مسح جميع البيانات؟')) return;
  entries = [];
  save();
  render();
}

function save() {
  localStorage.setItem('zakat_entries', JSON.stringify(entries));
}

// ─── Edit Modal ───────────────────────────────────────────────
function openEdit(id) {
  const e = entries.find(x => x.id === id);
  if (!e) return;
  document.getElementById('editId').value = id;
  document.getElementById('eType').value = e.type;
  document.getElementById('eKarat').value = e.karat;
  document.getElementById('eCount').value = e.count;
  document.getElementById('eGrams').value = e.grams;
  document.getElementById('ePrice').value = e.price || '';
  document.getElementById('eDate').value = e.date;
  document.getElementById('editModal').classList.add('show');
}

function closeModal() {
  document.getElementById('editModal').classList.remove('show');
}

function saveEdit() {
  const id = document.getElementById('editId').value;
  const idx = entries.findIndex(x => x.id === id);
  if (idx === -1) return;
  entries[idx] = {
    ...entries[idx],
    type: document.getElementById('eType').value,
    karat: parseInt(document.getElementById('eKarat').value),
    count: parseInt(document.getElementById('eCount').value),
    grams: parseFloat(document.getElementById('eGrams').value),
    price: parseFloat(document.getElementById('ePrice').value) || 0,
    date: document.getElementById('eDate').value,
  };
  save();
  render();
  closeModal();
  showToast('تم الحفظ بنجاح');
}

// ─── Export CSV ───────────────────────────────────────────────
function exportCSV() {
  const { rows } = computeAll();
  if (rows.length === 0) { showToast('لا توجد بيانات للتصدير', 'error'); return; }

  const headers = ['الصنف', 'العيار', 'الجرامات', 'وزن عيار 24', 'التراكمي', 'تاريخ الشراء', 'التاريخ الهجري', 'موعد الزكاة', 'زكاة سيناريو 1', 'زكاة سيناريو 2', 'السعر المدفوع'];
  const csv = [headers.join(','), ...rows.map(r => [
    r.type, r.karat, r.grams, r.w24.toFixed(3), r.cumulative.toFixed(3),
    r.date, getHijriString(r.date),
    r.zakatDueDate ? r.zakatDueDate.toISOString().slice(0, 10) : '',
    r.zakat1.toFixed(2), r.zakat2.toFixed(2), r.price || 0
  ].join(','))].join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'zakat-gold.csv';
  a.click();
}

// ─── Close modal on overlay click ────────────────────────────
document.getElementById('editModal').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// ─── Import Excel ─────────────────────────────────────────────
async function importExcel(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!window.XLSX) {
    await new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
      s.onload = res; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

      let imported = 0, skipped = 0;

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        const type = row[0];
        const count = row[1];
        const karat = row[2];
        const grams = row[3];
        const price = row[5];
        const dateRaw = row[6];

        if (!type || !grams || !dateRaw) { skipped++; continue; }

        let dateStr = '';
        if (dateRaw instanceof Date) {
          dateStr = dateRaw.toISOString().slice(0, 10);
        } else if (typeof dateRaw === 'number') {
          const d = new Date(Math.round((dateRaw - 25569) * 86400 * 1000));
          dateStr = d.toISOString().slice(0, 10);
        } else if (typeof dateRaw === 'string') {
          const d = new Date(dateRaw);
          if (!isNaN(d)) dateStr = d.toISOString().slice(0, 10);
        }

        if (!dateStr) { skipped++; continue; }

        const gramsNum = parseFloat(grams);
        const karatNum = parseInt(karat);
        const priceNum = typeof price === 'number' ? price : 0;

        if (!gramsNum || ![18, 21, 24].includes(karatNum)) { skipped++; continue; }

        entries.push({
          id: Date.now().toString() + '_' + i,
          type: String(type),
          karat: karatNum,
          count: parseInt(count) || 1,
          grams: gramsNum,
          price: priceNum,
          date: dateStr
        });
        imported++;
      }

      save();
      render();
      event.target.value = '';

      if (imported > 0) {
        showToast(`تم استيراد ${imported} صف بنجاح` + (skipped > 0 ? ` (تخطي ${skipped})` : ''));
      } else {
        showToast('لم يتم العثور على بيانات صالحة', 'error');
      }
    } catch (err) {
      showToast('خطأ في قراءة الملف: ' + err.message, 'error');
    }
  };
  reader.readAsArrayBuffer(file);
}

// ─── Init ─────────────────────────────────────────────────────
initSortableTable('mainTable', render);
render();
