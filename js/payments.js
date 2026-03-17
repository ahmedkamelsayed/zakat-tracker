// ─── Zakat Payment Tracker ────────────────────────────────────
// CRUD for zakat payments with rendering support
// Uses ZakatStore for all persistence

var PaymentsManager = (function () {

  // ─── Zakat type labels ──────────────────────────────────────

  var TYPE_LABELS = {
    gold: '🥇 زكاة الذهب',
    money: '💵 زكاة المال',
    stocks: '📈 زكاة الأسهم',
    fitr: '🌙 زكاة الفطر',
    general: '💰 زكاة عامة'
  };

  // ─── CRUD ───────────────────────────────────────────────────

  function getAll() {
    return ZakatStore.getPayments();
  }

  function add(payment) {
    var payments = getAll();
    payments.push({
      id: Date.now().toString(),
      amount: parseFloat(payment.amount) || 0,
      date: payment.date || new Date().toISOString().slice(0, 10),
      note: payment.note || '',
      zakatType: payment.zakatType || 'general'
    });
    ZakatStore.setPayments(payments);
    return payments;
  }

  function update(id, updates) {
    var payments = getAll();
    for (var i = 0; i < payments.length; i++) {
      if (payments[i].id === id) {
        for (var key in updates) {
          if (updates.hasOwnProperty(key)) {
            payments[i][key] = updates[key];
          }
        }
        break;
      }
    }
    ZakatStore.setPayments(payments);
    return payments;
  }

  function remove(id) {
    var payments = getAll();
    var filtered = [];
    for (var i = 0; i < payments.length; i++) {
      if (payments[i].id !== id) filtered.push(payments[i]);
    }
    ZakatStore.setPayments(filtered);
    return filtered;
  }

  function getById(id) {
    var payments = getAll();
    for (var i = 0; i < payments.length; i++) {
      if (payments[i].id === id) return payments[i];
    }
    return null;
  }

  // ─── Aggregation ────────────────────────────────────────────

  function getTotalPaidForType(type) {
    var payments = getAll();
    var total = 0;
    for (var i = 0; i < payments.length; i++) {
      if (payments[i].zakatType === type) {
        total += payments[i].amount || 0;
      }
    }
    return total;
  }

  function getTotalPaid() {
    var payments = getAll();
    var total = 0;
    for (var i = 0; i < payments.length; i++) {
      total += payments[i].amount || 0;
    }
    return total;
  }

  function getRemainingForType(type, totalDue) {
    var paid = getTotalPaidForType(type);
    return Math.max(0, totalDue - paid);
  }

  // ─── Rendering ──────────────────────────────────────────────

  function renderPaymentsSection(containerId, zakatType) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var allPayments = getAll();
    // Filter by zakatType if provided, otherwise show all
    var payments;
    if (zakatType) {
      payments = [];
      for (var f = 0; f < allPayments.length; f++) {
        if (allPayments[f].zakatType === zakatType) payments.push(allPayments[f]);
      }
    } else {
      payments = allPayments;
    }

    // Sort by date descending
    payments.sort(function (a, b) {
      return new Date(b.date) - new Date(a.date);
    });

    var totalPaid = 0;
    for (var t = 0; t < payments.length; t++) {
      totalPaid += payments[t].amount || 0;
    }

    var typeLabel = zakatType ? (TYPE_LABELS[zakatType] || zakatType) : '💰 جميع المدفوعات';

    var html = '';

    // ── Section header ──
    html += '<div class="section-title">' + typeLabel + ' — سجل المدفوعات</div>';

    // ── Summary card ──
    html += '<div class="cards" style="margin-bottom:20px">';
    html += '<div class="card">';
    html += '<span class="card-icon">✅</span>';
    html += '<div class="card-label">إجمالي المدفوع</div>';
    html += '<div class="card-value" style="color:var(--green, #4CAF7A)">';
    html += totalPaid.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
    html += '</div>';
    html += '<div class="card-sub">' + payments.length + ' عملية دفع</div>';
    html += '</div>';
    html += '</div>';

    // ── Add form ──
    html += '<div class="form-section">';
    html += '<div class="section-title">➕ تسجيل دفعة زكاة</div>';
    html += '<div class="form-grid">';

    html += '<div class="form-group">';
    html += '<label>المبلغ (ج.م)</label>';
    html += '<input type="number" id="payAmount" min="0" step="0.01" placeholder="0">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>نوع الزكاة</label>';
    html += '<select id="payZakatType">';
    html += '<option value="gold"' + (zakatType === 'gold' ? ' selected' : '') + '>زكاة الذهب</option>';
    html += '<option value="money"' + (zakatType === 'money' ? ' selected' : '') + '>زكاة المال</option>';
    html += '<option value="stocks"' + (zakatType === 'stocks' ? ' selected' : '') + '>زكاة الأسهم</option>';
    html += '<option value="fitr"' + (zakatType === 'fitr' ? ' selected' : '') + '>زكاة الفطر</option>';
    html += '<option value="general"' + (zakatType === 'general' || !zakatType ? ' selected' : '') + '>زكاة عامة</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>التاريخ</label>';
    html += '<input type="date" id="payDate" value="' + new Date().toISOString().slice(0, 10) + '">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>ملاحظة (اختياري)</label>';
    html += '<input type="text" id="payNote" placeholder="ملاحظة...">';
    html += '</div>';

    html += '<div class="form-group" style="justify-content:flex-end">';
    html += '<button class="btn btn-gold" id="paySubmitBtn">✓ تسجيل الدفعة</button>';
    html += '</div>';

    html += '</div>'; // form-grid
    html += '</div>'; // form-section

    // ── Payments history ──
    html += '<div class="table-section">';
    html += '<div class="table-header">';
    html += '<div class="section-title" style="margin:0">📊 سجل الدفعات</div>';
    html += '</div>';

    if (payments.length === 0) {
      html += '<div class="empty-state"><div class="icon">✅</div><p>لم يتم تسجيل دفعات بعد</p></div>';
    } else {
      html += '<div class="table-wrap">';
      html += '<table>';
      html += '<thead><tr>';
      html += '<th>#</th><th>المبلغ</th><th>نوع الزكاة</th><th>التاريخ</th><th>ملاحظة</th><th>إجراءات</th>';
      html += '</tr></thead>';
      html += '<tbody>';

      for (var i = 0; i < payments.length; i++) {
        var p = payments[i];
        var pTypeLabel = TYPE_LABELS[p.zakatType] || p.zakatType || '—';

        html += '<tr class="fade-in" data-id="' + p.id + '">';
        html += '<td>' + (i + 1) + '</td>';
        html += '<td><strong style="color:var(--green, #4CAF7A)">' + p.amount.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م</strong></td>';
        html += '<td>' + pTypeLabel + '</td>';
        html += '<td>' + (typeof formatGreg === 'function' ? formatGreg(p.date) : p.date) + '</td>';
        html += '<td>' + (p.note || '—') + '</td>';
        html += '<td style="white-space:nowrap">';
        html += '<button class="btn btn-edit" data-pay-edit="' + p.id + '">✏️</button> ';
        html += '<button class="btn btn-danger" data-pay-delete="' + p.id + '">🗑</button>';
        html += '</td>';
        html += '</tr>';
      }

      html += '</tbody>';
      html += '<tfoot><tr class="totals-row">';
      html += '<td style="text-align:right">المجموع</td>';
      html += '<td><strong>' + totalPaid.toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م</strong></td>';
      html += '<td colspan="4"></td>';
      html += '</tr></tfoot>';
      html += '</table>';
      html += '</div>'; // table-wrap
    }

    html += '</div>'; // table-section

    // ── Edit modal ──
    html += '<div class="modal-overlay" id="payEditModal">';
    html += '<div class="modal">';
    html += '<h3>✏️ تعديل الدفعة</h3>';
    html += '<input type="hidden" id="payEditId">';
    html += '<div class="form-grid" style="grid-template-columns:1fr 1fr">';

    html += '<div class="form-group">';
    html += '<label>المبلغ (ج.م)</label>';
    html += '<input type="number" id="payEditAmount" min="0" step="0.01">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>نوع الزكاة</label>';
    html += '<select id="payEditZakatType">';
    html += '<option value="gold">زكاة الذهب</option>';
    html += '<option value="money">زكاة المال</option>';
    html += '<option value="stocks">زكاة الأسهم</option>';
    html += '<option value="fitr">زكاة الفطر</option>';
    html += '<option value="general">زكاة عامة</option>';
    html += '</select>';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>التاريخ</label>';
    html += '<input type="date" id="payEditDate">';
    html += '</div>';

    html += '<div class="form-group">';
    html += '<label>ملاحظة</label>';
    html += '<input type="text" id="payEditNote">';
    html += '</div>';

    html += '</div>'; // form-grid
    html += '<div class="modal-actions">';
    html += '<button class="btn btn-outline" id="payEditCancel">إلغاء</button>';
    html += '<button class="btn btn-gold" id="payEditSave">💾 حفظ</button>';
    html += '</div>';
    html += '</div>'; // modal
    html += '</div>'; // modal-overlay

    container.innerHTML = html;

    // ── Bind events ──
    _bindPaymentEvents(containerId, zakatType);
  }

  function _bindPaymentEvents(containerId, zakatType) {
    var container = document.getElementById(containerId);
    if (!container) return;

    // Add button
    var submitBtn = document.getElementById('paySubmitBtn');
    if (submitBtn) {
      submitBtn.addEventListener('click', function () {
        var amount = parseFloat(document.getElementById('payAmount').value);
        var selectedType = document.getElementById('payZakatType').value;
        var date = document.getElementById('payDate').value;
        var note = document.getElementById('payNote').value.trim();

        if (!amount || amount <= 0) {
          if (typeof showToast === 'function') showToast('يرجى إدخال المبلغ', 'error');
          return;
        }
        if (!date) {
          if (typeof showToast === 'function') showToast('يرجى إدخال التاريخ', 'error');
          return;
        }

        add({ amount: amount, zakatType: selectedType, date: date, note: note });
        if (typeof showToast === 'function') showToast('تم تسجيل الدفعة بنجاح');
        renderPaymentsSection(containerId, zakatType);
      });
    }

    // Delete buttons
    var deleteBtns = container.querySelectorAll('[data-pay-delete]');
    for (var i = 0; i < deleteBtns.length; i++) {
      deleteBtns[i].addEventListener('click', function () {
        var id = this.getAttribute('data-pay-delete');
        if (!confirm('هل تريد حذف هذه الدفعة؟')) return;
        remove(id);
        if (typeof showToast === 'function') showToast('تم الحذف');
        renderPaymentsSection(containerId, zakatType);
      });
    }

    // Edit buttons
    var editBtns = container.querySelectorAll('[data-pay-edit]');
    for (var j = 0; j < editBtns.length; j++) {
      editBtns[j].addEventListener('click', function () {
        var id = this.getAttribute('data-pay-edit');
        _openPayEditModal(id);
      });
    }

    // Modal cancel
    var cancelBtn = document.getElementById('payEditCancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', _closePayEditModal);
    }

    // Modal save
    var saveBtn = document.getElementById('payEditSave');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var id = document.getElementById('payEditId').value;
        if (!id) return;
        update(id, {
          amount: parseFloat(document.getElementById('payEditAmount').value) || 0,
          zakatType: document.getElementById('payEditZakatType').value,
          date: document.getElementById('payEditDate').value,
          note: document.getElementById('payEditNote').value.trim()
        });
        _closePayEditModal();
        if (typeof showToast === 'function') showToast('تم الحفظ بنجاح');
        renderPaymentsSection(containerId, zakatType);
      });
    }

    // Close modal on overlay click
    var modal = document.getElementById('payEditModal');
    if (modal) {
      modal.addEventListener('click', function (e) {
        if (e.target === this) _closePayEditModal();
      });
    }
  }

  function _openPayEditModal(id) {
    var payment = getById(id);
    if (!payment) return;
    document.getElementById('payEditId').value = id;
    document.getElementById('payEditAmount').value = payment.amount;
    document.getElementById('payEditZakatType').value = payment.zakatType || 'general';
    document.getElementById('payEditDate').value = payment.date;
    document.getElementById('payEditNote').value = payment.note || '';
    document.getElementById('payEditModal').classList.add('show');
  }

  function _closePayEditModal() {
    var modal = document.getElementById('payEditModal');
    if (modal) modal.classList.remove('show');
  }

  // ─── Public API ─────────────────────────────────────────────

  return {
    getAll: getAll,
    add: add,
    update: update,
    remove: remove,
    getById: getById,
    getTotalPaidForType: getTotalPaidForType,
    getTotalPaid: getTotalPaid,
    getRemainingForType: getRemainingForType,
    renderPaymentsSection: renderPaymentsSection
  };

})();
