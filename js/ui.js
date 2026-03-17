// ─── Shared UI Components ─────────────────────────────────────

// ─── Theme Toggle (Light/Dark) ────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('zakat_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('zakat_theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const btn = document.getElementById('themeToggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// Apply theme immediately (before DOMContentLoaded) to prevent flash
(function() {
  const saved = localStorage.getItem('zakat_theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

// ─── Navigation Toggle ────────────────────────────────────────
function initNav() {
  const toggle = document.querySelector('.nav-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      links.classList.toggle('open');
    });
  }
}

// ─── Toast Notifications ──────────────────────────────────────
function showToast(message, type = 'success', duration = 3000) {
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.className = 'toast ' + type;
  requestAnimationFrame(() => {
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
  });
}

// ─── Zakat Due Alert ──────────────────────────────────────────
function checkZakatAlerts() {
  const banner = document.getElementById('alertBanner');
  if (!banner) return;

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const alerts = [];

  // Check gold zakat
  const goldEntries = JSON.parse(localStorage.getItem('zakat_entries') || '[]');
  if (goldEntries.length > 0) {
    const sorted = [...goldEntries].sort((a, b) => new Date(a.date) - new Date(b.date));
    let cumulative = 0;
    let nisabDate = null;

    for (const e of sorted) {
      cumulative += (e.grams * e.karat) / 24;
      if (cumulative >= NISAB_GRAMS && !nisabDate) {
        nisabDate = e.date;
        break;
      }
    }

    if (nisabDate) {
      const dueDate = addOneHijriYear(nisabDate);
      const daysUntil = Math.floor((dueDate - today) / 86400000);

      if (daysUntil < 0) {
        alerts.push({
          type: 'danger',
          msg: `تنبيه: زكاة الذهب متأخرة بـ ${Math.abs(daysUntil)} يوم! الموعد كان ${formatGreg(formatDateISO(dueDate))}`
        });
      } else if (daysUntil <= 30) {
        alerts.push({
          type: 'warning',
          msg: `تذكير: موعد زكاة الذهب بعد ${daysUntil} يوم (${formatGreg(formatDateISO(dueDate))})`
        });
      }
    }
  }

  // Check money zakat
  const moneyEntries = JSON.parse(localStorage.getItem('zakat_money_entries') || '[]');
  if (moneyEntries.length > 0) {
    const nisabData = JSON.parse(localStorage.getItem('zakat_money_nisab') || 'null');
    if (nisabData && nisabData.date) {
      const dueDate = addOneHijriYear(nisabData.date);
      const daysUntil = Math.floor((dueDate - today) / 86400000);

      if (daysUntil < 0) {
        alerts.push({
          type: 'danger',
          msg: `تنبيه: زكاة المال متأخرة بـ ${Math.abs(daysUntil)} يوم!`
        });
      } else if (daysUntil <= 30) {
        alerts.push({
          type: 'warning',
          msg: `تذكير: موعد زكاة المال بعد ${daysUntil} يوم`
        });
      }
    }
  }

  if (alerts.length > 0) {
    const worst = alerts.find(a => a.type === 'danger') || alerts[0];
    banner.className = 'alert-banner alert-' + worst.type + ' show';
    banner.innerHTML = `
      <span>${alerts.map(a => a.msg).join(' | ')}</span>
      <button class="close-alert" onclick="this.parentElement.classList.remove('show')">&times;</button>
    `;
  }
}

// ─── Print / PDF ──────────────────────────────────────────────
function printReport() {
  window.print();
}

// ─── Sort Table Helper ────────────────────────────────────────
function initSortableTable(tableId, renderFn) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const headers = table.querySelectorAll('thead th[data-sort]');
  let currentSort = { col: null, asc: true };

  headers.forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.sort;
      if (currentSort.col === col) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.col = col;
        currentSort.asc = true;
      }

      headers.forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
      th.classList.add(currentSort.asc ? 'sorted-asc' : 'sorted-desc');

      if (renderFn) renderFn(currentSort);
    });
  });

  return currentSort;
}

// ─── Chart Helper ─────────────────────────────────────────────
function renderGrowthChart(canvasId, labels, datasets) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return null;

  // Destroy existing chart
  if (canvas._chartInstance) {
    canvas._chartInstance.destroy();
  }

  const chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: labels,
      datasets: datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color || '#C9A84C',
        backgroundColor: (ds.color || '#C9A84C') + '20',
        borderWidth: 2,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: ds.color || '#C9A84C',
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: '#A89F8C', font: { family: 'Tajawal' } }
        }
      },
      scales: {
        x: {
          ticks: { color: '#A89F8C', font: { family: 'Tajawal' } },
          grid: { color: 'rgba(201,168,76,0.1)' }
        },
        y: {
          ticks: { color: '#A89F8C', font: { family: 'Tajawal' } },
          grid: { color: 'rgba(201,168,76,0.1)' }
        }
      }
    }
  });

  canvas._chartInstance = chart;
  return chart;
}

// ─── Chart colors adapt to theme ──────────────────────────────
function getChartTextColor() {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'light' ? '#6B5D4A' : '#A89F8C';
}

function getChartGridColor() {
  const theme = document.documentElement.getAttribute('data-theme');
  return theme === 'light' ? 'rgba(166,138,46,0.12)' : 'rgba(201,168,76,0.1)';
}

// ─── Common Init ──────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNav();
  checkZakatAlerts();

  // Check browser notifications if enabled
  if (typeof NotificationManager !== 'undefined' && NotificationManager.isEnabled()) {
    NotificationManager.checkAndNotify();
  }
});
