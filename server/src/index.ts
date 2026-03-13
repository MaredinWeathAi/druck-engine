import express from 'express';
import cors from 'cors';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ─── API KEY MANAGEMENT ───
let anthropicApiKey = process.env.ANTHROPIC_API_KEY || '';

// ─── SIMULATED DATA ENGINE ───
// Generates realistic macro data. In production, replace with FRED/GuruFocus/yfinance calls.

function randomWalk(start: number, n: number, drift = 0, vol = 0.01): number[] {
  const vals = [start];
  // Use seeded-ish random for consistency within a day
  const seed = new Date().toISOString().split('T')[0];
  let s = 0;
  for (let i = 0; i < seed.length; i++) s += seed.charCodeAt(i);
  const rng = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = 1; i < n; i++) {
    vals.push(vals[i - 1] * (1 + drift + (rng() - 0.5) * vol * 2));
  }
  return vals;
}

function dateRange(startStr: string, n: number, freqDays = 7): string[] {
  const dates: string[] = [];
  const d = new Date(startStr);
  for (let i = 0; i < n; i++) {
    dates.push(d.toISOString().split('T')[0]);
    d.setDate(d.getDate() + freqDays);
  }
  return dates;
}

function roc(arr: number[], period: number): number[] {
  return arr.map((v, i) => (i < period ? 0 : (v - arr[i - period]) / arr[i - period]));
}

// Generate data
const N = 78;
const dates = dateRange('2024-09-01', N, 7);
const bs = randomWalk(7.4, N, -0.0003, 0.003);
const tga = randomWalk(0.75, N, 0.0001, 0.015);
const rrp = randomWalk(0.85, N, -0.005, 0.01).map(v => Math.max(v, 0.04));
const nl = bs.map((b, i) => b - tga[i] - rrp[i]);
const spx = randomWalk(5450, N, 0.002, 0.012);
const m2 = randomWalk(20.8, N, 0.0004, 0.002);
const vel4w = roc(nl, 4);
const vel13w = roc(nl, 13);
const breadthArr = randomWalk(58, N, 0.0005, 0.03).map(v => Math.max(15, Math.min(90, v)));
const argSovYield = randomWalk(14.5, N, -0.003, 0.015);
const us10y = randomWalk(4.3, N, -0.0005, 0.006);
const argSpread = argSovYield.map((a, i) => a - us10y[i]);
const tecoPrice = randomWalk(12.5, N, 0.004, 0.02);
const ggalPrice = randomWalk(68, N, 0.005, 0.018);
const crude = randomWalk(72, N, 0.001, 0.02);
const copper = randomWalk(4.2, N, 0.0015, 0.015);
const gold = randomWalk(2650, N, 0.002, 0.008);
const hySpreads = randomWalk(3.8, N, -0.001, 0.02);

// Macro state
const latV4 = vel4w[N - 1];
const latV13 = vel13w[N - 1];
const breadthLat = breadthArr[N - 1];
const pce = 2.8;
const gdp = 2.1;

// Trifecta calculation
const mod1 = (latV4 > latV13 && latV4 > 0) ? 1 : (latV4 < latV13 && latV4 < 0) ? -1 : 0;
const mod2 = 1; // Smart money accumulating value (simulated)
const mod3 = breadthLat > 60 ? 1 : breadthLat < 40 ? -1 : 0;
const trifecta = mod1 + mod2 + mod3;
const isStag = pce > 3.0 && gdp < 1.0;

// ─── API ROUTES ───

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '3.5.0',
    name: 'Druck Engine — Trifecta Analyzer',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/trifecta', (_req, res) => {
  res.json({
    trifecta_score: trifecta,
    modules: {
      m1_liquidity: { score: mod1, roc_4w: +(latV4 * 100).toFixed(2), roc_13w: +(latV13 * 100).toFixed(2), signal: mod1 > 0 ? 'ACCELERATING' : mod1 < 0 ? 'DRAINING' : 'NEUTRAL' },
      m2_conviction: { score: mod2, signal: 'ACCUMULATING', note: 'Smart money rotating into Value/Banks' },
      m3_breadth: { score: mod3, breadth_pct: +breadthLat.toFixed(1), signal: mod3 > 0 ? 'HEALTHY' : mod3 < 0 ? 'FRAGILE' : 'NEUTRAL' },
    },
    regime: {
      is_stagflation: isStag,
      label: isStag ? 'STAGFLATION' : trifecta >= 2 ? 'RISK-ON' : trifecta <= -2 ? 'RISK-OFF' : 'NEUTRAL',
      pce, gdp,
    },
    hedge: {
      recommendation: trifecta >= 2 ? 'REDUCE' : trifecta <= -2 ? 'FULL' : 'STANDARD',
      spxu_allocation: trifecta >= 3 ? '0%' : trifecta >= 2 ? '25%' : trifecta >= 0 ? '50%' : trifecta >= -1 ? '75%' : '100%',
    },
  });
});

app.get('/api/liquidity', (_req, res) => {
  res.json({
    dates,
    net_liquidity: nl.map(v => +v.toFixed(4)),
    spx: spx.map(v => +v.toFixed(2)),
    roc_4w: vel4w.map(v => +(v * 100).toFixed(3)),
    roc_13w: vel13w.map(v => +(v * 100).toFixed(3)),
    latest: {
      net_liquidity: +nl[N - 1].toFixed(4),
      velocity_4w: +(latV4 * 100).toFixed(2),
      velocity_13w: +(latV13 * 100).toFixed(2),
      balance_sheet: +bs[N - 1].toFixed(2),
      tga: +(tga[N - 1] * 1000).toFixed(0),
      rrp: +(rrp[N - 1] * 1000).toFixed(0),
    },
  });
});

app.get('/api/breadth', (_req, res) => {
  res.json({
    dates,
    breadth: breadthArr.map(v => +v.toFixed(1)),
    spx_scaled: spx.map(v => +(v / 100).toFixed(2)),
    latest: {
      breadth_pct: +breadthLat.toFixed(1),
      trend_5w: +(breadthLat - breadthArr[N - 5]).toFixed(1),
      fragile: breadthLat < 40,
    },
  });
});

app.get('/api/argentina', (_req, res) => {
  const spreadTight = argSpread[N - 1] < argSpread[N - 8];
  const tecoChg = ((tecoPrice[N - 1] - tecoPrice[N - 8]) / tecoPrice[N - 8] * 100);
  const rerating = spreadTight && tecoChg > 0;
  res.json({
    dates,
    spread: argSpread.map(v => +v.toFixed(2)),
    teco_price: tecoPrice.map(v => +v.toFixed(2)),
    ggal_price: ggalPrice.map(v => +v.toFixed(2)),
    us10y: us10y.map(v => +v.toFixed(3)),
    latest: {
      spread: +argSpread[N - 1].toFixed(2),
      spread_prev_8w: +argSpread[N - 8].toFixed(2),
      teco: +tecoPrice[N - 1].toFixed(2),
      ggal: +ggalPrice[N - 1].toFixed(2),
      teco_change_pct: +tecoChg.toFixed(1),
      spread_tightening: spreadTight,
      structural_rerating: rerating,
    },
  });
});

app.get('/api/global-markets', (_req, res) => {
  // Simulated time series for global indices
  const nzealand = randomWalk(8200, N, 0.001, 0.015);
  const mexico = randomWalk(22500, N, 0.0015, 0.016);
  const turkey = randomWalk(8500, N, 0.002, 0.025);
  const skorea = randomWalk(2650, N, 0.0018, 0.018);
  const china = randomWalk(3100, N, 0.0005, 0.020);
  const uk = randomWalk(8100, N, 0.0010, 0.014);
  const germany = randomWalk(20500, N, 0.0012, 0.016);
  const japan = randomWalk(32800, N, 0.0008, 0.012);
  const india = randomWalk(72500, N, 0.0020, 0.019);
  const brazil = randomWalk(135000, N, 0.0015, 0.022);

  const countries = [
    { name: 'Argentina', etf: 'ARGT', index: 'Merval', pe: 6.5, fwdPe: 4.2, spread: 950, spread_prev: 980, proxyPrice: 68.5, proxyChg: 2.1, signal: 'RE-RATING', ytd_return: 28.5, breadth_pct: 72 },
    { name: 'Brazil', etf: 'EWZ', index: 'Bovespa', pe: 11.2, fwdPe: 9.8, spread: 320, spread_prev: 315, proxyPrice: 52.3, proxyChg: 1.8, signal: 'STABLE', ytd_return: 15.2, breadth_pct: 65 },
    { name: 'India', etf: 'INDA', index: 'Nifty 50', pe: 22.5, fwdPe: 19.2, spread: 180, spread_prev: 175, proxyPrice: 68.2, proxyChg: 0.9, signal: 'STABLE', ytd_return: 12.8, breadth_pct: 58 },
    { name: 'Japan', etf: 'EWJ', index: 'Nikkei 225', pe: 18.5, fwdPe: 16.1, spread: 120, spread_prev: 118, proxyPrice: 125.6, proxyChg: 1.5, signal: 'RISING', ytd_return: 8.5, breadth_pct: 62 },
    { name: 'Germany', etf: 'EWG', index: 'DAX', pe: 13.8, fwdPe: 12.1, spread: 95, spread_prev: 92, proxyPrice: 42.1, proxyChg: 0.8, signal: 'STABLE', ytd_return: 6.2, breadth_pct: 55 },
    { name: 'UK', etf: 'EWU', index: 'FTSE 100', pe: 12.5, fwdPe: 11.2, spread: 110, spread_prev: 108, proxyPrice: 35.8, proxyChg: 0.5, signal: 'STABLE', ytd_return: 4.5, breadth_pct: 52 },
    { name: 'China', etf: 'FXI', index: 'Hang Seng', pe: 9.8, fwdPe: 8.5, spread: 280, spread_prev: 275, proxyPrice: 22.3, proxyChg: -1.2, signal: 'DETERIORATING', ytd_return: -8.5, breadth_pct: 38 },
    { name: 'South Korea', etf: 'EWY', index: 'KOSPI', pe: 10.5, fwdPe: 9.2, spread: 185, spread_prev: 182, proxyPrice: 78.5, proxyChg: 2.1, signal: 'RISING', ytd_return: 18.2, breadth_pct: 68 },
    { name: 'Mexico', etf: 'EWW', index: 'IPC', pe: 14.2, fwdPe: 12.5, spread: 210, spread_prev: 215, proxyPrice: 88.3, proxyChg: 1.5, signal: 'STABLE', ytd_return: 10.8, breadth_pct: 60 },
    { name: 'Turkey', etf: 'TUR', index: 'BIST 100', pe: 8.2, fwdPe: 6.8, spread: 550, spread_prev: 545, proxyPrice: 31.2, proxyChg: 3.5, signal: 'RE-RATING', ytd_return: 35.2, breadth_pct: 75 },
  ];

  const countryData = countries.map((c, idx) => {
    const prices = [nzealand, mexico, turkey, skorea, china, uk, germany, japan, india, brazil][idx];
    return {
      ...c,
      prices: prices.map(v => +v.toFixed(2)),
    };
  });

  res.json({
    dates,
    countries: countryData,
    time_series: {
      dates,
      countries: countries.map(c => ({ name: c.name, prices: countryData.find(cd => cd.name === c.name)?.prices || [] })),
    },
  });
});

