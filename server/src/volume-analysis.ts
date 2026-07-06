// ═══════════════════════════════════════════════════════════════════
// INSTITUTIONAL VOLUME BREAKDOWN — Burry-Informed Shareholder Turnover
// ═══════════════════════════════════════════════════════════════════
// Primary metric: Shareholder Turnover (cumulative volume / shares outstanding)
// Phase-aware interpretation: distribution vs absorption vs bottoming
// Informed by Michael Burry's volume analysis philosophy from Substack
// ═══════════════════════════════════════════════════════════════════

import YahooFinance from 'yahoo-finance2';

// ── TYPES ──

export interface OHLCVBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface VolumeBreakdownResult {
  symbol: string;
  price: number;

  // Share structure
  sharesOutstanding: number | null;
  floatShares: number | null;

  // Peak & decline detection
  peak: {
    date: string;
    price: number;
    declineFromPeak: number;     // pct, negative
    daysSincePeak: number;
  } | null;

  // PRIMARY: Shareholder Turnover (Burry's key metric)
  shareholderTurnover: {
    cumVolumeSincePeak: number;     // total shares traded since peak
    turnoverPct: number;            // cumVol / sharesOutstanding * 100
    turnoverLabel: string;          // "Early Rotation" | "Progressing" | "Rotation Complete"
    floatTurnoverPct: number | null; // cumVol / float * 100 (secondary)
  } | null;

  // Volume character analysis
  volumeCharacter: {
    avgDailyVolume20d: number;
    avgDailyVolume50d: number;
    volumeVs50dAvg: number;         // current 20d avg / 50d avg — >1 = elevated
    recentVolumeSpikes: VolumeSpike[];
    sustainedElevatedDays: number;  // consecutive days of above-avg volume
    volumeTrend: 'rising' | 'falling' | 'stable';
  } | null;

  // Phase-aware interpretation
  pricePhase: 'ACTIVE_DECLINE' | 'STABILIZING' | 'RECOVERING' | 'NEW_HIGHS' | 'NO_DECLINE';
  interpretation: {
    signal: 'DISTRIBUTION' | 'CAPITULATION' | 'ABSORPTION' | 'BOTTOMING' | 'NEUTRAL' | 'UNKNOWN';
    confidence: 'HIGH' | 'MEDIUM' | 'LOW';
    narrative: string;
  };

  // Volume-Confirmed Entry signal (Burry's DCA override)
  volumeConfirmedEntry: {
    triggered: boolean;
    reason: string;
  };

  // Abnormal volume events
  abnormalEvents: AbnormalVolumeEvent[];
}

export interface VolumeSpike {
  date: string;
  volume: number;
  volumeVsAvg: number;    // multiple of 50d avg
  priceChange: number;     // pct
  type: 'CLIMAX_UP' | 'CLIMAX_DOWN' | 'EXPANSION' | 'EXHAUSTION';
}

export interface AbnormalVolumeEvent {
  date: string;
  volume: number;
  volumeVsAvg: number;
  priceChange: number;
  classification: string;
}

// ── YAHOO FINANCE INITIALIZATION ──

let yahooFinance: any;
try {
  yahooFinance = new (YahooFinance as any)({ suppressNotices: ['yahooSurvey'] });
} catch {
  try {
    yahooFinance = new (YahooFinance as any)();
  } catch {
    yahooFinance = new (YahooFinance as any)({});
  }
}

// ── SHARE STRUCTURE CACHE ──
// Cache shares outstanding / float for 24 hours
interface ShareStructure {
  sharesOutstanding: number | null;
  floatShares: number | null;
  fetchedAt: number;
}

