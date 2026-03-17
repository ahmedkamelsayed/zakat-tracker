// ─── Backup / Restore Manager ─────────────────────────────────

const BackupManager = (function () {

  function exportData() {
    try {
      const jsonStr = ZakatStore.exportAll();
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const now = new Date();
      const yyyy = now.getFullYear();
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const filename = 'zakat-backup-' + yyyy + '-' + mm + '-' + dd + '.json';

      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (typeof showToast === 'function') {
        showToast('تم تصدير البيانات بنجاح', 'success');
      }
    } catch (e) {
      if (typeof showToast === 'function') {
        showToast('خطأ في تصدير البيانات: ' + e.message, 'error');
      }
    }
  }

  function importData(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const data = JSON.parse(e.target.result);
        const success = ZakatStore.importAll(data);
        if (success) {
          setTimeout(function () {
            location.reload();
          }, 500);
        }
      } catch (err) {
        if (typeof showToast === 'function') {
          showToast('خطأ في قراءة الملف: ' + err.message, 'error');
        }
      }
    };
    reader.onerror = function () {
      if (typeof showToast === 'function') {
        showToast('خطأ في قراءة الملف', 'error');
      }
    };
    reader.readAsText(file);
  }

  function renderBackupSection(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = `
      <div class="info-section">
        <h2>النسخ الاحتياطي والاستعادة</h2>
        <p style="color:var(--text2); margin-bottom:16px;">
          يمكنك تصدير جميع بياناتك كملف JSON لحفظها، أو استيراد نسخة احتياطية سابقة.
        </p>
        <div style="display:flex; gap:12px; flex-wrap:wrap;">
          <button class="btn btn-gold" id="backupExportBtn">
            تصدير البيانات
          </button>
          <label class="btn btn-outline" style="cursor:pointer; position:relative;">
            استيراد البيانات
            <input type="file" id="backupImportInput" accept=".json"
                   style="position:absolute; inset:0; opacity:0; cursor:pointer;">
          </label>
        </div>
      </div>
    `;

    document.getElementById('backupExportBtn').addEventListener('click', function () {
      exportData();
    });

    document.getElementById('backupImportInput').addEventListener('change', function (e) {
      var file = e.target.files && e.target.files[0];
      if (file) {
        if (confirm('سيتم استبدال جميع البيانات الحالية بالبيانات المستوردة. هل أنت متأكد؟')) {
          importData(file);
        } else {
          e.target.value = '';
        }
      }
    });
  }

  return {
    exportData: exportData,
    importData: importData,
    renderBackupSection: renderBackupSection
  };

})();
