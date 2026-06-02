/**
 * Investment Inflection Engine v10.0 — Smart Money Cycle
 * ======================================================
 * Comprehensive inflection detection framework calibrated to how the BEST
 * investors (Tepper, Druckenmiller) actually trade — not crowd behavior.
 *
 * Smart Money Cycle (v10.0):
 *   BULLISH ARC (Enter → Distribute → Exit):
 *     Phase 1: NARRATIVE_EXPANSION   — New story, smart money enters early (BUY)
 *     Phase 2: INSTITUTIONAL_ACCUMULATION — Crowd piles in, smart money SELLS (DISTRIBUTE)
 *     Phase 3: BUYING_EXHAUSTION     — No marginal buyer, smart money exits (SELL)
 *   BEARISH ARC (Trim → Load → Bottom-fish):
 *     Phase 4: NARRATIVE_REVERSAL    — Story breaks, smart money trims (SELL)
 *     Phase 5: SELLING_EXHAUSTION    — Panic overdone, highest conviction BUY zone
 *     Phase 6: NARRATIVE_COLLAPSE    — Full capitulation, deep value BUY
 *
 * Architecture:
 *   - Phase 1: Extended Technical Indicators (RSI, MACD, ATR, SMAs, relative strength)
 *   - Phase 2: Volume Analysis (green/red ratio, climax, exhaustion)
 *   - Phase 3: Fundamental Data (GuruFocus integration)
 *   - Phase 4: Valuation Scoring (multiples, percentiles)
 *   - Phase 5: Five-Pillar Scoring (0-100 normalization)
 *   - Phase 6: Six-Phase Classification — Smart Money Cycle mapping
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
  sma50Above200: boolean;          // v10.2: structural trend — is 50d above 200d?
  // Momentum
  rsi14: number | null;
  macd: MACDResult;
  macdHistSlope: number | null;    // v10.2: 5-day slope of MACD histogram (rate of change of momentum)
  // v11.0: Time dimension — velocity of the move
  daysSinceCross200d: number | null;  // trading days since price last crossed the 200d MA
  extensionVelocity: number | null;   // extension% per trading day — how fast the move is happening
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

  // v10.2: Structural trend — is 50d above 200d?
  const sma50Above200 = (lastSma50 !== null && lastSma200 !== null) ? lastSma50 > lastSma200 : false;

  // RSI
  const rsi = calcRSI(closes);
  const lastRsi = rsi[rsi.length - 1];

  // MACD
  const macdArr = calcMACD(closes);
  const lastMacd = macdArr[macdArr.length - 1];

  // v10.2: MACD histogram slope — rate of change of momentum over last 5 bars
  // Positive slope = momentum improving, negative slope = momentum fading
  let macdHistSlope: number | null = null;
  if (macdArr.length >= 6) {
    const recent5 = macdArr.slice(-5).map(m => m.histogram);
    if (recent5.every(h => h !== null)) {
      // Linear regression slope of histogram over 5 periods
      const vals = recent5 as number[];
      const n = vals.length;
      const xMean = (n - 1) / 2;  // 0,1,2,3,4 → mean = 2
      let num = 0, den = 0;
      for (let i = 0; i < n; i++) {
        num += (i - xMean) * (vals[i] - vals.reduce((a, b) => a + b, 0) / n);
        den += (i - xMean) * (i - xMean);
      }
      macdHistSlope = den !== 0 ? Math.round((num / den) * 1000) / 1000 : 0;
    }
  }

  // v11.0: Time dimension — how long since the 200d cross, and velocity of extension
  let daysSinceCross200d: number | null = null;
  let extensionVelocity: number | null = null;
  if (sma200.length > 1) {
    // Walk backwards to find the most recent cross of price through the 200d MA
    for (let i = closes.length - 1; i > 0; i--) {
      const smaIdx200 = i - (closes.length - sma200.length);
      const smaIdx200Prev = smaIdx200 - 1;
      if (smaIdx200 < 1 || smaIdx200Prev < 0) break;
      const sma200Val = sma200[smaIdx200];
      const sma200Prev = sma200[smaIdx200Prev];
      if (sma200Val === null || sma200Prev === null) continue;

      const priceAboveNow = closes[i] > sma200Val;
      const priceAbovePrev = closes[i - 1] > sma200Prev;

      if (priceAboveNow !== priceAbovePrev) {
        // Found the crossover point
        daysSinceCross200d = closes.length - 1 - i;
        // Velocity: current extension% divided by days since cross
        if (daysSinceCross200d > 0 && lastSma200 !== null) {
          const currentExtension = ((current - lastSma200) / lastSma200) * 100;
          extensionVelocity = Math.round((currentExtension / daysSinceCross200d) * 1000) / 1000;
        }
        break;
      }
    }
  }

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
    goldenCross, deathCross, sma50Above200,
    rsi14: lastRsi,
    macd: lastMacd,
    macdHistSlope,
    daysSinceCross200d,
    extensionVelocity,
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
// Phases (in lifecycle order — Smart Money Cycle v10.0):
//
// BULLISH ARC (Enter → Distribute → Exit):
//   1. NARRATIVE_EXPANSION  — New story emerging, smart money enters early (BUY)
//   2. INSTITUTIONAL_ACCUMULATION — Crowd piling in, smart money DISTRIBUTES (SELL)
//   3. BUYING_EXHAUSTION    — Everyone's in, no marginal buyer, smart money exits (SELL)
//
// BEARISH ARC (Trim → Load up → Bottom-fish):
//   4. NARRATIVE_REVERSAL   — Story breaks, smart money trims remaining (SELL)
//   5. SELLING_EXHAUSTION   — Panic overdone, smart money loads up (BUY — highest conviction)
//   6. NARRATIVE_COLLAPSE   — Full capitulation, deep value, smart money bottom-fishes (BUY)
//
// KEY TRANSITIONS:
//   Phase 5→1 (Selling Exhaustion → Narrative Expansion) = OPTIMAL ENTRY ZONE
//   Phase 2→3 (Institutional Accumulation → Buying Exhaustion) = EXIT ZONE
//
// Validated by 5-year backtest: Tepper 61.3% aligned, Druckenmiller 59.3% aligned
//

export type InflectionPhase =
  | 'NARRATIVE_EXPANSION'
  | 'BUYING_EXHAUSTION'
  | 'NARRATIVE_COLLAPSE'
  | 'SELLING_EXHAUSTION'
  | 'INSTITUTIONAL_ACCUMULATION'
  | 'NARRATIVE_REVERSAL';

export type AccumulationSubPhase = 'EARLY_STEALTH' | 'LATE_BREAKOUT_IMMINENT';

export interface PhaseClassification {
  phase: InflectionPhase;
  confidence: number;  // 0-100
  description: string;
  actionBias: 'BUY' | 'HOLD' | 'REDUCE' | 'SHORT' | 'ACCUMULATE';
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  nextPhase: InflectionPhase;
  transitionSignals: string[];
  // v10.0: Sub-phase for INSTITUTIONAL_ACCUMULATION (backtest-derived)
  accumulationSubPhase?: AccumulationSubPhase;
  // v10.0: Guru behavior prediction based on 5-year backtest patterns
  guruSignals?: GuruBehaviorPrediction;
}

// ============================================================================
// v10.0: GURU BEHAVIOR PREDICTION MODULE — Smart Money Cycle mapping
// Derived from 5-year backtest of Tepper & Druckenmiller 13-F patterns
// ============================================================================

export interface GuruBehaviorPrediction {
  tepperLikely: 'BUYING' | 'TRIMMING' | 'EXITING' | 'HOLDING' | 'LOADING';
  tepperConfidence: number;  // 0-100
  tepperRationale: string;
  druckLikely: 'BUYING' | 'TRIMMING' | 'ROTATING' | 'HOLDING' | 'BOTTOM_FISHING';
  druckConfidence: number;
  druckRationale: string;
  convergenceScore: number;  // 0-100, how likely both gurus align
  convergenceSignal: string;
}

/**
 * Predict likely guru positioning based on current phase and market conditions.
 *
 * TEPPER PATTERNS (v10.0 Smart Money mapping, 61.3% alignment):
 * - Distributes into institutional demand (56.6% sell rate in INST_ACCUM)
 * - 85.7% sell rate in BUYING_EXHAUSTION — his standout signal
 * - Loads massively in SELLING_EXHAUSTION / early NARRATIVE_EXPANSION
 * - Prefers mega-cap liquid names; avg new position = 2.4% of portfolio
 * - Sectors: Airlines (entered BULL_LATE), China (BEAR contrarian), AI/Semis (BULL trim)
 *
 * DRUCKENMILLER PATTERNS (v10.0, 59.3% alignment):
 * - Distributes into institutional demand (59.2% sell rate in INST_ACCUM)
 * - Extraordinary bottom-fisher in NARRATIVE_COLLAPSE (80% buy rate)
 * - Q4-2022: 47 new positions at bear market bottom
 * - Short holding periods (1-3 quarters typical)
 * - AI/Semis: aggressive rotator, entered early, trimmed fast
 */