const shareStructureCache: Map<string, ShareStructure> = new Map();
const SHARE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function getShareStructureFromGF(symbol: string): Promise<{ sharesOutstanding: number | null; floatShares: number | null }> {
  const GF_API_KEY = process.env.GURUFOCUS_API_KEY || '026d8ee9d10c778c6656d672b5ff1e71:544e1fff1953fece457d6152f3239e74';
  try {
    const resp = await fetch(`https://api.gurufocus.com/public/user/${GF_API_KEY}/stock/${symbol}/summary`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) return { sharesOutstanding: null, floatShares: null };
    const data = await resp.json() as any;
    const cd = data?.summary?.company_data;
    if (!cd) return { sharesOutstanding: null, floatShares: null };

    // GuruFocus returns shares in millions — convert to actual count
    const soMillions = parseFloat(cd.shareso || cd.shares || '0');
    const flMillions = parseFloat(cd.float || '0');
    const so = soMillions > 0 ? Math.round(soMillions * 1e6) : null;
    const fl = flMillions > 0 ? Math.round(flMillions * 1e6) : null;

    console.log(`[VOL] GuruFocus share structure for ${symbol}: SO=${so ? (so / 1e6).toFixed(1) + 'M' : 'null'}, Float=${fl ? (fl / 1e6).toFixed(1) + 'M' : 'null'}`);
    return { sharesOutstanding: so, floatShares: fl };
  } catch (err: any) {
    console.error(`[VOL] GuruFocus share fallback failed for ${symbol}: ${err?.message?.slice(0, 60)}`);
    return { sharesOutstanding: null, floatShares: null };
  }
}

async function getShareStructure(symbol: string): Promise<{ sharesOutstanding: number | null; floatShares: number | null }> {
  // Check cache
  const cached = shareStructureCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < SHARE_CACHE_TTL) {
    return { sharesOutstanding: cached.sharesOutstanding, floatShares: cached.floatShares };
  }

  // GuruFocus first (works reliably from cloud), Yahoo as fallback
  let so: number | null = null;
  let fl: number | null = null;

  const gf = await getShareStructureFromGF(symbol);
  if (gf.sharesOutstanding) {
    so = gf.sharesOutstanding;
    fl = gf.floatShares;
  }

  // Try Yahoo only if GuruFocus failed (rare)
  if (!so) {
    try {
      const q = await Promise.race([
        yahooFinance.quoteSummary(symbol, { modules: ['defaultKeyStatistics'] }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000)),
      ]) as any;
      so = q?.defaultKeyStatistics?.sharesOutstanding || null;
      fl = q?.defaultKeyStatistics?.floatShares || fl;
      if (so) console.log(`[VOL] Yahoo share structure for ${symbol}: SO=${(so / 1e6).toFixed(1)}M`);
    } catch (_) { /* Yahoo fails on cloud — expected */ }
  }

  if (so) {
    shareStructureCache.set(symbol, {
      sharesOutstanding: so,
      floatShares: fl,
      fetchedAt: Date.now(),
    });
  } else {
    // Return cached even if stale
    if (cached) return { sharesOutstanding: cached.sharesOutstanding, floatShares: cached.floatShares };
  }

  return { sharesOutstanding: so, floatShares: fl };
}

// ── PEAK DETECTION ──
// Find the highest price point in the bar history and measure decline from it

function detectPeak(bars: OHLCVBar[]): {
  peakIdx: number;
  peakDate: string;
  peakPrice: number;
  currentPrice: number;
  declinePct: number;
  daysSincePeak: number;
} | null {
  if (bars.length < 20) return null;

  let peakIdx = 0;
  let peakPrice = bars[0].high;

  for (let i = 1; i < bars.length; i++) {
    if (bars[i].high > peakPrice) {
      peakPrice = bars[i].high;
      peakIdx = i;
    }
  }

  const currentPrice = bars[bars.length - 1].close;
  const declinePct = ((currentPrice - peakPrice) / peakPrice) * 100;
  const daysSincePeak = bars.length - 1 - peakIdx;

  return {
    peakIdx,
    peakDate: bars[peakIdx].date,
    peakPrice,
    currentPrice,
    declinePct,
    daysSincePeak,
  };
}

// ── CUMULATIVE VOLUME SINCE PEAK ──
// Sum all volume from peak date to present

function computeCumulativeVolume(bars: OHLCVBar[], peakIdx: number): number {
  let cum = 0;
  for (let i = peakIdx; i < bars.length; i++) {
    cum += bars[i].volume;
  }
  return cum;
}

// ── PRICE PHASE DETECTION ──
// Determines if we're in active decline, stabilizing, or recovering

