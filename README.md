# Zakat Tracker - حاسبة الزكاة

A comprehensive multi-page web application for calculating and tracking Zakat (Islamic obligatory charity) on gold and money.

## Features

### Gold Zakat (زكاة الذهب)
- Add/edit/delete gold items with type, karat (18/21/24), grams, date, and price
- Automatic 24k equivalent weight calculation
- Nisab detection (85g threshold)
- Hijri date display using Intl with `en-u-ca-islamic-umalqura`
- Two calculation scenarios: independent per-row and delayed cumulative with monthly penalty
- Excel import and CSV export
- Auto gold price fetching from API

### Money Zakat (زكاة المال)
- Track cash savings in multiple currencies (EGP, SAR, USD, EUR, etc.)
- Nisab = 85g gold price in selected currency (auto-calculated)
- Same two-scenario zakat logic as gold page
- Income/expense tracking with cumulative balance

### Info & FAQ (معلومات وأسئلة)
- Comprehensive Zakat information in Arabic
- 8 eligible recipient categories from Quran (Surah At-Tawbah: 60)
- Searchable FAQ with category filters

### Shared Features
- Zakat due alert banner (overdue or within 30 days)
- Annual Hijri year summary tables
- Growth charts (Chart.js)
- Print-friendly layout
- Sort & filter on tables
- Responsive mobile design
- localStorage persistence (all data stays on device)

## Project Structure

```
index.html          # Gold Zakat page
money.html          # Money Zakat page
info.html           # Info & FAQ page
css/style.css       # Shared styles
js/hijri.js         # Hijri calendar helpers
js/gold.js          # Gold zakat logic
js/money.js         # Money zakat logic
js/ui.js            # Shared UI components
js/api.js           # Gold price API
```

## Usage

Open `index.html` in any modern browser. No build tools or server required.

## Technical Notes

- **Critical**: `getHijriComponents()` uses `en-u-ca-islamic-umalqura` locale (NOT `ar-SA`) because Arabic numerals break `parseInt`
- Uses Umm al-Qura calendar via browser's `Intl.DateTimeFormat`
- Gold price fetched from metals.live API with USD/EGP exchange rate conversion
- All data stored in browser's localStorage

## License

MIT
