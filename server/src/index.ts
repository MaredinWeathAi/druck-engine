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
    version: '2.0.0',
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