function detectPricePhase(bars: OHLCVBar[], peakInfo: { peakIdx: number; declinePct: number }):
  'ACTIVE_DECLINE' | 'STABILIZING' | 'RECOVERING' | 'NEW_HIGHS' | 'NO_DECLINE' {

  if (peakInfo.declinePct > -10) return 'NO_DECLINE';

  const recentBars = bars.slice(-30); // last 30 trading days
  if (recentBars.length < 10) return 'ACTIVE_DECLINE';

  // Check if price is near its peak (within 5%)
  const lastPrice = bars[bars.length - 1].close;
  const peakPrice = bars[peakInfo.peakIdx].high;
  if (lastPrice / peakPrice > 0.95) return 'NEW_HIGHS';

  // Check recent 30-day trend
  const recent30dReturn = (recentBars[recentBars.length - 1].close - recentBars[0].close) / recentBars[0].close;

  // Check price range compression (stabilizing = tighter range)
  const highs = recentBars.map(b => b.high);
  const lows = recentBars.map(b => b.low);
  const rangeWidth = (Math.max(...highs) - Math.min(...lows)) / lastPrice;

  // Check if we're still making lower lows
  const midpoint = Math.floor(recentBars.length / 2);
  const firstHalfLow = Math.min(...recentBars.slice(0, midpoint).map(b => b.low));
  const secondHalfLow = Math.min(...recentBars.slice(midpoint).map(b => b.low));
  const makingLowerLows = secondHalfLow < firstHalfLow * 0.98; // 2% tolerance

  if (makingLowerLows && recent30dReturn < -0.05) return 'ACTIVE_DECLINE';
  if (recent30dReturn > 0.10) return 'RECOVERING';
  if (rangeWidth < 0.12 && !makingLowerLows) return 'STABILIZING';
  if (recent30dReturn > 0.02 && !makingLowerLows) return 'RECOVERING';
  if (recent30dReturn < -0.03) return 'ACTIVE_DECLINE';

  return 'STABILIZING';
}

// ── VOLUME CHARACTER ANALYSIS ──

function analyzeVolumeCharacter(bars: OHLCVBar[]): {
  avgDailyVolume20d: number;
  avgDailyVolume50d: number;
  volumeVs50dAvg: number;
  recentVolumeSpikes: VolumeSpike[];
  sustainedElevatedDays: number;
  volumeTrend: 'rising' | 'falling' | 'stable';
} | null {
  if (bars.length < 60) return null;

  const volBars = bars.filter(b => b.volume > 0);
  if (volBars.length < 60) return null;

  // 20d and 50d average volume
  const last20 = volBars.slice(-20);
  const last50 = volBars.slice(-50);
  const avg20d = last20.reduce((s, b) => s + b.volume, 0) / last20.length;
  const avg50d = last50.reduce((s, b) => s + b.volume, 0) / last50.length;

  // Volume relative to 50d average
  const volumeVs50dAvg = avg20d / avg50d;

  // Find volume spikes (>2x 50d average) in last 90 days
  const spikes: VolumeSpike[] = [];
  const lookback = Math.min(90, volBars.length);
  for (let i = volBars.length - lookback; i < volBars.length; i++) {
    const bar = volBars[i];
    const volMultiple = bar.volume / avg50d;
    if (volMultiple >= 2.0) {
      const priceChange = ((bar.close - bar.open) / bar.open) * 100;
      let type: VolumeSpike['type'] = 'EXPANSION';
      if (priceChange < -3 && volMultiple >= 2.5) type = 'CLIMAX_DOWN';
      else if (priceChange > 3 && volMultiple >= 2.5) type = 'CLIMAX_UP';
      else if (Math.abs(priceChange) < 1 && volMultiple >= 2.0) type = 'EXHAUSTION';

      spikes.push({
        date: bar.date,
        volume: bar.volume,
        volumeVsAvg: Math.round(volMultiple * 10) / 10,
        priceChange: Math.round(priceChange * 100) / 100,
        type,
      });
    }
  }

  // Sustained elevated volume: count consecutive recent days where volume > 1.3x 50d avg
  let sustainedDays = 0;
  for (let i = volBars.length - 1; i >= 0; i--) {
    if (volBars[i].volume > avg50d * 1.3) {
      sustainedDays++;
    } else {
      break;
    }
  }

  // Volume trend: compare first half of last 50 days vs second half
  const first25 = last50.slice(0, 25);
  const second25 = last50.slice(25);
  const avgFirst = first25.reduce((s, b) => s + b.volume, 0) / first25.length;
  const avgSecond = second25.reduce((s, b) => s + b.volume, 0) / second25.length;
  const trendRatio = avgSecond / avgFirst;
  let volumeTrend: 'rising' | 'falling' | 'stable' = 'stable';
  if (trendRatio > 1.15) volumeTrend = 'rising';
  else if (trendRatio < 0.85) volumeTrend = 'falling';

  return {
    avgDailyVolume20d: Math.round(avg20d),
    avgDailyVolume50d: Math.round(avg50d),
    volumeVs50dAvg: Math.round(volumeVs50dAvg * 100) / 100,
    recentVolumeSpikes: spikes.slice(-5), // keep last 5
    sustainedElevatedDays: sustainedDays,
    volumeTrend,
  };
}

