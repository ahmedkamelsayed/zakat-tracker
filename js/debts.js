// ─── Debt Tracking ───────────────────────────────────────────
// CRUD for debts with rendering support
// Uses ZakatStore for all persistence

var DebtsManager = (function () {

  // ─── CRUD ───────────────────────────────────────────────────

  function getAll() {
    return ZakatStore.getDebts();
  }

  function add(debt) {
    var debts = getAll();
    debts.push({
      id: Date.now().toString(),
      desc: debt.desc || '',
      amount: parseFloat(debt.amount) || 0,
      currency: debt.currency || 'EGP',
      date: debt.date || new Date().toISOString().slice(0, 10),
      type: debt.type || 'owed_by_me' // 'owed_by_me' | 'owed_to_me'
    });
    ZakatStore.setDebts(debts);
    return debts;
  }

  function update(id, updates) {
    var debts = getAll();
    for (var i = 0; i < debts.length; i++) {
      if (debts[i].id === id) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key)) {
            debts[i][key] = updates[key];
          }
        }
        break;
      }
    }
    ZakatStore.setDebts(debts);
    return debts;
  }

  function remove(id) {
    var debts = getAll();
    var filtered = [];
    for (var i = 0; i < debts.length; i++) {
      if (debts[i].id !== id) filtered.push(debts[i]);
    }
    ZakatStore.setDebts(filtered);
    return filtered;
  }

  function getById(id) {
    var debts = getAll();
    for (var i = 0; i < debts.length; i++) {
      if (debts[i].id === id) return debts[i];
    }
    return null;
  }

  // ─── Aggregation ────────────────────────────────────────────

  function getTotalDebtsEGP(exchangeRates) {
    var rates = exchangeRates || ZakatStore.getExchangeRates();
    var debts = getAll();
    var totalOwedByMe = 0;
    var totalOwedToMe = 0;

    for (var i = 0; i < debts.length; i++) {
      var d = debts[i];
      var rate = d.currency === 'EGP' ? 1 : (rates[d.currency] || 1);
      var amountEGP = d.amount * rate;

      if (d.type === 'owed_by_me') {
        totalOwedByMe += amountEGP;
      } else {
        totalOwedToMe += amountEGP;
      }
    }

    // Net debts owed by user (reduces zakatable wealth)
    return totalOwedByMe - totalOwedToMe;
  }

  // ─── Currency symbols (shared with money page) ──────────────

  var CURRENCY_LABELS = {
    EGP: 'ج.م', SAR: 'ر.س', AED: 'د.إ', USD: '$', EUR: '€', GBP: '£', KWD: 'د.ك'
  };

  // ─── Rendering ──────────────────────────────────────────────

  var _containerId = null;
  var _editingId = null;

  function renderDebtsSection(containerId) {
    _containerId = containerId;
    var container = document.getElementById(containerId);
    if (!container) return;

    var debts = getAll();
    var rates = ZakatStore.getExchangeRates();
    var netDebt = getTotalDebtsEGP(rates);

    var html = '';

    // ── Section header ──
    html += '<div class="section-title">📋 سجل الديون</div>';

    // ── Summary card ──
    html += '<div class="cards" style="margin-bottom:20px">';
    html += '<div class="card">';
    html += '<span class="card-icon">📋</span>';
    html += '<div class="card-label">صافي الديون (عليّ - لي)</div>';
    html += '<div class="card-value" style="color:' + (netDebt > 0 ? 'var(--red, #CF6679)' : 'var(--green, #4CAF7A)') + '">';
    html += Math.abs(netDebt).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
    html += '</div>';
    html += '<div class="card-sub">' + (netDebt > 0 ? 'ديون عليك تخصم من الزكاة' : netDebt < 0 ? 'ديون لك عند الغير' : 'لا توجد ديون') + '</div>';
    html += '</div>';
    html += '</div>';

    // ── Add form ──
    html += '<div class="form-section">';
    html += '<div class="section-title">➕ إضافة دين جديد</div>';
    html += '<div class="form-grid">';

    html += '<div class="form-group">';
    html += '<label>الوصف</label>';
    html += '<input type="text" id="debtDesc" placeholder="وصف الدين...">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>المبلغ</label>';
    html += '<input type="number" id="debtAmount" min="0" step="0.01" placeholder="0">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>العملة</label>';
    html += '<select id="debtCurrency">';
    html += '<option value="EGP">جنيه مصري (EGP)</option>';
    html += '<option value="SAR">ريال سعودي (SAR)</option>';
    html += '<option value="AED">درهم إماراتي (AED)</option>';
    html += '<option value="USD">دولار أمريكي (USD)</option>';
    html += '<option value="EUR">يورو (EUR)</option>';
    html += '<option value="GBP">جنيه إسترليني (GBP)</option>';
    html += '<option value="KWD">دينار كويتي (KWD)</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>النوع</label>';
    html += '<select id="debtType">';
    html += '<option value="owed_by_me">دين عليّ</option>';
    html += '<option value="owed_to_me">دين لي عند الغير</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>التاريخ</label>';
    html += '<input type="date" id="debtDate" value="' + new Date().toISOString().slice(0, 10) + '">';
    html += '</div>';

    html += '<div class="form-group" style="justify-content:flex-end">';
    html += '<button class="btn btn-gold" id="debtSubmitBtn">✓ إضافة</button>';
    html += '</div>';

    html += '</div>'; // form-grid
    html += '</div>'; // form-section

    // ── Debts list ──
    html += '<div class="table-section">';
    html += '<div class="table-header">';
    html += '<div class="section-title" style="margin:0">📊 قائمة الديون</div>';
    html += '</div>';

    if (debts.length === 0) {
      html += '<div class="empty-state"><div class="icon">📋</div><p>لا توجد ديون مسجلة</p></div>';
    } else {
      html += '<div class="table-wrap">';
      html += '<table>';
      html += '<thead><tr>';
      html += '<th>#</th><th>الوصف</th><th>المبلغ</th><th>العملة</th><th>القيمة بالجنيه</th><th>النوع</th><th>التاريخ</th><th>إجراءات</th>';
      html += '</tr></thead>';
      html += '<tbody>';

      for (var i = 0; i < debts.length; i++) {
        var d = debts[i];
        var rate = d.currency === 'EGP' ? 1 : (rates[d.currency] || 1);
        var egpVal = d.amount * rate;
        var typeLabel = d.type === 'owed_by_me'
          ? '<span style="color:var(--red, #CF6679)">دين عليّ</span>'
          : '<span style="color:var(--green, #4CAF7A)">دين لي</span>';
        var currSymbol = CURRENCY_LABELS[d.currency] || d.currency;

        html += '<tr class="fade-in" data-id="' + d.id + '">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td><strong>' + (d.desc || '—') + '</strong></td>';
        html += '<td>' + d.amount.toLocaleString('ar-EG') + ' ' + currSymbol + '</td>';
        html += '<td>' + d.currency + '</td>';
        html += '<td>' + egpVal.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م</td>';
        html += '<td>' + typeLabel + '</td>';
        html += '<td>' + (typeof formatGreg === 'function' ? formatGreg(d.date) : d.date) + '</td>';
        html += '<td style="white-space:nowrap">';
        html += '<button class="btn btn-edit" data-debt-edit="' + d.id + '">✏️</button> ';
        html += '<button class="btn btn-danger" data-debt-delete="' + d.id + '">🗑</button>';
        html += '</td>';
        html += '</tr>';
      }

      // Totals row
      var totalOwedByMe = 0;
      var totalOwedToMe = 0;
      for (var j = 0; j < debts.length; j++) {
        var dj = debts[j];
        var rj = dj.currency === 'EGP' ? 1 : (rates[dj.currency] || 1);
        if (dj.type === 'owed_by_me') totalOwedByMe += dj.amount * rj;
        else totalOwedToMe += dj.amount * rj;
      }

      html += '</tbody>';
      html += '<tfoot><tr class="totals-row">';
      html += '<td colspan="4" style="text-align:right">المجموع</td>';
      html += '<td colspan="4">';
      html += 'عليّ: ' + totalOwedByMe.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
      html += ' | لي: ' + totalOwedToMe.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
      html += '</td>';
      html += '</tr></tfoot>';
      html += '</table>';
      html += '</div>'; // table-wrap
    }

    html += '</div>'; // table-section

    // ── Edit modal ──
    html += '<div class="modal-overlay" id="debtEditModal">';
    html += '<div class="modal">';
    html += '<h3>✏️ تعديل الدين</h3>';
    html += '<input type="hidden" id="debtEditId">';
    html += '<div class="form-grid" style="grid-template-columns:1fr 1fr">';

    html += '<div class="form-group" style="grid-column:1/-1">';
    html += '<label>الوصف</label>';
    html += '<input type="text" id="debtEditDesc">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>المبلغ</label>';
    html += '<input type="number" id="debtEditAmount" min="0" step="0.01">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>العملة</label>';
    html += '<select id="debtEditCurrency">';
    html += '<option value="EGP">EGP</option><option value="SAR">SAR</option>';
    html += '<option value="AED">AED</option><option value="USD">USD</option>';
    html += '<option value="EUR">EUR</option><option value="GBP">GBP</option>';
    html += '<option value="KWD">KWD</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>النوع</label>';
    html += '<select id="debtEditType">';
    html += '<option value="owed_by_me">دين عليّ</option>';
    html += '<option value="owed_to_me">دين لي عند الغير</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>التاريخ</label>';
    html += '<input type="date" id="debtEditDate">';
    html += '</div>';

    html += '</div>'; // form-grid
    html += '<div class="modal-actions">';
    html += '<button class="btn btn-outline" id="debtEditCancel">إلغاء</button>';
    html += '<button class="btn btn-gold" id="debtEditSave">💾 حفظ</button>';
    html += '</div>';
    html += '</div>'; // modal
    html += '</div>'; // modal-overlay

    container.innerHTML = html;

    // ── Bind events ──
    _bindEvents(containerId);
  }

  function _bindEvents(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Add button
    var submitBtn = document.getElementById('debtSubmitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var desc = document.getElementById('debtDesc').value.trim();
        var amount = parseFloat(document.getElementById('debtAmount').value);
        var currency = document.getElementById('debtCurrency').value;
        var type = document.getElementById('debtType').value;
        var date = document.getElementById('debtDate').value;

        if (!amount || amount <= 0) {
          if (typeof showToast === 'function') showToast('يرجى إدخال المبلغ', 'error');
          return;
        }
        if (!date) {
          if (typeof showToast === 'function') showToast('يرجى إدخال التاريخ', 'error');
          return;
        }

        add({ desc: desc, amount: amount, currency: currency, type: type, date: date });
        if (typeof showToast === 'function') showToast('تمت إضافة الدين بنجاح');
        renderDebtsSection(containerId);
      });
    }

    // Delete buttons
    var deleteBtns = container.querySelectorAll('[data-debt-delete]');
    for (var i = 0; i < deleteBtns.length; i++) {
      deleteBtns[i].addEventListener('click', function () {
        var id = this.getAttribute('data-debt-delete');
        if (!confirm('هل تريد حذف هذا الدين؟')) return;
        remove(id);
        if (typeof showToast === 'function') showToast('تم الحذف');
        renderDebtsSection(containerId);
      });
    }

    // Edit buttons
    var editBtns = container.querySelectorAll('[data-debt-edit]');
    for (var j = 0; j < editBtns.length; j++) {
      editBtns[j].addEventListener('click', function () {
        var id = this.getAttribute('data-debt-edit');
        _openEditModal(id);
      });
    }

    // Modal cancel
    var cancelBtn = document.getElementById('debtEditCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', _closeEditModal);
    }

    // Modal save
    var saveBtn = document.getElementById('debtEditSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var id = document.getElementById('debtEditId').value;
        if (!id) return;
        update(id, {
          desc: document.getElementById('debtEditDesc').value.trim(),
          amount: parseFloat(document.getElementById('debtEditAmount').value) || 0,
          currency: document.getElementById('debtEditCurrency').value,
          type: document.getElementById('debtEditType').value,
          date: document.getElementById('debtEditDate').value
        });
        _closeEditModal();
        if (typeof showToast === 'function') showToast('تم الحفظ بنجاح');
        renderDebtsSection(containerId);
      });
    }

    // Close modal on overlay click
    var modal = document.getElementById('debtEditModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === this) _closeEditModal();
      });
    }
  }

  function _openEditModal(id) {
    var debt = getById(id);
    if (!debt) return;
    document.getElementById('debtEditId').value = id;
    document.getElementById('debtEditDesc').value = debt.desc || '';
    document.getElementById('debtEditAmount').value = debt.amount;
    document.getElementById('debtEditCurrency').value = debt.currency;
    document.getElementById('debtEditType').value = debt.type;
    document.getElementById('debtEditDate').value = debt.date;
    document.getElementById('debtEditModal').classList.add('show');
  }

  function _closeEditModal() {
    var modal = document.getElementById('debtEditModal');
    if (modal) modal.classList.remove('show');
  }

  // ─── Public API ─────────────────────────────────────────────

  return {
    getAll: getAll,
    add: add,
    update: update,
    remove: remove,
    getById: getById,
    getTotalDebtsEGP: getTotalDebtsEGP,
    renderDebtsSection: renderDebtsSection
  };

})();