export function predictGuruBehavior(
  phase: InflectionPhase,
  pillars: PillarScores,
  ta: ExtendedTAResult,
  accelTrend: 'accelerating' | 'decelerating' | 'neutral',
): GuruBehaviorPrediction {
  let tepperLikely: GuruBehaviorPrediction['tepperLikely'] = 'HOLDING';
  let tepperConf = 40;
  let tepperRat = '';
  let druckLikely: GuruBehaviorPrediction['druckLikely'] = 'HOLDING';
  let druckConf = 40;
  let druckRat = '';

  // --- TEPPER PREDICTION ---
  switch (phase) {
    case 'NARRATIVE_EXPANSION':
      // v10.0: Smart money enters early alongside the narrative (Phase 1 = BUY zone)
      tepperLikely = 'BUYING';
      tepperConf = 60;
      tepperRat = 'Narrative Expansion is the early entry zone — Tepper builds positions alongside the emerging story';
      break;
    case 'INSTITUTIONAL_ACCUMULATION':
      // v10.0: KEY CHANGE — Smart money DISTRIBUTES to crowd (56.6% sell rate)
      tepperLikely = 'TRIMMING';
      tepperConf = 75;
      tepperRat = 'v10.0: Tepper distributes into institutional demand — 56.6% sell rate when crowd is piling in';
      break;
    case 'BUYING_EXHAUSTION':
      // His standout signal: 85.7% sell rate — he exits aggressively here
      tepperLikely = 'EXITING';
      tepperConf = 90;
      tepperRat = 'BUYING_EXHAUSTION is Tepper\'s highest-conviction sell signal (85.7% sell rate — crowd fully loaded)';
      // Boost confidence if valuation is stretched and momentum fading
      if (pillars.valuation < 35 && accelTrend === 'decelerating') tepperConf = 95;
      break;
    case 'NARRATIVE_REVERSAL':
      // v10.0: Smart money trims remaining positions, but watches for contrarian entries
      tepperLikely = 'TRIMMING';
      tepperConf = 60;
      tepperRat = 'Tepper trims remaining positions as story breaks — but makes selective contrarian buys on specific names';
      break;
    case 'SELLING_EXHAUSTION':
      // v10.0: HIGHEST CONVICTION BUY — 73.7% of dollar volume goes to buys
      tepperLikely = 'LOADING';
      tepperConf = 80;
      tepperRat = 'SELLING_EXHAUSTION is the highest-conviction entry — Tepper loads mega-cap positions with maximum conviction';
      break;
    case 'NARRATIVE_COLLAPSE':
      // v10.0: Changed from HOLD_OR_BUY to BUY — deep value territory
      if (pillars.technical < 25 && pillars.valuation > 60) {
        tepperLikely = 'BUYING';
        tepperConf = 65;
        tepperRat = 'Deep collapse with cheap valuations: Tepper starts contrarian accumulation in deep value territory';
      } else {
        tepperLikely = 'HOLDING';
        tepperConf = 50;
        tepperRat = 'Early collapse: Tepper waiting for deeper value before committing capital';
      }
      break;
  }

  // --- DRUCKENMILLER PREDICTION ---
  switch (phase) {
    case 'NARRATIVE_EXPANSION':
      // v10.0: Smart money enters early, Druck rotates into emerging themes
      druckLikely = 'BUYING';
      druckConf = 65;
      druckRat = 'Druckenmiller enters early alongside narrative — high turnover, constantly rotating into next theme';
      break;
    case 'INSTITUTIONAL_ACCUMULATION':
      // v10.0: KEY CHANGE — Druck DISTRIBUTES to crowd (59.2% sell rate)
      druckLikely = 'TRIMMING';
      druckConf = 70;
      druckRat = 'v10.0: Druckenmiller distributes into institutional demand — 59.2% sell rate when crowd accumulates';
      break;
    case 'BUYING_EXHAUSTION':
      // Druck trims but less aggressively than Tepper
      druckLikely = 'TRIMMING';
      druckConf = 65;
      druckRat = 'Druckenmiller reduces exposure — shorter holding periods mean less to unwind (63.2% sell rate)';
      break;
    case 'NARRATIVE_REVERSAL':
      // v10.0: Druck trims remaining, watches for next setup
      druckLikely = 'TRIMMING';
      druckConf = 60;
      druckRat = 'Druckenmiller trims remaining positions as narrative breaks — 57.1% sell rate, preparing for next opportunity';
      break;
    case 'SELLING_EXHAUSTION':
      // Druck's extraordinary bottom-fishing zone
      druckLikely = 'BOTTOM_FISHING';
      druckConf = 80;
      druckRat = 'Druckenmiller\'s highest-conviction zone — cf. Q4-2022 bear market bottom (47 new positions in one quarter)';
      break;
    case 'NARRATIVE_COLLAPSE':
      // v10.0: Changed to BUY — Druck 80% buy rate, deep value territory
      druckLikely = 'BOTTOM_FISHING';
      druckConf = 75;
      druckRat = 'v10.0: Druckenmiller bottom-fishes in collapse — 80% buy rate, deep value territory (cf. Q4-2022)';
      if (pillars.technical < 20 && pillars.valuation > 65) {
        druckConf = 85;
        druckRat += ' — EXTREME value + technical washout = highest conviction bottom-fish signal';
      }
      break;
  }

  // --- CONVERGENCE SCORING ---
  // When both gurus align on direction, signals are much stronger (80% at 5-guru convergence in backtest)
  const tepperBullish = ['BUYING', 'LOADING'].includes(tepperLikely);
  const tepperBearish = ['TRIMMING', 'EXITING'].includes(tepperLikely);
  const druckBullish = ['BUYING', 'BOTTOM_FISHING'].includes(druckLikely);
  const druckBearish = ['TRIMMING'].includes(druckLikely);

  let convergenceScore = 30; // baseline
  let convergenceSignal = 'Gurus divergent — mixed signals';

  if (tepperBullish && druckBullish) {
    convergenceScore = Math.round((tepperConf + druckConf) / 2 * 1.1); // boost for alignment
    convergenceScore = Math.min(convergenceScore, 95);
    convergenceSignal = 'BULLISH CONVERGENCE — Both Tepper & Druckenmiller likely accumulating';
  } else if (tepperBearish && druckBearish) {
    convergenceScore = Math.round((tepperConf + druckConf) / 2 * 1.1);
    convergenceScore = Math.min(convergenceScore, 95);
    convergenceSignal = 'BEARISH CONVERGENCE — Both Tepper & Druckenmiller likely reducing';
  } else if (tepperBullish && druckBearish) {
    convergenceSignal = 'DIVERGENT — Tepper buying while Druckenmiller trimming (Tepper more contrarian)';
  } else if (tepperBearish && druckBullish) {
    convergenceSignal = 'DIVERGENT — Druckenmiller buying while Tepper selling (watch Tepper timing)';
  }

  // v10.0: Special convergence boost in highest-conviction zones
  // SELLING_EXHAUSTION + NARRATIVE_COLLAPSE = both gurus' strongest buy zones
  if (phase === 'SELLING_EXHAUSTION' || phase === 'NARRATIVE_COLLAPSE') {
    if (tepperBullish && druckBullish) {
      convergenceScore = Math.min(convergenceScore + 10, 95);
      convergenceSignal += ' — DEEP VALUE ZONE: historically strongest guru convergence for bottom-fishing';
    }
  }
  // INSTITUTIONAL_ACCUMULATION + BUYING_EXHAUSTION = both gurus' distribution zones
  if (phase === 'INSTITUTIONAL_ACCUMULATION' || phase === 'BUYING_EXHAUSTION') {
    if (tepperBearish && druckBearish) {
      convergenceScore = Math.min(convergenceScore + 10, 95);
      convergenceSignal += ' — DISTRIBUTION ZONE: both gurus historically sell into crowd demand';
    }
  }

  return {
    tepperLikely, tepperConfidence: tepperConf, tepperRationale: tepperRat,
    druckLikely, druckConfidence: druckConf, druckRationale: druckRat,
    convergenceScore, convergenceSignal,
  };
}