// ── ABNORMAL VOLUME EVENTS ──

function findAbnormalVolumeEvents(bars: OHLCVBar[], peakIdx: number): AbnormalVolumeEvent[] {
  if (bars.length < 60) return [];

  // Use 50d rolling average for baseline
  const events: AbnormalVolumeEvent[] = [];

  for (let i = Math.max(peakIdx, 50); i < bars.length; i++) {
    // Compute 50d average ending the day before
    const lookback = bars.slice(Math.max(0, i - 50), i);
    const volBars = lookback.filter(b => b.volume > 0);
    if (volBars.length < 20) continue;

    const avg = volBars.reduce((s, b) => s + b.volume, 0) / volBars.length;
    const bar = bars[i];
    const multiple = bar.volume / avg;

    if (multiple >= 3.0) {
      const priceChange = ((bar.close - bar.open) / bar.open) * 100;
      let classification = 'HIGH_VOLUME_EVENT';

      if (priceChange < -5) classification = 'PANIC_SELLING';
      else if (priceChange < -2) classification = 'DISTRIBUTION_DAY';
      else if (priceChange > 5) classification = 'INSTITUTIONAL_BUY';
      else if (priceChange > 2) classification = 'ACCUMULATION_DAY';
      else if (Math.abs(priceChange) < 1) classification = 'CHURNING';

      events.push({
        date: bar.date,
        volume: bar.volume,
        volumeVsAvg: Math.round(multiple * 10) / 10,
        priceChange: Math.round(priceChange * 100) / 100,
        classification,
      });
    }
  }

  return events.slice(-10); // keep last 10
}

// ── PHASE-AWARE INTERPRETATION ──
// This is the critical nuance from Burry: same volume means different things
// in different price phases

