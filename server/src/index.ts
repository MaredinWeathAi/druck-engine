import express from 'express';
import cors from 'cors';
import path from 'path';

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

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
    version: '3.0.0',
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

app.get('/api/macro', (_req, res) => {
  res.json({
    dates,
    crude: crude.map(v => +v.toFixed(2)),
    copper: copper.map(v => +v.toFixed(3)),
    gold: gold.map(v => +v.toFixed(0)),
    hy_spreads: hySpreads.map(v => +v.toFixed(2)),
    m2: m2.map(v => +v.toFixed(2)),
    indicators: {
      pce, gdp, cap_util: 78.2,
      yield_curve_bps: 18,
      m2_yoy: 0.8,
      is_stagflation: isStag,
    },
  });
});

app.get('/api/sectors', (_req, res) => {
  res.json({
    sectors: [
      { name: 'Airlines', fwd18m: -0.15, inst_conc: 0.12, pe: 8.2, fwd_pe: 6.1, capacity: 'Low' },
      { name: 'Chemicals', fwd18m: -0.08, inst_conc: 0.18, pe: 14.5, fwd_pe: 11.2, capacity: 'Low' },
      { name: 'Financials', fwd18m: 0.12, inst_conc: 0.42, pe: 12.8, fwd_pe: 10.5, capacity: 'Med' },
      { name: 'Technology', fwd18m: 0.35, inst_conc: 0.68, pe: 28.5, fwd_pe: 24.1, capacity: 'High' },
      { name: 'Energy', fwd18m: 0.05, inst_conc: 0.35, pe: 10.2, fwd_pe: 9.8, capacity: 'Med' },
      { name: 'Healthcare', fwd18m: 0.18, inst_conc: 0.45, pe: 18.3, fwd_pe: 15.7, capacity: 'Med' },
      { name: 'Industrials', fwd18m: 0.08, inst_conc: 0.30, pe: 16.7, fwd_pe: 13.9, capacity: 'Med' },
      { name: 'Materials', fwd18m: -0.05, inst_conc: 0.15, pe: 11.8, fwd_pe: 9.5, capacity: 'Low' },
      { name: 'Consumer Disc', fwd18m: 0.22, inst_conc: 0.52, pe: 22.1, fwd_pe: 18.4, capacity: 'High' },
      { name: 'Utilities', fwd18m: 0.02, inst_conc: 0.20, pe: 16.0, fwd_pe: 15.2, capacity: 'Med' },
      { name: 'Real Estate', fwd18m: -0.12, inst_conc: 0.10, pe: 19.5, fwd_pe: 14.8, capacity: 'Low' },
      { name: 'Argentina', fwd18m: 0.28, inst_conc: 0.08, pe: 6.5, fwd_pe: 4.2, capacity: 'Low' },
    ],
    smart_money: {
      sectors: ['Financials', 'Energy', 'Tech', 'Healthcare', 'Airlines', 'Materials', 'Argentina'],
      buying: [72, 58, 45, 52, 38, 41, 65],
      selling: [28, 35, 62, 40, 18, 30, 12],
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
  argentina: [
    { ticker: 'GGAL', name: 'Grupo Galicia', pe: 5.8, fwdPe: 3.5, mktCap: '$8.5B', above50d: true, insiderBuy: 10, insiderSell: 0, guruBuy: 6, guruSell: 1, dayChg: 1.5, weekChg: 5.8, monthChg: 18.5 },
    { ticker: 'YPF', name: 'YPF SA', pe: 4.2, fwdPe: 3.1, mktCap: '$12B', above50d: true, insiderBuy: 8, insiderSell: 0, guruBuy: 4, guruSell: 0, dayChg: 2.8, weekChg: 7.2, monthChg: 22.1 },
    { ticker: 'BMA', name: 'Banco Macro', pe: 6.1, fwdPe: 4.2, mktCap: '$5.2B', above50d: true, insiderBuy: 6, insiderSell: 0, guruBuy: 3, guruSell: 0, dayChg: 1.2, weekChg: 4.5, monthChg: 15.8 },
    { ticker: 'PAM', name: 'Pampa Energia', pe: 7.5, fwdPe: 5.1, mktCap: '$6.8B', above50d: true, insiderBuy: 5, insiderSell: 0, guruBuy: 2, guruSell: 0, dayChg: 0.8, weekChg: 3.2, monthChg: 12.5 },
    { ticker: 'TECO2', name: 'Telecom Arg', pe: 8.2, fwdPe: 5.5, mktCap: '$4.5B', above50d: true, insiderBuy: 7, insiderSell: 0, guruBuy: 3, guruSell: 0, dayChg: 2.1, weekChg: 6.1, monthChg: 20.2 },
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
      sector === 'financials' || sector === 'argentina' || sector === 'materials' ? 'Core Survivor' :
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
  console.log(`\n  DRUCK ENGINE v2.0 — Trifecta Analyzer`);
  console.log(`  Running on http://localhost:${PORT}\n`);
});
