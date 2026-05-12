// ═══════════════════════════════════════════════════════════════════
// MORNING MARKET LENS — Druckenmiller 272-Chart Framework (Phase 1)
// ═══════════════════════════════════════════════════════════════════
// ~30 priority instruments, Three Death Nails, Leading Groups,
// Breadth Health, What Changed, Aria Narrative
// ═══════════════════════════════════════════════════════════════════

import { Router, Request, Response } from 'express';
import YahooFinance from 'yahoo-finance2';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// Initialize yahoo-finance2 v3 (requires instantiation)
const yahooFinance = new (YahooFinance as any)();
try { yahooFinance.setGlobalConfig({ validation: { logErrors: false } }); } catch {}
try { yahooFinance.suppressNotices(['yahooSurvey']); } catch {}

// ─── INSTRUMENT REGISTRY (Phase 1: ~30 instruments) ───
interface Instrument {
  symbol: string;       // Yahoo Finance symbol
  name: string;
  bucket: 'equities' | 'commodities' | 'fx' | 'fixed_income';
  group: string;        // Sub-group within bucket
  druckRationale: string;
  isDeathNail?: boolean;
  isLeadingGroup?: boolean;
  isRatio?: boolean;
  ratioComponents?: [string, string]; // For computed ratio instruments
}

