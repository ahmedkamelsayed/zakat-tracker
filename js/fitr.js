// ─── Zakat Al-Fitr Logic ──────────────────────────────────────

var GRAIN_PRICES = {
  rice: 35,
  wheat: 25,
  dates: 50,
  raisins: 80,
  custom: 35
};

var GRAIN_LABELS = {
  rice: 'أرز',
  wheat: 'قمح',
  dates: 'تمر',
  raisins: 'زبيب',
  custom: 'مخصص'
};

var fitrConfig = ZakatStore.getFitrConfig();

// ─── Current Hijri Year ──────────────────────────────────────
var currentHijriYear = getHijriComponents(new Date()).year;

// ─── Init form values ────────────────────────────────────────
function initFitrForm() {
  document.getElementById('fGrainType').value = fitrConfig.grainType || 'rice';
  document.getElementById('fSaPrice').value = fitrConfig.pricePerSa || GRAIN_PRICES[fitrConfig.grainType] || 35;
  document.getElementById('fNumMembers').value = fitrConfig.members ? fitrConfig.members.length : 1;
  if (fitrConfig.members && fitrConfig.members.length > 0) {
    document.getElementById('fNumMembers').value = fitrConfig.members.length;
  }

  document.getElementById('fCurrentYear').textContent = currentHijriYear + ' هـ';

  recalcFitr();
  renderMembers();
  renderHistory();
  updatePayStatus();
}

// ─── Update grain price preset ───────────────────────────────
function updateGrainPrice() {
  var grain = document.getElementById('fGrainType').value;
  if (grain !== 'custom') {
    document.getElementById('fSaPrice').value = GRAIN_PRICES[grain] || 35;
  }
  recalcFitr();
}

// ─── Recalculate ─────────────────────────────────────────────
function recalcFitr() {
  var grainType = document.getElementById('fGrainType').value;
  var pricePerSa = parseFloat(document.getElementById('fSaPrice').value) || 0;
  var numMembers = parseInt(document.getElementById('fNumMembers').value) || 1;

  // If members list has entries, use its count
  if (fitrConfig.members && fitrConfig.members.length > 0) {
    numMembers = fitrConfig.members.length;
    document.getElementById('fNumMembers').value = numMembers;
  }

  var total = numMembers * pricePerSa;

  // Update config
  fitrConfig.grainType = grainType;
  fitrConfig.pricePerSa = pricePerSa;
  saveFitr();

  // Update summary cards
  document.getElementById('fMemberCount').textContent = numMembers;
  document.getElementById('fGrainLabel').textContent = GRAIN_LABELS[grainType] || grainType;
  document.getElementById('fPricePerSa').textContent = 'سعر الصاع: ' + pricePerSa.toLocaleString('ar-EG') + ' ج.م';
  document.getElementById('fTotal').textContent = total.toLocaleString('ar-EG') + ' ج.م';
  document.getElementById('fYearLabel').textContent = currentHijriYear + ' هـ';
}

// ─── Members ─────────────────────────────────────────────────
function addMember() {
  var nameInput = document.getElementById('fMemberName');
  var name = nameInput.value.trim();
  if (!name) {
    showToast('يرجى إدخال اسم الفرد', 'error');
    return;
  }

  if (!fitrConfig.members) fitrConfig.members = [];
  fitrConfig.members.push({ name: name, id: Date.now().toString() });
  saveFitr();
  renderMembers();
  recalcFitr();
  nameInput.value = '';
  showToast('تمت إضافة ' + name);
}

function removeMember(id) {
  if (!fitrConfig.members) return;
  var filtered = [];
  for (var i = 0; i < fitrConfig.members.length; i++) {
    if (fitrConfig.members[i].id !== id) filtered.push(fitrConfig.members[i]);
  }
  fitrConfig.members = filtered;
  saveFitr();
  renderMembers();
  recalcFitr();
}

function renderMembers() {
  var container = document.getElementById('membersList');
  if (!fitrConfig.members || fitrConfig.members.length === 0) {
    container.innerHTML = '<div style="font-size:13px; color:var(--text2); padding:8px 0">لم تتم إضافة أفراد بعد. يمكنك استخدام العدد فقط.</div>';
    return;
  }

  var html = '<div style="display:flex; gap:8px; flex-wrap:wrap">';
  for (var i = 0; i < fitrConfig.members.length; i++) {
    var m = fitrConfig.members[i];
    html += '<div style="display:inline-flex; align-items:center; gap:6px; background:var(--bg3); border:1px solid var(--border); border-radius:99px; padding:6px 14px; font-size:13px">';
    html += '<span>' + (i + 1) + '. ' + m.name + '</span>';
    html += '<button onclick="removeMember(\'' + m.id + '\')" style="background:none; border:none; color:var(--red); cursor:pointer; font-size:14px; padding:0 2px">&times;</button>';
    html += '</div>';
  }
  html += '</div>';
  container.innerHTML = html;
}

