// ─── Browser Notification Manager ─────────────────────────────

const NotificationManager = (function () {

  function isSupported() {
    return 'Notification' in window;
  }

  function requestPermission() {
    if (!isSupported()) return Promise.resolve('denied');
    return Notification.requestPermission();
  }

  function isEnabled() {
    var settings = ZakatStore.getSettings();
    return !!settings.notifications;
  }

  function setEnabled(bool) {
    var settings = ZakatStore.getSettings();
    settings.notifications = !!bool;
    ZakatStore.setSettings(settings);
  }

  function _showNotification(title, body, tag) {
    if (!isSupported()) return;
    if (Notification.permission !== 'granted') return;

    try {
      new Notification(title, {
        body: body,
        icon: 'favicon.svg',
        dir: 'rtl',
        lang: 'ar',
        tag: tag || 'zakat-notification'
      });
    } catch (e) {
      // Fallback for environments where Notification constructor fails
    }
  }

  function checkAndNotify() {
    if (!isSupported() || !isEnabled()) return;
    if (Notification.permission !== 'granted') return;

    var today = new Date();
    today.setHours(12, 0, 0, 0);

    // Check gold zakat due date
    var goldEntries = ZakatStore.getGoldEntries();
    if (goldEntries.length > 0) {
      var sorted = goldEntries.slice().sort(function (a, b) {
        return new Date(a.date) - new Date(b.date);
      });
      var cumulative = 0;
      var nisabDate = null;

      for (var i = 0; i < sorted.length; i++) {
        var e = sorted[i];
        cumulative += (e.grams * (e.karat || 24)) / 24;
        if (cumulative >= NISAB_GRAMS && !nisabDate) {
          nisabDate = e.date;
          break;
        }
      }

      if (nisabDate) {
        var goldDueDate = addOneHijriYear(nisabDate);
        var goldDaysUntil = Math.floor((goldDueDate - today) / 86400000);

        if (goldDaysUntil < 0) {
          _showNotification(
            'زكاة الذهب متأخرة!',
            'زكاة الذهب متأخرة بـ ' + Math.abs(goldDaysUntil) + ' يوم. يرجى إخراجها في أقرب وقت.',
            'zakat-gold-overdue'
          );
        } else if (goldDaysUntil <= 30) {
          _showNotification(
            'تذكير بزكاة الذهب',
            'موعد زكاة الذهب بعد ' + goldDaysUntil + ' يوم.',
            'zakat-gold-upcoming'
          );
        }
      }
    }

    // Check money zakat due date
    var moneyEntries = ZakatStore.getMoneyEntries();
    if (moneyEntries.length > 0) {
      var goldPrice = ZakatStore.getGoldPrice();
      if (goldPrice > 0) {
        var nisabInfo = ZakatStore.getCombinedNisabInfo(goldPrice);
        if (nisabInfo.reachedNisab && nisabInfo.nisabDate) {
          var moneyDueDate = addOneHijriYear(nisabInfo.nisabDate);
          var moneyDaysUntil = Math.floor((moneyDueDate - today) / 86400000);

          if (moneyDaysUntil < 0) {
            _showNotification(
              'زكاة المال متأخرة!',
              'زكاة المال متأخرة بـ ' + Math.abs(moneyDaysUntil) + ' يوم. يرجى إخراجها في أقرب وقت.',
              'zakat-money-overdue'
            );
          } else if (moneyDaysUntil <= 30) {
            _showNotification(
              'تذكير بزكاة المال',
              'موعد زكاة المال بعد ' + moneyDaysUntil + ' يوم.',
              'zakat-money-upcoming'
            );
          }
        }
      }
    }
  }

  function renderSettingsSection(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;

    var supported = isSupported();
    var enabled = isEnabled();
    var permission = supported ? Notification.permission : 'denied';

    var statusText = '';
    if (!supported) {
      statusText = 'المتصفح لا يدعم الإشعارات';
    } else if (permission === 'denied') {
      statusText = 'تم رفض الإذن. يرجى تفعيله من إعدادات المتصفح.';
    } else if (permission === 'granted') {
      statusText = 'الإشعارات مفعلة';
    } else {
      statusText = 'لم يتم طلب الإذن بعد';
    }

    container.innerHTML = `
      <div class="info-section">
        <h2>إشعارات الزكاة</h2>
        <p style="color:var(--text2); margin-bottom:16px;">
          احصل على تنبيهات عندما يقترب موعد إخراج الزكاة أو عند تأخرها.
        </p>
        <div style="display:flex; align-items:center; gap:16px; flex-wrap:wrap; margin-bottom:12px;">
          <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:15px;">
            <input type="checkbox" id="notifToggle" ${enabled ? 'checked' : ''} ${!supported ? 'disabled' : ''}>
            <span>تفعيل الإشعارات</span>
          </label>
          ${supported && permission !== 'granted' ? '<button class="btn btn-outline" id="notifPermBtn">طلب إذن الإشعارات</button>' : ''}
        </div>
        <div style="font-size:13px; color:var(--text2);" id="notifStatus">${statusText}</div>
      </div>
    `;

    var toggle = document.getElementById('notifToggle');
    if (toggle) {
      toggle.addEventListener('change', function () {
        setEnabled(this.checked);
        if (this.checked && supported && Notification.permission === 'default') {
          requestPermission().then(function (result) {
            _updateStatus(container);
            if (result === 'granted') {
              checkAndNotify();
            }
          });
        }
      });
    }

    var permBtn = document.getElementById('notifPermBtn');
    if (permBtn) {
      permBtn.addEventListener('click', function () {
        requestPermission().then(function (result) {
          _updateStatus(container);
          if (result === 'granted' && isEnabled()) {
            checkAndNotify();
          }
        });
      });
    }
  }

  function _updateStatus(container) {
    var statusEl = document.getElementById('notifStatus');
    var permBtn = document.getElementById('notifPermBtn');
    if (!statusEl) return;

    var permission = Notification.permission;
    if (permission === 'granted') {
      statusEl.textContent = 'الإشعارات مفعلة';
      if (permBtn) permBtn.style.display = 'none';
    } else if (permission === 'denied') {
      statusEl.textContent = 'تم رفض الإذن. يرجى تفعيله من إعدادات المتصفح.';
      if (permBtn) permBtn.style.display = 'none';
    }
  }

  return {
    isSupported: isSupported,
    requestPermission: requestPermission,
    isEnabled: isEnabled,
    setEnabled: setEnabled,
    checkAndNotify: checkAndNotify,
    renderSettingsSection: renderSettingsSection
  };

})();