const INSTRUMENTS: Instrument[] = [
  // ── DEATH NAIL TRIO ──
  { symbol: '^TNX', name: 'US 10Y Yield', bucket: 'fixed_income', group: 'US Treasuries', druckRationale: 'Death Nail #1 — rising rates squeeze multiples and housing', isDeathNail: true },
  { symbol: 'DX-Y.NYB', name: 'US Dollar Index (DXY)', bucket: 'fx', group: 'Dollar', druckRationale: 'Death Nail #2 — strong dollar tightens global financial conditions', isDeathNail: true },
  { symbol: 'CL=F', name: 'WTI Crude Oil', bucket: 'commodities', group: 'Energy', druckRationale: 'Death Nail #3 — rising oil is a tax on the consumer and input costs', isDeathNail: true },

  // ── LEADING GROUPS (Inside of the Market) ──
  { symbol: 'XHB', name: 'Homebuilders', bucket: 'equities', group: 'Leading Groups', druckRationale: '#1 leading group — rate-sensitive, first to break before recessions', isLeadingGroup: true },
  { symbol: 'IYT', name: 'Transports', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Goods movement — trucking and rails lead industrial slowdowns', isLeadingGroup: true },
  { symbol: 'XRT', name: 'Retailers', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Consumer durables demand — spending weakness shows here first', isLeadingGroup: true },
  { symbol: 'KRE', name: 'Regional Banks', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Credit cycle — regional banks break before the economy does', isLeadingGroup: true },
  { symbol: 'SMH', name: 'Semiconductors', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Modern replacement for chemicals — capex and AI demand tell', isLeadingGroup: true },
  { symbol: 'GM', name: 'General Motors (Autos proxy)', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Big-ticket consumer — autos lead discretionary spending', isLeadingGroup: true },

  // ── MAJOR INDICES ──
  { symbol: 'SPY', name: 'S&P 500', bucket: 'equities', group: 'Indices', druckRationale: 'Master tape — the reference benchmark for all signals' },
  { symbol: 'QQQ', name: 'Nasdaq 100', bucket: 'equities', group: 'Indices', druckRationale: 'Growth/secular leadership — tech and AI concentration' },
  { symbol: 'IWM', name: 'Russell 2000', bucket: 'equities', group: 'Indices', druckRationale: 'Domestic cyclicality and breadth proxy' },
  { symbol: '^VIX', name: 'VIX', bucket: 'equities', group: 'Indices', druckRationale: 'Volatility regime — complacency vs fear gauge' },
  { symbol: 'RSP', name: 'S&P 500 Equal Weight', bucket: 'equities', group: 'Indices', druckRationale: 'Mega-cap concentration risk — diverges from SPY in blow-off tops' },

  // ── DEFENSIVES & RATIOS ──
  { symbol: 'XLP', name: 'Consumer Staples', bucket: 'equities', group: 'Defensives', druckRationale: 'Defensive anchor — outperformance signals risk-off rotation' },
  { symbol: 'XLY', name: 'Consumer Discretionary', bucket: 'equities', group: 'Cyclicals', druckRationale: 'Cyclical consumer — underperformance vs staples = late cycle' },
  { symbol: 'XLU', name: 'Utilities', bucket: 'equities', group: 'Defensives', druckRationale: 'Bond proxy + defensive — outperformance vs tech = late cycle warning' },
  { symbol: 'XLK', name: 'Technology', bucket: 'equities', group: 'Growth', druckRationale: 'Secular growth anchor — underperformance vs utilities = risk-off' },

  // ── COMMODITIES ──
  { symbol: 'GC=F', name: 'Gold', bucket: 'commodities', group: 'Precious Metals', druckRationale: 'Real rates and debasement signal — rises when faith in fiat drops' },
  { symbol: 'HG=F', name: 'Copper', bucket: 'commodities', group: 'Industrial Metals', druckRationale: 'Dr. Copper — global industrial demand barometer' },
  { symbol: 'SI=F', name: 'Silver', bucket: 'commodities', group: 'Precious Metals', druckRationale: 'Industrial + monetary hybrid — confirms gold or diverges' },
  { symbol: 'BZ=F', name: 'Brent Crude', bucket: 'commodities', group: 'Energy', druckRationale: 'Global oil benchmark — pairs with WTI for spread analysis' },

  // ── CURRENCIES ──
  { symbol: 'EURUSD=X', name: 'EUR/USD', bucket: 'fx', group: 'Major Crosses', druckRationale: 'Largest cross — ECB-Fed differential drives global capital flows' },
  { symbol: 'JPY=X', name: 'USD/JPY', bucket: 'fx', group: 'Major Crosses', druckRationale: 'Carry trade barometer — BoJ policy drives global risk appetite' },
  { symbol: 'BTC-USD', name: 'Bitcoin', bucket: 'fx', group: 'Digital', druckRationale: 'Liquidity/debasement tell — leads risk-on moves in loose policy' },

  // ── FIXED INCOME ──
  { symbol: '^IRX', name: 'US 3-Month T-Bill', bucket: 'fixed_income', group: 'US Treasuries', druckRationale: 'Fed policy rate proxy — front end of the curve' },
  { symbol: '^FVX', name: 'US 5Y Yield', bucket: 'fixed_income', group: 'US Treasuries', druckRationale: 'Belly of the curve — intermediate rate expectations' },
  { symbol: '^TYX', name: 'US 30Y Yield', bucket: 'fixed_income', group: 'US Treasuries', druckRationale: 'Long end — term premium and inflation expectations' },
  { symbol: 'HYG', name: 'High Yield Bond ETF', bucket: 'fixed_income', group: 'Credit', druckRationale: 'Credit risk appetite — widening = stress, tightening = risk-on' },
  { symbol: 'TLT', name: 'Long Treasury ETF', bucket: 'fixed_income', group: 'Duration', druckRationale: 'Duration trade — flight to quality vs inflation fear' },
];

// ─── TYPES ───
type TrendState = 'UPTREND' | 'DOWNTREND' | 'TOPPING' | 'BASING' | 'SIDEWAYS';

interface TrendClassification {
  state: TrendState;
  price: number;
  ma50: number;
  ma200: number;
  roc20d: number; // 20-day rate of change %
  slope20d: number; // 20-day slope direction
}

interface InstrumentSnapshot {
  symbol: string;
  name: string;
  bucket: string;
  group: string;
  druckRationale: string;
  daily: TrendClassification;
  weekly: TrendClassification | null;
  monthly: TrendClassification | null;
  changePct1d: number;
  changePct30d: number;
  lastUpdated: string;
}

interface DeathNailState {
  component: string;
  symbol: string;
  firing: boolean;
  price: number;
  ma50: number;
  ma200: number;
  roc20d: number;
  explanation: string;
}

interface LeadingGroupState {
  symbol: string;
  name: string;
  health: 'HEALTHY' | 'NEUTRAL' | 'BROKEN';
  trendState: TrendState;
  relPerf3m: number; // 3-month relative performance vs SPY
  explanation: string;
}

interface SignalState {
  deathNails: {
    count: number; // 0-3
    masterFiring: boolean;
    components: DeathNailState[];
  };
  leadingGroups: {
    healthyCount: number;
    brokenCount: number;
    divergenceWarning: boolean; // 4+ broken while SPY near highs
    groups: LeadingGroupState[];
  };
  breadth: {
    rspSpyRatio: number;
    rspSpyTrend: 'RISING' | 'FALLING' | 'FLAT';
    breadthHealth: 'HEALTHY' | 'WEAKENING' | 'BROKEN';
  };
  defensivesVsCyclicals: {
    xlpXly: { ratio: number; trend13w: 'RISING' | 'FALLING' | 'FLAT' };
    xluXlk: { ratio: number; trend13w: 'RISING' | 'FALLING' | 'FLAT' };
    goldCopper: { ratio: number; trend13w: 'RISING' | 'FALLING' | 'FLAT' };
  };
  curveCredit: {
    yieldCurve2s10s: number;
    hySpread: number;
  };
  timestamp: string;
}

interface DiffEntry {
  time: string;
  category: 'death_nail' | 'leading_group' | 'breadth' | 'defensives' | 'curve_credit' | 'trend_state';
  symbol?: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

// ─── DATA STORAGE ───
let instrumentSnapshots: Map<string, InstrumentSnapshot> = new Map();
let currentSignals: SignalState | null = null;
let previousSignals: SignalState | null = null;
let whatChanged: DiffEntry[] = [];
let ariaLatestNarrative: string = '';
let ariaTimestamp: string = '';
let lensLastRefresh: number = 0;
let lensRefreshErrors: string[] = [];
const LENS_CACHE_MS = 4 * 60 * 60 * 1000; // 4 hours

// ─── YAHOO FINANCE HELPERS ───

// (Global config set at top of file)

interface OHLCBar {
  date: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchOHLC(symbol: string, period: string = '1y'): Promise<OHLCBar[]> {
  try {
    const endDate = new Date();
    const startDate = new Date();
    if (period === '2y') startDate.setFullYear(startDate.getFullYear() - 2);
    else if (period === '5y') startDate.setFullYear(startDate.getFullYear() - 5);
    else startDate.setFullYear(startDate.getFullYear() - 1);

    // Use historical() which is the standard method in yahoo-finance2
    const result = await yahooFinance.historical(symbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d' as any,
    }) as any[];

    if (!result || result.length === 0) {
      console.warn(`[YF] No data for ${symbol}`);
      return [];
    }

    return result
      .filter((q: any) => q.close != null && q.close > 0)
      .map((q: any) => ({
        date: new Date(q.date),
        open: q.open || q.close,
        high: q.high || q.close,
        low: q.low || q.close,
        close: q.close,
        volume: q.volume || 0,
      }));
  } catch (err: any) {
    console.error(`[YF] Error fetching ${symbol}:`, err?.message);
    return [];
  }
}

// ─── TECHNICAL ANALYSIS ENGINE ───

function calcSMA(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      let sum = 0;
      for (let j = i - period + 1; j <= i; j++) sum += closes[j];
      result.push(sum / period);
    }
  }
  return result;
}

function calcROC(closes: number[], period: number): number {
  if (closes.length < period + 1) return 0;
  const latest = closes[closes.length - 1];
  const prior = closes[closes.length - 1 - period];
  if (!prior || prior === 0) return 0;
  return ((latest - prior) / prior) * 100;
}

function calcSlope(values: number[], period: number): number {
  if (values.length < period) return 0;
  const recent = values.slice(-period).filter(v => !isNaN(v));
  if (recent.length < 2) return 0;
  // Simple linear regression slope
  const n = recent.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += recent[i];
    sumXY += i * recent[i];
    sumXX += i * i;
  }
  return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}

function classifyTrend(closes: number[]): TrendClassification {
  if (closes.length < 200) {
    // Not enough data for 200ma — use what we have
    const price = closes[closes.length - 1];
    const ma50 = closes.length >= 50 ? calcSMA(closes, 50).pop() || price : price;
    const roc20d = calcROC(closes, 20);
    return {
      state: roc20d > 2 ? 'UPTREND' : roc20d < -2 ? 'DOWNTREND' : 'SIDEWAYS',
      price,
      ma50,
      ma200: price,
      roc20d: +roc20d.toFixed(2),
      slope20d: calcSlope(closes, 20),
    };
  }

  const price = closes[closes.length - 1];
  const sma50 = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, 200);
  const ma50 = sma50[sma50.length - 1];
  const ma200 = sma200[sma200.length - 1];
  const roc20d = calcROC(closes, 20);
  const slope20d = calcSlope(closes, 20);

  let state: TrendState;

  if (price > ma50 && ma50 > ma200 && slope20d > 0) {
    state = 'UPTREND';
  } else if (price < ma50 && ma50 < ma200 && slope20d < 0) {
    state = 'DOWNTREND';
  } else if (price < ma50 && ma50 > ma200) {
    // Price dropped below 50ma but 50ma still above 200ma — topping
    state = 'TOPPING';
  } else if (price > ma50 && ma50 < ma200) {
    // Price above 50ma but 50ma still below 200ma — basing / recovery
    state = 'BASING';
  } else {
    state = 'SIDEWAYS';
  }

  return {
    state,
    price: +price.toFixed(4),
    ma50: +ma50.toFixed(4),
    ma200: +ma200.toFixed(4),
    roc20d: +roc20d.toFixed(2),
    slope20d,
  };
}

function aggregateToWeekly(bars: OHLCBar[]): number[] {
  const weeks: Map<string, number[]> = new Map();
  for (const bar of bars) {
    const d = bar.date;
    // ISO week key
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay()); // Sunday start
    const key = weekStart.toISOString().slice(0, 10);
    if (!weeks.has(key)) weeks.set(key, []);
    weeks.get(key)!.push(bar.close);
  }
  // Use last close of each week
  return Array.from(weeks.values()).map(closes => closes[closes.length - 1]);
}

function aggregateToMonthly(bars: OHLCBar[]): number[] {
  const months: Map<string, number[]> = new Map();
  for (const bar of bars) {
    const key = `${bar.date.getFullYear()}-${String(bar.date.getMonth() + 1).padStart(2, '0')}`;
    if (!months.has(key)) months.set(key, []);
    months.get(key)!.push(bar.close);
  }
  return Array.from(months.values()).map(closes => closes[closes.length - 1]);
}

// ─── SIGNAL COMPUTATIONS ───

function computeDeathNails(snapshots: Map<string, InstrumentSnapshot>): SignalState['deathNails'] {
  const components: DeathNailState[] = [];
  const deathNailSymbols = [
    { symbol: '^TNX', component: 'Rising Rates' },
    { symbol: 'DX-Y.NYB', component: 'Rising Dollar' },
    { symbol: 'CL=F', component: 'Rising Oil' },
  ];

  for (const { symbol, component } of deathNailSymbols) {
    const snap = snapshots.get(symbol);
    if (!snap) {
      components.push({
        component,
        symbol,
        firing: false,
        price: 0, ma50: 0, ma200: 0, roc20d: 0,
        explanation: `No data available for ${symbol}`,
      });
      continue;
    }

    const d = snap.daily;
    // Death nail fires when: price > 50dma AND price > 200dma AND 20d ROC > 0
    const firing = d.price > d.ma50 && d.price > d.ma200 && d.roc20d > 0;
    const explanation = firing
      ? `${snap.name} at ${d.price.toFixed(2)}, above 50dma (${d.ma50.toFixed(2)}) and 200dma (${d.ma200.toFixed(2)}), 20d ROC +${d.roc20d.toFixed(1)}%`
      : `${snap.name} at ${d.price.toFixed(2)} — not all conditions met (50dma: ${d.ma50.toFixed(2)}, 200dma: ${d.ma200.toFixed(2)}, 20d ROC: ${d.roc20d.toFixed(1)}%)`;

    components.push({ component, symbol, firing, price: d.price, ma50: d.ma50, ma200: d.ma200, roc20d: d.roc20d, explanation });
  }

  const firingCount = components.filter(c => c.firing).length;
  return {
    count: firingCount,
    masterFiring: firingCount === 3,
    components,
  };
}

function computeLeadingGroups(snapshots: Map<string, InstrumentSnapshot>): SignalState['leadingGroups'] {
  const spySnap = snapshots.get('SPY');
  const spy30d = spySnap?.changePct30d || 0;

  const leadingSymbols = INSTRUMENTS.filter(i => i.isLeadingGroup);
  const groups: LeadingGroupState[] = [];

  for (const inst of leadingSymbols) {
    const snap = snapshots.get(inst.symbol);
    if (!snap) {
      groups.push({
        symbol: inst.symbol, name: inst.name, health: 'NEUTRAL',
        trendState: 'SIDEWAYS', relPerf3m: 0,
        explanation: `No data for ${inst.symbol}`,
      });
      continue;
    }

    const d = snap.daily;
    // Relative performance vs SPY (3-month approximation using 30d change)
    const relPerf = snap.changePct30d - spy30d;

    let health: 'HEALTHY' | 'NEUTRAL' | 'BROKEN';
    if (d.state === 'UPTREND' || d.state === 'BASING') {
      health = relPerf >= -3 ? 'HEALTHY' : 'NEUTRAL';
    } else if (d.state === 'DOWNTREND') {
      health = 'BROKEN';
    } else if (d.state === 'TOPPING') {
      health = relPerf < -5 ? 'BROKEN' : 'NEUTRAL';
    } else {
      health = 'NEUTRAL';
    }

    const explanation = `${inst.name}: ${d.state}, rel perf vs SPY: ${relPerf >= 0 ? '+' : ''}${relPerf.toFixed(1)}%`;
    groups.push({ symbol: inst.symbol, name: inst.name, health, trendState: d.state, relPerf3m: +relPerf.toFixed(1), explanation });
  }

  const brokenCount = groups.filter(g => g.health === 'BROKEN').length;
  const healthyCount = groups.filter(g => g.health === 'HEALTHY').length;

  // Divergence warning: 4+ broken while SPY still positive
  const divergenceWarning = brokenCount >= 4 && spy30d > 0;

  return { healthyCount, brokenCount, divergenceWarning, groups };
}

function computeBreadth(snapshots: Map<string, InstrumentSnapshot>): SignalState['breadth'] {
  const rsp = snapshots.get('RSP');
  const spy = snapshots.get('SPY');

  let rspSpyRatio = 1;
  let rspSpyTrend: 'RISING' | 'FALLING' | 'FLAT' = 'FLAT';
  let breadthHealth: 'HEALTHY' | 'WEAKENING' | 'BROKEN' = 'HEALTHY';

  if (rsp && spy && spy.daily.price > 0) {
    rspSpyRatio = +(rsp.daily.price / spy.daily.price).toFixed(4);
    // If RSP underperforming SPY over 30d = narrowing breadth
    const rspChg = rsp.changePct30d;
    const spyChg = spy.changePct30d;
    const diff = rspChg - spyChg;

    if (diff > 1) rspSpyTrend = 'RISING';
    else if (diff < -1) rspSpyTrend = 'FALLING';
    else rspSpyTrend = 'FLAT';

    if (diff < -3) breadthHealth = 'BROKEN';
    else if (diff < -1) breadthHealth = 'WEAKENING';
    else breadthHealth = 'HEALTHY';
  }

  return { rspSpyRatio, rspSpyTrend, breadthHealth };
}

function computeDefensivesVsCyclicals(snapshots: Map<string, InstrumentSnapshot>): SignalState['defensivesVsCyclicals'] {
  function getRatioTrend(numSymbol: string, denSymbol: string): { ratio: number; trend13w: 'RISING' | 'FALLING' | 'FLAT' } {
    const num = snapshots.get(numSymbol);
    const den = snapshots.get(denSymbol);
    if (!num || !den || den.daily.price === 0) return { ratio: 1, trend13w: 'FLAT' };
    const ratio = +(num.daily.price / den.daily.price).toFixed(4);
    // Approximate 13-week trend using 30d changes
    const numChg = num.changePct30d;
    const denChg = den.changePct30d;
    const diff = numChg - denChg;
    let trend: 'RISING' | 'FALLING' | 'FLAT' = 'FLAT';
    if (diff > 1.5) trend = 'RISING';
    else if (diff < -1.5) trend = 'FALLING';
    return { ratio, trend13w: trend };
  }

  return {
    xlpXly: getRatioTrend('XLP', 'XLY'),
    xluXlk: getRatioTrend('XLU', 'XLK'),
    goldCopper: getRatioTrend('GC=F', 'HG=F'),
  };
}

function computeCurveCredit(snapshots: Map<string, InstrumentSnapshot>): SignalState['curveCredit'] {
  const tnx = snapshots.get('^TNX');
  const irx = snapshots.get('^IRX');
  const hyg = snapshots.get('HYG');

  // 2s10s approximation: 10Y - 3M (since we don't have 2Y from Yahoo easily)
  const yield10y = tnx?.daily.price || 0; // ^TNX is already in percentage form
  const yield3m = irx?.daily.price || 0;
  const yieldCurve = +((yield10y - yield3m) * 100).toFixed(0); // Convert to bps

  return {
    yieldCurve2s10s: yieldCurve,
    hySpread: 0, // We get this from FRED in the main module
  };
}

// ─── WHAT CHANGED DIFF ENGINE ───

function computeWhatChanged(current: SignalState, previous: SignalState | null): DiffEntry[] {
  const diffs: DiffEntry[] = [];
  const now = new Date().toISOString();

  if (!previous) {
    diffs.push({ time: now, category: 'death_nail', message: 'Morning Lens initialized — first signal snapshot captured.', severity: 'info' });
    return diffs;
  }

  // Death Nail changes
  if (current.deathNails.count !== previous.deathNails.count) {
    diffs.push({
      time: now,
      category: 'death_nail',
      message: `Death Nail count: ${previous.deathNails.count}/3 → ${current.deathNails.count}/3${current.deathNails.masterFiring ? ' — MASTER ALERT FIRING' : ''}`,
      severity: current.deathNails.masterFiring ? 'critical' : 'warning',
    });
  }

  for (let i = 0; i < current.deathNails.components.length; i++) {
    const curr = current.deathNails.components[i];
    const prev = previous.deathNails.components[i];
    if (prev && curr.firing !== prev.firing) {
      diffs.push({
        time: now,
        category: 'death_nail',
        symbol: curr.symbol,
        message: `${curr.component}: ${prev.firing ? 'FIRING → DORMANT' : 'DORMANT → FIRING'} — ${curr.explanation}`,
        severity: curr.firing ? 'critical' : 'info',
      });
    }
  }

  // Leading Group changes
  for (let i = 0; i < current.leadingGroups.groups.length; i++) {
    const curr = current.leadingGroups.groups[i];
    const prev = previous.leadingGroups.groups.find(g => g.symbol === curr.symbol);
    if (prev && curr.health !== prev.health) {
      diffs.push({
        time: now,
        category: 'leading_group',
        symbol: curr.symbol,
        message: `${curr.name}: ${prev.health} → ${curr.health} — ${curr.explanation}`,
        severity: curr.health === 'BROKEN' ? 'warning' : 'info',
      });
    }
  }

  // Divergence warning
  if (current.leadingGroups.divergenceWarning && !previous.leadingGroups.divergenceWarning) {
    diffs.push({
      time: now,
      category: 'leading_group',
      message: `DIVERGENCE WARNING: ${current.leadingGroups.brokenCount} of 6 leading groups BROKEN while SPY still positive — 1987/2007-style divergence`,
      severity: 'critical',
    });
  }

  // Breadth changes
  if (current.breadth.breadthHealth !== previous.breadth.breadthHealth) {
    diffs.push({
      time: now,
      category: 'breadth',
      message: `Breadth health: ${previous.breadth.breadthHealth} → ${current.breadth.breadthHealth}. RSP/SPY trend: ${current.breadth.rspSpyTrend}`,
      severity: current.breadth.breadthHealth === 'BROKEN' ? 'warning' : 'info',
    });
  }

  // Defensives vs cyclicals
  const ratioNames: Array<{ key: keyof SignalState['defensivesVsCyclicals']; name: string }> = [
    { key: 'xlpXly', name: 'XLP/XLY (Staples vs Discretionary)' },
    { key: 'xluXlk', name: 'XLU/XLK (Utilities vs Tech)' },
    { key: 'goldCopper', name: 'Gold/Copper' },
  ];

  for (const { key, name } of ratioNames) {
    const currR = current.defensivesVsCyclicals[key];
    const prevR = previous.defensivesVsCyclicals[key];
    if (currR.trend13w !== prevR.trend13w) {
      diffs.push({
        time: now,
        category: 'defensives',
        message: `${name} ratio: 13-week trend flipped from ${prevR.trend13w} to ${currR.trend13w}${currR.trend13w === 'RISING' ? ' — defensive rotation building' : ''}`,
        severity: currR.trend13w === 'RISING' ? 'warning' : 'info',
      });
    }
  }

  // Trend state changes for all instruments
  const currentSnaps = Array.from(instrumentSnapshots.values());
  for (const snap of currentSnaps) {
    // We only track daily trend state changes in the diff
    // (In future, weekly/monthly changes also surface)
    // For now, compare to previous snapshot if we had one
    // This is simplified — a full impl would store previous snapshots
  }

  return diffs;
}

// ─── MASTER REFRESH ───

async function refreshMorningLens(): Promise<void> {
  console.log('[LENS] Starting Morning Lens data refresh...');
  const errors: string[] = [];
  const startTime = Date.now();

  // Fetch OHLC sequentially with delays to avoid Yahoo Finance rate limits on cloud IPs
  const allBars: Map<string, OHLCBar[]> = new Map();

  for (let i = 0; i < INSTRUMENTS.length; i++) {
    try {
      const bars = await fetchOHLC(INSTRUMENTS[i].symbol, '1y');
      if (bars.length > 0) {
        allBars.set(INSTRUMENTS[i].symbol, bars);
      } else {
        errors.push(`${INSTRUMENTS[i].symbol}: No data`);
        console.warn(`[LENS] Failed to fetch ${INSTRUMENTS[i].symbol}: No data`);
      }
    } catch (err: any) {
      errors.push(`${INSTRUMENTS[i].symbol}: ${err?.message || 'Unknown error'}`);
      console.warn(`[LENS] Failed to fetch ${INSTRUMENTS[i].symbol}: ${err?.message}`);
    }
    // Delay between each request to avoid rate limiting
    if (i < INSTRUMENTS.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log(`[LENS] Fetched ${allBars.size}/${INSTRUMENTS.length} instruments in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

  // Compute snapshots for each instrument
  const newSnapshots: Map<string, InstrumentSnapshot> = new Map();

  for (const inst of INSTRUMENTS) {
    const bars = allBars.get(inst.symbol);
    if (!bars || bars.length < 20) continue;

    const dailyCloses = bars.map(b => b.close);
    const weeklyCloses = aggregateToWeekly(bars);
    const monthlyCloses = aggregateToMonthly(bars);

    const daily = classifyTrend(dailyCloses);
    const weekly = weeklyCloses.length >= 50 ? classifyTrend(weeklyCloses) : null;
    const monthly = monthlyCloses.length >= 12 ? classifyTrend(monthlyCloses) : null;

    // Calculate change percentages
    const latestClose = dailyCloses[dailyCloses.length - 1];
    const prevClose = dailyCloses.length >= 2 ? dailyCloses[dailyCloses.length - 2] : latestClose;
    const close30dAgo = dailyCloses.length >= 22 ? dailyCloses[dailyCloses.length - 22] : dailyCloses[0];

    const changePct1d = +((latestClose - prevClose) / prevClose * 100).toFixed(2);
    const changePct30d = +((latestClose - close30dAgo) / close30dAgo * 100).toFixed(2);

    newSnapshots.set(inst.symbol, {
      symbol: inst.symbol,
      name: inst.name,
      bucket: inst.bucket,
      group: inst.group,
      druckRationale: inst.druckRationale,
      daily,
      weekly,
      monthly,
      changePct1d,
      changePct30d,
      lastUpdated: new Date().toISOString(),
    });
  }

  instrumentSnapshots = newSnapshots;

  // Compute signals
  previousSignals = currentSignals;
  currentSignals = {
    deathNails: computeDeathNails(newSnapshots),
    leadingGroups: computeLeadingGroups(newSnapshots),
    breadth: computeBreadth(newSnapshots),
    defensivesVsCyclicals: computeDefensivesVsCyclicals(newSnapshots),
    curveCredit: computeCurveCredit(newSnapshots),
    timestamp: new Date().toISOString(),
  };

  // Compute what changed
  whatChanged = computeWhatChanged(currentSignals, previousSignals);

  lensLastRefresh = Date.now();
  lensRefreshErrors = errors;

  console.log(`[LENS] ✓ Refresh complete — ${newSnapshots.size} instruments, Death Nails: ${currentSignals.deathNails.count}/3, Leading Groups: ${currentSignals.leadingGroups.healthyCount}H/${currentSignals.leadingGroups.brokenCount}B`);
}

// Auto-refresh on startup (delayed 5 seconds to let server start)
setTimeout(() => {
  refreshMorningLens().catch(err => console.error('[LENS] Initial refresh error:', err));
}, 5000);

// Auto-refresh every 4 hours
setInterval(() => {
  refreshMorningLens().catch(err => console.error('[LENS] Auto-refresh error:', err));
}, LENS_CACHE_MS);

// ─── ARIA NARRATIVE ───

async function generateAriaNarrative(apiKey: string): Promise<string> {
  if (!currentSignals) return 'Signal data not yet available. Please wait for the first data refresh.';

  try {
    const anthropic = new Anthropic({ apiKey });

    const signalPayload = {
      date: new Date().toISOString().slice(0, 10),
      deathNails: currentSignals.deathNails,
      leadingGroups: currentSignals.leadingGroups,
      breadth: currentSignals.breadth,
      defensivesVsCyclicals: currentSignals.defensivesVsCyclicals,
      curveCredit: currentSignals.curveCredit,
      whatChanged,
      instruments: Object.fromEntries(
        Array.from(instrumentSnapshots.entries()).map(([k, v]) => [k, {
          name: v.name,
          dailyState: v.daily.state,
          weeklyState: v.weekly?.state || 'N/A',
          price: v.daily.price,
          changePct1d: v.changePct1d,
          changePct30d: v.changePct30d,
        }])
      ),
    };

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 600,
      system: `You are Aria, Marcelo's AI research partner at Maredin Wealth Advisors. You write his morning macro brief in his voice: direct, no fluff, no hedging, no bullet lists unless absolutely needed. 250-350 words. Cover: (1) Are the three death nails firing, and what changed in their state since yesterday? (2) Which leading groups changed state since yesterday? (3) What is the biggest tape divergence right now? (4) One specific thing to watch today. End with one sentence on portfolio implication for Maredin's current book. Use only the attached JSON state — do not invent any data not in it. If a field is null or stale, say so explicitly.`,
      messages: [
        { role: 'user', content: `Generate this morning's brief from the following signal state:\n\n${JSON.stringify(signalPayload, null, 2)}` },
      ],
    });

    const text = response.content
      .filter((b: any) => b.type === 'text')
      .map((b: any) => b.text)
      .join('');

    ariaLatestNarrative = text;
    ariaTimestamp = new Date().toISOString();
    return text;
  } catch (err: any) {
    console.error('[ARIA] Narrative generation failed:', err?.message);
    return `Narrative unavailable: ${err?.message || 'Unknown error'}`;
  }
}