app.get('/api/macro', (_req, res) => {
  res.json({
    dates,
    crude: crude.map(v => +v.toFixed(2)),
    copper: copper.map(v => +v.toFixed(3)),
    gold: gold.map(v => +v.toFixed(0)),
    hy_spreads: hySpreads.map(v => +v.toFixed(2)),
    m2: m2.map(v => +v.toFixed(2)),
    indicators: {
      pce: { trailing_12m: 2.8, latest: 2.6, trend: 'FALLING' },
      gdp: { trailing_12m: 2.1, latest: 2.4, trend: 'RISING' },
      cap_util: { trailing_12m: 78.2, latest: 77.8, trend: 'FALLING' },
      yield_curve_bps: { trailing_12m: 18, latest: 25, trend: 'STEEPENING' },
      unemployment: { trailing_12m: 3.9, latest: 4.1, trend: 'RISING' },
      cpi_yoy: { trailing_12m: 3.2, latest: 2.9, trend: 'FALLING' },
      ism_mfg: { trailing_12m: 48.5, latest: 50.2, trend: 'RISING' },
      m2_yoy: { trailing_12m: 0.8, latest: 1.2, trend: 'RISING' },
      is_stagflation: isStag,
    },
  });
});

app.get('/api/gurus', (_req, res) => {
  const gurus = [
    {
      name: 'Bill Ackman',
      fund: 'Pershing Square',
      aum: '$12B',
      style: 'Concentrated Activist',
      holdings: [
        { ticker: 'HHH', action: 'BUY', shares_chg: '+500K', pct_portfolio: 18.5, sector: 'Real Estate' },
        { ticker: 'UMC', action: 'BUY', shares_chg: '+300K', pct_portfolio: 12.3, sector: 'Technology' },
        { ticker: 'IQ', action: 'HOLD', shares_chg: '+50K', pct_portfolio: 8.7, sector: 'Technology' },
        { ticker: 'PHM', action: 'BUY', shares_chg: '+200K', pct_portfolio: 10.2, sector: 'Consumer Disc' },
        { ticker: 'XOM', action: 'BUY', shares_chg: '+100K', pct_portfolio: 6.8, sector: 'Energy' },
      ],
      quarterly_moves: { new_positions: 2, increased: 3, decreased: 1, sold_out: 0 },
      conviction_score: 0.85,
    },
    {
      name: 'David Tepper',
      fund: 'Appaloosa Management',
      aum: '$18B',
      style: 'Multi-Strategy',
      holdings: [
        { ticker: 'BAC', action: 'BUY', shares_chg: '+1.5M', pct_portfolio: 14.2, sector: 'Financials' },
        { ticker: 'GS', action: 'BUY', shares_chg: '+800K', pct_portfolio: 10.5, sector: 'Financials' },
        { ticker: 'PLD', action: 'SELL', shares_chg: '-300K', pct_portfolio: -5.2, sector: 'Real Estate' },
        { ticker: 'NVDA', action: 'BUY', shares_chg: '+200K', pct_portfolio: 9.8, sector: 'Technology' },
        { ticker: 'AAPL', action: 'HOLD', shares_chg: '+100K', pct_portfolio: 7.3, sector: 'Technology' },
      ],
      quarterly_moves: { new_positions: 1, increased: 4, decreased: 2, sold_out: 1 },
      conviction_score: 0.78,
    },
    {
      name: 'Stanley Druckenmiller',
      fund: 'Duquesne Family Office',
      aum: '$6.5B',
      style: 'Macro Systematic',
      holdings: [
        { ticker: 'TLT', action: 'BUY', shares_chg: '+400K', pct_portfolio: 16.8, sector: 'Fixed Income' },
        { ticker: 'GLD', action: 'BUY', shares_chg: '+600K', pct_portfolio: 13.2, sector: 'Commodities' },
        { ticker: 'EEM', action: 'BUY', shares_chg: '+500K', pct_portfolio: 11.5, sector: 'Equities' },
        { ticker: 'SPY', action: 'HOLD', shares_chg: '+200K', pct_portfolio: 9.8, sector: 'Equities' },
        { ticker: 'EWY', action: 'BUY', shares_chg: '+300K', pct_portfolio: 8.5, sector: 'Equities' },
      ],
      quarterly_moves: { new_positions: 2, increased: 2, decreased: 1, sold_out: 0 },
      conviction_score: 0.82,
    },
    {
      name: 'George Soros',
      fund: 'Soros Fund Management',
      aum: '$8.2B',
      style: 'Macro Discretionary',
      holdings: [
        { ticker: 'EWA', action: 'BUY', shares_chg: '+700K', pct_portfolio: 15.5, sector: 'Equities' },
        { ticker: 'FXI', action: 'SELL', shares_chg: '-900K', pct_portfolio: -12.3, sector: 'Equities' },
        { ticker: 'TLT', action: 'BUY', shares_chg: '+500K', pct_portfolio: 14.8, sector: 'Fixed Income' },
        { ticker: 'GLD', action: 'BUY', shares_chg: '+400K', pct_portfolio: 11.2, sector: 'Commodities' },
        { ticker: 'EWG', action: 'BUY', shares_chg: '+300K', pct_portfolio: 9.1, sector: 'Equities' },
      ],
      quarterly_moves: { new_positions: 1, increased: 3, decreased: 2, sold_out: 1 },
      conviction_score: 0.75,
    },
    {
      name: 'Seth Klarman',
      fund: 'Baupost Group',
      aum: '$35B',
      style: 'Value / Distressed',
      holdings: [
        { ticker: 'BAC', action: 'BUY', shares_chg: '+1.2M', pct_portfolio: 11.8, sector: 'Financials' },
        { ticker: 'C', action: 'BUY', shares_chg: '+800K', pct_portfolio: 9.5, sector: 'Financials' },
        { ticker: 'PG', action: 'HOLD', shares_chg: '+100K', pct_portfolio: 7.2, sector: 'Consumer Staples' },
        { ticker: 'KO', action: 'HOLD', shares_chg: '+50K', pct_portfolio: 6.8, sector: 'Consumer Staples' },
        { ticker: 'MCD', action: 'BUY', shares_chg: '+300K', pct_portfolio: 8.5, sector: 'Consumer Disc' },
      ],
      quarterly_moves: { new_positions: 0, increased: 2, decreased: 1, sold_out: 0 },
      conviction_score: 0.88,
    },
    {
      name: 'Glenn Greenberg',
      fund: 'Brave Warrior Advisors',
      aum: '$3.5B',
      style: 'Deep Value',
      holdings: [
        { ticker: 'WFC', action: 'BUY', shares_chg: '+500K', pct_portfolio: 13.2, sector: 'Financials' },
        { ticker: 'JPM', action: 'BUY', shares_chg: '+300K', pct_portfolio: 10.8, sector: 'Financials' },
        { ticker: 'IBM', action: 'HOLD', shares_chg: '+100K', pct_portfolio: 7.5, sector: 'Technology' },
        { ticker: 'KMB', action: 'HOLD', shares_chg: '+50K', pct_portfolio: 6.2, sector: 'Consumer Staples' },
        { ticker: 'COP', action: 'BUY', shares_chg: '+200K', pct_portfolio: 8.9, sector: 'Energy' },
      ],
      quarterly_moves: { new_positions: 1, increased: 2, decreased: 0, sold_out: 0 },
      conviction_score: 0.81,
    },
    {
      name: 'David Einhorn',
      fund: 'Greenlight Capital',
      aum: '$3.2B',
      style: 'Long/Short Activist',
      holdings: [
        { ticker: 'MU', action: 'BUY', shares_chg: '+400K', pct_portfolio: 12.5, sector: 'Technology' },
        { ticker: 'SCHW', action: 'BUY', shares_chg: '+300K', pct_portfolio: 9.8, sector: 'Financials' },
        { ticker: 'BLK', action: 'HOLD', shares_chg: '+100K', pct_portfolio: 7.5, sector: 'Financials' },
        { ticker: 'APE', action: 'SELL', shares_chg: '-500K', pct_portfolio: -11.2, sector: 'Consumer Disc' },
        { ticker: 'EQR', action: 'HOLD', shares_chg: '+50K', pct_portfolio: 6.5, sector: 'Real Estate' },
      ],
      quarterly_moves: { new_positions: 1, increased: 2, decreased: 2, sold_out: 1 },
      conviction_score: 0.72,
    },
    {
      name: 'David Adams',
      fund: 'Adams Capital',
      aum: '$1.8B',
      style: 'Growth at Value',
      holdings: [
        { ticker: 'MSFT', action: 'BUY', shares_chg: '+200K', pct_portfolio: 14.2, sector: 'Technology' },
        { ticker: 'V', action: 'BUY', shares_chg: '+250K', pct_portfolio: 11.8, sector: 'Financials' },
        { ticker: 'MA', action: 'BUY', shares_chg: '+200K', pct_portfolio: 10.5, sector: 'Financials' },
        { ticker: 'PG', action: 'HOLD', shares_chg: '+100K', pct_portfolio: 8.2, sector: 'Consumer Staples' },
        { ticker: 'COST', action: 'BUY', shares_chg: '+150K', pct_portfolio: 9.8, sector: 'Consumer Staples' },
      ],
      quarterly_moves: { new_positions: 1, increased: 3, decreased: 0, sold_out: 0 },
      conviction_score: 0.83,
    },
  ];

  // Aggregate data
  const allTickers = gurus.flatMap(g => g.holdings.map(h => h.ticker));
  const tickerCounts: Record<string, { buy: number; sell: number }> = {};
  allTickers.forEach(ticker => {
    if (!tickerCounts[ticker]) tickerCounts[ticker] = { buy: 0, sell: 0 };
  });
  gurus.forEach(g => {
    g.holdings.forEach(h => {
      if (h.action === 'BUY') tickerCounts[h.ticker].buy++;
      else if (h.action === 'SELL') tickerCounts[h.ticker].sell++;
    });
  });

  const most_bought = Object.entries(tickerCounts)
    .filter(([, v]) => v.buy >= 2)
    .sort((a, b) => b[1].buy - a[1].buy)
    .slice(0, 10)
    .map(([ticker, v]) => ({ ticker, guru_count: v.buy }));

  const most_sold = Object.entries(tickerCounts)
    .filter(([, v]) => v.sell >= 1)
    .sort((a, b) => b[1].sell - a[1].sell)
    .slice(0, 5)
    .map(([ticker, v]) => ({ ticker, guru_count: v.sell }));

  const sectorConcentration: Record<string, number> = {};
  gurus.forEach(g => {
    g.holdings.forEach(h => {
      if (!sectorConcentration[h.sector]) sectorConcentration[h.sector] = 0;
      sectorConcentration[h.sector]++;
    });
  });

  const consensus_picks = Object.entries(tickerCounts)
    .filter(([, v]) => v.buy >= 3)
    .map(([ticker]) => ticker);

  res.json({
    gurus,
    aggregate: {
      most_bought_tickers: most_bought,
      most_sold_tickers: most_sold,
      sector_concentration: sectorConcentration,
    },
    consensus_picks,
  });
});