// ============================================================================
// v10.2: STRUCTURAL REGIME CLASSIFIER — Druckenmiller Decision-Tree
// ============================================================================
//
// For ETFs/instruments without fundamental data. Classifies regimes using
// structural market conditions in priority order:
//
//   1. TREND STRUCTURE: Price vs 200d MA, 50d vs 200d MA relationship
//   2. MOMENTUM DIRECTION: MACD histogram sign and slope
//   3. CONFIRMATION: Volume, RSI, failed breaks adjust confidence only
//
// Transition rules are explicit structural events (death cross, break below
// 200d, MACD histogram flip) — not score fluctuations from noise.
//
// Phase lifecycle:
//   P1 Expansion → P2 Distribution → P3 Exhaustion →
//   P4 Reversal → P5 Sell Exhaustion → P6 Collapse → P1 ...
//
function classifyPhaseStructural(
  ta: ExtendedTAResult,
  currentPhase?: InflectionPhase,
): PhaseClassification {
  const above200 = ta.priceVsSma200 !== null && ta.priceVsSma200 > 0;
  const above50 = ta.priceVsSma50 !== null && ta.priceVsSma50 > 0;
  const sma50Over200 = ta.sma50Above200;
  const histPositive = ta.macd.histogram !== null && ta.macd.histogram > 0;
  const histExpanding = ta.macdHistSlope !== null && ta.macdHistSlope > 0.05;   // momentum improving
  const histContracting = ta.macdHistSlope !== null && ta.macdHistSlope < -0.05; // momentum fading

  // ── EXTENSION METRICS (volatility-adaptive) ──
  // v11.0 calibration: extension thresholds scaled by instrument volatility.
  // Empirical study of 10yr data shows:
  //   SPY peaks at avg +8.4% (stdev 6.5) — 18% threshold never fires
  //   SMH peaks at avg +22% (stdev 14.3) — 18% fires during normal moves
  //   XLP peaks at avg +7.1% (stdev 4.4) — 18% is absurd for staples
  // Solution: use ATR% as volatility proxy, scale thresholds proportionally.
  const extensionPct = ta.priceVsSma200 !== null ? ta.priceVsSma200 : 0;
  const absExtension = Math.abs(extensionPct);

  // ATR% is the instrument's daily volatility as % of price (already computed)
  // Typical values: SPY ~0.7%, XLP ~0.6%, SMH ~1.5%, XBI ~1.5%, XLE ~1.3%
  // Scale extension bands by atrPct relative to SPY baseline (0.75%)
  const atrPct = ta.atrPct !== null ? ta.atrPct : 0.75;
  const volScale = Math.max(0.5, Math.min(3.0, atrPct / 0.75));  // clamp 0.5x-3x

  // Adaptive thresholds (calibrated from 10yr empirical percentile study):
  //   "Extended" ≈ p85-p90 of historical extension distribution ≈ 1.5σ
  //   "Parabolic" ≈ p95+ ≈ 2.5σ
  //   "Extreme" ≈ p99 ≈ 3.5σ
  // Base thresholds (for SPY-like vol ~0.75% daily ATR):
  const extendedThreshold = 10 * volScale;   // SPY: 10%, SMH: ~20%, XLP: ~8%
  const parabolicThreshold = 17 * volScale;  // SPY: 17%, SMH: ~34%, XLP: ~13%
  const extremeThreshold = 24 * volScale;    // SPY: 24%, SMH: ~48%, XLP: ~19%

  const isParabolic = extensionPct > parabolicThreshold;
  const isExtended = extensionPct > extendedThreshold;
  const isMidTrend = extensionPct > (extendedThreshold * 0.5) && extensionPct <= extendedThreshold;
  const isDeepOversold = extensionPct < -parabolicThreshold;
  const isOversold = extensionPct < -extendedThreshold;

  // RSI extremes
  const rsiOverbought = ta.rsi14 !== null && ta.rsi14 > 75;
  const rsiOverextended = ta.rsi14 !== null && ta.rsi14 > 80;
  const rsiOversold = ta.rsi14 !== null && ta.rsi14 < 30;
  const rsiDeepOversold = ta.rsi14 !== null && ta.rsi14 < 25;

  // ── TIME DIMENSION — velocity of the move ──
  // Empirical calibration: average peak velocity across instruments is ~0.3%/day.
  // Previous thresholds of 1.0/1.5 %/day never fired at actual peaks.
  // Recalibrated from 10yr data at actual reversal points:
  //   Avg peak velocity: 0.25-0.35 %/day (most instruments)
  //   Fast peaks (XBI): 0.5-0.7 %/day
  //   Velocity also scales with instrument volatility
  const velocity = ta.extensionVelocity !== null ? ta.extensionVelocity : 0;
  const absVelocity = Math.abs(velocity);
  const daysSinceCross = ta.daysSinceCross200d;
  const euphoricVelThreshold = 0.5 * volScale;    // ~0.5 for SPY, ~1.0 for SMH
  const aggressiveVelThreshold = 0.35 * volScale;  // ~0.35 for SPY, ~0.7 for SMH
  const isEuphoricVelocity = absVelocity > euphoricVelThreshold;
  const isAggressiveVelocity = absVelocity > aggressiveVelThreshold;
  const isSteadyGrind = absVelocity < 0.15 && daysSinceCross !== null && daysSinceCross > 60;

  // ── HARD OVERRIDES ──
  // Rule 1: Price below 200d MA ALWAYS overrides golden cross for uptrend phases.
  // If price broke below the 200d, you're not in expansion or accumulation, period.
  // The golden cross is a lagging indicator — price leads.
  const priceBelow200 = ta.priceVsSma200 !== null && ta.priceVsSma200 < 0;

  // ── DECISION TREE: determine the "natural" regime from structure ──
  let structuralPhase: InflectionPhase;

  if (priceBelow200 && !sma50Over200 && !histPositive && !histContracting) {
    // Below 200d, bearish MA alignment, steady negative momentum
    structuralPhase = 'NARRATIVE_REVERSAL';  // P4 — confirmed downtrend
  } else if (priceBelow200 && !sma50Over200 && (histContracting || histPositive)) {
    // Below 200d but momentum inflecting (histogram contracting or turning positive)
    structuralPhase = 'SELLING_EXHAUSTION';  // P5 — momentum inflection in downtrend
  } else if (priceBelow200 && sma50Over200) {
    // Price below 200d but 50d still above — structural divergence
    // Could be early breakdown or recovery forming depending on direction
    if (histPositive || histExpanding) {
      structuralPhase = 'SELLING_EXHAUSTION';  // P5 — momentum turning up, recovery building
    } else {
      structuralPhase = 'BUYING_EXHAUSTION';  // P3 — golden cross is lagging, price already broke
    }
  } else if (above200 && sma50Over200 && histPositive) {
    // Full uptrend: price > 200d, 50d > 200d, MACD histogram positive
    // BUT — check extension to differentiate early trend from blow-off.
    // Druckenmiller cares about WHERE you are in the move, not just direction.
    const isExtremeParabolic = extensionPct > extremeThreshold;

    if (isExtremeParabolic) {
      // Beyond 3.5σ — blow-off zone regardless of momentum or velocity
      structuralPhase = 'BUYING_EXHAUSTION';  // P3 — extreme blow-off
    } else if (isParabolic && (rsiOverbought || histContracting || isEuphoricVelocity)) {
      // 30-40% above 200d with overbought RSI, fading momentum, OR arrived too fast
      structuralPhase = 'BUYING_EXHAUSTION';  // P3 — parabolic with warning signs
    } else if (isParabolic) {
      // 30-40% above 200d, momentum strong, arrived at reasonable pace
      structuralPhase = 'INSTITUTIONAL_ACCUMULATION';  // P2 — smart money alert zone
    } else if (isExtended && isEuphoricVelocity) {
      // 18-30% but got here at euphoric speed (>1.5%/day) — this is a rip, not a trend
      // Druckenmiller is suspicious of moves that happen too fast
      structuralPhase = 'BUYING_EXHAUSTION';  // P3 — velocity-driven exhaustion
    } else if (isExtended && rsiOverextended) {
      // 18-30% with RSI >80 — approaching exhaustion
      structuralPhase = 'BUYING_EXHAUSTION';  // P3 — overextended
    } else if (isExtended && histContracting) {
      // 18-30% with momentum fading — distribution starting
      structuralPhase = 'INSTITUTIONAL_ACCUMULATION';  // P2 — smart money distributing
    } else if (isExtended && isAggressiveVelocity) {
      // 18-30% moving fast (>1%/day) but not euphoric yet — distribution alert
      structuralPhase = 'INSTITUTIONAL_ACCUMULATION';  // P2 — fast move, watch closely
    } else if (isExtended) {
      // 18-30% at steady pace with strong momentum — late expansion
      structuralPhase = 'NARRATIVE_EXPANSION';  // P1 — late stage, watch closely
    } else if (isMidTrend && isSteadyGrind) {
      // 8-18% reached via slow steady grind over 60+ days — highest quality P1
      // This is Druckenmiller's favorite: "I like things that have been quietly going up"
      structuralPhase = 'NARRATIVE_EXPANSION';  // P1 — ideal trend
    } else {
      // Fresh to mid-trend with healthy momentum — true expansion
      structuralPhase = 'NARRATIVE_EXPANSION';  // P1
    }
  } else if (above200 && sma50Over200 && !histPositive) {
    // Uptrend but momentum fading: histogram turned negative while still above MAs
    if (isExtended) {
      // Extended AND losing momentum — closer to exhaustion than accumulation
      structuralPhase = 'BUYING_EXHAUSTION';  // P3 — momentum dying on extended move
    } else {
      structuralPhase = 'INSTITUTIONAL_ACCUMULATION';  // P2 — distribution zone
    }
  } else if (above200 && !sma50Over200) {
    // Price above 200d but 50d crossed below — death cross territory
    structuralPhase = 'BUYING_EXHAUSTION';  // P3 — trend structure breaking
  } else {
    // Edge case fallback
    structuralPhase = 'INSTITUTIONAL_ACCUMULATION';
  }

  // ── TRANSITION RULES: structural events required to leave current phase ──
  if (currentPhase && currentPhase !== structuralPhase) {
    const shouldTransition = checkStructuralTransition(currentPhase, structuralPhase, ta);
    if (!shouldTransition) {
      structuralPhase = currentPhase;
    }
  }

  // ── CONFIDENCE from confirmation signals ──
  let confidence = 50;
  const transitions: string[] = [];

  // Velocity commentary (empirically calibrated)
  if (daysSinceCross !== null && above200) {
    if (isEuphoricVelocity) {
      transitions.push(`Euphoric velocity: ${extensionPct.toFixed(0)}% in ${daysSinceCross}d (${absVelocity.toFixed(2)}%/day vs ${euphoricVelThreshold.toFixed(2)} threshold)`);
      confidence -= 10;
    } else if (isAggressiveVelocity) {
      transitions.push(`Fast move: ${extensionPct.toFixed(0)}% in ${daysSinceCross}d (${absVelocity.toFixed(2)}%/day)`);
      confidence -= 5;
    } else if (isSteadyGrind) {
      transitions.push(`Steady grind: ${extensionPct.toFixed(0)}% over ${daysSinceCross}d — high quality trend`);
      confidence += 10;
    } else if (daysSinceCross > 0) {
      transitions.push(`Trend age: ${daysSinceCross}d since 200d cross (${absVelocity.toFixed(2)}%/day)`);
    }
  } else if (daysSinceCross !== null && priceBelow200) {
    if (isEuphoricVelocity) {
      transitions.push(`Rapid decline: ${extensionPct.toFixed(0)}% in ${daysSinceCross}d — capitulation risk`);
      confidence += 5;
    } else if (daysSinceCross > 0) {
      transitions.push(`Below 200d for ${daysSinceCross}d (${absVelocity.toFixed(2)}%/day decline rate)`);
    }
  }

  // Extension commentary (volatility-adaptive thresholds)
  if (above200) {
    if (isParabolic) {
      transitions.push(`Parabolic: ${extensionPct.toFixed(0)}% above 200d (threshold: ${parabolicThreshold.toFixed(0)}%) — blow-off risk`);
      confidence -= 10;
    } else if (isExtended) {
      transitions.push(`Extended: ${extensionPct.toFixed(0)}% above 200d (threshold: ${extendedThreshold.toFixed(0)}%) — late-cycle`);
      confidence -= 5;
    } else if (isMidTrend) {
      transitions.push(`Mid-trend: ${extensionPct.toFixed(0)}% above 200d — healthy extension`);
    } else {
      transitions.push(`Fresh move: ${extensionPct.toFixed(0)}% above 200d — early trend`);
      confidence += 5;
    }
  } else if (priceBelow200) {
    if (isDeepOversold) {
      transitions.push(`Deep oversold: ${extensionPct.toFixed(0)}% below 200d (threshold: ${(-parabolicThreshold).toFixed(0)}%) — capitulation`);
      confidence += 5;
    } else if (isOversold) {
      transitions.push(`Oversold: ${extensionPct.toFixed(0)}% below 200d — mean reversion setup`);
    }
  }

  // Volume confirmation
  if (ta.volume) {
    if (structuralPhase === 'NARRATIVE_EXPANSION') {
      if (ta.volume.greenDayVolRatio > 1.2) { confidence += 10; transitions.push('Volume confirms: green days leading'); }
      if (ta.volume.volumeExhaustion === 'buying') { confidence -= 15; transitions.push('Warning: buying volume exhaustion detected'); }
    }
    if (structuralPhase === 'NARRATIVE_REVERSAL' || structuralPhase === 'SELLING_EXHAUSTION') {
      if (ta.volume.volumeExhaustion === 'selling') { confidence += 10; transitions.push('Selling exhaustion forming in volume'); }
      if (ta.volume.volumeTrend === 'contracting') { confidence += 5; transitions.push('Volume contracting — selling pressure drying up'); }
    }
    if (structuralPhase === 'INSTITUTIONAL_ACCUMULATION') {
      if (ta.volume.volumeTrend === 'contracting') { confidence += 10; transitions.push('Quiet volume confirms distribution/basing'); }
    }
    if (structuralPhase === 'BUYING_EXHAUSTION') {
      if (ta.volume.volumeExhaustion === 'buying') { confidence += 10; transitions.push('Buying volume exhaustion — climax top risk'); }
      if (ta.volume.climaxVolume) { confidence += 5; transitions.push('Volume climax detected — distribution'); }
    }
  }

  // RSI confirmation
  if (ta.rsi14 !== null) {
    if (structuralPhase === 'NARRATIVE_EXPANSION' && ta.rsi14 >= 50 && ta.rsi14 <= 70) confidence += 10;
    if (structuralPhase === 'NARRATIVE_EXPANSION' && ta.rsi14 > 70) { confidence -= 5; transitions.push(`RSI ${ta.rsi14.toFixed(0)} — momentum elevated`); }
    if (structuralPhase === 'BUYING_EXHAUSTION' && rsiOverbought) { confidence += 10; transitions.push(`RSI ${ta.rsi14.toFixed(0)} — overbought confirms exhaustion`); }
    if (structuralPhase === 'BUYING_EXHAUSTION' && rsiOverextended) { confidence += 5; transitions.push(`RSI ${ta.rsi14.toFixed(0)} — extreme overbought`); }
    if (structuralPhase === 'SELLING_EXHAUSTION' && rsiOversold) { confidence += 15; transitions.push(`RSI ${ta.rsi14.toFixed(0)} — deeply oversold inflection zone`); }
    if (structuralPhase === 'NARRATIVE_REVERSAL' && rsiDeepOversold) { confidence += 10; transitions.push(`RSI ${ta.rsi14.toFixed(0)} — extreme oversold, inflection likely`); }
  }

  // 52-week position
  if (ta.highLow) {
    if (structuralPhase === 'NARRATIVE_EXPANSION' && ta.highLow.pctFromHigh > -5) confidence += 5;
    if (structuralPhase === 'NARRATIVE_EXPANSION' && ta.highLow.pctFromHigh < -15) { confidence -= 10; transitions.push('Well off highs — trend quality questionable'); }
    if (structuralPhase === 'NARRATIVE_REVERSAL' && ta.highLow.pctFromHigh < -25) confidence += 5;
    if (structuralPhase === 'SELLING_EXHAUSTION' && ta.highLow.pctFromHigh < -30) { confidence += 10; transitions.push('Deep capitulation — maximum fear zone'); }
  }

  // Failed breaks
  if (ta.failedBreaks.length > 0) {
    const recentFailed = ta.failedBreaks.filter(b => b.day >= ta.failedBreaks[0].day - 10);
    if (recentFailed.some(b => b.type === 'failed_breakout')) {
      if (structuralPhase === 'NARRATIVE_EXPANSION') { confidence -= 10; transitions.push('Failed breakout — potential bull trap'); }
      if (structuralPhase === 'BUYING_EXHAUSTION') { confidence += 10; transitions.push('Failed breakout confirms exhaustion'); }
    }
    if (recentFailed.some(b => b.type === 'failed_breakdown')) {
      if (structuralPhase === 'SELLING_EXHAUSTION') { confidence += 10; transitions.push('Failed breakdown — bears losing control'); }
    }
  }

  // Relative strength vs SPY
  if (ta.rsVsSpy20d !== null) {
    if (Math.abs(ta.rsVsSpy20d) > 5) {
      if (ta.rsVsSpy20d > 5 && (structuralPhase === 'NARRATIVE_EXPANSION' || structuralPhase === 'SELLING_EXHAUSTION')) confidence += 5;
      if (ta.rsVsSpy20d < -5 && (structuralPhase === 'NARRATIVE_REVERSAL' || structuralPhase === 'BUYING_EXHAUSTION')) confidence += 5;
    }
  }

  // Approaching next phase signals
  if (structuralPhase === 'NARRATIVE_EXPANSION' && histContracting) {
    transitions.push('MACD momentum fading — approaching Distribution zone');
  }
  if (structuralPhase === 'INSTITUTIONAL_ACCUMULATION' && ta.deathCross) {
    transitions.push('Death cross imminent — approaching Exhaustion');
  }
  if (structuralPhase === 'NARRATIVE_REVERSAL' && ta.macdHistSlope !== null && ta.macdHistSlope > 0) {
    transitions.push('Momentum decelerating — approaching Sell Exhaustion');
  }
  if (structuralPhase === 'SELLING_EXHAUSTION' && ta.goldenCross) {
    transitions.push('Golden cross forming — approaching Recovery');
  }

  confidence = Math.max(20, Math.min(95, confidence));

  // Phase metadata
  const phaseMetadata: Record<InflectionPhase, Omit<PhaseClassification, 'phase' | 'confidence' | 'transitionSignals'>> = {
    NARRATIVE_EXPANSION: {
      description: 'EARLY/MID UPTREND — Price above 200d with healthy extension, 50d above 200d, positive momentum. Ride the trend.',
      actionBias: 'BUY', riskLevel: 'LOW',
      nextPhase: 'INSTITUTIONAL_ACCUMULATION',
    },
    INSTITUTIONAL_ACCUMULATION: {
      description: 'MOMENTUM FADING — Still above MAs but MACD rolling over or trend extended. Smart money distributes into strength.',
      actionBias: 'REDUCE', riskLevel: 'MODERATE',
      nextPhase: 'BUYING_EXHAUSTION',
    },
    BUYING_EXHAUSTION: {
      description: 'TREND EXHAUSTION — Parabolic extension, death cross forming, or structural breakdown. Exit/hedge zone.',
      actionBias: 'SHORT', riskLevel: 'HIGH',
      nextPhase: 'NARRATIVE_REVERSAL',
    },
    NARRATIVE_REVERSAL: {
      description: 'CONFIRMED DOWNTREND — Below 200d, bearish MA alignment, negative momentum.',
      actionBias: 'REDUCE', riskLevel: 'EXTREME',
      nextPhase: 'SELLING_EXHAUSTION',
    },
    SELLING_EXHAUSTION: {
      description: 'MOMENTUM INFLECTION — Still below 200d but decline decelerating. Smart money starts buying.',
      actionBias: 'ACCUMULATE', riskLevel: 'HIGH',
      nextPhase: 'NARRATIVE_COLLAPSE',
    },
    NARRATIVE_COLLAPSE: {
      description: 'RECOVERY FORMING — Golden cross building, momentum turning. Highest conviction entry zone.',
      actionBias: 'BUY', riskLevel: 'MODERATE',
      nextPhase: 'NARRATIVE_EXPANSION',
    },
  };

  // Sub-phase detection
  let accumulationSubPhase: AccumulationSubPhase | undefined;
  if (structuralPhase === 'INSTITUTIONAL_ACCUMULATION') {
    const isLate = ta.deathCross || (ta.priceVsSma50 !== null && ta.priceVsSma50 < 1)
      || (ta.macdHistSlope !== null && ta.macdHistSlope < -0.1);
    accumulationSubPhase = isLate ? 'LATE_BREAKOUT_IMMINENT' : 'EARLY_STEALTH';
    if (isLate) {
      transitions.push('Distribution entering LATE phase — trend structure weakening');
    }
  }

  const guruSignals = predictGuruBehavior(structuralPhase, { technical: 50, fundamental: 50, valuation: 50, inflection: 50, narrative: 50, composite: 50, weights: { technical: 0.25, fundamental: 0.20, valuation: 0.20, inflection: 0.25, narrative: 0.10 } }, ta, 'neutral');

  return {
    phase: structuralPhase,
    confidence,
    ...phaseMetadata[structuralPhase],
    transitionSignals: transitions,
    accumulationSubPhase,
    guruSignals,
  };
}

