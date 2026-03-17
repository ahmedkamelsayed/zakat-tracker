// ─── Profile Manager UI ───────────────────────────────────────

const ProfileManager = (function () {

  function renderProfileSwitcher(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var profiles = ZakatStore.getAllProfiles();
    var current = ZakatStore.getCurrentProfile();

    var optionsHtml = '';
    for (var i = 0; i < profiles.length; i++) {
      var p = profiles[i];
      var selected = p.id === current.id ? ' selected' : '';
      optionsHtml += '<option value="' + p.id + '"' + selected + '>' + _escapeHtml(p.name) + '</option>';
    }

    container.innerHTML = `
      <div class="info-section">
        <h2>إدارة الحسابات</h2>
        <p style="color:var(--text2); margin-bottom:16px;">
          يمكنك إنشاء حسابات منفصلة لتتبع زكاة أشخاص مختلفين أو فصل أنواع الأموال.
        </p>
        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:16px;">
          <label style="font-size:14px; font-weight:500;">الحساب الحالي:</label>
          <select id="profileSelect" class="profile-select" style="padding:8px 12px; border-radius:var(--radius); border:1px solid rgba(201,168,76,0.3); background:var(--card-bg); color:var(--text1); font-family:inherit; font-size:14px; min-width:180px;">
            ${optionsHtml}
          </select>
        </div>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-gold" id="profileCreateBtn">إنشاء حساب جديد</button>
          <button class="btn btn-outline" id="profileDeleteBtn" style="color:var(--red); border-color:rgba(207,102,121,0.3);">حذف الحساب</button>
        </div>
      </div>
    `;

    // Switch profile on select change
    document.getElementById('profileSelect').addEventListener('change', function () {
      var selectedId = this.value;
      if (selectedId !== current.id) {
        switchTo(selectedId);
      }
    });

    // Create profile button
    document.getElementById('profileCreateBtn').addEventListener('click', function () {
      createProfileModal();
    });

    // Delete profile button
    document.getElementById('profileDeleteBtn').addEventListener('click', function () {
      var select = document.getElementById('profileSelect');
      if (select) {
        deleteProfileConfirm(select.value);
      }
    });
  }

  function createProfileModal() {
    // Remove existing modal if any
    var existing = document.getElementById('profileModal');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'profileModal';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="modal">
        <h3>إنشاء حساب جديد</h3>
        <div class="form-group" style="margin-bottom:16px;">
          <label>اسم الحساب</label>
          <input type="text" id="newProfileName" placeholder="مثال: زكاة الزوجة، حساب آخر" style="width:100%; padding:10px; border-radius:var(--radius); border:1px solid rgba(201,168,76,0.3); background:var(--card-bg); color:var(--text1); font-family:inherit; font-size:14px;">
        </div>
        <div class="modal-actions">
          <button class="btn btn-outline" id="profileModalCancel">إلغاء</button>
          <button class="btn btn-gold" id="profileModalCreate">إنشاء</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Focus the input
    var nameInput = document.getElementById('newProfileName');
    if (nameInput) nameInput.focus();

    // Cancel
    document.getElementById('profileModalCancel').addEventListener('click', function () {
      overlay.remove();
    });

    // Close on overlay click
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.remove();
    });

    // Create
    document.getElementById('profileModalCreate').addEventListener('click', function () {
      var name = nameInput.value.trim();
      if (!name) {
        if (typeof showToast === 'function') showToast('يرجى إدخال اسم الحساب', 'error');
        return;
      }
      var profile = ZakatStore.createProfile(name);
      if (typeof showToast === 'function') showToast('تم إنشاء الحساب: ' + name, 'success');
      overlay.remove();
      switchTo(profile.id);
    });

    // Enter key to create
    nameInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        document.getElementById('profileModalCreate').click();
      }
    });
  }

  function switchTo(profileId) {
    var success = ZakatStore.switchProfile(profileId);
    if (success) {
      location.reload();
    }
  }

  function deleteProfileConfirm(id) {
    if (id === 'default') {
      if (typeof showToast === 'function') showToast('لا يمكن حذف الحساب الرئيسي', 'error');
      return;
    }

    var profiles = ZakatStore.getAllProfiles();
    var profileName = '';
    for (var i = 0; i < profiles.length; i++) {
      if (profiles[i].id === id) {
        profileName = profiles[i].name;
        break;
      }
    }

    if (confirm('هل أنت متأكد من حذف الحساب "' + profileName + '"؟\nسيتم حذف جميع بيانات هذا الحساب نهائياً.')) {
      var success = ZakatStore.deleteProfile(id);
      if (success) {
        if (typeof showToast === 'function') showToast('تم حذف الحساب', 'success');
        location.reload();
      }
    }
  }

  function _escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return {
    renderProfileSwitcher: renderProfileSwitcher,
    createProfileModal: createProfileModal,
    switchTo: switchTo,
    deleteProfileConfirm: deleteProfileConfirm
  };

})();