function interpretVolume(
  pricePhase: string,
  turnoverPct: number | null,
  volumeChar: ReturnType<typeof analyzeVolumeCharacter>,
  abnormalEvents: AbnormalVolumeEvent[],
  declinePct: number,
): { signal: VolumeBreakdownResult['interpretation']['signal']; confidence: 'HIGH' | 'MEDIUM' | 'LOW'; narrative: string } {

  if (!turnoverPct || !volumeChar) {
    return { signal: 'UNKNOWN', confidence: 'LOW', narrative: 'Insufficient data for volume interpretation.' };
  }

  if (pricePhase === 'NO_DECLINE' || pricePhase === 'NEW_HIGHS') {
    return {
      signal: 'NEUTRAL',
      confidence: 'MEDIUM',
      narrative: `Stock is near highs — no significant decline to analyze for shareholder rotation. Turnover at ${turnoverPct.toFixed(0)}% is normal trading activity.`,
    };
  }

  // Count distribution vs accumulation events
  const distDays = abnormalEvents.filter(e => e.classification === 'DISTRIBUTION_DAY' || e.classification === 'PANIC_SELLING').length;
  const accumDays = abnormalEvents.filter(e => e.classification === 'ACCUMULATION_DAY' || e.classification === 'INSTITUTIONAL_BUY').length;

  if (pricePhase === 'ACTIVE_DECLINE') {
    // During active decline, high volume = distribution or capitulation
    if (volumeChar.volumeVs50dAvg > 1.5 && distDays > accumDays) {
      return {
        signal: 'DISTRIBUTION',
        confidence: 'HIGH',
        narrative: `Active decline with heavy volume (${volumeChar.volumeVs50dAvg.toFixed(1)}x 50d avg). Stock is down ${Math.abs(declinePct).toFixed(0)}% from peak with ${turnoverPct.toFixed(0)}% shareholder turnover. Volume character suggests institutional distribution — sellers are active. ${distDays} distribution days vs ${accumDays} accumulation days in recent abnormal events.`,
      };
    }
    if (volumeChar.volumeVs50dAvg > 2.0) {
      return {
        signal: 'CAPITULATION',
        confidence: 'MEDIUM',
        narrative: `Extreme volume during active decline (${volumeChar.volumeVs50dAvg.toFixed(1)}x 50d avg) may signal capitulation. Stock is down ${Math.abs(declinePct).toFixed(0)}% with ${turnoverPct.toFixed(0)}% turnover. If volume begins to contract after this spike, it could mark a selling climax.`,
      };
    }
    return {
      signal: 'DISTRIBUTION',
      confidence: 'MEDIUM',
      narrative: `Stock in active decline, down ${Math.abs(declinePct).toFixed(0)}% from peak. Shareholder turnover at ${turnoverPct.toFixed(0)}% — the shareholder base has not yet fully rotated. Volume trend is ${volumeChar.volumeTrend}.`,
    };
  }

  if (pricePhase === 'STABILIZING') {
    // This is Burry's key insight: elevated volume during stabilization = bottoming
    if (turnoverPct >= 200) {
      return {
        signal: 'BOTTOMING',
        confidence: 'HIGH',
        narrative: `Price stabilizing after ${Math.abs(declinePct).toFixed(0)}% decline with ${turnoverPct.toFixed(0)}% shareholder turnover — the entire shareholder base has rotated more than twice. Per Burry's framework, new owners at lower prices are likely "steadier hands" without the psychological trauma of the decline. Volume is ${volumeChar.volumeTrend === 'rising' ? 'still rising' : volumeChar.volumeVs50dAvg > 1.2 ? 'elevated' : 'normalizing'}. ${accumDays > distDays ? 'Accumulation days outnumber distribution days — institutional buying detected.' : ''}`,
      };
    }
    if (turnoverPct >= 100) {
      return {
        signal: 'ABSORPTION',
        confidence: 'MEDIUM',
        narrative: `Price stabilizing with ${turnoverPct.toFixed(0)}% turnover — the full shareholder base has turned over once but rotation is still progressing. Down ${Math.abs(declinePct).toFixed(0)}% from peak. Volume ${volumeChar.sustainedElevatedDays > 5 ? `has been elevated for ${volumeChar.sustainedElevatedDays} consecutive days, potentially signaling a bottoming process` : 'is at normal levels'}. Need more turnover before the base is fully rotated.`,
      };
    }
    return {
      signal: 'ABSORPTION',
      confidence: 'LOW',
      narrative: `Price stabilizing after ${Math.abs(declinePct).toFixed(0)}% decline but only ${turnoverPct.toFixed(0)}% shareholder turnover — early in the rotation process. The shareholder base has not sufficiently rotated to new hands at lower prices. Patience required.`,
    };
  }

  if (pricePhase === 'RECOVERING') {
    if (turnoverPct >= 200) {
      return {
        signal: 'BOTTOMING',
        confidence: 'HIGH',
        narrative: `Recovery underway after ${Math.abs(declinePct).toFixed(0)}% decline with massive ${turnoverPct.toFixed(0)}% turnover. Shareholder base has fully rotated — price recovery with this level of turnover is a strong bottoming confirmation.`,
      };
    }
    return {
      signal: 'ABSORPTION',
      confidence: 'MEDIUM',
      narrative: `Price recovering from ${Math.abs(declinePct).toFixed(0)}% decline. Shareholder turnover at ${turnoverPct.toFixed(0)}%. ${turnoverPct >= 100 ? 'Base has rotated once — recovery is constructive.' : 'Turnover below 100% — recovery may be fragile without full shareholder rotation.'}`,
    };
  }

  return { signal: 'UNKNOWN', confidence: 'LOW', narrative: 'Unable to classify volume pattern.' };
}

// ── VOLUME-CONFIRMED ENTRY SIGNAL ──
// Burry's override: when turnover is sufficient AND price stabilizes,
// it's an entry even without a 20% pullback from purchase

