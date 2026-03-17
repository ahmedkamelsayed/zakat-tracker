// ─── Hijri Date Helpers ───────────────────────────────────────
// CRITICAL: getHijriComponents uses 'en-u' NOT 'ar-SA' — Arabic numerals break parseInt

const NISAB_GRAMS = 85;

function getHijriComponents(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', {
    year: 'numeric', month: 'numeric', day: 'numeric'
  });
  const parts = f.formatToParts(d);
  return {
    year: parseInt(parts.find(p => p.type === 'year').value),
    month: parseInt(parts.find(p => p.type === 'month').value),
    day: parseInt(parts.find(p => p.type === 'day').value)
  };
}

function getHijriString(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura', {
    year: 'numeric', month: 'long', day: 'numeric'
  }).format(d);
}

function hijriMonthsDiff(date1, date2) {
  const h1 = getHijriComponents(date1);
  const h2 = getHijriComponents(date2);
  return (h2.year * 12 + h2.month) - (h1.year * 12 + h1.month);
}

function addOneHijriYear(date) {
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : new Date(date);
  const h = getHijriComponents(d);
  const targetYear = h.year + 1;
  const targetMonth = h.month;
  const targetDay = h.day;

  for (let offset = 340; offset <= 380; offset++) {
    const candidate = new Date(d.getTime() + offset * 86400000);
    const ch = getHijriComponents(candidate);
    if (ch.year === targetYear && ch.month === targetMonth && ch.day === targetDay) {
      return candidate;
    }
  }
  for (let offset = 340; offset <= 380; offset++) {
    const candidate = new Date(d.getTime() + offset * 86400000);
    const ch = getHijriComponents(candidate);
    if (ch.year === targetYear && ch.month === targetMonth) {
      return candidate;
    }
  }
  return new Date(d.getTime() + 354 * 86400000);
}

function formatGreg(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
}

function getHijriYear(date) {
  return getHijriComponents(date).year;
}

function formatDateISO(date) {
  if (typeof date === 'string') return date;
  return date.toISOString().slice(0, 10);
}
