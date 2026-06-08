// ═══════════════════════════════════════════════════════════════════
// HISTORICAL DATA TRACKING SYSTEM — Druck Engine v10.1
// ═══════════════════════════════════════════════════════════════════
// Persistent SQLite storage for daily snapshots, phase history,
// phase transitions, and prediction accuracy tracking.
//
// CRITICAL: Algorithm version locking — the system NEVER auto-updates
// its algorithms. Updates only happen after explicit user approval.
// ═══════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// ─── DATABASE SETUP ───

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'druck-history.db');
let db: Database.Database;

export function initDatabase(): void {
  db = new Database(DB_PATH, { verbose: undefined });
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');

  // ── Algorithm Versions ──
  // Tracks which version of the classification logic was active at each point in time.
  // CRITICAL: Never auto-update. Only insert new versions after user approval.
  db.exec(`
    CREATE TABLE IF NOT EXISTS algorithm_versions (
      version_id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      description TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      config_snapshot TEXT,
      approved_by TEXT,
      approval_note TEXT
    )
  `);

  // Watchlist table
  initWatchlistTable();

  // Seed initial version if none exists
  const versionCount = db.prepare('SELECT COUNT(*) as cnt FROM algorithm_versions').get() as any;
  if (versionCount.cnt === 0) {
    db.prepare(`
      INSERT INTO algorithm_versions (version_id, description, is_active, config_snapshot, approved_by, approval_note)
      VALUES (?, ?, 1, ?, 'system', 'Initial version — baseline Smart Money Cycle v10.0')
    `).run(
      'v10.0.0',
      'Smart Money Cycle v10.0 — 5-pillar scoring (Tech 25%, Inflection 25%, Fundamental 20%, Valuation 20%, Narrative 10%), 6-phase competitive classification',
      JSON.stringify({
        pillars: { technical: 0.25, inflection: 0.25, fundamental: 0.20, valuation: 0.20, narrative: 0.10 },
        phases: 6,
        lookbacks: { sma: [20, 50, 100, 200], rsi: 14, macd: [12, 26, 9], roc: 20, relStrength: [20, 60], volume: [20, 50] },
        accel: { roc_n: 20, roc_m: 5, smoothing: 5, ema_period: 20, divergence_threshold: { roc: 0.5, log: 0.08, ema: 0.1 } },
      })
    );
  }

  // ── Daily Snapshots ──
  // Core data recording: OHLCV + phase + pillar scores for every instrument every day
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      date TEXT NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),

      -- Price data
      open REAL,
      high REAL,
      low REAL,
      close REAL,
      volume INTEGER,

      -- Change metrics
      change_pct_1d REAL,
      change_pct_30d REAL,

      -- Trend classification
      daily_trend TEXT,
      weekly_trend TEXT,
      monthly_trend TEXT,

      -- Phase classification
      phase_num INTEGER,
      phase_short TEXT,
      action_bias TEXT,
      confidence REAL,
      overall_signal TEXT,

      -- Algorithm version used for this classification
      algorithm_version TEXT NOT NULL DEFAULT 'v10.0.0',

      -- Technical indicators (JSON blob for extensibility)
      technical_data TEXT,

      -- Pillar scores (JSON blob)
      pillar_scores TEXT,

      UNIQUE(symbol, date, recorded_at)
    )
  `);

  // Index for fast lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_symbol_date ON daily_snapshots(symbol, date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_date ON daily_snapshots(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_snapshots_phase ON daily_snapshots(symbol, phase_num, date)`);

  // ── Phase Transitions ──
  // Records every detected phase change with before/after context
  db.exec(`
    CREATE TABLE IF NOT EXISTS phase_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      detected_at TEXT NOT NULL DEFAULT (datetime('now')),
      date TEXT NOT NULL,

      from_phase INTEGER NOT NULL,
      to_phase INTEGER NOT NULL,
      from_phase_short TEXT,
      to_phase_short TEXT,
      from_bias TEXT,
      to_bias TEXT,
      bias_flipped INTEGER NOT NULL DEFAULT 0,
      direction TEXT,
      severity TEXT,

      -- Price context at transition
      price_at_transition REAL,

      -- Algorithm version that detected this transition
      algorithm_version TEXT NOT NULL DEFAULT 'v10.0.0',

      -- For prediction accuracy: what happened AFTER this transition
      price_5d_after REAL,
      price_20d_after REAL,
      price_60d_after REAL,
      return_5d REAL,
      return_20d REAL,
      return_60d REAL,
      prediction_correct INTEGER  -- null = not yet evaluated, 1 = correct, 0 = incorrect
    )
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_transitions_symbol ON phase_transitions(symbol, date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_transitions_date ON phase_transitions(date)`);

  // ── Prediction Accuracy Log ──
  // Aggregated accuracy metrics per algorithm version
  db.exec(`
    CREATE TABLE IF NOT EXISTS accuracy_metrics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      computed_at TEXT NOT NULL DEFAULT (datetime('now')),
      algorithm_version TEXT NOT NULL,
      period_start TEXT NOT NULL,
      period_end TEXT NOT NULL,

      -- Overall metrics
      total_transitions INTEGER,
      correct_predictions INTEGER,
      incorrect_predictions INTEGER,
      pending_evaluation INTEGER,
      hit_rate REAL,

      -- Per-phase metrics (JSON)
      phase_metrics TEXT,

      -- Per-bias metrics (JSON)
      bias_metrics TEXT,

      -- Notes
      notes TEXT
    )
  `);

  // ── Algorithm Update Requests ──
  // Tracks when the system suggests updates and whether user approved
  db.exec(`
    CREATE TABLE IF NOT EXISTS algorithm_update_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requested_at TEXT NOT NULL DEFAULT (datetime('now')),
      current_version TEXT NOT NULL,
      proposed_version TEXT,
      reason TEXT NOT NULL,
      accuracy_data TEXT,
      status TEXT NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
      reviewed_at TEXT,
      reviewed_by TEXT,
      review_notes TEXT
    )
  `);

  console.log(`[HISTORY] Database initialized at ${DB_PATH}`);
}