function checkVolumeConfirmedEntry(
  pricePhase: string,
  turnoverPct: number | null,
  volumeChar: ReturnType<typeof analyzeVolumeCharacter>,
  declinePct: number,
): { triggered: boolean; reason: string } {

  if (!turnoverPct || !volumeChar) {
    return { triggered: false, reason: 'Insufficient data' };
  }

  if (pricePhase === 'NO_DECLINE' || pricePhase === 'NEW_HIGHS') {
    return { triggered: false, reason: 'No decline — volume entry signal not applicable' };
  }

  if (pricePhase === 'ACTIVE_DECLINE') {
    return { triggered: false, reason: 'Price still in active decline — wait for stabilization' };
  }

  // Burry's threshold: ~246% turnover on MELI was his quantified example
  // We use 200% as the trigger with stabilizing/recovering price
  if (turnoverPct >= 200 && (pricePhase === 'STABILIZING' || pricePhase === 'RECOVERING')) {
    const volumeNote = volumeChar.sustainedElevatedDays > 5
      ? `Volume elevated for ${volumeChar.sustainedElevatedDays} consecutive days.`
      : `Volume trend: ${volumeChar.volumeTrend}.`;

    return {
      triggered: true,
      reason: `Shareholder turnover at ${turnoverPct.toFixed(0)}% (2x+ rotation) with price ${pricePhase.toLowerCase()}. ${volumeNote} Per Burry's framework: "If the analysis and the volume tell me I am closer to a bottom, I will dollar cost average in without waiting for the 20% drop."`,
    };
  }

  if (turnoverPct >= 150 && pricePhase === 'STABILIZING' && volumeChar.sustainedElevatedDays > 10) {
    return {
      triggered: false,
      reason: `Turnover approaching threshold at ${turnoverPct.toFixed(0)}% with sustained elevated volume. Close to volume-confirmed entry but not yet at 200%+ rotation.`,
    };
  }

  if (turnoverPct < 100) {
    return { triggered: false, reason: `Only ${turnoverPct.toFixed(0)}% turnover — shareholder base not rotated. Need 200%+ for volume-confirmed entry.` };
  }

  return { triggered: false, reason: `Turnover at ${turnoverPct.toFixed(0)}% — progressing but below 200% threshold for volume-confirmed entry.` };
}

// ═══════════════════════════════════════════════════════════════════
// MAIN EXPORT: computeVolumeBreakdown
// ═══════════════════════════════════════════════════════════════════