// ─── API ENDPOINTS ───

// Morning Lens health / status
router.get('/lens/status', (req: Request, res: Response) => {
  res.json({
    status: currentSignals ? 'ready' : 'loading',
    instrumentCount: instrumentSnapshots.size,
    totalInstruments: INSTRUMENTS.length,
    lastRefresh: lensLastRefresh ? new Date(lensLastRefresh).toISOString() : null,
    errors: lensRefreshErrors,
    deathNailCount: currentSignals?.deathNails.count || 0,
    whatChangedCount: whatChanged.length,
  });
});

// Full signal state
router.get('/lens/signals', (req: Request, res: Response) => {
  if (!currentSignals) {
    return res.status(503).json({ error: 'Data not yet loaded. Please wait for initial refresh.' });
  }
  res.json(currentSignals);
});

// Death Nails detail
router.get('/lens/death-nails', (req: Request, res: Response) => {
  if (!currentSignals) return res.status(503).json({ error: 'Loading...' });
  res.json(currentSignals.deathNails);
});

// Leading Groups detail
router.get('/lens/leading-groups', (req: Request, res: Response) => {
  if (!currentSignals) return res.status(503).json({ error: 'Loading...' });
  res.json(currentSignals.leadingGroups);
});

// What Changed Since Yesterday
router.get('/lens/what-changed', (req: Request, res: Response) => {
  res.json({
    entries: whatChanged,
    timestamp: currentSignals?.timestamp || null,
  });
});