// ─── Pay Status ──────────────────────────────────────────────
function updatePayStatus() {
  var yearStr = currentHijriYear.toString();
  var record = fitrConfig.records && fitrConfig.records[yearStr];
  var paid = record && record.paid;

  document.getElementById('fPayStatus').textContent = paid ? 'تم الدفع' : 'لم تُدفع بعد';
  document.getElementById('fPayStatus').style.color = paid ? 'var(--green)' : 'var(--red)';
  document.getElementById('fPayStatusSub').textContent = paid ? 'بارك الله فيك' : 'يجب إخراجها قبل صلاة العيد';

  var btn = document.getElementById('fPayBtn');
  var label = document.getElementById('fPaidLabel');

  if (paid) {
    btn.textContent = '↩ إلغاء الدفع';
    btn.className = 'btn btn-outline';
    label.style.display = '';
  } else {
    btn.textContent = '✅ تم الدفع';
    btn.className = 'btn btn-gold';
    label.style.display = 'none';
  }
}

function togglePaid() {
  var yearStr = currentHijriYear.toString();
  if (!fitrConfig.records) fitrConfig.records = {};

  var pricePerSa = parseFloat(document.getElementById('fSaPrice').value) || 0;
  var numMembers = fitrConfig.members && fitrConfig.members.length > 0
    ? fitrConfig.members.length
    : (parseInt(document.getElementById('fNumMembers').value) || 1);
  var total = numMembers * pricePerSa;

  if (!fitrConfig.records[yearStr]) {
    fitrConfig.records[yearStr] = {};
  }

  var currentlyPaid = fitrConfig.records[yearStr].paid;

  if (currentlyPaid) {
    // Undo
    fitrConfig.records[yearStr].paid = false;
    showToast('تم إلغاء الدفع');
  } else {
    // Mark as paid and save details
    fitrConfig.records[yearStr] = {
      paid: true,
      date: new Date().toISOString().slice(0, 10),
      members: numMembers,
      grainType: fitrConfig.grainType,
      pricePerSa: pricePerSa,
      total: total,
      memberNames: fitrConfig.members ? fitrConfig.members.map(function (m) { return m.name; }) : []
    };
    showToast('تم تسجيل دفع زكاة الفطر — بارك الله فيك');
  }

  saveFitr();
  updatePayStatus();
  renderHistory();
}

// ─── History ─────────────────────────────────────────────────
function renderHistory() {
  var tbody = document.getElementById('fitrHistoryBody');
  if (!fitrConfig.records) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="padding:20px"><p>لا توجد سجلات بعد</p></div></td></tr>';
    return;
  }

  var years = Object.keys(fitrConfig.records).sort(function (a, b) { return parseInt(b) - parseInt(a); });
  if (years.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state" style="padding:20px"><p>لا توجد سجلات بعد</p></div></td></tr>';
    return;
  }

  var html = '';
  for (var i = 0; i < years.length; i++) {
    var year = years[i];
    var rec = fitrConfig.records[year];
    var grainLabel = GRAIN_LABELS[rec.grainType] || rec.grainType || '—';
    var statusHtml = rec.paid
      ? '<span style="color:var(--green); font-weight:600">تم الدفع</span>'
      : '<span style="color:var(--red); font-weight:600">لم تُدفع</span>';

    html += '<tr class="fade-in">';
    html += '<td><strong>' + year + ' هـ</strong></td>';
    html += '<td>' + (rec.members || '—') + '</td>';
    html += '<td>' + grainLabel + '</td>';
    html += '<td>' + (rec.pricePerSa ? rec.pricePerSa.toLocaleString('ar-EG') + ' ج.م' : '—') + '</td>';
    html += '<td><strong>' + (rec.total ? rec.total.toLocaleString('ar-EG') + ' ج.م' : '—') + '</strong></td>';
    html += '<td>' + statusHtml + '</td>';
    html += '</tr>';
  }

  tbody.innerHTML = html;
}

// ─── Save ────────────────────────────────────────────────────
function saveFitr() {
  ZakatStore.setFitrConfig(fitrConfig);
}

// ─── Init ────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function () {
  initFitrForm();
});