export async function computeVolumeBreakdown(
  symbol: string,
  bars: OHLCVBar[],
): Promise<VolumeBreakdownResult> {

  const price = bars.length > 0 ? bars[bars.length - 1].close : 0;

  // 1. Get share structure from Yahoo Finance
  const { sharesOutstanding, floatShares } = await getShareStructure(symbol);

  // 2. Peak detection
  const peakInfo = detectPeak(bars);

  // 3. If no significant decline (>10%), return minimal result
  if (!peakInfo || peakInfo.declinePct > -10) {
    return {
      symbol,
      price: Math.round(price * 100) / 100,
      sharesOutstanding,
      floatShares,
      peak: peakInfo ? {
        date: peakInfo.peakDate,
        price: Math.round(peakInfo.peakPrice * 100) / 100,
        declineFromPeak: Math.round(peakInfo.declinePct * 10) / 10,
        daysSincePeak: peakInfo.daysSincePeak,
      } : null,
      shareholderTurnover: null,
      volumeCharacter: analyzeVolumeCharacter(bars),
      pricePhase: 'NO_DECLINE',
      interpretation: {
        signal: 'NEUTRAL',
        confidence: 'LOW',
        narrative: `${symbol} is within 10% of its peak — no significant decline to analyze for shareholder rotation.`,
      },
      volumeConfirmedEntry: { triggered: false, reason: 'No significant decline' },
      abnormalEvents: [],
    };
  }

  // 4. Cumulative volume since peak
  const cumVolume = computeCumulativeVolume(bars, peakInfo.peakIdx);

  // 5. Shareholder turnover
  let shareholderTurnover: VolumeBreakdownResult['shareholderTurnover'] = null;
  if (sharesOutstanding && sharesOutstanding > 0) {
    const turnoverPct = (cumVolume / sharesOutstanding) * 100;
    let turnoverLabel = 'Early Rotation';
    if (turnoverPct >= 200) turnoverLabel = 'Rotation Complete';
    else if (turnoverPct >= 100) turnoverLabel = 'Progressing';

    const floatTurnoverPct = floatShares && floatShares > 0
      ? (cumVolume / floatShares) * 100
      : null;

    shareholderTurnover = {
      cumVolumeSincePeak: cumVolume,
      turnoverPct: Math.round(turnoverPct),
      turnoverLabel,
      floatTurnoverPct: floatTurnoverPct !== null ? Math.round(floatTurnoverPct) : null,
    };
  }

  // 6. Volume character analysis
  const volumeChar = analyzeVolumeCharacter(bars);

  // 7. Price phase detection
  const pricePhase = detectPricePhase(bars, peakInfo);

  // 8. Abnormal volume events since peak
  const abnormalEvents = findAbnormalVolumeEvents(bars, peakInfo.peakIdx);

  // 9. Phase-aware interpretation
  const interpretation = interpretVolume(
    pricePhase,
    shareholderTurnover?.turnoverPct || null,
    volumeChar,
    abnormalEvents,
    peakInfo.declinePct,
  );

  // 10. Volume-confirmed entry check
  const volumeConfirmedEntry = checkVolumeConfirmedEntry(
    pricePhase,
    shareholderTurnover?.turnoverPct || null,
    volumeChar,
    peakInfo.declinePct,
  );

  console.log(`[VOL] ${symbol}: peak ${peakInfo.peakDate} @ $${peakInfo.peakPrice.toFixed(2)}, decline ${peakInfo.declinePct.toFixed(1)}%, turnover ${shareholderTurnover?.turnoverPct || '?'}%, phase ${pricePhase}, signal ${interpretation.signal}`);

  return {
    symbol,
    price: Math.round(price * 100) / 100,
    sharesOutstanding,
    floatShares,
    peak: {
      date: peakInfo.peakDate,
      price: Math.round(peakInfo.peakPrice * 100) / 100,
      declineFromPeak: Math.round(peakInfo.declinePct * 10) / 10,
      daysSincePeak: peakInfo.daysSincePeak,
    },
    shareholderTurnover,
    volumeCharacter: volumeChar,
    pricePhase,
    interpretation,
    volumeConfirmedEntry,
    abnormalEvents,
  };
}

// ═══════════════════════════════════════════════════════════════════
// LIGHTWEIGHT WATCHLIST BADGE
// ═══════════════════════════════════════════════════════════════════
// Returns just the turnover % and badge color for watchlist display
// without full analysis — optimized for batch calls

export interface WatchlistVolumeBadge {
  symbol: string;
  turnoverPct: number | null;
  declineFromPeak: number | null;
  badgeColor: 'green' | 'amber' | 'red' | 'gray';
  badgeLabel: string;
}

export async function computeWatchlistVolumeBadge(
  symbol: string,
  bars: OHLCVBar[],
): Promise<WatchlistVolumeBadge> {
  const peakInfo = detectPeak(bars);

  if (!peakInfo || peakInfo.declinePct > -10) {
    return {
      symbol,
      turnoverPct: null,
      declineFromPeak: peakInfo ? Math.round(peakInfo.declinePct * 10) / 10 : null,
      badgeColor: 'gray',
      badgeLabel: '—',
    };
  }

  const { sharesOutstanding } = await getShareStructure(symbol);
  if (!sharesOutstanding || sharesOutstanding <= 0) {
    return {
      symbol,
      turnoverPct: null,
      declineFromPeak: Math.round(peakInfo.declinePct * 10) / 10,
      badgeColor: 'gray',
      badgeLabel: '?',
    };
  }

  const cumVolume = computeCumulativeVolume(bars, peakInfo.peakIdx);
  const turnoverPct = Math.round((cumVolume / sharesOutstanding) * 100);

  let badgeColor: WatchlistVolumeBadge['badgeColor'] = 'red';
  if (turnoverPct >= 200) badgeColor = 'green';
  else if (turnoverPct >= 100) badgeColor = 'amber';

  return {
    symbol,
    turnoverPct,
    declineFromPeak: Math.round(peakInfo.declinePct * 10) / 10,
    badgeColor,
    badgeLabel: `${turnoverPct}% TO`,
  };
}