app.get('/api/sectors', (_req, res) => {
  res.json({
    sectors: [
      { name: 'Financials', fwd18m: 0.12, inst_conc: 0.42, pe: 12.8, fwd_pe: 10.5, capacity: 'Med' },
      { name: 'Technology', fwd18m: 0.35, inst_conc: 0.68, pe: 28.5, fwd_pe: 24.1, capacity: 'High' },
      { name: 'Energy', fwd18m: 0.05, inst_conc: 0.35, pe: 10.2, fwd_pe: 9.8, capacity: 'Med' },
      { name: 'Healthcare', fwd18m: 0.18, inst_conc: 0.45, pe: 18.3, fwd_pe: 15.7, capacity: 'Med' },
      { name: 'Industrials', fwd18m: 0.08, inst_conc: 0.30, pe: 16.7, fwd_pe: 13.9, capacity: 'Med' },
      { name: 'Materials', fwd18m: -0.05, inst_conc: 0.15, pe: 11.8, fwd_pe: 9.5, capacity: 'Low' },
      { name: 'Consumer Disc', fwd18m: 0.22, inst_conc: 0.52, pe: 22.1, fwd_pe: 18.4, capacity: 'High' },
      { name: 'Consumer Staples', fwd18m: 0.08, inst_conc: 0.38, pe: 19.2, fwd_pe: 17.1, capacity: 'Med' },
      { name: 'Utilities', fwd18m: 0.02, inst_conc: 0.20, pe: 16.0, fwd_pe: 15.2, capacity: 'Med' },
      { name: 'Real Estate', fwd18m: -0.12, inst_conc: 0.10, pe: 19.5, fwd_pe: 14.8, capacity: 'Low' },
      { name: 'Communication Services', fwd18m: 0.15, inst_conc: 0.55, pe: 24.3, fwd_pe: 21.5, capacity: 'High' },
      { name: 'Airlines', fwd18m: -0.15, inst_conc: 0.12, pe: 8.2, fwd_pe: 6.1, capacity: 'Low' },
      { name: 'Chemicals', fwd18m: -0.08, inst_conc: 0.18, pe: 14.5, fwd_pe: 11.2, capacity: 'Low' },
    ],
    smart_money: {
      sectors: ['Financials', 'Energy', 'Technology', 'Healthcare', 'Airlines', 'Materials', 'Industrials'],
      buying: [72, 58, 45, 52, 38, 41, 52],
      selling: [28, 35, 62, 40, 18, 30, 25],
    },
  });
});

app.get('/api/positions', (_req, res) => {
  res.json({
    positions: [
      { ticker: 'BAC', name: 'Bank of America', sector: 'Financials', etf: 'XLF', day_chg: -1.2, etf_chg: -0.3, regime_tag: 'Core Survivor' },
      { ticker: 'WFC', name: 'Wells Fargo', sector: 'Financials', etf: 'XLF', day_chg: 0.8, etf_chg: -0.3, regime_tag: 'Core Survivor' },
      { ticker: 'BX', name: 'Blackstone', sector: 'Alt Finance', etf: 'XLF', day_chg: -0.5, etf_chg: -0.3, regime_tag: 'Core Survivor' },
      { ticker: 'AAL', name: 'American Airlines', sector: 'Airlines', etf: 'JETS', day_chg: -2.8, etf_chg: -0.9, regime_tag: isStag ? 'HIGH RISK' : 'Cyclical' },
      { ticker: 'DAL', name: 'Delta Airlines', sector: 'Airlines', etf: 'JETS', day_chg: -1.5, etf_chg: -0.9, regime_tag: isStag ? 'HIGH RISK' : 'Cyclical' },
      { ticker: 'GGAL', name: 'Grupo Galicia', sector: 'Argentina', etf: 'ARGT', day_chg: 1.5, etf_chg: 0.8, regime_tag: 'Re-rating Play' },
      { ticker: 'TECO2', name: 'Telecom Arg', sector: 'Argentina', etf: 'ARGT', day_chg: 2.1, etf_chg: 0.8, regime_tag: 'Re-rating Play' },
      { ticker: 'SPXU', name: 'S&P Ultra Short', sector: 'Hedge', etf: 'SPY', day_chg: 0.9, etf_chg: 0.3, regime_tag: trifecta >= 2 ? 'REDUCE' : 'Active Hedge' },
    ],
  });
});

// ─── INDUSTRY DEEP DIVE ───

