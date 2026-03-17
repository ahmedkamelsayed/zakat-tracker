// ─── Gold Price API ───────────────────────────────────────────
// Fetches current gold price per gram in EGP (24k)
// Uses multiple fallback APIs

const GoldAPI = {
  _cache: null,
  _cacheTime: 0,
  CACHE_DURATION: 30 * 60 * 1000, // 30 minutes

  async fetchPrice() {
    // Return cached if fresh
    if (this._cache && (Date.now() - this._cacheTime) < this.CACHE_DURATION) {
      return this._cache;
    }

    const methods = [
      this._fetchFromMetalsAPI,
      this._fetchFromGoldPriceOrg,
    ];

    for (const method of methods) {
      try {
        const price = await method.call(this);
        if (price && price > 0) {
          this._cache = price;
          this._cacheTime = Date.now();
          localStorage.setItem('zakat_auto_price', JSON.stringify({ price, time: Date.now() }));
          return price;
        }
      } catch (e) {
        console.warn('Gold price fetch failed:', e.message);
      }
    }

    // Fallback to last cached
    const saved = localStorage.getItem('zakat_auto_price');
    if (saved) {
      const { price } = JSON.parse(saved);
      return price;
    }

    return null;
  },

  async _fetchFromMetalsAPI() {
    // Free tier: metals-api.com (limited calls)
    const resp = await fetch('https://api.metals.live/v1/spot/gold');
    if (!resp.ok) throw new Error('metals.live failed');
    const data = await resp.json();
    // Returns USD per troy ounce
    const usdPerOz = data[0]?.price;
    if (!usdPerOz) throw new Error('No price data');
    // Convert: 1 troy oz = 31.1035g, then USD to EGP
    const usdPerGram = usdPerOz / 31.1035;
    const egpRate = await this._getUSDtoEGP();
    return Math.round(usdPerGram * egpRate);
  },

  async _fetchFromGoldPriceOrg() {
    // Alternative using exchangerate + gold
    const goldResp = await fetch('https://api.metals.live/v1/spot/gold');
    if (!goldResp.ok) throw new Error('gold fetch failed');
    const goldData = await goldResp.json();
    const usdPerOz = goldData[0]?.price;
    if (!usdPerOz) throw new Error('No gold price');
    const usdPerGram = usdPerOz / 31.1035;
    const egpRate = await this._getUSDtoEGP();
    return Math.round(usdPerGram * egpRate);
  },

  async _getUSDtoEGP() {
    // Try to get USD/EGP rate
    try {
      const resp = await fetch('https://open.er-api.com/v6/latest/USD');
      if (resp.ok) {
        const data = await resp.json();
        return data.rates?.EGP || 50;
      }
    } catch (e) {
      console.warn('Exchange rate fetch failed');
    }
    // Fallback rate
    const saved = localStorage.getItem('zakat_usd_egp');
    return saved ? parseFloat(saved) : 50;
  },

  // Get gold price in any currency (for money zakat)
  async getPriceInCurrency(currency = 'EGP') {
    try {
      const goldResp = await fetch('https://api.metals.live/v1/spot/gold');
      if (!goldResp.ok) throw new Error('gold fetch failed');
      const goldData = await goldResp.json();
      const usdPerOz = goldData[0]?.price;
      if (!usdPerOz) throw new Error('No gold price');
      const usdPerGram = usdPerOz / 31.1035;

      if (currency === 'USD') return usdPerGram;

      const resp = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!resp.ok) throw new Error('rate fetch failed');
      const data = await resp.json();
      const rate = data.rates?.[currency];
      if (!rate) throw new Error('Unknown currency: ' + currency);
      return usdPerGram * rate;
    } catch (e) {
      console.warn('getPriceInCurrency failed:', e.message);
      return null;
    }
  }
};
