// ─── Centralized Data Store ──────────────────────────────────
// Wraps all localStorage access with profile support
// Keys are scoped as: zakat_p_{profileId}_{key}

const ZakatStore = (function () {
  const PROFILES_KEY = 'zakat_profiles';
  const CURRENT_PROFILE_KEY = 'zakat_current_profile';
  const SETTINGS_KEY = 'zakat_app_settings';

  // Old (unscoped) keys for migration
  const LEGACY_MAP = {
    'zakat_entries': 'gold_entries',
    'zakat_price': 'gold_price',
    'zakat_money_entries': 'money_entries',
    'zakat_money_nisab_value': 'money_nisab',
    'zakat_money_nisab': 'money_nisab_info',
    'zakat_exchange_rates': 'exchange_rates',
    'zakat_exchange_rates_time': 'exchange_rates_time',
    'zakat_auto_price': 'auto_price',
    'zakat_usd_egp': 'usd_egp',
    'zakat_debts': 'debts',
    'zakat_payments': 'payments',
    'zakat_stocks': 'stock_entries',
    'zakat_stock_entries': 'stock_entries',
    'zakat_fitr_config': 'fitr_config',
  };

  // ─── Profile Helpers ────────────────────────────────────────

  function _getAllProfilesMeta() {
    try {
      return JSON.parse(localStorage.getItem(PROFILES_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function _saveProfilesMeta(profiles) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(profiles));
  }

  function _ensureDefaultProfile() {
    var profiles = _getAllProfilesMeta();
    if (profiles.length === 0) {
      profiles.push({ id: 'default', name: 'الحساب الرئيسي', createdAt: new Date().toISOString() });
      _saveProfilesMeta(profiles);
    }
    if (!localStorage.getItem(CURRENT_PROFILE_KEY)) {
      localStorage.setItem(CURRENT_PROFILE_KEY, 'default');
    }
  }

  // ─── Migration from old unscoped keys ───────────────────────

  function _migrateIfNeeded() {
    if (localStorage.getItem('zakat_migrated_v1')) return;

    _ensureDefaultProfile();
    var profileId = 'default';

    for (var oldKey in LEGACY_MAP) {
      if (!LEGACY_MAP.hasOwnProperty(oldKey)) continue;
      var newSuffix = LEGACY_MAP[oldKey];
      var oldVal = localStorage.getItem(oldKey);
      if (oldVal !== null) {
        var scopedKey = _scopedKey(profileId, newSuffix);
        if (localStorage.getItem(scopedKey) === null) {
          localStorage.setItem(scopedKey, oldVal);
        }
      }
    }

    localStorage.setItem('zakat_migrated_v1', '1');
  }

  // ─── Key Scoping ────────────────────────────────────────────

  function _currentProfileId() {
    return localStorage.getItem(CURRENT_PROFILE_KEY) || 'default';
  }

  function _scopedKey(profileId, key) {
    return 'zakat_p_' + profileId + '_' + key;
  }

  function _key(suffix) {
    return _scopedKey(_currentProfileId(), suffix);
  }

  // ─── Generic getters/setters ────────────────────────────────

  function _getJSON(suffix, fallback) {
    try {
      var val = localStorage.getItem(_key(suffix));
      return val !== null ? JSON.parse(val) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function _setJSON(suffix, value) {
    localStorage.setItem(_key(suffix), JSON.stringify(value));
  }

  function _getString(suffix, fallback) {
    var val = localStorage.getItem(_key(suffix));
    return val !== null ? val : (fallback || '');
  }

  function _setString(suffix, value) {
    localStorage.setItem(_key(suffix), String(value));
  }

  // ─── Initialize ─────────────────────────────────────────────

  _migrateIfNeeded();
  _ensureDefaultProfile();

  // ─── Public API ─────────────────────────────────────────────

  return {
    // ── Gold Entries ────────────────────────────────────────
    getGoldEntries: function () {
      return _getJSON('gold_entries', []);
    },
    setGoldEntries: function (entries) {
      _setJSON('gold_entries', entries);
    },

    // ── Gold Price ──────────────────────────────────────────
    getGoldPrice: function () {
      return parseFloat(_getString('gold_price', '0')) || 0;
    },
    setGoldPrice: function (price) {
      _setString('gold_price', price);
    },

    // ── Money Entries ───────────────────────────────────────
    getMoneyEntries: function () {
      return _getJSON('money_entries', []);
    },
    setMoneyEntries: function (entries) {
      _setJSON('money_entries', entries);
    },

    // ── Money Nisab ─────────────────────────────────────────
    getMoneyNisab: function () {
      return parseFloat(_getString('money_nisab', '0')) || 0;
    },
    setMoneyNisab: function (value) {
      _setString('money_nisab', value);
    },

    // ── Exchange Rates ──────────────────────────────────────
    getExchangeRates: function () {
      return _getJSON('exchange_rates', {});
    },
    setExchangeRates: function (rates) {
      _setJSON('exchange_rates', rates);
    },

    // ── Stock Entries ───────────────────────────────────────
    getStockEntries: function () {
      return _getJSON('stock_entries', []);
    },
    setStockEntries: function (entries) {
      _setJSON('stock_entries', entries);
    },

    // ── Debts ───────────────────────────────────────────────
    getDebts: function () {
      return _getJSON('debts', []);
    },
    setDebts: function (debts) {
      _setJSON('debts', debts);
    },

    // ── Payments ────────────────────────────────────────────
    getPayments: function () {
      return _getJSON('payments', []);
    },
    setPayments: function (payments) {
      _setJSON('payments', payments);
    },

    // ── Fitr Config ─────────────────────────────────────────
    getFitrConfig: function () {
      return _getJSON('fitr_config', {
        members: [],
        pricePerSa: 35,
        grainType: 'rice',
        records: {}
      });
    },
    setFitrConfig: function (config) {
      _setJSON('fitr_config', config);
    },

    // ── Combined Nisab Info ─────────────────────────────────
    getCombinedNisabInfo: function (goldPrice) {
      var gp = goldPrice || this.getGoldPrice();
      var nisabEGP = NISAB_GRAMS * gp;

      // Total gold value in EGP
      var goldEntries = this.getGoldEntries();
      var totalGoldGrams24 = 0;
      for (var g = 0; g < goldEntries.length; g++) {
        var e = goldEntries[g];
        totalGoldGrams24 += (e.grams * (e.karat || 24)) / 24;
      }
      var totalGoldEGP = totalGoldGrams24 * gp;

      // Total cash in EGP
      var moneyEntries = this.getMoneyEntries();
      var exchangeRates = this.getExchangeRates();
      var totalCashEGP = 0;

      var sorted = moneyEntries.slice().sort(function (a, b) {
        return new Date(a.date) - new Date(b.date);
      });
      for (var m = 0; m < sorted.length; m++) {
        var me = sorted[m];
        var amountEGP = me.currency === 'EGP' ? me.amount : me.amount * (exchangeRates[me.currency] || 1);
        if (me.type === 'expense') {
          totalCashEGP -= Math.abs(amountEGP);
        } else {
          totalCashEGP += Math.abs(amountEGP);
        }
      }
      if (totalCashEGP < 0) totalCashEGP = 0;

      var combinedEGP = totalGoldEGP + totalCashEGP;
      var reachedNisab = gp > 0 && combinedEGP >= nisabEGP;

      // Find nisab date
      var nisabDate = null;
      if (reachedNisab) {
        var allDated = [];
        for (var gi = 0; gi < goldEntries.length; gi++) {
          var ge = goldEntries[gi];
          var valueEGP = ((ge.grams * (ge.karat || 24)) / 24) * gp;
          allDated.push({ date: ge.date, value: valueEGP });
        }
        for (var mi = 0; mi < sorted.length; mi++) {
          var se = sorted[mi];
          var seEGP = se.currency === 'EGP' ? se.amount : se.amount * (exchangeRates[se.currency] || 1);
          var signed = se.type === 'expense' ? -Math.abs(seEGP) : Math.abs(seEGP);
          allDated.push({ date: se.date, value: signed });
        }
        allDated.sort(function (a, b) {
          return new Date(a.date) - new Date(b.date);
        });
        var cum = 0;
        for (var i = 0; i < allDated.length; i++) {
          cum += allDated[i].value;
          if (cum >= nisabEGP) {
            nisabDate = allDated[i].date;
            break;
          }
        }
      }

      return {
        totalGoldEGP: totalGoldEGP,
        totalCashEGP: totalCashEGP,
        combinedEGP: combinedEGP,
        nisabEGP: nisabEGP,
        reachedNisab: reachedNisab,
        nisabDate: nisabDate
      };
    },

    // ── Profile Management ──────────────────────────────────

    getAllProfiles: function () {
      return _getAllProfilesMeta();
    },

    getCurrentProfile: function () {
      var id = _currentProfileId();
      var profiles = _getAllProfilesMeta();
      for (var i = 0; i < profiles.length; i++) {
        if (profiles[i].id === id) return profiles[i];
      }
      return { id: 'default', name: 'الحساب الرئيسي' };
    },

    createProfile: function (name) {
      var profiles = _getAllProfilesMeta();
      var id = 'p_' + Date.now().toString(36);
      var profile = { id: id, name: name, createdAt: new Date().toISOString() };
      profiles.push(profile);
      _saveProfilesMeta(profiles);
      return profile;
    },

    deleteProfile: function (id) {
      if (id === 'default') {
        if (typeof showToast === 'function') showToast('لا يمكن حذف الحساب الرئيسي', 'error');
        return false;
      }

      var profiles = _getAllProfilesMeta();
      var filtered = [];
      for (var i = 0; i < profiles.length; i++) {
        if (profiles[i].id !== id) filtered.push(profiles[i]);
      }
      _saveProfilesMeta(filtered);

      // Remove all scoped keys for this profile
      var prefix = 'zakat_p_' + id + '_';
      var keysToRemove = [];
      for (var j = 0; j < localStorage.length; j++) {
        var key = localStorage.key(j);
        if (key && key.indexOf(prefix) === 0) {
          keysToRemove.push(key);
        }
      }
      for (var k = 0; k < keysToRemove.length; k++) {
        localStorage.removeItem(keysToRemove[k]);
      }

      // Switch to default if we deleted the active profile
      if (_currentProfileId() === id) {
        localStorage.setItem(CURRENT_PROFILE_KEY, 'default');
      }

      return true;
    },

    switchProfile: function (id) {
      var profiles = _getAllProfilesMeta();
      var exists = false;
      for (var i = 0; i < profiles.length; i++) {
        if (profiles[i].id === id) { exists = true; break; }
      }
      if (!exists) {
        if (typeof showToast === 'function') showToast('الحساب غير موجود', 'error');
        return false;
      }
      localStorage.setItem(CURRENT_PROFILE_KEY, id);
      return true;
    },

    // ── Export / Import ─────────────────────────────────────

    exportAll: function () {
      var profiles = _getAllProfilesMeta();
      var data = {
        version: 1,
        exportDate: new Date().toISOString(),
        currentProfile: _currentProfileId(),
        profiles: profiles,
        settings: this.getSettings(),
        profileData: {}
      };

      for (var p = 0; p < profiles.length; p++) {
        var profile = profiles[p];
        var prefix = 'zakat_p_' + profile.id + '_';
        var profileData = {};
        for (var i = 0; i < localStorage.length; i++) {
          var key = localStorage.key(i);
          if (key && key.indexOf(prefix) === 0) {
            var suffix = key.substring(prefix.length);
            try {
              profileData[suffix] = JSON.parse(localStorage.getItem(key));
            } catch (e) {
              profileData[suffix] = localStorage.getItem(key);
            }
          }
        }
        data.profileData[profile.id] = profileData;
      }

      return JSON.stringify(data, null, 2);
    },

    importAll: function (json) {
      try {
        var data = typeof json === 'string' ? JSON.parse(json) : json;

        if (!data.profiles || !data.profileData) {
          if (typeof showToast === 'function') showToast('ملف غير صالح', 'error');
          return false;
        }

        // Save profiles meta
        _saveProfilesMeta(data.profiles);

        // Save settings
        if (data.settings) {
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
        }

        // Save each profile's data
        for (var p = 0; p < data.profiles.length; p++) {
          var profile = data.profiles[p];
          var profileData = data.profileData[profile.id];
          if (!profileData) continue;

          var prefix = 'zakat_p_' + profile.id + '_';

          // Clear existing data for this profile
          var keysToRemove = [];
          for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf(prefix) === 0) {
              keysToRemove.push(key);
            }
          }
          for (var r = 0; r < keysToRemove.length; r++) {
            localStorage.removeItem(keysToRemove[r]);
          }

          // Write new data
          for (var suffix in profileData) {
            if (profileData.hasOwnProperty(suffix)) {
              var val = profileData[suffix];
              localStorage.setItem(prefix + suffix, typeof val === 'string' ? val : JSON.stringify(val));
            }
          }
        }

        // Restore current profile
        if (data.currentProfile) {
          localStorage.setItem(CURRENT_PROFILE_KEY, data.currentProfile);
        }

        if (typeof showToast === 'function') showToast('تم استيراد البيانات بنجاح', 'success');
        return true;
      } catch (e) {
        if (typeof showToast === 'function') showToast('خطأ في استيراد البيانات: ' + e.message, 'error');
        return false;
      }
    },

    // ── App-Wide Settings ───────────────────────────────────

    getSettings: function () {
      try {
        return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {
          theme: 'dark',
          notifications: true,
          language: 'ar'
        };
      } catch (e) {
        return { theme: 'dark', notifications: true, language: 'ar' };
      }
    },

    setSettings: function (settings) {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
  };

})();