const industryStocks: Record<string, Array<{ticker: string, name: string, pe: number, fwdPe: number, mktCap: string, above50d: boolean, insiderBuy: number, insiderSell: number, guruBuy: number, guruSell: number, dayChg: number, weekChg: number, monthChg: number}>> = {
  financials: [
    { ticker: 'BAC', name: 'Bank of America', pe: 12.1, fwdPe: 10.2, mktCap: '$312B', above50d: true, insiderBuy: 8, insiderSell: 2, guruBuy: 15, guruSell: 6, dayChg: -1.2, weekChg: 2.3, monthChg: 5.8 },
    { ticker: 'WFC', name: 'Wells Fargo', pe: 11.8, fwdPe: 9.9, mktCap: '$198B', above50d: true, insiderBuy: 5, insiderSell: 1, guruBuy: 12, guruSell: 4, dayChg: 0.8, weekChg: 1.5, monthChg: 4.2 },
    { ticker: 'JPM', name: 'JPMorgan Chase', pe: 13.2, fwdPe: 11.5, mktCap: '$580B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 18, guruSell: 5, dayChg: 0.3, weekChg: 1.8, monthChg: 6.1 },
    { ticker: 'GS', name: 'Goldman Sachs', pe: 14.5, fwdPe: 12.1, mktCap: '$155B', above50d: false, insiderBuy: 2, insiderSell: 3, guruBuy: 8, guruSell: 7, dayChg: -0.5, weekChg: -1.2, monthChg: 2.3 },
    { ticker: 'MS', name: 'Morgan Stanley', pe: 15.1, fwdPe: 12.8, mktCap: '$148B', above50d: true, insiderBuy: 4, insiderSell: 2, guruBuy: 10, guruSell: 4, dayChg: 0.2, weekChg: 0.9, monthChg: 3.5 },
    { ticker: 'BX', name: 'Blackstone', pe: 28.5, fwdPe: 22.1, mktCap: '$172B', above50d: true, insiderBuy: 6, insiderSell: 1, guruBuy: 14, guruSell: 3, dayChg: -0.5, weekChg: 2.1, monthChg: 7.2 },
    { ticker: 'C', name: 'Citigroup', pe: 10.5, fwdPe: 8.8, mktCap: '$118B', above50d: false, insiderBuy: 7, insiderSell: 3, guruBuy: 9, guruSell: 5, dayChg: -1.8, weekChg: -0.5, monthChg: 1.1 },
    { ticker: 'SCHW', name: 'Charles Schwab', pe: 22.3, fwdPe: 18.5, mktCap: '$125B', above50d: true, insiderBuy: 2, insiderSell: 2, guruBuy: 6, guruSell: 4, dayChg: 0.6, weekChg: 1.2, monthChg: 3.8 },
  ],
  airlines: [
    { ticker: 'AAL', name: 'American Airlines', pe: 5.8, fwdPe: 4.5, mktCap: '$10B', above50d: false, insiderBuy: 12, insiderSell: 1, guruBuy: 4, guruSell: 2, dayChg: -2.8, weekChg: -4.5, monthChg: -8.2 },
    { ticker: 'DAL', name: 'Delta Air Lines', pe: 7.2, fwdPe: 5.8, mktCap: '$32B', above50d: false, insiderBuy: 8, insiderSell: 2, guruBuy: 6, guruSell: 3, dayChg: -1.5, weekChg: -3.1, monthChg: -5.5 },
    { ticker: 'UAL', name: 'United Airlines', pe: 6.5, fwdPe: 5.2, mktCap: '$22B', above50d: false, insiderBuy: 5, insiderSell: 1, guruBuy: 5, guruSell: 2, dayChg: -2.1, weekChg: -3.8, monthChg: -6.8 },
    { ticker: 'LUV', name: 'Southwest Airlines', pe: 18.5, fwdPe: 12.2, mktCap: '$18B', above50d: false, insiderBuy: 3, insiderSell: 2, guruBuy: 3, guruSell: 4, dayChg: -1.2, weekChg: -2.5, monthChg: -4.1 },
    { ticker: 'JBLU', name: 'JetBlue Airways', pe: 0, fwdPe: 15.5, mktCap: '$2B', above50d: false, insiderBuy: 2, insiderSell: 0, guruBuy: 1, guruSell: 1, dayChg: -3.5, weekChg: -6.2, monthChg: -12.1 },
  ],
  energy: [
    { ticker: 'XOM', name: 'Exxon Mobil', pe: 13.8, fwdPe: 12.5, mktCap: '$460B', above50d: true, insiderBuy: 2, insiderSell: 1, guruBuy: 11, guruSell: 5, dayChg: 0.8, weekChg: 2.1, monthChg: 4.5 },
    { ticker: 'CVX', name: 'Chevron', pe: 14.2, fwdPe: 13.1, mktCap: '$280B', above50d: true, insiderBuy: 1, insiderSell: 1, guruBuy: 9, guruSell: 4, dayChg: 0.5, weekChg: 1.8, monthChg: 3.2 },
    { ticker: 'COP', name: 'ConocoPhillips', pe: 11.5, fwdPe: 10.2, mktCap: '$135B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 7, guruSell: 3, dayChg: 1.2, weekChg: 3.5, monthChg: 6.1 },
    { ticker: 'SLB', name: 'Schlumberger', pe: 15.8, fwdPe: 13.5, mktCap: '$65B', above50d: false, insiderBuy: 2, insiderSell: 2, guruBuy: 4, guruSell: 3, dayChg: -0.8, weekChg: -1.5, monthChg: 1.2 },
    { ticker: 'EOG', name: 'EOG Resources', pe: 10.2, fwdPe: 9.1, mktCap: '$72B', above50d: true, insiderBuy: 4, insiderSell: 1, guruBuy: 6, guruSell: 2, dayChg: 0.9, weekChg: 2.8, monthChg: 5.5 },
  ],
  technology: [
    { ticker: 'AAPL', name: 'Apple', pe: 32.5, fwdPe: 28.1, mktCap: '$3.4T', above50d: true, insiderBuy: 0, insiderSell: 5, guruBuy: 20, guruSell: 12, dayChg: -0.5, weekChg: 1.2, monthChg: 3.5 },
    { ticker: 'MSFT', name: 'Microsoft', pe: 35.2, fwdPe: 30.5, mktCap: '$3.1T', above50d: true, insiderBuy: 0, insiderSell: 8, guruBuy: 18, guruSell: 10, dayChg: 0.3, weekChg: 2.1, monthChg: 5.2 },
    { ticker: 'NVDA', name: 'NVIDIA', pe: 55.8, fwdPe: 35.2, mktCap: '$2.8T', above50d: true, insiderBuy: 0, insiderSell: 12, guruBuy: 15, guruSell: 8, dayChg: 1.5, weekChg: 4.5, monthChg: 12.1 },
    { ticker: 'GOOGL', name: 'Alphabet', pe: 25.1, fwdPe: 21.8, mktCap: '$2.1T', above50d: true, insiderBuy: 0, insiderSell: 6, guruBuy: 16, guruSell: 9, dayChg: -0.2, weekChg: 0.8, monthChg: 2.8 },
    { ticker: 'META', name: 'Meta Platforms', pe: 28.3, fwdPe: 23.5, mktCap: '$1.4T', above50d: false, insiderBuy: 0, insiderSell: 10, guruBuy: 14, guruSell: 7, dayChg: -1.8, weekChg: -2.5, monthChg: -1.2 },
    { ticker: 'AMZN', name: 'Amazon', pe: 42.5, fwdPe: 32.1, mktCap: '$1.9T', above50d: true, insiderBuy: 0, insiderSell: 4, guruBuy: 12, guruSell: 6, dayChg: 0.8, weekChg: 3.2, monthChg: 8.5 },
  ],
  healthcare: [
    { ticker: 'UNH', name: 'UnitedHealth', pe: 19.5, fwdPe: 16.8, mktCap: '$480B', above50d: true, insiderBuy: 2, insiderSell: 3, guruBuy: 12, guruSell: 5, dayChg: 0.5, weekChg: 1.5, monthChg: 3.8 },
    { ticker: 'JNJ', name: 'Johnson & Johnson', pe: 22.1, fwdPe: 18.5, mktCap: '$380B', above50d: true, insiderBuy: 1, insiderSell: 2, guruBuy: 8, guruSell: 4, dayChg: 0.2, weekChg: 0.8, monthChg: 2.1 },
    { ticker: 'LLY', name: 'Eli Lilly', pe: 85.2, fwdPe: 52.1, mktCap: '$720B', above50d: true, insiderBuy: 0, insiderSell: 5, guruBuy: 10, guruSell: 6, dayChg: 1.2, weekChg: 3.5, monthChg: 8.5 },
    { ticker: 'PFE', name: 'Pfizer', pe: 38.5, fwdPe: 11.2, mktCap: '$160B', above50d: false, insiderBuy: 8, insiderSell: 1, guruBuy: 7, guruSell: 3, dayChg: -1.5, weekChg: -2.8, monthChg: -5.2 },
    { ticker: 'ABBV', name: 'AbbVie', pe: 16.8, fwdPe: 14.2, mktCap: '$310B', above50d: true, insiderBuy: 3, insiderSell: 2, guruBuy: 9, guruSell: 4, dayChg: 0.3, weekChg: 1.2, monthChg: 4.1 },
  ],
  materials: [
    { ticker: 'FCX', name: 'Freeport-McMoRan', pe: 28.5, fwdPe: 18.2, mktCap: '$65B', above50d: true, insiderBuy: 4, insiderSell: 1, guruBuy: 8, guruSell: 3, dayChg: 1.5, weekChg: 4.2, monthChg: 8.5 },
    { ticker: 'NEM', name: 'Newmont', pe: 15.2, fwdPe: 12.8, mktCap: '$52B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 6, guruSell: 2, dayChg: 2.1, weekChg: 5.5, monthChg: 12.2 },
    { ticker: 'APD', name: 'Air Products', pe: 25.8, fwdPe: 21.5, mktCap: '$62B', above50d: false, insiderBuy: 1, insiderSell: 2, guruBuy: 4, guruSell: 3, dayChg: -0.5, weekChg: -1.2, monthChg: 0.8 },
    { ticker: 'DOW', name: 'Dow Inc', pe: 18.5, fwdPe: 14.1, mktCap: '$38B', above50d: false, insiderBuy: 5, insiderSell: 1, guruBuy: 5, guruSell: 2, dayChg: -1.2, weekChg: -2.5, monthChg: -3.8 },
    { ticker: 'LIN', name: 'Linde', pe: 32.1, fwdPe: 28.5, mktCap: '$210B', above50d: true, insiderBuy: 1, insiderSell: 1, guruBuy: 7, guruSell: 4, dayChg: 0.3, weekChg: 1.1, monthChg: 3.2 },
  ],
  consumer_staples: [
    { ticker: 'PG', name: 'Procter & Gamble', pe: 24.5, fwdPe: 22.1, mktCap: '$380B', above50d: true, insiderBuy: 2, insiderSell: 1, guruBuy: 14, guruSell: 3, dayChg: 0.3, weekChg: 1.2, monthChg: 3.8 },
    { ticker: 'KO', name: 'Coca-Cola', pe: 26.2, fwdPe: 23.5, mktCap: '$285B', above50d: true, insiderBuy: 1, insiderSell: 0, guruBuy: 10, guruSell: 2, dayChg: 0.1, weekChg: 0.8, monthChg: 2.5 },
    { ticker: 'MCD', name: 'McDonald\'s', pe: 28.8, fwdPe: 25.2, mktCap: '$215B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 12, guruSell: 4, dayChg: 0.5, weekChg: 1.5, monthChg: 4.2 },
    { ticker: 'WMT', name: 'Walmart', pe: 22.5, fwdPe: 20.8, mktCap: '$420B', above50d: true, insiderBuy: 2, insiderSell: 0, guruBuy: 13, guruSell: 2, dayChg: 0.2, weekChg: 1.1, monthChg: 3.5 },
    { ticker: 'KMB', name: 'Kimberly-Clark', pe: 19.8, fwdPe: 18.5, mktCap: '$48B', above50d: true, insiderBuy: 1, insiderSell: 1, guruBuy: 6, guruSell: 2, dayChg: -0.1, weekChg: 0.5, monthChg: 2.1 },
  ],
  communication_services: [
    { ticker: 'GOOGL', name: 'Alphabet', pe: 25.1, fwdPe: 21.8, mktCap: '$2.1T', above50d: true, insiderBuy: 0, insiderSell: 3, guruBuy: 16, guruSell: 5, dayChg: -0.2, weekChg: 0.8, monthChg: 2.8 },
    { ticker: 'META', name: 'Meta Platforms', pe: 28.3, fwdPe: 23.5, mktCap: '$1.4T', above50d: false, insiderBuy: 0, insiderSell: 6, guruBuy: 12, guruSell: 4, dayChg: -1.8, weekChg: -2.5, monthChg: -1.2 },
    { ticker: 'NFLX', name: 'Netflix', pe: 38.5, fwdPe: 32.2, mktCap: '$280B', above50d: true, insiderBuy: 0, insiderSell: 4, guruBuy: 8, guruSell: 3, dayChg: 1.2, weekChg: 3.5, monthChg: 8.2 },
    { ticker: 'DIS', name: 'The Walt Disney Company', pe: 32.1, fwdPe: 28.5, mktCap: '$210B', above50d: false, insiderBuy: 1, insiderSell: 2, guruBuy: 7, guruSell: 5, dayChg: -0.8, weekChg: -1.5, monthChg: -0.5 },
    { ticker: 'CMCSA', name: 'Comcast', pe: 15.8, fwdPe: 14.2, mktCap: '$195B', above50d: true, insiderBuy: 2, insiderSell: 1, guruBuy: 5, guruSell: 2, dayChg: 0.3, weekChg: 1.2, monthChg: 3.1 },
  ],
  industrials: [
    { ticker: 'BA', name: 'Boeing', pe: 18.5, fwdPe: 14.2, mktCap: '$195B', above50d: false, insiderBuy: 8, insiderSell: 2, guruBuy: 9, guruSell: 5, dayChg: -2.5, weekChg: -5.2, monthChg: -8.5 },
    { ticker: 'GE', name: 'General Electric', pe: 22.5, fwdPe: 19.8, mktCap: '$205B', above50d: true, insiderBuy: 3, insiderSell: 1, guruBuy: 8, guruSell: 3, dayChg: 0.5, weekChg: 1.8, monthChg: 4.2 },
    { ticker: 'CAT', name: 'Caterpillar', pe: 19.2, fwdPe: 16.5, mktCap: '$125B', above50d: true, insiderBuy: 2, insiderSell: 1, guruBuy: 7, guruSell: 3, dayChg: 0.8, weekChg: 2.1, monthChg: 5.5 },
    { ticker: 'RTX', name: 'Raytheon Technologies', pe: 20.5, fwdPe: 18.2, mktCap: '$235B', above50d: true, insiderBuy: 1, insiderSell: 1, guruBuy: 6, guruSell: 2, dayChg: 0.3, weekChg: 1.5, monthChg: 3.8 },
    { ticker: 'MMM', name: '3M Company', pe: 18.8, fwdPe: 16.5, mktCap: '$98B', above50d: false, insiderBuy: 5, insiderSell: 2, guruBuy: 4, guruSell: 3, dayChg: -0.5, weekChg: -1.2, monthChg: 0.8 },
  ],
};

app.get('/api/industries/:sector', (req, res) => {
  const sector = req.params.sector.toLowerCase();
  const stocks = industryStocks[sector];
  if (!stocks) {
    return res.status(404).json({ error: `Sector "${sector}" not found. Available: ${Object.keys(industryStocks).join(', ')}` });
  }
  const above50d = stocks.filter(s => s.above50d).length;
  const avgPe = +(stocks.reduce((a, s) => a + s.pe, 0) / stocks.length).toFixed(1);
  const avgFwdPe = +(stocks.reduce((a, s) => a + s.fwdPe, 0) / stocks.length).toFixed(1);
  const totalGuruBuy = stocks.reduce((a, s) => a + s.guruBuy, 0);
  const totalGuruSell = stocks.reduce((a, s) => a + s.guruSell, 0);
  const totalInsiderBuy = stocks.reduce((a, s) => a + s.insiderBuy, 0);
  const totalInsiderSell = stocks.reduce((a, s) => a + s.insiderSell, 0);

  // Generate sector-level time series
  const sectorPrices = randomWalk(100, N, sector === 'argentina' ? 0.005 : sector === 'airlines' ? -0.002 : 0.002, 0.015);

  res.json({
    sector,
    stocks,
    summary: {
      breadth_pct: +((above50d / stocks.length) * 100).toFixed(1),
      above_50d: above50d,
      total: stocks.length,
      avg_pe: avgPe,
      avg_fwd_pe: avgFwdPe,
      pe_compression: +((avgFwdPe - avgPe) / avgPe * 100).toFixed(1),
      guru_buy_sell_ratio: +(totalGuruBuy / Math.max(totalGuruSell, 1)).toFixed(2),
      insider_buy_sell_ratio: +(totalInsiderBuy / Math.max(totalInsiderSell, 1)).toFixed(2),
      total_guru_buys: totalGuruBuy,
      total_guru_sells: totalGuruSell,
      total_insider_buys: totalInsiderBuy,
      total_insider_sells: totalInsiderSell,
    },
    time_series: {
      dates,
      prices: sectorPrices.map(v => +v.toFixed(2)),
    },
    regime_tag: isStag ? (
      sector === 'financials' || sector === 'materials' || sector === 'consumer_staples' ? 'Core Survivor' :
      sector === 'airlines' ? 'HIGH RISK' :
      sector === 'technology' ? 'Grey Out' : 'Neutral'
    ) : 'Standard',
  });
});

app.get('/api/breadth/constituents', (_req, res) => {
  const sectorBreadth = Object.entries(industryStocks).map(([sector, stocks]) => {
    const above = stocks.filter(s => s.above50d).length;
    return {
      sector,
      above_50d: above,
      total: stocks.length,
      breadth_pct: +((above / stocks.length) * 100).toFixed(1),
      stocks: stocks.map(s => ({ ticker: s.ticker, above50d: s.above50d, dayChg: s.dayChg })),
    };
  });
  const totalAbove = sectorBreadth.reduce((a, s) => a + s.above_50d, 0);
  const totalStocks = sectorBreadth.reduce((a, s) => a + s.total, 0);

  // Simulated breadth divergence detection
  const spxUp = spx[N - 1] > spx[N - 5];
  const breadthDown = breadthArr[N - 1] < breadthArr[N - 5];
  const divergence = spxUp && breadthDown;

  res.json({
    overall: {
      breadth_pct: +((totalAbove / totalStocks) * 100).toFixed(1),
      above_50d: totalAbove,
      total: totalStocks,
      spx_trending_up: spxUp,
      breadth_trending_down: breadthDown,
      divergence_detected: divergence,
      divergence_severity: divergence ? 'WARNING' : 'NONE',
    },
    by_sector: sectorBreadth,
    time_series: {
      dates,
      breadth: breadthArr.map(v => +v.toFixed(1)),
      spx: spx.map(v => +v.toFixed(2)),
    },
  });
});

app.get('/api/liquidity/components', (_req, res) => {
  res.json({
    dates,
    components: {
      balance_sheet: bs.map(v => +v.toFixed(4)),
      tga: tga.map(v => +(v * 1000).toFixed(1)),
      rrp: rrp.map(v => +(v * 1000).toFixed(1)),
      m2: m2.map(v => +v.toFixed(2)),
    },
    roc: {
      balance_sheet_4w: roc(bs, 4).map(v => +(v * 100).toFixed(3)),
      tga_4w: roc(tga, 4).map(v => +(v * 100).toFixed(3)),
      rrp_4w: roc(rrp, 4).map(v => +(v * 100).toFixed(3)),
    },
    net_liquidity: nl.map(v => +v.toFixed(4)),
    velocity: {
      roc_4w: vel4w.map(v => +(v * 100).toFixed(3)),
      roc_13w: vel13w.map(v => +(v * 100).toFixed(3)),
      acceleration: vel4w.map((v, i) => i < 1 ? 0 : +((v - vel4w[i-1]) * 100).toFixed(4)),
    },
  });
});

app.get('/api/commodities/detail', (_req, res) => {
  const silver = randomWalk(31.5, N, 0.002, 0.012);
  const natgas = randomWalk(2.8, N, -0.001, 0.03);
  const brent = randomWalk(76, N, 0.001, 0.018);

  res.json({
    dates,
    commodities: {
      wti: crude.map(v => +v.toFixed(2)),
      brent: brent.map(v => +v.toFixed(2)),
      copper: copper.map(v => +v.toFixed(3)),
      gold: gold.map(v => +v.toFixed(0)),
      silver: silver.map(v => +v.toFixed(2)),
      natural_gas: natgas.map(v => +v.toFixed(2)),
    },
    hy_spreads: hySpreads.map(v => +v.toFixed(2)),
    signals: {
      copper_oil_ratio: +(copper[N-1] / crude[N-1] * 1000).toFixed(2),
      gold_silver_ratio: +(gold[N-1] / silver[N-1]).toFixed(1),
      copper_trend: copper[N-1] > copper[N-8] ? 'RISING' : 'FALLING',
      oil_trend: crude[N-1] > crude[N-8] ? 'RISING' : 'FALLING',
      gold_trend: gold[N-1] > gold[N-8] ? 'RISING' : 'FALLING',
      macro_signal: copper[N-1] > copper[N-8] && crude[N-1] > crude[N-8] ? 'GROWTH' : 'STAGFLATION_RISK',
      stress_level: hySpreads[N-1] > 5 ? 'HIGH' : hySpreads[N-1] > 4 ? 'ELEVATED' : 'NORMAL',
    },
  });
});

// ─── CYCLE POSITION & ACTION SIGNALS ───

app.get('/api/cycle-position', (_req, res) => {
  // Simulated macro indicators from /api/macro
  const pceVal = 2.8;
  const gdpVal = 2.1;
  const capUtil = 77.8;
  const yieldCurveBps = 25;
  const unemploymentVal = 4.1;
  const ismMfg = 50.2;
  const m2Yoy = 1.2;
  const cpiYoy = 2.9;

  // Determine cycle phase based on Druckenmiller framework
  let currentPhase = 'MID_CYCLE';
  let phaseConfidence = 0.72;
  let phaseDescription = 'Economy expanding with moderate growth. ISM above 50, GDP healthy, inflation contained.';
  let nextPhase = 'LATE_CYCLE';
  let nextProbability = 0.35;
  let nextEstimatedMonths = '6-12';
  const triggers: string[] = [];

  // EARLY RECOVERY: ISM rising from below 50 + yield curve steepening + unemployment peaking/falling + M2 growing
  if (ismMfg < 50 && yieldCurveBps > 20 && m2Yoy > 1) {
    currentPhase = 'EARLY_RECOVERY';
    phaseConfidence = 0.68;
    phaseDescription = 'Early cycle expansion. ISM recovering, curve steep, M2 growth supporting liquidity.';
    nextPhase = 'MID_CYCLE';
    nextProbability = 0.55;
    nextEstimatedMonths = '3-6';
  }
  // MID CYCLE: ISM above 50 + GDP above 2% + moderate inflation + capacity utilization rising
  else if (ismMfg > 50 && gdpVal > 2 && cpiYoy < 3.5 && capUtil < 80) {
    currentPhase = 'MID_CYCLE';
    phaseConfidence = 0.72;
    phaseDescription = 'Economy expanding with moderate growth. ISM above 50, GDP healthy, inflation contained.';
    nextPhase = 'LATE_CYCLE';
    nextProbability = 0.35;
    nextEstimatedMonths = '6-12';
    triggers.push('ISM deceleration below 52');
    triggers.push('Capacity utilization above 80%');
    triggers.push('Yield curve flattening');
  }
  // LATE CYCLE: ISM above 50 but decelerating + capacity utilization above 80% + CPI rising + yield curve flattening
  else if (ismMfg > 50 && capUtil > 80 && cpiYoy > 3 && yieldCurveBps < 30) {
    currentPhase = 'LATE_CYCLE';
    phaseConfidence = 0.78;
    phaseDescription = 'Late-cycle expansion with inflation pressures. Capacity stretched, Fed tightening likely.';
    nextPhase = 'RECESSION';
    nextProbability = 0.45;
    nextEstimatedMonths = '6-18';
    triggers.push('Yield curve inversion');
    triggers.push('ISM breaks below 48');
    triggers.push('Credit conditions tightening');
  }
  // RECESSION: ISM below 47 + GDP below 1% + yield curve inverted + unemployment rising rapidly
  else if (ismMfg < 47 && gdpVal < 1 && yieldCurveBps < -10 && unemploymentVal > 4.5) {
    currentPhase = 'RECESSION';
    phaseConfidence = 0.85;
    phaseDescription = 'Recessionary environment. ISM in contraction, negative growth, yield curve inverted, unemployment rising.';
    nextPhase = 'EARLY_RECOVERY';
    nextProbability = 0.50;
    nextEstimatedMonths = '12-18';
    triggers.push('Fed pivot to easing');
    triggers.push('Yield curve re-steepening');
    triggers.push('ISM stabilization above 47');
  }

  // Leading indicators
  const ismDirection = ismMfg > 50.5 ? 'RISING' : ismMfg < 49.5 ? 'FALLING' : 'STABLE';
  const yieldCurveSignal = yieldCurveBps > 50 ? 'STEEPENING' : yieldCurveBps < 0 ? 'INVERTED' : 'NORMAL';
  const creditConditions = hySpreads[N - 1] < 4 ? 'EASING' : hySpreads[N - 1] > 5 ? 'TIGHTENING' : 'NEUTRAL';
  const m2Growth = m2Yoy > 1.5 ? 'POSITIVE' : m2Yoy > 0 ? 'MODEST' : 'NEGATIVE';
  const earningsDirection = trifecta >= 1 ? 'POSITIVE' : trifecta <= -1 ? 'NEGATIVE' : 'NEUTRAL';

  // Sector rotation logic
  const accumulate = [];
  const hold = [];
  const reduce = [];

  if (currentPhase === 'EARLY_RECOVERY' || currentPhase === 'MID_CYCLE') {
    accumulate.push(
      { sector: 'Financials', reason: 'Rate-sensitive, benefits from steepening curve and economic expansion', cycle_sweet_spot: 'Early-to-Mid' },
      { sector: 'Industrials', reason: 'Capex cycle picking up, ISM expansion favors capital goods', cycle_sweet_spot: 'Mid' },
      { sector: 'Technology', reason: 'Earnings growth outpacing in expansion, institutional flows strong', cycle_sweet_spot: 'Early-to-Mid' },
      { sector: 'Materials', reason: 'Commodity demand rises with industrial activity', cycle_sweet_spot: 'Mid' }
    );
    hold.push(
      { sector: 'Healthcare', reason: 'Defensive growth, performs across cycles', cycle_sweet_spot: 'All' },
      { sector: 'Energy', reason: 'Commodity support but late-cycle characteristics emerging', cycle_sweet_spot: 'Mid-to-Late' },
      { sector: 'Consumer Disc', reason: 'Consumer spending stable but watch employment trends', cycle_sweet_spot: 'Early-to-Mid' }
    );
    reduce.push(
      { sector: 'Utilities', reason: 'Underperforms in expansion, rate-sensitive negatively', cycle_sweet_spot: 'Recession' },
      { sector: 'Consumer Staples', reason: 'Defensive — rotate in only when late cycle signals strengthen', cycle_sweet_spot: 'Late-to-Recession' },
      { sector: 'Airlines', reason: 'Fuel costs + rate sensitivity make these fragile in transitions', cycle_sweet_spot: 'Early Recovery only' }
    );
  } else if (currentPhase === 'LATE_CYCLE') {
    accumulate.push(
      { sector: 'Energy', reason: 'Commodity inflation tailwinds, demand still strong', cycle_sweet_spot: 'Late-to-Recession' },
      { sector: 'Materials', reason: 'Inflation beneficiaries, final stretch of growth', cycle_sweet_spot: 'Late' }
    );
    hold.push(
      { sector: 'Financials', reason: 'Margins compress as curve flattens, valuations attractive', cycle_sweet_spot: 'Mid-to-Late' },
      { sector: 'Healthcare', reason: 'Defensive play as earnings slowdown approaches', cycle_sweet_spot: 'All' },
      { sector: 'Consumer Staples', reason: 'Begin rotation here as late cycle indicators peak', cycle_sweet_spot: 'Late-to-Recession' }
    );
    reduce.push(
      { sector: 'Technology', reason: 'Growth concerns as rates rise, valuation compression', cycle_sweet_spot: 'Recession' },
      { sector: 'Industrials', reason: 'Capex peak may have passed, earnings deceleration risk', cycle_sweet_spot: 'Mid' },
      { sector: 'Airlines', reason: 'Sector weakness persists through late cycle', cycle_sweet_spot: 'Early Recovery only' }
    );
  } else if (currentPhase === 'RECESSION') {
    accumulate.push(
      { sector: 'Consumer Staples', reason: 'Defensive earnings, stable cash flows in downturn', cycle_sweet_spot: 'Late-to-Recession' },
      { sector: 'Healthcare', reason: 'Non-cyclical, benefits from de-risking flows', cycle_sweet_spot: 'All' },
      { sector: 'Utilities', reason: 'Bonds-like characteristics, yield support', cycle_sweet_spot: 'Recession' }
    );
    hold.push(
      { sector: 'Energy', reason: 'Demand destruction headwind, wait for stabilization', cycle_sweet_spot: 'Mid-to-Late' },
      { sector: 'Materials', reason: 'Commodity collapse risk, avoid until recovery clear', cycle_sweet_spot: 'Mid' }
    );
    reduce.push(
      { sector: 'Technology', reason: 'Earnings decline, margin pressure, growth discount deepens', cycle_sweet_spot: 'Recession' },
      { sector: 'Industrials', reason: 'Capex cuts, weak demand, cyclical downsizing', cycle_sweet_spot: 'Mid' },
      { sector: 'Financials', reason: 'Credit losses accelerating, curve too flat', cycle_sweet_spot: 'Early-to-Mid' },
      { sector: 'Airlines', reason: 'Demand collapse, structural weakness, avoid', cycle_sweet_spot: 'Early Recovery only' }
    );
  }

  // Druckenmiller framework scoring
  const liquidityScore = latV4 > latV13 && latV4 > 0 ? 1 : latV4 < latV13 && latV4 < 0 ? -1 : 0;
  const earningsCycleScore = trifecta >= 1 ? 1 : trifecta <= -1 ? -1 : 0;
  const sentimentScore = breadthLat > 65 ? 1 : breadthLat < 45 ? -1 : 0;
  const macroRegimeScore = gdpVal > 2.5 && cpiYoy < 3 ? 1 : gdpVal < 1.5 && cpiYoy > 3.5 ? -1 : 0;
  const overallBias = (liquidityScore + earningsCycleScore + sentimentScore + macroRegimeScore) >= 1 ? 'RISK-ON' : (liquidityScore + earningsCycleScore + sentimentScore + macroRegimeScore) <= -1 ? 'RISK-OFF' : 'NEUTRAL';

  // Rotation timeline
  const rotationTimeline = [
    { timeframe: 'NOW', action: currentPhase === 'MID_CYCLE' ? 'Overweight cyclicals (Financials, Industrials, Tech)' : currentPhase === 'EARLY_RECOVERY' ? 'Aggressive risk-on, build cyclical positions' : currentPhase === 'LATE_CYCLE' ? 'Reduce growth exposure, shift to quality' : 'Full defensive posture — Staples, Healthcare, Gold', rationale: currentPhase === 'MID_CYCLE' ? 'Mid-cycle expansion with ISM above 50' : currentPhase === 'EARLY_RECOVERY' ? 'Recovery momentum with liquidity expansion' : currentPhase === 'LATE_CYCLE' ? 'Late cycle transition favors quality and defense' : 'Recession preparation, preserve capital' },
    { timeframe: '3-6 MONTHS', action: currentPhase === 'MID_CYCLE' ? 'Begin rotating into Energy, Materials if ISM holds above 52' : currentPhase === 'EARLY_RECOVERY' ? 'Shift to financials, wait for inflation signals' : currentPhase === 'LATE_CYCLE' ? 'Accelerate rotation to Staples, Healthcare' : 'Continue defensive — evaluate stabilization signals', rationale: currentPhase === 'MID_CYCLE' ? 'Late-mid cycle commodity demand typically peaks' : currentPhase === 'EARLY_RECOVERY' ? 'Financials benefit from curve steepening' : currentPhase === 'LATE_CYCLE' ? 'Reduce cyclical exposure preemptively' : 'Watch for ISM stabilization, Fed pivot signals' },
    { timeframe: '6-12 MONTHS', action: currentPhase === 'MID_CYCLE' ? 'If ISM decelerates: rotate toward Healthcare, reduce Industrials' : currentPhase === 'EARLY_RECOVERY' ? 'Build Materials, Energy if inflation rises' : currentPhase === 'LATE_CYCLE' ? 'Begin building defensive cash position' : 'Prepare for recovery — rotate back to value/cyclicals', rationale: currentPhase === 'MID_CYCLE' ? 'Late cycle transition favors quality and defense' : currentPhase === 'EARLY_RECOVERY' ? 'Inflation phase of recovery typically favors commodities' : currentPhase === 'LATE_CYCLE' ? 'Preserve capital ahead of potential downturn' : 'Position for eventual recovery and cycle reset' },
    { timeframe: '12+ MONTHS', action: currentPhase === 'RECESSION' || currentPhase === 'LATE_CYCLE' ? 'If yield curve inverts: full defensive rotation — Staples, Healthcare, Gold' : 'Monitor for late-cycle signals, prepare defensive hedges', rationale: currentPhase === 'RECESSION' || currentPhase === 'LATE_CYCLE' ? 'Recession preparation, preserve capital' : 'Cycle transition preparation' }
  ];

  const keyWatchpoints = [
    ismDirection === 'FALLING' ? 'ISM deceleration would signal transition to late cycle' : 'ISM inflection point — watch for break below 50',
    yieldCurveSignal === 'INVERTED' ? 'Yield curve re-inversion would be major warning' : 'Monitor curve flattening — late cycle signal',
    m2Growth === 'NEGATIVE' ? 'M2 growth turning negative = liquidity headwind' : 'Sustaining M2 growth critical for expansion',
    'Watch unemployment — Sahm Rule trigger at +0.5% from trough',
  ];

  res.json({
    current_phase: currentPhase,
    phase_confidence: phaseConfidence,
    phase_description: phaseDescription,
    leading_indicators: {
      ism_direction: ismDirection,
      yield_curve_signal: yieldCurveSignal,
      credit_conditions: creditConditions,
      m2_growth: m2Growth,
      earnings_momentum: earningsDirection,
    },
    next_phase: {
      likely: nextPhase,
      probability: nextProbability,
      estimated_months: nextEstimatedMonths,
      triggers,
    },
    sector_rotation: {
      accumulate,
      hold,
      reduce,
    },
    druckenmiller_framework: {
      liquidity_score: liquidityScore,
      earnings_cycle_score: earningsCycleScore,
      sentiment_score: sentimentScore,
      macro_regime_score: macroRegimeScore,
      overall_bias: overallBias,
      key_watchpoints: keyWatchpoints,
    },
    rotation_timeline: rotationTimeline,
  });
});

app.get('/api/action-signals', (_req, res) => {
  // Dynamic signal generation based on actual computed values
  const trifectaScore = trifecta;
  const liquidityVelocity = latV4;
  const liquidityVelocity13w = latV13;
  const breadthPct = breadthLat;
  const hySpreadsLatest = hySpreads[N - 1];
  const copperLatest = copper[N - 1];
  const crudeLatest = crude[N - 1];
  const gdpVal = gdp;
  const pceVal = pce;

  // Calculate derived metrics
  const velocityAccelerating = liquidityVelocity > liquidityVelocity13w && liquidityVelocity > 0;
  const breadthHealthy = breadthPct > 60;
  const breadthDeteriorating = breadthPct < 40;
  const hySpreadsTight = hySpreadsLatest < 4;
  const hySpreadsDangerous = hySpreadsLatest > 5;
  const copperStrong = copperLatest > copper[N - 8];
  const commoditiesRising = copperStrong && crudeLatest > crude[N - 8];

  // Dashboard signal
  const dashboardSignal = trifectaScore >= 2
    ? { signal: 'ACCUMULATE RISK', color: 'green', rationale: 'Trifecta +2, liquidity expanding, breadth healthy — lean into cyclicals' }
    : trifectaScore <= -2
    ? { signal: 'REDUCE RISK', color: 'red', rationale: 'Trifecta -2, liquidity draining, breadth fragile — shift defensive' }
    : { signal: 'BALANCED POSITIONING', color: 'amber', rationale: 'Trifecta neutral, mixed signals — maintain discipline' };

  // Liquidity signal
  const liquiditySignal = velocityAccelerating && liquidityVelocity > 0
    ? { signal: 'LIQUIDITY EXPANDING', color: 'green', rationale: '4-week velocity above 13-week, net liquidity rising — bullish for risk assets' }
    : liquidityVelocity < liquidityVelocity13w && liquidityVelocity < 0
    ? { signal: 'LIQUIDITY DRAINING', color: 'red', rationale: '4-week velocity below 13-week, net liquidity falling — headwind for risk' }
    : { signal: 'LIQUIDITY NEUTRAL', color: 'amber', rationale: 'Velocity mixed signals, monitor for directional break' };

  // Breadth signal
  const breadthSignal = breadthHealthy
    ? { signal: 'HEALTHY PARTICIPATION', color: 'green', rationale: `${breadthPct.toFixed(1)}% above 50-day MA, no divergence detected — broad market support` }
    : breadthDeteriorating
    ? { signal: 'BREADTH DETERIORATING', color: 'orange', rationale: `Only ${breadthPct.toFixed(1)}% above 50-day MA — concentration risk warning` }
    : { signal: 'BREADTH NEUTRAL', color: 'amber', rationale: 'Breadth at mid-range — balanced but watch for deterioration' };

  // Gurus signal (simulated from aggregate conviction)
  const gurusSignal = trifectaScore >= 1
    ? { signal: 'SMART MONEY ACCUMULATING', color: 'green', rationale: '6 of 8 gurus net buyers this quarter, concentrated in Financials and Tech' }
    : trifectaScore <= -1
    ? { signal: 'SMART MONEY DISTRIBUTING', color: 'red', rationale: '5 of 8 gurus net sellers, rotating to safety' }
    : { signal: 'SMART MONEY NEUTRAL', color: 'amber', rationale: '4 buyers / 4 sellers — mixed conviction, waiting' };

  // Industries signal
  const industriesSignal = trifectaScore >= 1 && breadthHealthy
    ? { signal: 'ROTATE INTO CYCLICALS', color: 'blue', rationale: 'ISM expansion favors Industrials, Financials, Materials — reduce defensive' }
    : trifectaScore <= -1 && breadthDeteriorating
    ? { signal: 'ROTATE TO DEFENSIVES', color: 'orange', rationale: 'Weak breadth + negative trifecta — shift to Healthcare, Staples' }
    : { signal: 'MAINTAIN BALANCE', color: 'amber', rationale: 'Mixed cycle signals — hold balanced sector allocation' };

  // Global markets signal (based on EM spreads)
  const argSpreadLatest = argSpread[N - 1];
  const argSpreadPrev = argSpread[N - 8];
  const argRerating = argSpreadLatest < argSpreadPrev;

  const globalSignal = argRerating
    ? { signal: 'EM OPPORTUNITIES', color: 'blue', rationale: `Argentina spread compression (${(argSpreadLatest - argSpreadPrev).toFixed(2)}bps) — re-rating plays active` }
    : { signal: 'EM WATCH', color: 'amber', rationale: 'EM spreads stable, monitor for breakout opportunities' };

  // Commodities signal
  const commoditiesSignal = commoditiesRising && hySpreadsTight
    ? { signal: 'GROWTH SIGNAL', color: 'green', rationale: 'Copper rising, oil stable, HY spreads normal — no stress indicators' }
    : !commoditiesRising && hySpreadsDangerous
    ? { signal: 'STRESS DETECTED', color: 'red', rationale: 'Commodities declining, HY spreads blown out — caution warranted' }
    : { signal: 'COMMODITIES NEUTRAL', color: 'amber', rationale: 'Mixed commodity signals, monitor credit conditions' };

  // Hedges signal
  const hedgesSignal = trifectaScore >= 2
    ? { signal: 'REDUCE HEDGES', color: 'green', rationale: `Trifecta +2 suggests reducing SPXU allocation to 25%` }
    : trifectaScore <= -2
    ? { signal: 'INCREASE HEDGES', color: 'red', rationale: `Trifecta -2 suggests increasing SPXU allocation to 75-100%` }
    : { signal: 'MAINTAIN HEDGES', color: 'amber', rationale: 'Trifecta neutral — hold standard 50% hedge level' };

  // Portfolio signal
  const portfolioSignal = Math.abs(trifectaScore) >= 2
    ? { signal: 'REVIEW POSITIONS', color: 'amber', rationale: 'Cycle positioning suggests rotating — check alignment with current phase' }
    : { signal: 'HOLD POSITIONING', color: 'green', rationale: 'Current positions well-aligned with macro backdrop' };

  // Rotation signal (based on cycle position)
  const pceVal_local = pce;
  const gdpVal_local = gdp;
  const capUtil = 77.8;
  const ismMfg = 50.2;

  let rotationSignal;
  if (ismMfg > 50 && gdpVal_local > 2 && capUtil < 80) {
    rotationSignal = { signal: 'MID-CYCLE EXPANSION', color: 'green', rationale: 'Overweight cyclicals now, prepare for late-cycle rotation in 6-12 months' };
  } else if (capUtil > 80 && pceVal_local > 3) {
    rotationSignal = { signal: 'LATE CYCLE ROTATION', color: 'orange', rationale: 'Begin defensive rotation — reduced exposure to commodities, tech' };
  } else if (ismMfg < 47 && gdpVal_local < 1) {
    rotationSignal = { signal: 'RECESSION MODE', color: 'red', rationale: 'Full defensive posture — focus on quality, cash, government bonds' };
  } else {
    rotationSignal = { signal: 'EARLY RECOVERY', color: 'blue', rationale: 'Aggressive cyclical positioning, build risk exposure' };
  }

  res.json({
    dashboard: dashboardSignal,
    liquidity: liquiditySignal,
    breadth: breadthSignal,
    gurus: gurusSignal,
    industries: industriesSignal,
    globalmarkets: globalSignal,
    commodities: commoditiesSignal,
    hedges: hedgesSignal,
    portfolio: portfolioSignal,
    rotation: rotationSignal,
  });
});

// ─── API KEY SETTINGS ───

app.get('/api/settings/key-status', (_req, res) => {
  res.json({ has_key: !!anthropicApiKey, masked: anthropicApiKey ? '••••' + anthropicApiKey.slice(-8) : null });
});

app.post('/api/settings/key', (req, res) => {
  const { api_key } = req.body;
  if (!api_key || typeof api_key !== 'string' || !api_key.startsWith('sk-')) {
    return res.status(400).json({ error: 'Invalid API key format' });
  }
  anthropicApiKey = api_key;
  res.json({ status: 'ok', masked: '••••' + api_key.slice(-8) });
});

// ─── SCREENSHOT POSITION REVIEW ───

app.post('/api/review-positions', async (req, res) => {
  if (!anthropicApiKey) {
    return res.status(400).json({ error: 'No Anthropic API key configured. Set it in Settings.' });
  }

  const { screenshots } = req.body;
  if (!screenshots || !Array.isArray(screenshots) || screenshots.length === 0) {
    return res.status(400).json({ error: 'No screenshots provided' });
  }
  if (screenshots.length > 10) {
    return res.status(400).json({ error: 'Maximum 10 screenshots per review' });
  }

  // Gather current engine state for context
  const engineState = {
    trifecta_score: trifecta,
    modules: {
      m1_liquidity: { score: mod1, roc_4w: +(latV4 * 100).toFixed(2), roc_13w: +(latV13 * 100).toFixed(2), signal: mod1 > 0 ? 'ACCELERATING' : mod1 < 0 ? 'DRAINING' : 'NEUTRAL' },
      m2_conviction: { score: mod2, signal: 'ACCUMULATING' },
      m3_breadth: { score: mod3, breadth_pct: +breadthLat.toFixed(1), signal: mod3 > 0 ? 'HEALTHY' : mod3 < 0 ? 'FRAGILE' : 'NEUTRAL' },
    },
    regime: { is_stagflation: isStag, label: isStag ? 'STAGFLATION' : trifecta >= 2 ? 'RISK-ON' : trifecta <= -2 ? 'RISK-OFF' : 'NEUTRAL', pce, gdp },
    hedge: { recommendation: trifecta >= 2 ? 'REDUCE' : trifecta <= -2 ? 'FULL' : 'STANDARD', spxu_allocation: trifecta >= 3 ? '0%' : trifecta >= 2 ? '25%' : trifecta >= 0 ? '50%' : trifecta >= -1 ? '75%' : '100%' },
    net_liquidity: +nl[N - 1].toFixed(4),
    breadth_pct: +breadthLat.toFixed(1),
    argentina: { spread: +argSpread[N - 1].toFixed(2), spread_tightening: argSpread[N - 1] < argSpread[N - 8] },
  };

  try {
    const client = new Anthropic({ apiKey: anthropicApiKey });

    // Build content array with all screenshots
    const imageContent: Array<Anthropic.ImageBlockParam | Anthropic.TextBlockParam> = [];
    screenshots.forEach((s: { data: string; label: string }, i: number) => {
      imageContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: s.data.replace(/^data:image\/\w+;base64,/, '') },
      });
      imageContent.push({
        type: 'text',
        text: `[Screenshot ${i + 1}: "${s.label}"]`,
      });
    });

    imageContent.push({
      type: 'text',
      text: `CURRENT DRUCK ENGINE STATE:
${JSON.stringify(engineState, null, 2)}

TASK: You are the Druck Engine position review module. Analyze all the screenshots above — these show the user's actual positions from their trading models/platforms.

For EACH position you can identify in the screenshots:
1. Identify the ticker/asset, direction (long/short), and approximate size if visible
2. Rate it on a scale: STRONG ALIGNMENT / ALIGNED / NEUTRAL / MISALIGNED / STRONGLY MISALIGNED — relative to what the Trifecta engine currently recommends
3. Give a brief 1-2 sentence rationale referencing specific Trifecta signals

Then provide:
- An OVERALL PORTFOLIO GRADE (A+ through F) based on alignment with the engine
- Top 3 RISKS in the current positioning
- Top 3 SUGGESTED ADJUSTMENTS ranked by priority

Format your response as JSON with this exact structure:
{
  "positions": [
    { "ticker": "...", "direction": "LONG|SHORT", "size_note": "...", "alignment": "STRONG ALIGNMENT|ALIGNED|NEUTRAL|MISALIGNED|STRONGLY MISALIGNED", "rating_color": "green|lime|amber|orange|red", "rationale": "..." }
  ],
  "overall_grade": "A+",
  "overall_summary": "2-3 sentence overall assessment",
  "risks": ["risk 1", "risk 2", "risk 3"],
  "adjustments": [
    { "priority": 1, "action": "...", "rationale": "..." }
  ],
  "model_notes": ["Any observations about the models/screenshots themselves"]
}

Return ONLY valid JSON, no markdown fences.`,
    });

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{ role: 'user', content: imageContent }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    // Try to parse as JSON, fallback to raw text
    try {
      const parsed = JSON.parse(text);
      res.json({ status: 'ok', review: parsed, engine_state: engineState });
    } catch {
      // If not valid JSON, wrap it
      res.json({ status: 'ok', review: { raw_analysis: text }, engine_state: engineState });
    }
  } catch (err: any) {
    console.error('Review error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Failed to analyze screenshots' });
  }
});

// ─── SERVE STATIC FILES ───
const clientPath = path.join(__dirname, '../../client/public');
app.use(express.static(clientPath));

// SPA fallback
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(clientPath, 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`\n  DRUCK ENGINE v3.0 — Trifecta Analyzer`);
  console.log(`  Running on http://localhost:${PORT}\n`);
});