// All instrument snapshots
router.get('/lens/instruments', (req: Request, res: Response) => {
  const bucket = req.query.bucket as string | undefined;
  let snapshots = Array.from(instrumentSnapshots.values());
  if (bucket) {
    snapshots = snapshots.filter(s => s.bucket === bucket);
  }
  res.json({
    count: snapshots.length,
    instruments: snapshots,
  });
});

// Single instrument detail
router.get('/lens/instruments/:symbol', (req: Request, res: Response) => {
  const symbol = decodeURIComponent(req.params.symbol as string);
  const snap = instrumentSnapshots.get(symbol);
  if (!snap) return res.status(404).json({ error: `Instrument ${symbol} not found` });
  res.json(snap);
});

// Instrument registry (list of all tracked instruments with metadata)
router.get('/lens/registry', (req: Request, res: Response) => {
  res.json({
    count: INSTRUMENTS.length,
    instruments: INSTRUMENTS.map(i => ({
      symbol: i.symbol,
      name: i.name,
      bucket: i.bucket,
      group: i.group,
      druckRationale: i.druckRationale,
      isDeathNail: i.isDeathNail || false,
      isLeadingGroup: i.isLeadingGroup || false,
      hasData: instrumentSnapshots.has(i.symbol),
    })),
  });
});

// Aria morning narrative
router.get('/lens/narrative', async (req: Request, res: Response) => {
  // Return cached narrative if recent (< 4 hours)
  if (ariaLatestNarrative && ariaTimestamp) {
    const age = Date.now() - new Date(ariaTimestamp).getTime();
    if (age < LENS_CACHE_MS) {
      return res.json({ narrative: ariaLatestNarrative, timestamp: ariaTimestamp, cached: true });
    }
  }

  // Need API key
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey) {
    return res.json({
      narrative: 'Aria narrative unavailable — no Anthropic API key configured. Set ANTHROPIC_API_KEY in environment.',
      timestamp: new Date().toISOString(),
      cached: false,
    });
  }

  const text = await generateAriaNarrative(apiKey);
  res.json({ narrative: text, timestamp: ariaTimestamp, cached: false });
});

// Force refresh
router.post('/lens/refresh', async (req: Request, res: Response) => {
  try {
    await refreshMorningLens();
    res.json({ status: 'refreshed', instrumentCount: instrumentSnapshots.size });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Refresh failed' });
  }
});

export default router;
export { INSTRUMENTS, refreshMorningLens };