// ── Structural transition rules ──
// Returns true if there is a definitive structural event justifying the move
// from currentPhase to newPhase. Without one, the current phase holds.
function checkStructuralTransition(
  current: InflectionPhase,
  proposed: InflectionPhase,
  ta: ExtendedTAResult,
): boolean {
  const above200 = ta.priceVsSma200 !== null && ta.priceVsSma200 > 0;
  const below200 = ta.priceVsSma200 !== null && ta.priceVsSma200 < 0;
  const above50 = ta.priceVsSma50 !== null && ta.priceVsSma50 > 0;
  const histPos = ta.macd.histogram !== null && ta.macd.histogram > 0;
  const histNeg = ta.macd.histogram !== null && ta.macd.histogram < 0;
  const deepBelow200 = ta.priceVsSma200 !== null && ta.priceVsSma200 < -3;  // clearly below, not just touching

  switch (current) {
    case 'NARRATIVE_EXPANSION':
      // P1 → P2: MACD histogram turns negative while still above 200d
      if (proposed === 'INSTITUTIONAL_ACCUMULATION') return histNeg && above200;
      // P1 → P3: 50d crosses below 200d (death cross) — skip P2
      if (proposed === 'BUYING_EXHAUSTION') return ta.deathCross;
      // P1 → P4: price breaks below 200d with negative MACD — rapid deterioration
      if (proposed === 'NARRATIVE_REVERSAL') return below200 && histNeg && !ta.sma50Above200;
      return false;

    case 'INSTITUTIONAL_ACCUMULATION':
      // P2 → P1: MACD histogram turns positive again — momentum recovered
      if (proposed === 'NARRATIVE_EXPANSION') return histPos && above200 && ta.sma50Above200;
      // P2 → P3: death cross fires or price breaks below 200d
      if (proposed === 'BUYING_EXHAUSTION') return ta.deathCross || !ta.sma50Above200;
      // P2 → P4: full breakdown — below 200d, bearish MAs
      if (proposed === 'NARRATIVE_REVERSAL') return deepBelow200 && !ta.sma50Above200 && histNeg;
      return false;

    case 'BUYING_EXHAUSTION':
      // P3 → P4: price closes well below 200d — downtrend confirmed
      if (proposed === 'NARRATIVE_REVERSAL') return deepBelow200 && histNeg;
      // P3 → P2: recovery — price reclaims above 200d, histogram improving
      if (proposed === 'INSTITUTIONAL_ACCUMULATION') return above200 && !ta.deathCross;
      // P3 → P1: strong recovery — full trend restored (rare)
      if (proposed === 'NARRATIVE_EXPANSION') return above200 && ta.sma50Above200 && histPos;
      return false;

    case 'NARRATIVE_REVERSAL':
      // P4 → P5: MACD histogram starts contracting (becoming less negative) or turns positive
      if (proposed === 'SELLING_EXHAUSTION') return (ta.macdHistSlope !== null && ta.macdHistSlope > 0.05) || histPos;
      // P4 → P6: golden cross forming while still below 200d
      if (proposed === 'NARRATIVE_COLLAPSE') return ta.goldenCross || ta.sma50Above200;
      // P4 → P1: V-shaped recovery straight to uptrend (rare but possible)
      if (proposed === 'NARRATIVE_EXPANSION') return above200 && ta.sma50Above200 && histPos;
      return false;

    case 'SELLING_EXHAUSTION':
      // P5 → P6: golden cross fires or 50d crosses above 200d
      if (proposed === 'NARRATIVE_COLLAPSE') return ta.goldenCross || ta.sma50Above200;
      // P5 → P1: strong recovery — price reclaims above 200d with positive momentum
      if (proposed === 'NARRATIVE_EXPANSION') return above200 && ta.sma50Above200 && histPos;
      // P5 → P4: failed bottom — momentum rolls back over negative
      if (proposed === 'NARRATIVE_REVERSAL') return histNeg && (ta.macdHistSlope !== null && ta.macdHistSlope < -0.05);
      return false;

    case 'NARRATIVE_COLLAPSE':
      // P6 → P1: price breaks above 200d — full uptrend restored
      if (proposed === 'NARRATIVE_EXPANSION') return above200 && histPos;
      // P6 → P2: price above 200d but momentum already fading
      if (proposed === 'INSTITUTIONAL_ACCUMULATION') return above200 && histNeg;
      // P6 → P4: golden cross failed, rolls back to downtrend
      if (proposed === 'NARRATIVE_REVERSAL') return !ta.sma50Above200 && histNeg && deepBelow200;
      return false;

    default:
      return true;  // unknown state — allow transition
  }
}