// ─── ALGORITHM VERSION MANAGEMENT ───

export function getActiveAlgorithmVersion(): string {
  const row = db.prepare('SELECT version_id FROM algorithm_versions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get() as any;
  return row?.version_id || 'v10.0.0';
}

export function getAllAlgorithmVersions(): any[] {
  return db.prepare('SELECT * FROM algorithm_versions ORDER BY created_at DESC').all();
}

export interface AlgorithmUpdateRequest {
  reason: string;
  accuracyData?: any;
}

// Request an algorithm update — does NOT automatically apply it
export function requestAlgorithmUpdate(req: AlgorithmUpdateRequest): number {
  const currentVersion = getActiveAlgorithmVersion();
  const result = db.prepare(`
    INSERT INTO algorithm_update_requests (current_version, reason, accuracy_data)
    VALUES (?, ?, ?)
  `).run(currentVersion, req.reason, req.accuracyData ? JSON.stringify(req.accuracyData) : null);
  return result.lastInsertRowid as number;
}

// Approve and apply an algorithm update — REQUIRES explicit user action
export function approveAlgorithmUpdate(
  requestId: number,
  newVersionId: string,
  description: string,
  configSnapshot: any,
  approvedBy: string,
  approvalNote: string
): void {
  const txn = db.transaction(() => {
    // Deactivate all current versions
    db.prepare('UPDATE algorithm_versions SET is_active = 0').run();

    // Create new version
    db.prepare(`
      INSERT INTO algorithm_versions (version_id, description, is_active, config_snapshot, approved_by, approval_note)
      VALUES (?, ?, 1, ?, ?, ?)
    `).run(newVersionId, description, JSON.stringify(configSnapshot), approvedBy, approvalNote);

    // Update the request
    db.prepare(`
      UPDATE algorithm_update_requests
      SET status = 'approved', proposed_version = ?, reviewed_at = datetime('now'), reviewed_by = ?, review_notes = ?
      WHERE id = ?
    `).run(newVersionId, approvedBy, approvalNote, requestId);
  });
  txn();
}

export function getPendingUpdateRequests(): any[] {
  return db.prepare('SELECT * FROM algorithm_update_requests WHERE status = ? ORDER BY requested_at DESC').all('pending');
}

// ─── DAILY SNAPSHOT RECORDING ───

export interface SnapshotRecord {
  symbol: string;
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
  changePct1d: number | null;
  changePct30d: number | null;
  dailyTrend: string | null;
  weeklyTrend: string | null;
  monthlyTrend: string | null;
  phaseNum: number | null;
  phaseShort: string | null;
  actionBias: string | null;
  confidence: number | null;
  overallSignal: string | null;
  technicalData?: any;
  pillarScores?: any;
}

const insertSnapshotStmt = () => db.prepare(`
  INSERT OR REPLACE INTO daily_snapshots (
    symbol, date, open, high, low, close, volume,
    change_pct_1d, change_pct_30d,
    daily_trend, weekly_trend, monthly_trend,
    phase_num, phase_short, action_bias, confidence, overall_signal,
    algorithm_version, technical_data, pillar_scores
  ) VALUES (
    @symbol, @date, @open, @high, @low, @close, @volume,
    @changePct1d, @changePct30d,
    @dailyTrend, @weeklyTrend, @monthlyTrend,
    @phaseNum, @phaseShort, @actionBias, @confidence, @overallSignal,
    @algorithmVersion, @technicalData, @pillarScores
  )
`);

export function recordSnapshot(record: SnapshotRecord): void {
  const algoVersion = getActiveAlgorithmVersion();
  insertSnapshotStmt().run({
    symbol: record.symbol,
    date: record.date,
    open: record.open,
    high: record.high,
    low: record.low,
    close: record.close,
    volume: record.volume,
    changePct1d: record.changePct1d,
    changePct30d: record.changePct30d,
    dailyTrend: record.dailyTrend,
    weeklyTrend: record.weeklyTrend,
    monthlyTrend: record.monthlyTrend,
    phaseNum: record.phaseNum,
    phaseShort: record.phaseShort,
    actionBias: record.actionBias,
    confidence: record.confidence,
    overallSignal: record.overallSignal,
    algorithmVersion: algoVersion,
    technicalData: record.technicalData ? JSON.stringify(record.technicalData) : null,
    pillarScores: record.pillarScores ? JSON.stringify(record.pillarScores) : null,
  });
}

export function recordSnapshotBatch(records: SnapshotRecord[]): void {
  const algoVersion = getActiveAlgorithmVersion();
  const stmt = insertSnapshotStmt();
  const txn = db.transaction(() => {
    for (const record of records) {
      stmt.run({
        symbol: record.symbol,
        date: record.date,
        open: record.open,
        high: record.high,
        low: record.low,
        close: record.close,
        volume: record.volume,
        changePct1d: record.changePct1d,
        changePct30d: record.changePct30d,
        dailyTrend: record.dailyTrend,
        weeklyTrend: record.weeklyTrend,
        monthlyTrend: record.monthlyTrend,
        phaseNum: record.phaseNum,
        phaseShort: record.phaseShort,
        actionBias: record.actionBias,
        confidence: record.confidence,
        overallSignal: record.overallSignal,
        algorithmVersion: algoVersion,
        technicalData: record.technicalData ? JSON.stringify(record.technicalData) : null,
        pillarScores: record.pillarScores ? JSON.stringify(record.pillarScores) : null,
      });
    }
  });
  txn();
  console.log(`[HISTORY] Recorded ${records.length} snapshots for ${new Set(records.map(r => r.symbol)).size} instruments`);
}

// ─── PHASE TRANSITION RECORDING ───

export interface TransitionRecord {
  symbol: string;
  date: string;
  fromPhase: number;
  toPhase: number;
  fromPhaseShort: string;
  toPhaseShort: string;
  fromBias: string;
  toBias: string;
  biasFlipped: boolean;
  direction: string;
  severity: string;
  priceAtTransition: number | null;
}

export function recordTransition(record: TransitionRecord): void {
  const algoVersion = getActiveAlgorithmVersion();
  db.prepare(`
    INSERT INTO phase_transitions (
      symbol, date, from_phase, to_phase, from_phase_short, to_phase_short,
      from_bias, to_bias, bias_flipped, direction, severity,
      price_at_transition, algorithm_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    record.symbol, record.date, record.fromPhase, record.toPhase,
    record.fromPhaseShort, record.toPhaseShort,
    record.fromBias, record.toBias, record.biasFlipped ? 1 : 0,
    record.direction, record.severity,
    record.priceAtTransition, algoVersion
  );
}

export function recordTransitionBatch(records: TransitionRecord[]): void {
  const algoVersion = getActiveAlgorithmVersion();
  const stmt = db.prepare(`
    INSERT INTO phase_transitions (
      symbol, date, from_phase, to_phase, from_phase_short, to_phase_short,
      from_bias, to_bias, bias_flipped, direction, severity,
      price_at_transition, algorithm_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const txn = db.transaction(() => {
    for (const r of records) {
      stmt.run(
        r.symbol, r.date, r.fromPhase, r.toPhase,
        r.fromPhaseShort, r.toPhaseShort,
        r.fromBias, r.toBias, r.biasFlipped ? 1 : 0,
        r.direction, r.severity,
        r.priceAtTransition, algoVersion
      );
    }
  });
  txn();
}

// ─── QUERY FUNCTIONS ───

export function getSymbolHistory(symbol: string, limit: number = 365): any[] {
  return db.prepare(`
    SELECT * FROM daily_snapshots
    WHERE symbol = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(symbol, limit);
}

export function getSymbolPhaseTimeline(symbol: string): any[] {
  return db.prepare(`
    SELECT date, phase_num, phase_short, action_bias, confidence, overall_signal, close, volume, algorithm_version
    FROM daily_snapshots
    WHERE symbol = ? AND phase_num IS NOT NULL
    ORDER BY date ASC
  `).all(symbol);
}

export function getSymbolTransitions(symbol: string): any[] {
  return db.prepare(`
    SELECT * FROM phase_transitions
    WHERE symbol = ?
    ORDER BY date DESC
  `).all(symbol);
}

export function getRecentTransitions(days: number = 30): any[] {
  return db.prepare(`
    SELECT * FROM phase_transitions
    WHERE date >= date('now', '-' || ? || ' days')
    ORDER BY detected_at DESC
  `).all(days);
}

export function getLatestSnapshots(): any[] {
  return db.prepare(`
    SELECT ds.* FROM daily_snapshots ds
    INNER JOIN (
      SELECT symbol, MAX(date) as max_date
      FROM daily_snapshots
      GROUP BY symbol
    ) latest ON ds.symbol = latest.symbol AND ds.date = latest.max_date
    ORDER BY ds.symbol
  `).all();
}

export function getSnapshotsByDate(date: string): any[] {
  return db.prepare(`
    SELECT * FROM daily_snapshots WHERE date = ? ORDER BY symbol
  `).all(date);
}

// ─── PREDICTION ACCURACY ───

// Update transitions with actual price performance after N days
export function updateTransitionOutcomes(): number {
  const today = new Date().toISOString().split('T')[0];

  // Find transitions that need 5-day outcome update
  const need5d = db.prepare(`
    SELECT pt.id, pt.symbol, pt.date, pt.to_phase, pt.to_bias, pt.price_at_transition
    FROM phase_transitions pt
    WHERE pt.return_5d IS NULL
    AND pt.price_at_transition IS NOT NULL
    AND date(pt.date, '+7 days') <= date(?)
  `).all(today) as any[];

  // Find transitions that need 20-day outcome update
  const need20d = db.prepare(`
    SELECT pt.id, pt.symbol, pt.date, pt.to_phase, pt.to_bias, pt.price_at_transition
    FROM phase_transitions pt
    WHERE pt.return_20d IS NULL
    AND pt.price_at_transition IS NOT NULL
    AND date(pt.date, '+25 days') <= date(?)
  `).all(today) as any[];

  // Find transitions that need 60-day outcome update
  const need60d = db.prepare(`
    SELECT pt.id, pt.symbol, pt.date, pt.to_phase, pt.to_bias, pt.price_at_transition
    FROM phase_transitions pt
    WHERE pt.return_60d IS NULL
    AND pt.price_at_transition IS NOT NULL
    AND date(pt.date, '+65 days') <= date(?)
  `).all(today) as any[];

  let updated = 0;

  // For 5-day outcomes, look up the close price ~5 trading days later
  for (const t of need5d) {
    const futureSnap = db.prepare(`
      SELECT close FROM daily_snapshots
      WHERE symbol = ? AND date > ? AND close IS NOT NULL
      ORDER BY date ASC LIMIT 1 OFFSET 4
    `).get(t.symbol, t.date) as any;

    if (futureSnap && t.price_at_transition) {
      const return5d = ((futureSnap.close - t.price_at_transition) / t.price_at_transition) * 100;
      db.prepare('UPDATE phase_transitions SET price_5d_after = ?, return_5d = ? WHERE id = ?')
        .run(futureSnap.close, +return5d.toFixed(2), t.id);
      updated++;
    }
  }

  // 20-day outcomes
  for (const t of need20d) {
    const futureSnap = db.prepare(`
      SELECT close FROM daily_snapshots
      WHERE symbol = ? AND date > ? AND close IS NOT NULL
      ORDER BY date ASC LIMIT 1 OFFSET 19
    `).get(t.symbol, t.date) as any;

    if (futureSnap && t.price_at_transition) {
      const return20d = ((futureSnap.close - t.price_at_transition) / t.price_at_transition) * 100;

      // Evaluate prediction correctness based on bias
      // BUY/ACCUMULATE = bullish → correct if positive return
      // SELL/REDUCE/SHORT = bearish → correct if negative return
      const isBullish = t.to_bias && (t.to_bias.includes('BUY') || t.to_bias.includes('ACCUMULATE'));
      const isBearish = t.to_bias && (t.to_bias.includes('SELL') || t.to_bias.includes('SHORT') || t.to_bias.includes('REDUCE'));
      let correct: number | null = null;
      if (isBullish) correct = return20d > 0 ? 1 : 0;
      else if (isBearish) correct = return20d < 0 ? 1 : 0;

      db.prepare('UPDATE phase_transitions SET price_20d_after = ?, return_20d = ?, prediction_correct = ? WHERE id = ?')
        .run(futureSnap.close, +return20d.toFixed(2), correct, t.id);
      updated++;
    }
  }

  // 60-day outcomes
  for (const t of need60d) {
    const futureSnap = db.prepare(`
      SELECT close FROM daily_snapshots
      WHERE symbol = ? AND date > ? AND close IS NOT NULL
      ORDER BY date ASC LIMIT 1 OFFSET 59
    `).get(t.symbol, t.date) as any;

    if (futureSnap && t.price_at_transition) {
      const return60d = ((futureSnap.close - t.price_at_transition) / t.price_at_transition) * 100;
      db.prepare('UPDATE phase_transitions SET price_60d_after = ?, return_60d = ? WHERE id = ?')
        .run(futureSnap.close, +return60d.toFixed(2), t.id);
      updated++;
    }
  }

  if (updated > 0) console.log(`[HISTORY] Updated ${updated} transition outcomes`);
  return updated;
}

// Compute accuracy metrics for a given algorithm version
export function computeAccuracyMetrics(algorithmVersion?: string): any {
  const version = algorithmVersion || getActiveAlgorithmVersion();

  const transitions = db.prepare(`
    SELECT * FROM phase_transitions WHERE algorithm_version = ?
  `).all(version) as any[];

  const evaluated = transitions.filter(t => t.prediction_correct !== null);
  const correct = evaluated.filter(t => t.prediction_correct === 1);
  const incorrect = evaluated.filter(t => t.prediction_correct === 0);
  const pending = transitions.filter(t => t.prediction_correct === null);

  // Per-phase metrics
  const phaseMetrics: Record<number, { total: number; correct: number; incorrect: number; pending: number; avgReturn20d: number }> = {};
  for (let p = 1; p <= 6; p++) {
    const phaseTxns = transitions.filter(t => t.to_phase === p);
    const phaseEval = phaseTxns.filter(t => t.prediction_correct !== null);
    const phaseCorrect = phaseEval.filter(t => t.prediction_correct === 1);
    const phaseIncorrect = phaseEval.filter(t => t.prediction_correct === 0);
    const returns = phaseTxns.filter(t => t.return_20d !== null).map(t => t.return_20d);
    phaseMetrics[p] = {
      total: phaseTxns.length,
      correct: phaseCorrect.length,
      incorrect: phaseIncorrect.length,
      pending: phaseTxns.filter(t => t.prediction_correct === null).length,
      avgReturn20d: returns.length > 0 ? +(returns.reduce((a: number, b: number) => a + b, 0) / returns.length).toFixed(2) : 0,
    };
  }

  // Per-bias metrics
  const biasMetrics: Record<string, { total: number; correct: number; hitRate: number; avgReturn20d: number }> = {};
  const biases = [...new Set(transitions.map(t => t.to_bias).filter(Boolean))];
  for (const bias of biases) {
    const biasTxns = transitions.filter(t => t.to_bias === bias);
    const biasEval = biasTxns.filter(t => t.prediction_correct !== null);
    const biasCorrect = biasEval.filter(t => t.prediction_correct === 1);
    const returns = biasTxns.filter(t => t.return_20d !== null).map(t => t.return_20d);
    biasMetrics[bias] = {
      total: biasTxns.length,
      correct: biasCorrect.length,
      hitRate: biasEval.length > 0 ? +(biasCorrect.length / biasEval.length * 100).toFixed(1) : 0,
      avgReturn20d: returns.length > 0 ? +(returns.reduce((a: number, b: number) => a + b, 0) / returns.length).toFixed(2) : 0,
    };
  }

  return {
    algorithmVersion: version,
    totalTransitions: transitions.length,
    evaluated: evaluated.length,
    correct: correct.length,
    incorrect: incorrect.length,
    pending: pending.length,
    hitRate: evaluated.length > 0 ? +(correct.length / evaluated.length * 100).toFixed(1) : null,
    phaseMetrics,
    biasMetrics,
    computedAt: new Date().toISOString(),
  };
}

// ─── DATABASE STATS ───

export function getDbStats(): any {
  const snapshotCount = (db.prepare('SELECT COUNT(*) as cnt FROM daily_snapshots').get() as any).cnt;
  const transitionCount = (db.prepare('SELECT COUNT(*) as cnt FROM phase_transitions').get() as any).cnt;
  const symbolCount = (db.prepare('SELECT COUNT(DISTINCT symbol) as cnt FROM daily_snapshots').get() as any).cnt;
  const dateRange = db.prepare('SELECT MIN(date) as earliest, MAX(date) as latest FROM daily_snapshots').get() as any;
  const activeVersion = getActiveAlgorithmVersion();
  const pendingUpdates = (db.prepare('SELECT COUNT(*) as cnt FROM algorithm_update_requests WHERE status = ?').get('pending') as any).cnt;

  return {
    snapshotCount,
    transitionCount,
    symbolCount,
    dateRange: { earliest: dateRange?.earliest, latest: dateRange?.latest },
    activeAlgorithmVersion: activeVersion,
    pendingAlgorithmUpdates: pendingUpdates,
    dbPath: DB_PATH,
    dbSizeBytes: fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════
// WATCHLIST — Persistent ticker tracking with analysis snapshots
// ═══════════════════════════════════════════════════════════════════

export function initWatchlistTable(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist (
      symbol TEXT PRIMARY KEY,
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_analyzed TEXT,
      price REAL,
      phase_num INTEGER,
      phase_short TEXT,
      prev_phase_num INTEGER,
      prev_phase_short TEXT,
      phase_changed_at TEXT,
      phase_change_direction TEXT,
      verdict TEXT,
      archetype TEXT,
      signal TEXT,
      up_down_ratio REAL,
      price_vs_200d REAL,
      pct_from_52w_high REAL,
      failed_breakdowns INTEGER,
      golden_cross INTEGER,
      sector TEXT,
      narrative TEXT,
      reasoning TEXT,
      full_data TEXT
    )
  `);

  // Add phase change columns if they don't exist (migration for existing DBs)
  try { db.exec('ALTER TABLE watchlist ADD COLUMN prev_phase_num INTEGER'); } catch {}
  try { db.exec('ALTER TABLE watchlist ADD COLUMN prev_phase_short TEXT'); } catch {}
  try { db.exec('ALTER TABLE watchlist ADD COLUMN phase_changed_at TEXT'); } catch {}
  try { db.exec('ALTER TABLE watchlist ADD COLUMN phase_change_direction TEXT'); } catch {}

  // Add sizing regime columns (migration)
  try { db.exec('ALTER TABLE watchlist ADD COLUMN sizing_regime TEXT'); } catch {}
  try { db.exec('ALTER TABLE watchlist ADD COLUMN sizing_label TEXT'); } catch {}
  try { db.exec('ALTER TABLE watchlist ADD COLUMN sizing_conviction INTEGER'); } catch {}
  try { db.exec('ALTER TABLE watchlist ADD COLUMN sizing_conflicts INTEGER DEFAULT 0'); } catch {}
  try { db.exec('ALTER TABLE watchlist ADD COLUMN sizing_conflict_note TEXT'); } catch {}
  try { db.exec('ALTER TABLE watchlist ADD COLUMN sizing_detail TEXT'); } catch {}

  // Phase change history log
  db.exec(`
    CREATE TABLE IF NOT EXISTS watchlist_phase_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      changed_at TEXT NOT NULL DEFAULT (datetime('now')),
      from_phase_num INTEGER,
      from_phase_short TEXT,
      to_phase_num INTEGER,
      to_phase_short TEXT,
      direction TEXT,
      price_at_change REAL,
      verdict_at_change TEXT
    )
  `);

  // ── PHASE & VERDICT HISTORY — tracks both systems over time ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS phase_verdict_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      source TEXT NOT NULL,
      price REAL,
      phase_num INTEGER,
      phase_short TEXT,
      verdict TEXT,
      archetype TEXT,
      extension_pct REAL,
      up_down_ratio REAL,
      failed_breakdowns INTEGER,
      confidence INTEGER
    )
  `);

  // ── FORESHADOW SNAPSHOTS — tracks narrative overlay settings over time ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS foreshadow_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
      fed_input INTEGER,
      oil_input INTEGER,
      growth_input INTEGER,
      derived_dollar INTEGER,
      derived_inflation INTEGER,
      derived_credit INTEGER,
      derived_gold INTEGER,
      phase_shifts TEXT,
      notes TEXT
    )
  `);

  // ── DRUCKENMILLER 13F TRACKING — compare our calls vs his actual decisions ──
  db.exec(`
    CREATE TABLE IF NOT EXISTS druckenmiller_13f (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filing_date TEXT NOT NULL,
      report_date TEXT NOT NULL,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL,
      shares_delta_pct REAL,
      position_value REAL,
      portfolio_pct REAL,
      our_phase_at_time INTEGER,
      our_verdict_at_time TEXT,
      sector TEXT,
      notes TEXT
    )
  `);
}

export function getWatchlist(): any[] {
  try {
    return db.prepare('SELECT * FROM watchlist ORDER BY added_at DESC').all();
  } catch { return []; }
}

export function addWatchlistTicker(symbol: string): void {
  try {
    db.prepare('INSERT OR IGNORE INTO watchlist (symbol) VALUES (?)').run(symbol.toUpperCase());
  } catch {}
}

export function removeWatchlistTicker(symbol: string): void {
  try {
    db.prepare('DELETE FROM watchlist WHERE symbol = ?').run(symbol.toUpperCase());
  } catch {}
}

export function getWatchlistPhaseLog(symbol?: string): any[] {
  try {
    if (symbol) {
      return db.prepare('SELECT * FROM watchlist_phase_log WHERE symbol = ? ORDER BY changed_at DESC LIMIT 50').all(symbol.toUpperCase());
    }
    return db.prepare('SELECT * FROM watchlist_phase_log ORDER BY changed_at DESC LIMIT 100').all();
  } catch { return []; }
}

export function updateWatchlistAnalysis(symbol: string, data: any): void {
  try {
    const phase = data.phase || {};
    const verdict = data.verdict || {};
    const anchors = data.anchors || {};
    const vd = data.volumeDemand || {};
    const fb = data.failedBreakdowns || {};
    const newPhaseNum = phase.phaseNum || null;
    const newPhaseShort = phase.phaseShort || null;

    // Detect phase change — compare with current stored phase
    const current = db.prepare('SELECT phase_num, phase_short, price FROM watchlist WHERE symbol = ?').get(symbol.toUpperCase()) as any;
    const oldPhaseNum = current?.phase_num || null;
    const oldPhaseShort = current?.phase_short || null;

    let phaseChanged = false;
    let changeDirection = '';
    if (oldPhaseNum !== null && newPhaseNum !== null && oldPhaseNum !== newPhaseNum) {
      phaseChanged = true;
      // Lower phase number = more bullish in our system (P1=Buy, P5=Avoid)
      changeDirection = newPhaseNum < oldPhaseNum ? 'IMPROVING' : 'WORSENING';

      // Log the phase change
      db.prepare(`
        INSERT INTO watchlist_phase_log (symbol, from_phase_num, from_phase_short, to_phase_num, to_phase_short, direction, price_at_change, verdict_at_change)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(symbol.toUpperCase(), oldPhaseNum, oldPhaseShort, newPhaseNum, newPhaseShort, changeDirection, data.price || null, verdict.verdict || null);

      console.log(`[WATCHLIST] ⚡ PHASE CHANGE: ${symbol} ${oldPhaseShort} → ${newPhaseShort} (${changeDirection})`);
    }

    const sr = data.sizingRegime || {};
    db.prepare(`
      UPDATE watchlist SET
        last_analyzed = datetime('now'),
        price = ?,
        phase_num = ?,
        phase_short = ?,
        prev_phase_num = ?,
        prev_phase_short = ?,
        phase_changed_at = CASE WHEN ? = 1 THEN datetime('now') ELSE phase_changed_at END,
        phase_change_direction = CASE WHEN ? = 1 THEN ? ELSE phase_change_direction END,
        verdict = ?,
        archetype = ?,
        signal = ?,
        up_down_ratio = ?,
        price_vs_200d = ?,
        pct_from_52w_high = ?,
        failed_breakdowns = ?,
        golden_cross = ?,
        sector = ?,
        narrative = ?,
        reasoning = ?,
        sizing_regime = ?,
        sizing_label = ?,
        sizing_conviction = ?,
        sizing_conflicts = ?,
        sizing_conflict_note = ?,
        sizing_detail = ?,
        full_data = ?
      WHERE symbol = ?
    `).run(
      data.price || null,
      newPhaseNum,
      newPhaseShort,
      oldPhaseNum,  // prev_phase_num
      oldPhaseShort, // prev_phase_short
      phaseChanged ? 1 : 0, // phase_changed_at condition
      phaseChanged ? 1 : 0, // phase_change_direction condition
      changeDirection || null, // phase_change_direction value
      verdict.verdict || null,
      verdict.archetype || null,
      verdict.signal || null,
      vd.upDownRatio || null,
      anchors.priceVs200d || null,
      anchors.pctFrom52wHigh || null,
      fb.count || 0,
      anchors.sma50Above200 ? 1 : 0,
      data.sectorDetected || null,
      data.narrative || null,
      JSON.stringify(verdict.reasoning || []),
      sr.regime || null,
      sr.label || null,
      sr.conviction || null,
      sr.conflictsWithVerdict ? 1 : 0,
      sr.conflictNote || null,
      sr.sizing || null,
      JSON.stringify(data),
      symbol.toUpperCase(),
    );
  } catch (err: any) {
    console.error('[WATCHLIST] Update error:', err?.message);
  }
}

// ── Record phase/verdict snapshot for tracking accuracy over time ──
export function recordPhaseVerdictSnapshot(symbol: string, source: string, data: {
  price: number; phaseNum: number; phaseShort: string; verdict: string;
  archetype: string; extensionPct: number; upDownRatio: number | null;
  failedBreakdowns: number; confidence: number;
}): void {
  try {
    db.prepare(`
      INSERT INTO phase_verdict_history (symbol, source, price, phase_num, phase_short, verdict, archetype, extension_pct, up_down_ratio, failed_breakdowns, confidence)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(symbol, source, data.price, data.phaseNum, data.phaseShort, data.verdict, data.archetype, data.extensionPct, data.upDownRatio, data.failedBreakdowns, data.confidence);
  } catch {}
}

export function getPhaseVerdictHistory(symbol?: string, limit: number = 100): any[] {
  try {
    if (symbol) return db.prepare('SELECT * FROM phase_verdict_history WHERE symbol = ? ORDER BY recorded_at DESC LIMIT ?').all(symbol.toUpperCase(), limit);
    return db.prepare('SELECT * FROM phase_verdict_history ORDER BY recorded_at DESC LIMIT ?').all(limit);
  } catch { return []; }
}

// ── Record Foreshadow snapshot ──
export function recordForeshadowSnapshot(inputs: {
  fed: number; oil: number; growth: number;
  dollar: number; inflation: number; credit: number; gold: number;
}, phaseShifts: string, notes?: string): void {
  try {
    db.prepare(`
      INSERT INTO foreshadow_snapshots (fed_input, oil_input, growth_input, derived_dollar, derived_inflation, derived_credit, derived_gold, phase_shifts, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(inputs.fed, inputs.oil, inputs.growth, inputs.dollar, inputs.inflation, inputs.credit, inputs.gold, phaseShifts, notes || null);
  } catch {}
}

export function getForeshadowHistory(limit: number = 50): any[] {
  try { return db.prepare('SELECT * FROM foreshadow_snapshots ORDER BY recorded_at DESC LIMIT ?').all(limit); }
  catch { return []; }
}

// ── Record Druckenmiller 13F entry ──
export function recordDruckenmiller13F(entry: {
  filingDate: string; reportDate: string; symbol: string; action: string;
  sharesDeltaPct: number; positionValue: number; portfolioPct: number;
  ourPhase: number; ourVerdict: string; sector: string; notes: string;
}): void {
  try {
    db.prepare(`
      INSERT INTO druckenmiller_13f (filing_date, report_date, symbol, action, shares_delta_pct, position_value, portfolio_pct, our_phase_at_time, our_verdict_at_time, sector, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(entry.filingDate, entry.reportDate, entry.symbol, entry.action, entry.sharesDeltaPct, entry.positionValue, entry.portfolioPct, entry.ourPhase, entry.ourVerdict, entry.sector, entry.notes);
  } catch {}
}

export function getDruckenmiller13FHistory(): any[] {
  try { return db.prepare('SELECT * FROM druckenmiller_13f ORDER BY report_date DESC, symbol ASC').all(); }
  catch { return []; }
}

export function closeDatabase(): void {
  if (db) db.close();
}
