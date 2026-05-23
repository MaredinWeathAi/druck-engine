/**
 * Investment Inflection Engine
 * ============================
 * Comprehensive inflection detection framework for identifying momentum shifts,
 * exhaustion points, and phase transitions in equity lifecycle.
 *
 * Architecture:
 *   - Phase 1: Extended Technical Indicators (RSI, MACD, ATR, SMAs, relative strength)
 *   - Phase 2: Volume Analysis (green/red ratio, climax, exhaustion)
 *   - Phase 3: Fundamental Data (GuruFocus integration)
 *   - Phase 4: Valuation Scoring (multiples, percentiles)
 *   - Phase 5: Five-Pillar Scoring (0-100 normalization)
 *   - Phase 6: Six-Phase Classification State Machine
 *   - Phase 7: Exhaustion Models & BUY NOW / SHORT NOW Triggers
 *   - Phase 8: Industry-Specific Drivers
 *   - Phase 9: Alert System
 *
 * Data flow: Yahoo Finance OHLCV → TA calculations → Pillar scores → Phase classification → Alerts
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ============================================================================
// TYPES — Extended Price Bar with OHLCV
// ============================================================================

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface NormalizedOHLCV {
  day: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

// ============================================================================
// PHASE 1: EXTENDED TECHNICAL INDICATORS
// ============================================================================

// --- Simple Moving Average ---
export function calcSMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    let sum = 0;
    for (let j = 0; j < period; j++) sum += closes[i - j];
    result.push(Math.round((sum / period) * 100) / 100);
  }
  return result;
}

// --- Exponential Moving Average ---
export function calcEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result.push(null); continue; }
    if (ema === null) {
      // Seed with SMA
      let sum = 0;
      for (let j = 0; j < period; j++) sum += closes[i - j];
      ema = sum / period;
    } else {
      ema = closes[i] * k + ema * (1 - k);
    }
    result.push(Math.round(ema * 100) / 100);
  }
  return result;
}

// --- RSI (Relative Strength Index) ---
export function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  if (closes.length < period + 1) return closes.map(() => null);

  let avgGain = 0, avgLoss = 0;

  // Initial average over first `period` changes
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Fill nulls for warmup
  for (let i = 0; i <= period; i++) result.push(null);

  // Wilder's smoothing
  for (let i = period + 1; i < closes.length; i++) {
    if (i === period + 1) {
      // First RSI value uses initial averages (already computed)
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      result[period] = Math.round((100 - 100 / (1 + rs)) * 100) / 100;
    }
    const change = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (change > 0 ? change : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (change < 0 ? Math.abs(change) : 0)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result.push(Math.round((100 - 100 / (1 + rs)) * 100) / 100);
  }
  return result;
}

// --- MACD (Moving Average Convergence Divergence) ---
export interface MACDResult {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function calcMACD(closes: number[], fast = 12, slow = 26, sig = 9): MACDResult[] {
  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);
  const macdLine: (number | null)[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (emaFast[i] !== null && emaSlow[i] !== null) {
      macdLine.push(Math.round((emaFast[i]! - emaSlow[i]!) * 1000) / 1000);
    } else {
      macdLine.push(null);
    }
  }

  // Signal line = EMA of MACD line
  const validMacd = macdLine.filter(v => v !== null) as number[];
  const signalEma = calcEMA(validMacd, sig);

  // Map signal back to full array
  const result: MACDResult[] = [];
  let validIdx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (macdLine[i] === null) {
      result.push({ macd: null, signal: null, histogram: null });
    } else {
      const sigVal = signalEma[validIdx] ?? null;
      const hist = macdLine[i] !== null && sigVal !== null
        ? Math.round((macdLine[i]! - sigVal) * 1000) / 1000 : null;
      result.push({
        macd: macdLine[i],
        signal: sigVal !== null ? Math.round(sigVal * 1000) / 1000 : null,
        histogram: hist,
      });
      validIdx++;
    }
  }
  return result;
}

// --- ATR (Average True Range) ---
export function calcATR(bars: NormalizedOHLCV[], period = 14): (number | null)[] {
  const result: (number | null)[] = [];
  const trueRanges: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      trueRanges.push(bars[i].high - bars[i].low);
      result.push(null);
      continue;
    }
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close),
    );
    trueRanges.push(tr);

    if (i < period) { result.push(null); continue; }

    if (i === period) {
      // Initial ATR = average of first `period` TRs
      let sum = 0;
      for (let j = 1; j <= period; j++) sum += trueRanges[j];
      result.push(Math.round((sum / period) * 100) / 100);
    } else {
      // Wilder's smoothing
      const prevATR = result[i - 1]!;
      const atr = (prevATR * (period - 1) + tr) / period;
      result.push(Math.round(atr * 100) / 100);
    }
  }
  return result;
}

// --- 52-Week High/Low & Drawdown ---
export interface HighLowData {
  high52w: number;
  low52w: number;
  pctFromHigh: number;   // negative = drawdown
  pctFromLow: number;    // positive = above low
  daysFromHigh: number;
  daysFromLow: number;
}

export function calc52WeekHighLow(bars: NormalizedOHLCV[]): HighLowData | null {
  if (bars.length < 20) return null;
  const lookback = Math.min(252, bars.length); // ~252 trading days = 1 year
  const recent = bars.slice(-lookback);
  const current = bars[bars.length - 1].close;

  let high = -Infinity, low = Infinity;
  let highIdx = 0, lowIdx = 0;

  for (let i = 0; i < recent.length; i++) {
    if (recent[i].high > high) { high = recent[i].high; highIdx = i; }
    if (recent[i].low < low) { low = recent[i].low; lowIdx = i; }
  }

  return {
    high52w: Math.round(high * 100) / 100,
    low52w: Math.round(low * 100) / 100,
    pctFromHigh: Math.round(((current - high) / high) * 10000) / 100,
    pctFromLow: Math.round(((current - low) / low) * 10000) / 100,
    daysFromHigh: recent.length - 1 - highIdx,
    daysFromLow: recent.length - 1 - lowIdx,
  };
}

// --- Relative Strength vs Benchmark ---
export function calcRelativeStrength(
  tickerCloses: number[],
  benchmarkCloses: number[],
  period = 20,
): (number | null)[] {
  const result: (number | null)[] = [];
  const len = Math.min(tickerCloses.length, benchmarkCloses.length);

  for (let i = 0; i < len; i++) {
    if (i < period) { result.push(null); continue; }
    const tickerReturn = (tickerCloses[i] / tickerCloses[i - period] - 1) * 100;
    const benchReturn = (benchmarkCloses[i] / benchmarkCloses[i - period] - 1) * 100;
    result.push(Math.round((tickerReturn - benchReturn) * 100) / 100);
  }
  // Pad if ticker is longer than benchmark
  while (result.length < tickerCloses.length) result.push(null);
  return result;
}

// --- Support / Resistance Detection ---
export interface SupportResistance {
  level: number;
  type: 'support' | 'resistance';
  touches: number;
  strength: 'weak' | 'moderate' | 'strong';
  lastTouchDay: number;
}

export function detectSupportResistance(
  bars: NormalizedOHLCV[],
  tolerance = 0.015, // 1.5% price band
  minTouches = 2,
): SupportResistance[] {
  if (bars.length < 30) return [];

  // Find local pivot highs and lows (5-bar pivots)
  const pivots: { price: number; type: 'high' | 'low'; day: number }[] = [];
  for (let i = 2; i < bars.length - 2; i++) {
    const isHigh = bars[i].high > bars[i - 1].high && bars[i].high > bars[i - 2].high
      && bars[i].high > bars[i + 1].high && bars[i].high > bars[i + 2].high;
    const isLow = bars[i].low < bars[i - 1].low && bars[i].low < bars[i - 2].low
      && bars[i].low < bars[i + 1].low && bars[i].low < bars[i + 2].low;
    if (isHigh) pivots.push({ price: bars[i].high, type: 'high', day: i });
    if (isLow) pivots.push({ price: bars[i].low, type: 'low', day: i });
  }

  // Cluster pivots within tolerance
  const levels: SupportResistance[] = [];
  const used = new Set<number>();

  for (let i = 0; i < pivots.length; i++) {
    if (used.has(i)) continue;
    const cluster = [pivots[i]];
    used.add(i);

    for (let j = i + 1; j < pivots.length; j++) {
      if (used.has(j)) continue;
      if (Math.abs(pivots[j].price - pivots[i].price) / pivots[i].price <= tolerance) {
        cluster.push(pivots[j]);
        used.add(j);
      }
    }

    if (cluster.length >= minTouches) {
      const avgPrice = cluster.reduce((s, p) => s + p.price, 0) / cluster.length;
      const currentPrice = bars[bars.length - 1].close;
      const type = avgPrice < currentPrice ? 'support' : 'resistance';
      const strength = cluster.length >= 4 ? 'strong' : cluster.length >= 3 ? 'moderate' : 'weak';

      levels.push({
        level: Math.round(avgPrice * 100) / 100,
        type,
        touches: cluster.length,
        strength,
        lastTouchDay: Math.max(...cluster.map(c => c.day)),
      });
    }
  }

  return levels.sort((a, b) => b.touches - a.touches).slice(0, 10);
}

// --- Failed Breakout / Breakdown Detection ---
export interface FailedBreak {
  day: number;
  date: string;
  type: 'failed_breakout' | 'failed_breakdown';
  level: number;
  price: number;
  description: string;
}

export function detectFailedBreaks(
  bars: NormalizedOHLCV[],
  supportResistance: SupportResistance[],
): FailedBreak[] {
  const signals: FailedBreak[] = [];
  if (bars.length < 10) return signals;

  for (const sr of supportResistance) {
    const tolerance = sr.level * 0.005; // 0.5% beyond level

    for (let i = Math.max(5, sr.lastTouchDay); i < bars.length - 1; i++) {
      if (sr.type === 'resistance') {
        // Failed breakout: broke above resistance then fell back within 3 days
        if (bars[i].high > sr.level + tolerance) {
          let failed = false;
          for (let j = 1; j <= Math.min(3, bars.length - 1 - i); j++) {
            if (bars[i + j].close < sr.level - tolerance) { failed = true; break; }
          }
          if (failed) {
            signals.push({
              day: i, date: bars[i].date,
              type: 'failed_breakout', level: sr.level, price: bars[i].close,
              description: `Failed breakout above ${sr.level.toFixed(2)} (${sr.strength} resistance, ${sr.touches} touches)`,
            });
          }
        }
      } else {
        // Failed breakdown: broke below support then recovered within 3 days
        if (bars[i].low < sr.level - tolerance) {
          let failed = false;
          for (let j = 1; j <= Math.min(3, bars.length - 1 - i); j++) {
            if (bars[i + j].close > sr.level + tolerance) { failed = true; break; }
          }
          if (failed) {
            signals.push({
              day: i, date: bars[i].date,
              type: 'failed_breakdown', level: sr.level, price: bars[i].close,
              description: `Failed breakdown below ${sr.level.toFixed(2)} (${sr.strength} support, ${sr.touches} touches)`,
            });
          }
        }
      }
    }
  }

  // Deduplicate: only keep one signal per level per 10-day window
  const deduped: FailedBreak[] = [];
  signals.sort((a, b) => a.day - b.day);
  for (const s of signals) {
    const exists = deduped.find(d => d.type === s.type && Math.abs(d.level - s.level) < 0.01 && Math.abs(d.day - s.day) < 10);
    if (!exists) deduped.push(s);
  }
  return deduped;
}


// ============================================================================
// PHASE 2: VOLUME ANALYSIS ENGINE
// ============================================================================

export interface VolumeAnalysis {
  avgVolume20d: number;
  avgVolume50d: number;
  greenDayVolRatio: number;     // ratio of avg volume on up days vs down days (20d)
  redDayVolRatio: number;       // inverse
  climaxVolume: boolean;        // today's volume > 2x 20d average
  volumeExhaustion: 'buying' | 'selling' | 'none';
  volumeTrend: 'expanding' | 'contracting' | 'flat';
  obv: number;                  // On-Balance Volume (normalized)
  obvSlope: number | null;      // 10d OBV slope
}

export function analyzeVolume(bars: NormalizedOHLCV[]): VolumeAnalysis | null {
  if (bars.length < 50) return null;
  const recent50 = bars.slice(-50);
  const recent20 = bars.slice(-20);
  const current = bars[bars.length - 1];

  // Average volumes
  const avg20 = recent20.reduce((s, b) => s + b.volume, 0) / 20;
  const avg50 = recent50.reduce((s, b) => s + b.volume, 0) / 50;

  // Green/Red day volume
  let greenVol = 0, greenDays = 0, redVol = 0, redDays = 0;
  for (const b of recent20) {
    if (b.close >= b.open) { greenVol += b.volume; greenDays++; }
    else { redVol += b.volume; redDays++; }
  }
  const avgGreen = greenDays > 0 ? greenVol / greenDays : 0;
  const avgRed = redDays > 0 ? redVol / redDays : 0;

  // Green/red ratio: >1.3 = buyers dominant, <0.7 = sellers dominant
  const greenRedRatio = avgRed > 0 ? avgGreen / avgRed : avgGreen > 0 ? 2 : 1;

  // Climax volume
  const climax = current.volume > avg20 * 2;

  // Volume exhaustion: high volume into the trend with decreasing follow-through
  let exhaustion: 'buying' | 'selling' | 'none' = 'none';
  if (bars.length >= 10) {
    const last10 = bars.slice(-10);
    const priceUp = last10[last10.length - 1].close > last10[0].close;
    const volDecreasing = last10.slice(-5).reduce((s, b) => s + b.volume, 0) / 5
      < last10.slice(0, 5).reduce((s, b) => s + b.volume, 0) / 5 * 0.7;
    if (priceUp && volDecreasing && climax) exhaustion = 'buying';
    if (!priceUp && volDecreasing && climax) exhaustion = 'selling';
  }

  // Volume trend
  const vol10Recent = bars.slice(-10).reduce((s, b) => s + b.volume, 0) / 10;
  const vol10Prior = bars.slice(-20, -10).reduce((s, b) => s + b.volume, 0) / 10;
  const volChange = vol10Prior > 0 ? (vol10Recent - vol10Prior) / vol10Prior : 0;
  const volumeTrend = volChange > 0.15 ? 'expanding' : volChange < -0.15 ? 'contracting' : 'flat';

  // On-Balance Volume (last 50 days, normalized)
  let obv = 0;
  const obvArr: number[] = [];
  for (let i = 1; i < recent50.length; i++) {
    if (recent50[i].close > recent50[i - 1].close) obv += recent50[i].volume;
    else if (recent50[i].close < recent50[i - 1].close) obv -= recent50[i].volume;
    obvArr.push(obv);
  }
  const obvSlope = obvArr.length >= 10
    ? (obvArr[obvArr.length - 1] - obvArr[obvArr.length - 10]) / 10 : null;

  return {
    avgVolume20d: Math.round(avg20),
    avgVolume50d: Math.round(avg50),
    greenDayVolRatio: Math.round(greenRedRatio * 100) / 100,
    redDayVolRatio: greenRedRatio > 0 ? Math.round((1 / greenRedRatio) * 100) / 100 : 0,
    climaxVolume: climax,
    volumeExhaustion: exhaustion,
    volumeTrend,
    obv: Math.round(obv),
    obvSlope: obvSlope !== null ? Math.round(obvSlope) : null,
  };
}

// --- Earnings Reaction Analysis ---
export interface EarningsReaction {
  date: string;
  priceChangePct: number;
  volumeVsAvg: number;
  type: 'positive_surprise_flat' | 'negative_surprise_recovery' | 'normal';
  description: string;
}

export function analyzeEarningsReaction(
  bars: NormalizedOHLCV[],
  earningsDate: string,
  surprisePct: number, // positive = beat, negative = miss
): EarningsReaction | null {
  // Find the earnings date in bars
  const idx = bars.findIndex(b => b.date === earningsDate);
  if (idx < 1 || idx >= bars.length - 2) return null;

  const dayBefore = bars[idx - 1];
  const earningsDay = bars[idx];
  const dayAfter = bars[idx + 1];
  const avg20Vol = bars.slice(Math.max(0, idx - 20), idx).reduce((s, b) => s + b.volume, 0) / 20;

  const pctChange = ((dayAfter.close - dayBefore.close) / dayBefore.close) * 100;
  const volRatio = earningsDay.volume / avg20Vol;

  let type: EarningsReaction['type'] = 'normal';
  let desc = '';

  // Good news but stock flat or red — bearish signal (exhaustion)
  if (surprisePct > 2 && pctChange < 0.5) {
    type = 'positive_surprise_flat';
    desc = `Beat by ${surprisePct.toFixed(1)}% but stock only moved ${pctChange.toFixed(1)}% — potential buying exhaustion`;
  }
  // Bad news but stock recovers — bullish signal (selling exhaustion)
  else if (surprisePct < -2 && pctChange > -0.5) {
    type = 'negative_surprise_recovery';
    desc = `Missed by ${Math.abs(surprisePct).toFixed(1)}% but stock held at ${pctChange.toFixed(1)}% — potential selling exhaustion`;
  }
  else {
    desc = `Surprise: ${surprisePct.toFixed(1)}%, Reaction: ${pctChange.toFixed(1)}% — normal reaction`;
  }

  return {
    date: earningsDate,
    priceChangePct: Math.round(pctChange * 100) / 100,
    volumeVsAvg: Math.round(volRatio * 100) / 100,
    type,
    description: desc,
  };
}


// ============================================================================
// FULL EXTENDED TA COMPUTATION
// ============================================================================

export interface ExtendedTAResult {
  ticker: string;
  name: string;
  // Moving averages
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  // Trend structure
  priceVsSma20: number | null;  // % above/below
  priceVsSma50: number | null;
  priceVsSma200: number | null;
  goldenCross: boolean;
  deathCross: boolean;
  // Momentum
  rsi14: number | null;
  macd: MACDResult;
  atr14: number | null;
  atrPct: number | null;       // ATR as % of price (volatility)
  // 52-week
  highLow: HighLowData | null;
  // Relative strength
  rsVsSpy20d: number | null;
  rsVsSpy60d: number | null;
  // Volume
  volume: VolumeAnalysis | null;
  // Structure
  supportResistance: SupportResistance[];
  failedBreaks: FailedBreak[];
}

export function computeExtendedTA(
  ticker: string,
  name: string,
  bars: OHLCVBar[],
  spyCloses?: number[], // optional SPY benchmark
): ExtendedTAResult | null {
  if (!bars || bars.length < 50) return null;

  const normalized: NormalizedOHLCV[] = bars.map((b, i) => ({
    day: i, date: b.date,
    open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
  }));

  const closes = normalized.map(b => b.close);
  const current = closes[closes.length - 1];

  // Moving averages
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const sma100 = calcSMA(closes, 100);
  const sma200 = calcSMA(closes, 200);

  const lastSma20 = sma20[sma20.length - 1];
  const lastSma50 = sma50[sma50.length - 1];
  const lastSma100 = sma100[sma100.length - 1];
  const lastSma200 = sma200[sma200.length - 1];

  // Cross detection (recent 5 days)
  let goldenCross = false, deathCross = false;
  for (let i = Math.max(0, sma50.length - 5); i < sma50.length; i++) {
    if (i < 1 || sma50[i] === null || sma200[i] === null || sma50[i - 1] === null || sma200[i - 1] === null) continue;
    if (sma50[i - 1]! < sma200[i - 1]! && sma50[i]! >= sma200[i]!) goldenCross = true;
    if (sma50[i - 1]! > sma200[i - 1]! && sma50[i]! <= sma200[i]!) deathCross = true;
  }

  // RSI
  const rsi = calcRSI(closes);
  const lastRsi = rsi[rsi.length - 1];

  // MACD
  const macdArr = calcMACD(closes);
  const lastMacd = macdArr[macdArr.length - 1];

  // ATR
  const atr = calcATR(normalized);
  const lastAtr = atr[atr.length - 1];

  // 52-week high/low
  const highLow = calc52WeekHighLow(normalized);

  // Relative strength vs SPY
  let rsVsSpy20 = null, rsVsSpy60 = null;
  if (spyCloses && spyCloses.length > 0) {
    const rs20 = calcRelativeStrength(closes, spyCloses, 20);
    const rs60 = calcRelativeStrength(closes, spyCloses, 60);
    rsVsSpy20 = rs20[rs20.length - 1];
    rsVsSpy60 = rs60[rs60.length - 1];
  }

  // Volume analysis
  const volAnalysis = analyzeVolume(normalized);

  // Support/Resistance
  const sr = detectSupportResistance(normalized);
  const failedBreaks = detectFailedBreaks(normalized, sr);

  return {
    ticker, name,
    sma20: lastSma20, sma50: lastSma50, sma100: lastSma100, sma200: lastSma200,
    priceVsSma20: lastSma20 !== null ? Math.round(((current - lastSma20) / lastSma20) * 10000) / 100 : null,
    priceVsSma50: lastSma50 !== null ? Math.round(((current - lastSma50) / lastSma50) * 10000) / 100 : null,
    priceVsSma200: lastSma200 !== null ? Math.round(((current - lastSma200) / lastSma200) * 10000) / 100 : null,
    goldenCross, deathCross,
    rsi14: lastRsi,
    macd: lastMacd,
    atr14: lastAtr,
    atrPct: lastAtr !== null ? Math.round((lastAtr / current) * 10000) / 100 : null,
    highLow,
    rsVsSpy20d: rsVsSpy20, rsVsSpy60d: rsVsSpy60,
    volume: volAnalysis,
    supportResistance: sr,
    failedBreaks,
  };
}


// ============================================================================
// REST ENDPOINTS
// ============================================================================

// GET /api/inflection/status
router.get('/status', (_req: Request, res: Response) => {
  res.json({
    module: 'Investment Inflection Engine',
    version: '1.0.0',
    phases: {
      phase1_extended_ta: 'active',
      phase2_volume: 'active',
      phase3_fundamentals: 'active',
      phase4_valuation: 'active',
      phase5_pillars: 'active',
      phase6_classification: 'active',
      phase7_exhaustion: 'active',
      phase8_industry: 'active',
      phase9_alerts: 'active',
    },
    indicators: [
      'SMA(20,50,100,200)', 'EMA(12,20,26)', 'RSI(14)', 'MACD(12,26,9)',
      'ATR(14)', '52-Week High/Low', 'Relative Strength vs SPY',
      'Support/Resistance', 'Failed Breakout/Breakdown',
      'Volume Analysis', 'OBV', 'Climax Volume', 'Volume Exhaustion',
    ],
  });
});

// POST /api/inflection/analyze — Full extended TA analysis
router.post('/analyze', (req: Request, res: Response) => {
  const { ticker, name, bars, spyCloses } = req.body;
  if (!ticker || !bars || !Array.isArray(bars)) {
    return res.status(400).json({ error: 'Required: ticker, name, bars[] (OHLCV)' });
  }

  const result = computeExtendedTA(ticker, name || ticker, bars, spyCloses);
  if (!result) {
    return res.status(400).json({ error: 'Insufficient data (need 50+ OHLCV bars)' });
  }

  res.json(result);
});

// POST /api/inflection/batch — Batch extended TA analysis
router.post('/batch', (req: Request, res: Response) => {
  const { tickers, spyCloses } = req.body;
  if (!Array.isArray(tickers)) {
    return res.status(400).json({ error: 'Required: tickers[] array of { ticker, name, bars[] }' });
  }

  const results: ExtendedTAResult[] = [];
  for (const t of tickers) {
    const result = computeExtendedTA(t.ticker, t.name || t.ticker, t.bars, spyCloses);
    if (result) results.push(result);
  }

  res.json({ analyzed: results.length, results });
});

// POST /api/inflection/earnings-reaction — Analyze earnings reaction
router.post('/earnings-reaction', (req: Request, res: Response) => {
  const { bars, earningsDate, surprisePct } = req.body;
  if (!bars || !earningsDate || surprisePct === undefined) {
    return res.status(400).json({ error: 'Required: bars[], earningsDate, surprisePct' });
  }

  const normalized: NormalizedOHLCV[] = bars.map((b: OHLCVBar, i: number) => ({
    day: i, date: b.date,
    open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
  }));

  const result = analyzeEarningsReaction(normalized, earningsDate, surprisePct);
  if (!result) {
    return res.status(400).json({ error: 'Could not find earnings date in price data' });
  }

  res.json(result);
});


// ============================================================================
// PHASE 5: FIVE-PILLAR SCORING FRAMEWORK (0-100 each)
// ============================================================================
//
// Pillars:
//   1. Technical (price action, momentum, breadth)
//   2. Fundamental (growth, profitability, quality)
//   3. Valuation (multiples vs history, relative to sector)
//   4. Inflection (acceleration, divergence, exhaustion signals)
//   5. Narrative (manual input + sentiment heuristics)
//

export interface PillarScores {
  technical: number;       // 0-100
  fundamental: number;     // 0-100
  valuation: number;       // 0-100
  inflection: number;      // 0-100
  narrative: number;       // 0-100
  composite: number;       // weighted average
  weights: { technical: number; fundamental: number; valuation: number; inflection: number; narrative: number };
}

// --- Helper: clamp to 0-100 ---
function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

// --- Technical Pillar Scoring ---
export function scoreTechnical(ta: ExtendedTAResult): number {
  let score = 50; // neutral baseline

  // Trend structure (up to ±20)
  if (ta.priceVsSma200 !== null) {
    if (ta.priceVsSma200 > 0) score += Math.min(10, ta.priceVsSma200 * 0.5);
    else score += Math.max(-10, ta.priceVsSma200 * 0.5);
  }
  if (ta.priceVsSma50 !== null) {
    if (ta.priceVsSma50 > 0) score += Math.min(5, ta.priceVsSma50 * 0.3);
    else score += Math.max(-5, ta.priceVsSma50 * 0.3);
  }
  if (ta.goldenCross) score += 5;
  if (ta.deathCross) score -= 5;

  // RSI (±15)
  if (ta.rsi14 !== null) {
    if (ta.rsi14 > 70) score -= (ta.rsi14 - 70) * 0.5;     // overbought penalty
    else if (ta.rsi14 < 30) score += (30 - ta.rsi14) * 0.5; // oversold bonus (contrarian)
    else if (ta.rsi14 >= 50 && ta.rsi14 <= 65) score += 5;  // healthy momentum zone
  }

  // MACD (±10)
  if (ta.macd.histogram !== null) {
    if (ta.macd.histogram > 0) score += Math.min(10, ta.macd.histogram * 2);
    else score += Math.max(-10, ta.macd.histogram * 2);
  }

  // 52-week position (±10)
  if (ta.highLow) {
    if (ta.highLow.pctFromHigh > -5) score += 5;    // near highs
    if (ta.highLow.pctFromHigh < -20) score -= 5;   // deep drawdown
    if (ta.highLow.pctFromLow < 10) score -= 5;     // near lows (caution)
  }

  // Relative strength vs SPY (±10)
  if (ta.rsVsSpy20d !== null) {
    score += Math.min(10, Math.max(-10, ta.rsVsSpy20d * 0.5));
  }

  // Volume (±10)
  if (ta.volume) {
    if (ta.volume.greenDayVolRatio > 1.3) score += 5;
    if (ta.volume.greenDayVolRatio < 0.7) score -= 5;
    if (ta.volume.volumeExhaustion === 'buying') score -= 5;
    if (ta.volume.volumeExhaustion === 'selling') score += 5;
  }

  return clamp(score);
}

// --- Fundamental Pillar Scoring ---
// Takes fundamental data from fundamental-data.ts
export function scoreFundamental(f: {
  revenueGrowthYoY: number | null;
  epsGrowthYoY: number | null;
  operatingMargin: number | null;
  netMargin: number | null;
  roic: number | null;
  fcfYield: number | null;
  debtToEquity: number | null;
  piotroskiFScore: number | null;
  currentRatio: number | null;
}): number {
  let score = 50;

  // Revenue growth (±15)
  if (f.revenueGrowthYoY !== null) {
    if (f.revenueGrowthYoY > 20) score += 15;
    else if (f.revenueGrowthYoY > 10) score += 10;
    else if (f.revenueGrowthYoY > 0) score += 5;
    else if (f.revenueGrowthYoY > -10) score -= 5;
    else score -= 10;
  }

  // EPS growth (±10)
  if (f.epsGrowthYoY !== null) {
    if (f.epsGrowthYoY > 20) score += 10;
    else if (f.epsGrowthYoY > 0) score += 5;
    else score -= 5;
  }

  // Margins (±10)
  if (f.operatingMargin !== null) {
    if (f.operatingMargin > 25) score += 5;
    else if (f.operatingMargin > 15) score += 3;
    else if (f.operatingMargin < 5) score -= 5;
  }

  // ROIC (±10)
  if (f.roic !== null) {
    if (f.roic > 20) score += 10;
    else if (f.roic > 12) score += 5;
    else if (f.roic < 5) score -= 5;
  }

  // FCF yield (±5)
  if (f.fcfYield !== null) {
    if (f.fcfYield > 5) score += 5;
    else if (f.fcfYield < 0) score -= 5;
  }

  // Leverage (±5)
  if (f.debtToEquity !== null) {
    if (f.debtToEquity > 2) score -= 5;
    else if (f.debtToEquity < 0.5) score += 3;
  }

  // Piotroski F-Score (±5)
  if (f.piotroskiFScore !== null) {
    if (f.piotroskiFScore >= 7) score += 5;
    else if (f.piotroskiFScore <= 3) score -= 5;
  }

  return clamp(score);
}

// --- Valuation Pillar Scoring ---
export function scoreValuation(v: {
  peForward: number | null;
  evToEbitda: number | null;
  pegRatio: number | null;
  fcfYield: number | null;
  pePctile: number | null;
  gfValueMargin: number | null;
}): number {
  let score = 50;

  // Forward P/E (±15) — lower is better
  if (v.peForward !== null) {
    if (v.peForward < 12) score += 15;
    else if (v.peForward < 18) score += 8;
    else if (v.peForward < 25) score += 0;
    else if (v.peForward < 35) score -= 8;
    else score -= 15;
  }

  // EV/EBITDA (±10)
  if (v.evToEbitda !== null) {
    if (v.evToEbitda < 8) score += 10;
    else if (v.evToEbitda < 14) score += 5;
    else if (v.evToEbitda > 25) score -= 10;
    else if (v.evToEbitda > 18) score -= 5;
  }

  // PEG ratio (±10) — <1 is great, >2 is expensive
  if (v.pegRatio !== null && v.pegRatio > 0) {
    if (v.pegRatio < 0.8) score += 10;
    else if (v.pegRatio < 1.2) score += 5;
    else if (v.pegRatio > 2) score -= 10;
    else if (v.pegRatio > 1.5) score -= 5;
  }

  // PE percentile in 5yr range (±10) — lower = cheaper historically
  if (v.pePctile !== null) {
    if (v.pePctile < 20) score += 10;      // historically cheap
    else if (v.pePctile < 40) score += 5;
    else if (v.pePctile > 80) score -= 10;  // historically expensive
    else if (v.pePctile > 60) score -= 5;
  }

  // GF Value margin (±10) — negative = undervalued
  if (v.gfValueMargin !== null) {
    if (v.gfValueMargin < -20) score += 10;  // significantly undervalued
    else if (v.gfValueMargin < -10) score += 5;
    else if (v.gfValueMargin > 20) score -= 10;
    else if (v.gfValueMargin > 10) score -= 5;
  }

  return clamp(score);
}

// --- Inflection Pillar Scoring ---
// Uses acceleration data from ta-acceleration.ts
export function scoreInflection(accel: {
  rocAccel: number | null;
  logAccelSmooth: number | null;
  emaAccel: number | null;
  trend: 'accelerating' | 'decelerating' | 'neutral';
  recentSignalCount: number;
  recentSignalType?: 'DECEL_DIVERGENCE' | 'ACCEL_DIVERGENCE' | null;
}, ta: ExtendedTAResult): number {
  let score = 50;

  // Acceleration trend (±15)
  if (accel.trend === 'accelerating') score += 15;
  else if (accel.trend === 'decelerating') score -= 15;

  // Individual acceleration values (±10)
  if (accel.rocAccel !== null) {
    score += Math.min(5, Math.max(-5, accel.rocAccel * 2));
  }
  if (accel.emaAccel !== null) {
    score += Math.min(5, Math.max(-5, accel.emaAccel * 10));
  }

  // Recent divergence signals (±10)
  if (accel.recentSignalType === 'ACCEL_DIVERGENCE') score += 10;
  if (accel.recentSignalType === 'DECEL_DIVERGENCE') score -= 10;

  // Failed breaks (±10)
  if (ta.failedBreaks.length > 0) {
    const recentBreaks = ta.failedBreaks.filter(b => b.day >= ta.failedBreaks[0].day - 20);
    const failedBreakouts = recentBreaks.filter(b => b.type === 'failed_breakout').length;
    const failedBreakdowns = recentBreaks.filter(b => b.type === 'failed_breakdown').length;
    if (failedBreakouts > 0) score -= 5 * failedBreakouts;
    if (failedBreakdowns > 0) score += 5 * failedBreakdowns;
  }

  // Volume exhaustion signals (±5)
  if (ta.volume) {
    if (ta.volume.volumeExhaustion === 'buying') score -= 5;
    if (ta.volume.volumeExhaustion === 'selling') score += 5;
  }

  return clamp(score);
}

// --- Narrative Pillar Scoring ---
// Semi-automated: takes manual sentiment input + heuristics
export function scoreNarrative(input: {
  manualSentiment?: number;  // 0-100 manual override if provided
  earningsBeatRate?: number | null;
  insiderNetPct?: number | null;
  analystRevisionsUp?: number;
  analystRevisionsDown?: number;
}): number {
  // If manual sentiment provided, weight it heavily
  if (input.manualSentiment !== undefined) {
    let base = input.manualSentiment;
    // Adjust slightly based on data
    if (input.earningsBeatRate !== null && input.earningsBeatRate !== undefined) {
      if (input.earningsBeatRate > 80) base = Math.min(100, base + 5);
      if (input.earningsBeatRate < 50) base = Math.max(0, base - 5);
    }
    return clamp(base);
  }

  // Auto-score from available data
  let score = 50;

  if (input.earningsBeatRate !== null && input.earningsBeatRate !== undefined) {
    if (input.earningsBeatRate > 80) score += 10;
    else if (input.earningsBeatRate > 60) score += 5;
    else if (input.earningsBeatRate < 40) score -= 10;
  }

  if (input.insiderNetPct !== null && input.insiderNetPct !== undefined) {
    if (input.insiderNetPct > 30) score += 10;    // heavy insider buying
    else if (input.insiderNetPct > 0) score += 5;
    else if (input.insiderNetPct < -30) score -= 10;
  }

  const revisionsUp = input.analystRevisionsUp ?? 0;
  const revisionsDown = input.analystRevisionsDown ?? 0;
  if (revisionsUp > revisionsDown * 2) score += 10;
  else if (revisionsDown > revisionsUp * 2) score -= 10;

  return clamp(score);
}

// --- Composite Score ---
export function computePillarScores(
  technical: number,
  fundamental: number,
  valuation: number,
  inflection: number,
  narrative: number,
  weights = { technical: 0.25, fundamental: 0.20, valuation: 0.20, inflection: 0.25, narrative: 0.10 },
): PillarScores {
  const composite = Math.round(
    technical * weights.technical +
    fundamental * weights.fundamental +
    valuation * weights.valuation +
    inflection * weights.inflection +
    narrative * weights.narrative
  );

  return {
    technical, fundamental, valuation, inflection, narrative,
    composite: clamp(composite),
    weights,
  };
}


// ============================================================================
// PHASE 6: SIX-PHASE CLASSIFICATION STATE MACHINE
// ============================================================================
//
// Phases (in lifecycle order):
//   1. NARRATIVE_EXPANSION  — Story growing, price accelerating, everyone bullish
//   2. BUYING_EXHAUSTION    — Price still rising but momentum fading, volume diverging
//   3. NARRATIVE_COLLAPSE   — Story breaks, price declining, momentum confirms
//   4. SELLING_EXHAUSTION   — Price still falling but decelerating, smart money accumulating
//   5. INSTITUTIONAL_ACCUMULATION — Price basing, quiet accumulation, narrative ignored
//   6. NARRATIVE_REVERSAL   — New story emerging, price inflecting up, early movers
//

export type InflectionPhase =
  | 'NARRATIVE_EXPANSION'
  | 'BUYING_EXHAUSTION'
  | 'NARRATIVE_COLLAPSE'
  | 'SELLING_EXHAUSTION'
  | 'INSTITUTIONAL_ACCUMULATION'
  | 'NARRATIVE_REVERSAL';

export interface PhaseClassification {
  phase: InflectionPhase;
  confidence: number;  // 0-100
  description: string;
  actionBias: 'BUY' | 'HOLD' | 'REDUCE' | 'SHORT' | 'ACCUMULATE';
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  nextPhase: InflectionPhase;
  transitionSignals: string[];
}

export function classifyPhase(
  pillars: PillarScores,
  ta: ExtendedTAResult,
  accelTrend: 'accelerating' | 'decelerating' | 'neutral',
): PhaseClassification {
  const { technical, fundamental, valuation, inflection, narrative } = pillars;

  // Phase scoring: each phase gets a confidence score based on pillar patterns
  const phaseScores: Record<InflectionPhase, number> = {
    NARRATIVE_EXPANSION: 0,
    BUYING_EXHAUSTION: 0,
    NARRATIVE_COLLAPSE: 0,
    SELLING_EXHAUSTION: 0,
    INSTITUTIONAL_ACCUMULATION: 0,
    NARRATIVE_REVERSAL: 0,
  };

  // --- NARRATIVE EXPANSION ---
  // High technical + high narrative + accelerating + stretched valuation
  if (technical > 65) phaseScores.NARRATIVE_EXPANSION += 20;
  if (narrative > 65) phaseScores.NARRATIVE_EXPANSION += 20;
  if (accelTrend === 'accelerating') phaseScores.NARRATIVE_EXPANSION += 20;
  if (valuation < 40) phaseScores.NARRATIVE_EXPANSION += 10; // expensive = expansion
  if (ta.rsi14 !== null && ta.rsi14 > 60) phaseScores.NARRATIVE_EXPANSION += 15;
  if (ta.highLow && ta.highLow.pctFromHigh > -10) phaseScores.NARRATIVE_EXPANSION += 15;

  // --- BUYING EXHAUSTION ---
  // High price but fading momentum + volume divergence
  if (technical > 55 && inflection < 45) phaseScores.BUYING_EXHAUSTION += 25;
  if (accelTrend === 'decelerating') phaseScores.BUYING_EXHAUSTION += 20;
  if (ta.volume?.volumeExhaustion === 'buying') phaseScores.BUYING_EXHAUSTION += 20;
  if (ta.volume?.greenDayVolRatio !== undefined && ta.volume.greenDayVolRatio < 0.8) phaseScores.BUYING_EXHAUSTION += 15;
  if (ta.rsi14 !== null && ta.rsi14 > 70) phaseScores.BUYING_EXHAUSTION += 10;
  if (valuation < 35) phaseScores.BUYING_EXHAUSTION += 10; // very expensive

  // --- NARRATIVE COLLAPSE ---
  // Everything falling, momentum confirms, narrative dying
  if (technical < 35) phaseScores.NARRATIVE_COLLAPSE += 20;
  if (narrative < 40) phaseScores.NARRATIVE_COLLAPSE += 15;
  if (accelTrend === 'decelerating') phaseScores.NARRATIVE_COLLAPSE += 15;
  if (inflection < 35) phaseScores.NARRATIVE_COLLAPSE += 15;
  if (ta.deathCross) phaseScores.NARRATIVE_COLLAPSE += 15;
  if (ta.highLow && ta.highLow.pctFromHigh < -25) phaseScores.NARRATIVE_COLLAPSE += 10;
  if (ta.rsi14 !== null && ta.rsi14 < 40) phaseScores.NARRATIVE_COLLAPSE += 10;

  // --- SELLING EXHAUSTION ---
  // Price still low but momentum inflecting, volume drying up on red days
  if (technical < 40 && inflection > 50) phaseScores.SELLING_EXHAUSTION += 25;
  if (accelTrend === 'accelerating' && technical < 45) phaseScores.SELLING_EXHAUSTION += 20;
  if (ta.volume?.volumeExhaustion === 'selling') phaseScores.SELLING_EXHAUSTION += 20;
  if (ta.rsi14 !== null && ta.rsi14 < 35) phaseScores.SELLING_EXHAUSTION += 15;
  if (valuation > 65) phaseScores.SELLING_EXHAUSTION += 10; // cheap
  if (ta.failedBreaks.some(b => b.type === 'failed_breakdown')) phaseScores.SELLING_EXHAUSTION += 10;

  // --- INSTITUTIONAL ACCUMULATION ---
  // Price flat/basing, quiet volume, fundamentals intact, narrative dead
  if (technical >= 40 && technical <= 55) phaseScores.INSTITUTIONAL_ACCUMULATION += 15;
  if (fundamental > 55) phaseScores.INSTITUTIONAL_ACCUMULATION += 15;
  if (narrative < 45) phaseScores.INSTITUTIONAL_ACCUMULATION += 10;
  if (ta.volume?.volumeTrend === 'contracting') phaseScores.INSTITUTIONAL_ACCUMULATION += 15;
  if (ta.atrPct !== null && ta.atrPct < 2) phaseScores.INSTITUTIONAL_ACCUMULATION += 10; // low volatility
  if (valuation > 55) phaseScores.INSTITUTIONAL_ACCUMULATION += 15; // reasonable valuation
  if (inflection >= 45 && inflection <= 55) phaseScores.INSTITUTIONAL_ACCUMULATION += 10; // neutral accel

  // --- NARRATIVE REVERSAL ---
  // New momentum starting, inflection positive, narrative shifting
  if (inflection > 60) phaseScores.NARRATIVE_REVERSAL += 20;
  if (accelTrend === 'accelerating') phaseScores.NARRATIVE_REVERSAL += 20;
  if (technical > 45 && technical < 65) phaseScores.NARRATIVE_REVERSAL += 15;
  if (narrative > 50 && narrative < 70) phaseScores.NARRATIVE_REVERSAL += 10;
  if (ta.goldenCross) phaseScores.NARRATIVE_REVERSAL += 15;
  if (ta.volume?.greenDayVolRatio !== undefined && ta.volume.greenDayVolRatio > 1.3) phaseScores.NARRATIVE_REVERSAL += 10;
  if (ta.failedBreaks.some(b => b.type === 'failed_breakdown')) phaseScores.NARRATIVE_REVERSAL += 10;

  // Find winning phase
  let bestPhase: InflectionPhase = 'NARRATIVE_EXPANSION';
  let bestScore = 0;
  for (const [phase, score] of Object.entries(phaseScores)) {
    if (score > bestScore) { bestPhase = phase as InflectionPhase; bestScore = score; }
  }

  // Confidence = how much the winning phase leads the second place
  const sorted = Object.values(phaseScores).sort((a, b) => b - a);
  const confidence = sorted[0] > 0
    ? Math.min(95, Math.round(((sorted[0] - (sorted[1] || 0)) / sorted[0]) * 100 + 30))
    : 20;

  // Phase metadata
  const phaseMetadata: Record<InflectionPhase, Omit<PhaseClassification, 'phase' | 'confidence' | 'transitionSignals'>> = {
    NARRATIVE_EXPANSION: {
      description: 'Story growing, price accelerating, broad participation — ride the trend but tighten stops',
      actionBias: 'HOLD', riskLevel: 'MODERATE',
      nextPhase: 'BUYING_EXHAUSTION',
    },
    BUYING_EXHAUSTION: {
      description: 'Price still rising but momentum fading — reduce exposure, raise stops, take profits',
      actionBias: 'REDUCE', riskLevel: 'HIGH',
      nextPhase: 'NARRATIVE_COLLAPSE',
    },
    NARRATIVE_COLLAPSE: {
      description: 'Story breaking, momentum confirms downside — avoid catching the knife',
      actionBias: 'SHORT', riskLevel: 'EXTREME',
      nextPhase: 'SELLING_EXHAUSTION',
    },
    SELLING_EXHAUSTION: {
      description: 'Sellers exhausted, smart money sniffing — begin building watchlist, pilot positions only',
      actionBias: 'ACCUMULATE', riskLevel: 'HIGH',
      nextPhase: 'INSTITUTIONAL_ACCUMULATION',
    },
    INSTITUTIONAL_ACCUMULATION: {
      description: 'Quiet basing, fundamentals intact, narrative dead — accumulate on weakness',
      actionBias: 'BUY', riskLevel: 'MODERATE',
      nextPhase: 'NARRATIVE_REVERSAL',
    },
    NARRATIVE_REVERSAL: {
      description: 'New narrative emerging, momentum inflecting positive — early position building',
      actionBias: 'BUY', riskLevel: 'LOW',
      nextPhase: 'NARRATIVE_EXPANSION',
    },
  };

  // Transition signals
  const transitions: string[] = [];
  const nextPhase = phaseMetadata[bestPhase].nextPhase;
  const nextScore = phaseScores[nextPhase];
  if (nextScore > bestScore * 0.6) {
    transitions.push(`Approaching ${nextPhase.replace(/_/g, ' ')} (${nextScore}/${bestScore} score ratio)`);
  }

  return {
    phase: bestPhase,
    confidence,
    ...phaseMetadata[bestPhase],
    transitionSignals: transitions,
  };
}


// ============================================================================
// PHASE 7: EXHAUSTION MODELS & TRIGGER SYSTEM
// ============================================================================

export interface ExhaustionScore {
  type: 'BUYING_EXHAUSTION' | 'SELLING_EXHAUSTION';
  points: number;         // cumulative points
  maxPoints: number;
  triggered: boolean;     // true if threshold met
  triggerLabel: string;   // 'SHORT NOW' or 'BUY NOW'
  criteria: Array<{ label: string; met: boolean; points: number }>;
}

// --- Buying Exhaustion → SHORT NOW trigger ---
export function scoreBuyingExhaustion(
  ta: ExtendedTAResult,
  accel: { rocAccel: number | null; trend: string },
  valuation: { pePctile: number | null; peForward: number | null },
): ExhaustionScore {
  const criteria: ExhaustionScore['criteria'] = [];
  let points = 0;
  const maxPoints = 21;

  // RSI > 75 (3 pts)
  const rsiOverbought = ta.rsi14 !== null && ta.rsi14 > 75;
  criteria.push({ label: 'RSI > 75 (extreme overbought)', met: rsiOverbought, points: 3 });
  if (rsiOverbought) points += 3;

  // Negative acceleration while price at highs (3 pts)
  const decelAtHighs = accel.trend === 'decelerating' && ta.highLow !== null && ta.highLow.pctFromHigh > -5;
  criteria.push({ label: 'Decelerating momentum at 52wk highs', met: decelAtHighs, points: 3 });
  if (decelAtHighs) points += 3;

  // Volume exhaustion — buying (2 pts)
  const volExhaust = ta.volume?.volumeExhaustion === 'buying';
  criteria.push({ label: 'Volume buying exhaustion detected', met: !!volExhaust, points: 2 });
  if (volExhaust) points += 2;

  // Green/red volume ratio < 0.8 (2 pts)
  const weakGreenVol = ta.volume !== null && ta.volume!.greenDayVolRatio < 0.8;
  criteria.push({ label: 'Green day volume < red day volume', met: !!weakGreenVol, points: 2 });
  if (weakGreenVol) points += 2;

  // Failed breakout (3 pts)
  const failedBreakout = ta.failedBreaks.some(b => b.type === 'failed_breakout');
  criteria.push({ label: 'Failed breakout above resistance', met: failedBreakout, points: 3 });
  if (failedBreakout) points += 3;

  // PE in top quintile of 5yr range (2 pts)
  const expensivePE = valuation.pePctile !== null && valuation.pePctile > 80;
  criteria.push({ label: 'PE in top 20% of 5yr range', met: !!expensivePE, points: 2 });
  if (expensivePE) points += 2;

  // MACD histogram turning negative (2 pts)
  const macdFlip = ta.macd.histogram !== null && ta.macd.histogram < 0;
  criteria.push({ label: 'MACD histogram turned negative', met: !!macdFlip, points: 2 });
  if (macdFlip) points += 2;

  // Climax volume on up day (2 pts) — blow-off top signal
  const climaxUp = ta.volume?.climaxVolume === true;
  criteria.push({ label: 'Climax volume detected', met: !!climaxUp, points: 2 });
  if (climaxUp) points += 2;

  // Price > 2 ATR above 20 SMA (2 pts) — extended
  const extended = ta.sma20 !== null && ta.atr14 !== null
    && (ta.highLow ? ta.highLow.high52w : 0) > ta.sma20 + 2 * ta.atr14;
  criteria.push({ label: 'Price extended > 2 ATR above 20 SMA', met: !!extended, points: 2 });
  if (extended) points += 2;

  return {
    type: 'BUYING_EXHAUSTION',
    points,
    maxPoints,
    triggered: points >= 12,   // SHORT NOW threshold
    triggerLabel: points >= 12 ? '⚠️ SHORT NOW' : points >= 8 ? '🟡 WATCH — approaching exhaustion' : '',
    criteria,
  };
}

// --- Selling Exhaustion → BUY NOW trigger ---
export function scoreSellingExhaustion(
  ta: ExtendedTAResult,
  accel: { rocAccel: number | null; trend: string },
  valuation: { pePctile: number | null; peForward: number | null; gfValueMargin: number | null },
  fundamental: { piotroskiFScore: number | null },
): ExhaustionScore {
  const criteria: ExhaustionScore['criteria'] = [];
  let points = 0;
  const maxPoints = 23;

  // RSI < 25 (3 pts)
  const rsiOversold = ta.rsi14 !== null && ta.rsi14 < 25;
  criteria.push({ label: 'RSI < 25 (extreme oversold)', met: rsiOversold, points: 3 });
  if (rsiOversold) points += 3;

  // Positive acceleration while price at lows (3 pts)
  const accelAtLows = accel.trend === 'accelerating' && ta.highLow !== null && ta.highLow.pctFromLow < 10;
  criteria.push({ label: 'Accelerating momentum at 52wk lows', met: accelAtLows, points: 3 });
  if (accelAtLows) points += 3;

  // Volume exhaustion — selling (2 pts)
  const volExhaust = ta.volume?.volumeExhaustion === 'selling';
  criteria.push({ label: 'Volume selling exhaustion detected', met: !!volExhaust, points: 2 });
  if (volExhaust) points += 2;

  // Red day volume declining (2 pts)
  const weakRedVol = ta.volume !== null && ta.volume!.greenDayVolRatio > 1.3;
  criteria.push({ label: 'Green day volume > red day volume', met: !!weakRedVol, points: 2 });
  if (weakRedVol) points += 2;

  // Failed breakdown (3 pts)
  const failedBreakdown = ta.failedBreaks.some(b => b.type === 'failed_breakdown');
  criteria.push({ label: 'Failed breakdown below support', met: failedBreakdown, points: 3 });
  if (failedBreakdown) points += 3;

  // PE in bottom quintile of 5yr range (2 pts)
  const cheapPE = valuation.pePctile !== null && valuation.pePctile < 20;
  criteria.push({ label: 'PE in bottom 20% of 5yr range', met: !!cheapPE, points: 2 });
  if (cheapPE) points += 2;

  // GF Value — significantly undervalued (2 pts)
  const undervalued = valuation.gfValueMargin !== null && valuation.gfValueMargin < -15;
  criteria.push({ label: 'GuruFocus Value margin > 15% undervalued', met: !!undervalued, points: 2 });
  if (undervalued) points += 2;

  // MACD histogram turning positive (2 pts)
  const macdFlip = ta.macd.histogram !== null && ta.macd.histogram > 0;
  criteria.push({ label: 'MACD histogram turned positive', met: !!macdFlip, points: 2 });
  if (macdFlip) points += 2;

  // Piotroski F-Score ≥ 7 (2 pts) — fundamentally sound
  const goodFScore = fundamental.piotroskiFScore !== null && fundamental.piotroskiFScore >= 7;
  criteria.push({ label: 'Piotroski F-Score ≥ 7', met: !!goodFScore, points: 2 });
  if (goodFScore) points += 2;

  // Drawdown > 30% from 52wk high (2 pts)
  const deepDrawdown = ta.highLow !== null && ta.highLow.pctFromHigh < -30;
  criteria.push({ label: 'Drawdown > 30% from 52wk high', met: !!deepDrawdown, points: 2 });
  if (deepDrawdown) points += 2;

  return {
    type: 'SELLING_EXHAUSTION',
    points,
    maxPoints,
    triggered: points >= 12,   // BUY NOW threshold
    triggerLabel: points >= 12 ? '🟢 BUY NOW' : points >= 8 ? '🟡 WATCH — approaching inflection' : '',
    criteria,
  };
}


// ============================================================================
// FULL INFLECTION ANALYSIS — Combines everything
// ============================================================================

export interface FullInflectionResult {
  ticker: string;
  name: string;
  // Phase 1+2: Extended TA
  extendedTA: ExtendedTAResult;
  // Phase 5: Pillar Scores
  pillars: PillarScores;
  // Phase 6: Phase Classification
  phase: PhaseClassification;
  // Phase 7: Exhaustion Models
  buyingExhaustion: ExhaustionScore;
  sellingExhaustion: ExhaustionScore;
  // Composite assessment
  overallSignal: 'STRONG_BUY' | 'BUY' | 'ACCUMULATE' | 'HOLD' | 'REDUCE' | 'SELL' | 'STRONG_SELL';
  timestamp: string;
}

export function computeFullInflection(
  ticker: string,
  name: string,
  bars: OHLCVBar[],
  spyCloses: number[] | undefined,
  accelData: { rocAccel: number | null; logAccelSmooth: number | null; emaAccel: number | null; trend: 'accelerating' | 'decelerating' | 'neutral'; recentSignals: any[] },
  fundamentalData: { revenueGrowthYoY: number | null; epsGrowthYoY: number | null; operatingMargin: number | null; netMargin: number | null; roic: number | null; fcfYield: number | null; debtToEquity: number | null; piotroskiFScore: number | null; currentRatio: number | null },
  valuationData: { peForward: number | null; evToEbitda: number | null; pegRatio: number | null; fcfYield: number | null; pePctile: number | null; gfValueMargin: number | null },
  narrativeInput: { manualSentiment?: number; earningsBeatRate?: number | null; insiderNetPct?: number | null; analystRevisionsUp?: number; analystRevisionsDown?: number },
): FullInflectionResult | null {
  // Phase 1+2: Extended TA
  const extTA = computeExtendedTA(ticker, name, bars, spyCloses);
  if (!extTA) return null;

  // Phase 5: Pillar Scores
  const techScore = scoreTechnical(extTA);
  const fundScore = scoreFundamental(fundamentalData);
  const valScore = scoreValuation(valuationData);
  const inflScore = scoreInflection({
    ...accelData,
    recentSignalCount: accelData.recentSignals.length,
    recentSignalType: accelData.recentSignals.length > 0 ? accelData.recentSignals[accelData.recentSignals.length - 1].type : null,
  }, extTA);
  const narrScore = scoreNarrative(narrativeInput);

  const pillars = computePillarScores(techScore, fundScore, valScore, inflScore, narrScore);

  // Phase 6: Classification
  const phase = classifyPhase(pillars, extTA, accelData.trend);

  // Phase 7: Exhaustion
  const buyExh = scoreBuyingExhaustion(extTA, accelData, valuationData);
  const sellExh = scoreSellingExhaustion(extTA, accelData, valuationData, fundamentalData);

  // Overall signal (combines phase + exhaustion + composite score)
  let overallSignal: FullInflectionResult['overallSignal'] = 'HOLD';
  if (buyExh.triggered) overallSignal = 'STRONG_SELL';
  else if (sellExh.triggered) overallSignal = 'STRONG_BUY';
  else if (pillars.composite >= 75) overallSignal = 'BUY';
  else if (pillars.composite >= 60) overallSignal = 'ACCUMULATE';
  else if (pillars.composite <= 25) overallSignal = 'SELL';
  else if (pillars.composite <= 40) overallSignal = 'REDUCE';

  return {
    ticker, name,
    extendedTA: extTA,
    pillars,
    phase,
    buyingExhaustion: buyExh,
    sellingExhaustion: sellExh,
    overallSignal,
    timestamp: new Date().toISOString(),
  };
}

// --- Full Inflection Analysis Endpoint ---
router.post('/full-analysis', (req: Request, res: Response) => {
  const { ticker, name, bars, spyCloses, accelData, fundamentalData, valuationData, narrativeInput } = req.body;

  if (!ticker || !bars || !Array.isArray(bars)) {
    return res.status(400).json({ error: 'Required: ticker, bars[] (OHLCV). Optional: spyCloses[], accelData, fundamentalData, valuationData, narrativeInput' });
  }

  // Defaults for optional data
  const accel = accelData || { rocAccel: null, logAccelSmooth: null, emaAccel: null, trend: 'neutral', recentSignals: [] };
  const fund = fundamentalData || { revenueGrowthYoY: null, epsGrowthYoY: null, operatingMargin: null, netMargin: null, roic: null, fcfYield: null, debtToEquity: null, piotroskiFScore: null, currentRatio: null };
  const val = valuationData || { peForward: null, evToEbitda: null, pegRatio: null, fcfYield: null, pePctile: null, gfValueMargin: null };
  const narr = narrativeInput || {};

  const result = computeFullInflection(ticker, name || ticker, bars, spyCloses, accel, fund, val, narr);
  if (!result) {
    return res.status(400).json({ error: 'Insufficient data for analysis (need 50+ OHLCV bars)' });
  }

  res.json(result);
});


export default router;