export function classifyPhase(
  pillars: PillarScores,
  ta: ExtendedTAResult,
  accelTrend: 'accelerating' | 'decelerating' | 'neutral',
  currentPhase?: InflectionPhase,
  hasRealFundamentals: boolean = true,
): PhaseClassification {

  // ════════════════════════════════════════════════════════════════════════════
  // v10.2: STRUCTURAL REGIME CLASSIFIER (ETF path)
  // Replaces point-accumulation scoring for instruments without fundamental data.
  //
  // Based on how Druckenmiller reads charts:
  //   1. Trend structure first (price vs 200d, 50d vs 200d)
  //   2. Momentum direction (MACD histogram slope = rate of change of momentum)
  //   3. Confirmation signals adjust confidence, never flip the phase
  //   4. Explicit transition rules — only structural breaks change the regime
  // ════════════════════════════════════════════════════════════════════════════

  if (!hasRealFundamentals) {
    return classifyPhaseStructural(ta, currentPhase);
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ORIGINAL PILLAR-BASED SCORER (stock path — has real fundamental/valuation data)
  // ════════════════════════════════════════════════════════════════════════════
  const { technical, fundamental, valuation, inflection, narrative } = pillars;

  const phaseScores: Record<InflectionPhase, number> = {
    NARRATIVE_EXPANSION: 0,
    BUYING_EXHAUSTION: 0,
    NARRATIVE_COLLAPSE: 0,
    SELLING_EXHAUSTION: 0,
    INSTITUTIONAL_ACCUMULATION: 0,
    NARRATIVE_REVERSAL: 0,
  };

  // --- NARRATIVE EXPANSION ---
  if (technical > 65) phaseScores.NARRATIVE_EXPANSION += 20;
  if (narrative > 65) phaseScores.NARRATIVE_EXPANSION += 20;
  if (accelTrend === 'accelerating') phaseScores.NARRATIVE_EXPANSION += 20;
  if (valuation < 40) phaseScores.NARRATIVE_EXPANSION += 10;
  if (ta.rsi14 !== null && ta.rsi14 > 60) phaseScores.NARRATIVE_EXPANSION += 15;
  if (ta.highLow && ta.highLow.pctFromHigh > -5) phaseScores.NARRATIVE_EXPANSION += 15;

  // --- BUYING EXHAUSTION ---
  if (technical > 55 && inflection < 40) phaseScores.BUYING_EXHAUSTION += 25;
  if (accelTrend === 'decelerating') phaseScores.BUYING_EXHAUSTION += 20;
  if (ta.volume?.volumeExhaustion === 'buying') phaseScores.BUYING_EXHAUSTION += 20;
  if (ta.volume?.greenDayVolRatio !== undefined && ta.volume.greenDayVolRatio < 0.7) phaseScores.BUYING_EXHAUSTION += 15;
  if (ta.rsi14 !== null && ta.rsi14 > 70) phaseScores.BUYING_EXHAUSTION += 10;
  if (valuation < 35) phaseScores.BUYING_EXHAUSTION += 10;
  if (valuation < 30 && narrative > 70) phaseScores.BUYING_EXHAUSTION += 12;
  if (technical > 60 && inflection < 40 && valuation < 40) phaseScores.BUYING_EXHAUSTION += 8;

  // --- NARRATIVE COLLAPSE ---
  if (technical < 30) phaseScores.NARRATIVE_COLLAPSE += 20;
  if (narrative < 40) phaseScores.NARRATIVE_COLLAPSE += 15;
  if (accelTrend === 'decelerating') phaseScores.NARRATIVE_COLLAPSE += 15;
  if (inflection < 30) phaseScores.NARRATIVE_COLLAPSE += 15;
  if (ta.deathCross) phaseScores.NARRATIVE_COLLAPSE += 20;
  if (ta.highLow && ta.highLow.pctFromHigh < -25) phaseScores.NARRATIVE_COLLAPSE += 10;
  if (ta.rsi14 !== null && ta.rsi14 < 35) phaseScores.NARRATIVE_COLLAPSE += 10;

  // --- SELLING EXHAUSTION ---
  if (technical < 35 && inflection > 55) phaseScores.SELLING_EXHAUSTION += 25;
  if (accelTrend === 'accelerating' && technical < 40) phaseScores.SELLING_EXHAUSTION += 20;
  if (ta.volume?.volumeExhaustion === 'selling') phaseScores.SELLING_EXHAUSTION += 20;
  if (ta.rsi14 !== null && ta.rsi14 < 30) phaseScores.SELLING_EXHAUSTION += 15;
  if (valuation > 65) phaseScores.SELLING_EXHAUSTION += 10;
  if (ta.failedBreaks.some(b => b.type === 'failed_breakdown')) phaseScores.SELLING_EXHAUSTION += 10;
  if (valuation > 70 && fundamental > 55) phaseScores.SELLING_EXHAUSTION += 10;
  if (technical < 25 && accelTrend === 'accelerating') phaseScores.SELLING_EXHAUSTION += 8;

  // --- INSTITUTIONAL ACCUMULATION ---
  if (technical >= 40 && technical <= 55) phaseScores.INSTITUTIONAL_ACCUMULATION += 15;
  if (fundamental > 55) phaseScores.INSTITUTIONAL_ACCUMULATION += 15;
  if (narrative < 45) phaseScores.INSTITUTIONAL_ACCUMULATION += 10;
  if (ta.volume?.volumeTrend === 'contracting') phaseScores.INSTITUTIONAL_ACCUMULATION += 15;
  if (ta.atrPct !== null && ta.atrPct < 2) phaseScores.INSTITUTIONAL_ACCUMULATION += 10;
  if (valuation > 55) phaseScores.INSTITUTIONAL_ACCUMULATION += 15;
  if (inflection >= 45 && inflection <= 55) phaseScores.INSTITUTIONAL_ACCUMULATION += 10;

  // --- NARRATIVE REVERSAL ---
  if (inflection > 60) phaseScores.NARRATIVE_REVERSAL += 20;
  if (accelTrend === 'accelerating') phaseScores.NARRATIVE_REVERSAL += 20;
  if (technical > 45 && technical < 65) phaseScores.NARRATIVE_REVERSAL += 15;
  if (narrative > 50 && narrative < 70) phaseScores.NARRATIVE_REVERSAL += 10;
  if (ta.goldenCross) phaseScores.NARRATIVE_REVERSAL += 20;
  if (ta.volume?.greenDayVolRatio !== undefined && ta.volume.greenDayVolRatio > 1.3) phaseScores.NARRATIVE_REVERSAL += 10;
  if (ta.failedBreaks.some(b => b.type === 'failed_breakdown')) phaseScores.NARRATIVE_REVERSAL += 10;

  let bestPhase: InflectionPhase = 'NARRATIVE_EXPANSION';
  let bestScore = 0;
  for (const [phase, score] of Object.entries(phaseScores)) {
    if (score > bestScore) { bestPhase = phase as InflectionPhase; bestScore = score; }
  }

  // Hysteresis for stock path too
  const HYSTERESIS_MARGIN = 15;
  if (currentPhase && currentPhase !== bestPhase) {
    const currentScore = phaseScores[currentPhase];
    if (bestScore - currentScore < HYSTERESIS_MARGIN) {
      bestPhase = currentPhase;
      bestScore = currentScore;
    }
  }

  const sorted = Object.values(phaseScores).sort((a, b) => b - a);
  const confidence = sorted[0] > 0
    ? Math.min(95, Math.round(((sorted[0] - (sorted[1] || 0)) / sorted[0]) * 100 + 30))
    : 20;

  // Phase metadata
  // v10.0: Smart Money Cycle — action biases reflect what the BEST investors do, not the crowd
  const phaseMetadata: Record<InflectionPhase, Omit<PhaseClassification, 'phase' | 'confidence' | 'transitionSignals'>> = {
    NARRATIVE_EXPANSION: {
      description: 'ENTRY ZONE — New story emerging, smart money enters early alongside the narrative',
      actionBias: 'BUY', riskLevel: 'MODERATE',
      nextPhase: 'INSTITUTIONAL_ACCUMULATION',
    },
    INSTITUTIONAL_ACCUMULATION: {
      description: 'DISTRIBUTION ZONE — Crowd piling in, smart money sells to them. If you own it, start taking profits',
      actionBias: 'REDUCE', riskLevel: 'MODERATE',
      nextPhase: 'BUYING_EXHAUSTION',
    },
    BUYING_EXHAUSTION: {
      description: 'EXIT ZONE — Everyone is in, no marginal buyer left. Smart money exits aggressively',
      actionBias: 'SHORT', riskLevel: 'HIGH',
      nextPhase: 'NARRATIVE_REVERSAL',
    },
    NARRATIVE_REVERSAL: {
      description: 'Story breaking, smart money trims remaining. Watch for selective contrarian entries on specific names',
      actionBias: 'REDUCE', riskLevel: 'EXTREME',
      nextPhase: 'SELLING_EXHAUSTION',
    },
    SELLING_EXHAUSTION: {
      description: 'STRONG ENTRY — Panic selling overdone. Highest conviction buy zone. This is where the best returns start',
      actionBias: 'ACCUMULATE', riskLevel: 'HIGH',
      nextPhase: 'NARRATIVE_COLLAPSE',
    },
    NARRATIVE_COLLAPSE: {
      description: 'DEEP VALUE ENTRY — Full capitulation, narrative dead. Maximum fear = maximum opportunity',
      actionBias: 'BUY', riskLevel: 'EXTREME',
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

  // v10.0: Institutional Accumulation sub-phase detection
  // INSTITUTIONAL_ACCUMULATION is a DISTRIBUTION phase — smart money sells into crowd demand
  // Sub-phases help time the distribution: EARLY = start trimming, LATE = accelerate exits
  let accumulationSubPhase: AccumulationSubPhase | undefined;
  if (bestPhase === 'INSTITUTIONAL_ACCUMULATION') {
    // LATE_BREAKOUT_IMMINENT: volume expanding, inflection rising, narrative heating up
    // = crowd frenzy peaking, smart money should be nearly done distributing
    const isLate = (inflection > 52) ||
      (ta.volume?.volumeTrend === 'expanding') ||
      (ta.goldenCross) ||
      (narrative > 48);
    accumulationSubPhase = isLate ? 'LATE_BREAKOUT_IMMINENT' : 'EARLY_STEALTH';
    if (isLate) {
      transitions.push('Accumulation entering LATE phase — crowd euphoria peaking, accelerate distribution before exhaustion sets in');
    } else {
      transitions.push('Accumulation in EARLY phase — institutions arriving, begin trimming into rising demand');
    }
  }

  // v10.0: Guru behavior prediction
  const guruSignals = predictGuruBehavior(bestPhase, pillars, ta, accelTrend);

  return {
    phase: bestPhase,
    confidence,
    ...phaseMetadata[bestPhase],
    transitionSignals: transitions,
    accumulationSubPhase,
    guruSignals,
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
  currentPhase?: InflectionPhase,  // v10.1: previous phase for hysteresis
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

  // v10.1: Detect if we have real fundamental/valuation data or just null defaults
  const hasRealFundamentals = Object.values(fundamentalData).some(v => v !== null)
    || Object.values(valuationData).some(v => v !== null);

  // Phase 6: Classification (with hysteresis from previous phase)
  const phase = classifyPhase(pillars, extTA, accelData.trend, currentPhase, hasRealFundamentals);

  // Phase 7: Exhaustion
  const buyExh = scoreBuyingExhaustion(extTA, accelData, valuationData);
  const sellExh = scoreSellingExhaustion(extTA, accelData, valuationData, fundamentalData);

  // Overall signal (combines phase + exhaustion + composite score)
  // v10.0: Guru convergence can boost/dampen signals
  let overallSignal: FullInflectionResult['overallSignal'] = 'HOLD';
  if (buyExh.triggered) overallSignal = 'STRONG_SELL';
  else if (sellExh.triggered) overallSignal = 'STRONG_BUY';
  else if (pillars.composite >= 75) overallSignal = 'BUY';
  else if (pillars.composite >= 60) overallSignal = 'ACCUMULATE';
  else if (pillars.composite <= 25) overallSignal = 'SELL';
  else if (pillars.composite <= 40) overallSignal = 'REDUCE';

  // v10.0: If guru convergence is strong and aligns with signal, boost confidence
  if (phase.guruSignals && phase.guruSignals.convergenceScore >= 70) {
    const guruBullish = phase.guruSignals.convergenceSignal.includes('BULLISH');
    const guruBearish = phase.guruSignals.convergenceSignal.includes('BEARISH');
    // Upgrade ACCUMULATE→BUY if gurus converge bullish
    if (guruBullish && overallSignal === 'ACCUMULATE') overallSignal = 'BUY';
    // Upgrade REDUCE→SELL if gurus converge bearish
    if (guruBearish && overallSignal === 'REDUCE') overallSignal = 'SELL';
  }

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

