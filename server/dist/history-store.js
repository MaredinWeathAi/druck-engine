"use strict";
// ═══════════════════════════════════════════════════════════════════
// HISTORICAL DATA TRACKING SYSTEM — Druck Engine v10.1
// ═══════════════════════════════════════════════════════════════════
// Persistent SQLite storage for daily snapshots, phase history,
// phase transitions, and prediction accuracy tracking.
//
// CRITICAL: Algorithm version locking — the system NEVER auto-updates
// its algorithms. Updates only happen after explicit user approval.
// ═══════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initDatabase = initDatabase;
exports.getActiveAlgorithmVersion = getActiveAlgorithmVersion;
exports.getAllAlgorithmVersions = getAllAlgorithmVersions;
exports.requestAlgorithmUpdate = requestAlgorithmUpdate;
exports.approveAlgorithmUpdate = approveAlgorithmUpdate;
exports.getPendingUpdateRequests = getPendingUpdateRequests;
exports.recordSnapshot = recordSnapshot;
exports.recordSnapshotBatch = recordSnapshotBatch;
exports.recordTransition = recordTransition;
exports.recordTransitionBatch = recordTransitionBatch;
exports.getSymbolHistory = getSymbolHistory;
exports.getSymbolPhaseTimeline = getSymbolPhaseTimeline;
exports.getSymbolTransitions = getSymbolTransitions;
exports.getRecentTransitions = getRecentTransitions;
exports.getLatestSnapshots = getLatestSnapshots;
exports.getSnapshotsByDate = getSnapshotsByDate;
exports.updateTransitionOutcomes = updateTransitionOutcomes;
exports.computeAccuracyMetrics = computeAccuracyMetrics;
exports.getDbStats = getDbStats;
exports.closeDatabase = closeDatabase;
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// ─── DATABASE SETUP ───
const DATA_DIR = process.env.DATA_DIR || path_1.default.join(process.cwd(), 'data');
if (!fs_1.default.existsSync(DATA_DIR))
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path_1.default.join(DATA_DIR, 'druck-history.db');
let db;
function initDatabase() {
    db = new better_sqlite3_1.default(DB_PATH, { verbose: undefined });
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
    // Seed initial version if none exists
    const versionCount = db.prepare('SELECT COUNT(*) as cnt FROM algorithm_versions').get();
    if (versionCount.cnt === 0) {
        db.prepare(`
      INSERT INTO algorithm_versions (version_id, description, is_active, config_snapshot, approved_by, approval_note)
      VALUES (?, ?, 1, ?, 'system', 'Initial version — baseline Smart Money Cycle v10.0')
    `).run('v10.0.0', 'Smart Money Cycle v10.0 — 5-pillar scoring (Tech 25%, Inflection 25%, Fundamental 20%, Valuation 20%, Narrative 10%), 6-phase competitive classification', JSON.stringify({
            pillars: { technical: 0.25, inflection: 0.25, fundamental: 0.20, valuation: 0.20, narrative: 0.10 },
            phases: 6,
            lookbacks: { sma: [20, 50, 100, 200], rsi: 14, macd: [12, 26, 9], roc: 20, relStrength: [20, 60], volume: [20, 50] },
            accel: { roc_n: 20, roc_m: 5, smoothing: 5, ema_period: 20, divergence_threshold: { roc: 0.5, log: 0.08, ema: 0.1 } },
        }));
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
function getActiveAlgorithmVersion() {
    const row = db.prepare('SELECT version_id FROM algorithm_versions WHERE is_active = 1 ORDER BY created_at DESC LIMIT 1').get();
    return row?.version_id || 'v10.0.0';
}
function getAllAlgorithmVersions() {
    return db.prepare('SELECT * FROM algorithm_versions ORDER BY created_at DESC').all();
}
// Request an algorithm update — does NOT automatically apply it
function requestAlgorithmUpdate(req) {
    const currentVersion = getActiveAlgorithmVersion();
    const result = db.prepare(`
    INSERT INTO algorithm_update_requests (current_version, reason, accuracy_data)
    VALUES (?, ?, ?)
  `).run(currentVersion, req.reason, req.accuracyData ? JSON.stringify(req.accuracyData) : null);
    return result.lastInsertRowid;
}
// Approve and apply an algorithm update — REQUIRES explicit user action
function approveAlgorithmUpdate(requestId, newVersionId, description, configSnapshot, approvedBy, approvalNote) {
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
function getPendingUpdateRequests() {
    return db.prepare('SELECT * FROM algorithm_update_requests WHERE status = ? ORDER BY requested_at DESC').all('pending');
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
function recordSnapshot(record) {
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
function recordSnapshotBatch(records) {
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
function recordTransition(record) {
    const algoVersion = getActiveAlgorithmVersion();
    db.prepare(`
    INSERT INTO phase_transitions (
      symbol, date, from_phase, to_phase, from_phase_short, to_phase_short,
      from_bias, to_bias, bias_flipped, direction, severity,
      price_at_transition, algorithm_version
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(record.symbol, record.date, record.fromPhase, record.toPhase, record.fromPhaseShort, record.toPhaseShort, record.fromBias, record.toBias, record.biasFlipped ? 1 : 0, record.direction, record.severity, record.priceAtTransition, algoVersion);
}
function recordTransitionBatch(records) {
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
            stmt.run(r.symbol, r.date, r.fromPhase, r.toPhase, r.fromPhaseShort, r.toPhaseShort, r.fromBias, r.toBias, r.biasFlipped ? 1 : 0, r.direction, r.severity, r.priceAtTransition, algoVersion);
        }
    });
    txn();
}
// ─── QUERY FUNCTIONS ───
function getSymbolHistory(symbol, limit = 365) {
    return db.prepare(`
    SELECT * FROM daily_snapshots
    WHERE symbol = ?
    ORDER BY date DESC
    LIMIT ?
  `).all(symbol, limit);
}
function getSymbolPhaseTimeline(symbol) {
    return db.prepare(`
    SELECT date, phase_num, phase_short, action_bias, confidence, overall_signal, close, volume, algorithm_version
    FROM daily_snapshots
    WHERE symbol = ? AND phase_num IS NOT NULL
    ORDER BY date ASC
  `).all(symbol);
}
function getSymbolTransitions(symbol) {
    return db.prepare(`
    SELECT * FROM phase_transitions
    WHERE symbol = ?
    ORDER BY date DESC
  `).all(symbol);
}
function getRecentTransitions(days = 30) {
    return db.prepare(`
    SELECT * FROM phase_transitions
    WHERE date >= date('now', '-' || ? || ' days')
    ORDER BY detected_at DESC
  `).all(days);
}
function getLatestSnapshots() {
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
function getSnapshotsByDate(date) {
    return db.prepare(`
    SELECT * FROM daily_snapshots WHERE date = ? ORDER BY symbol
  `).all(date);
}
// ─── PREDICTION ACCURACY ───
// Update transitions with actual price performance after N days
function updateTransitionOutcomes() {
    const today = new Date().toISOString().split('T')[0];
    // Find transitions that need 5-day outcome update
    const need5d = db.prepare(`
    SELECT pt.id, pt.symbol, pt.date, pt.to_phase, pt.to_bias, pt.price_at_transition
    FROM phase_transitions pt
    WHERE pt.return_5d IS NULL
    AND pt.price_at_transition IS NOT NULL
    AND date(pt.date, '+7 days') <= date(?)
  `).all(today);
    // Find transitions that need 20-day outcome update
    const need20d = db.prepare(`
    SELECT pt.id, pt.symbol, pt.date, pt.to_phase, pt.to_bias, pt.price_at_transition
    FROM phase_transitions pt
    WHERE pt.return_20d IS NULL
    AND pt.price_at_transition IS NOT NULL
    AND date(pt.date, '+25 days') <= date(?)
  `).all(today);
    // Find transitions that need 60-day outcome update
    const need60d = db.prepare(`
    SELECT pt.id, pt.symbol, pt.date, pt.to_phase, pt.to_bias, pt.price_at_transition
    FROM phase_transitions pt
    WHERE pt.return_60d IS NULL
    AND pt.price_at_transition IS NOT NULL
    AND date(pt.date, '+65 days') <= date(?)
  `).all(today);
    let updated = 0;
    // For 5-day outcomes, look up the close price ~5 trading days later
    for (const t of need5d) {
        const futureSnap = db.prepare(`
      SELECT close FROM daily_snapshots
      WHERE symbol = ? AND date > ? AND close IS NOT NULL
      ORDER BY date ASC LIMIT 1 OFFSET 4
    `).get(t.symbol, t.date);
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
    `).get(t.symbol, t.date);
        if (futureSnap && t.price_at_transition) {
            const return20d = ((futureSnap.close - t.price_at_transition) / t.price_at_transition) * 100;
            // Evaluate prediction correctness based on bias
            // BUY/ACCUMULATE = bullish → correct if positive return
            // SELL/REDUCE/SHORT = bearish → correct if negative return
            const isBullish = t.to_bias && (t.to_bias.includes('BUY') || t.to_bias.includes('ACCUMULATE'));
            const isBearish = t.to_bias && (t.to_bias.includes('SELL') || t.to_bias.includes('SHORT') || t.to_bias.includes('REDUCE'));
            let correct = null;
            if (isBullish)
                correct = return20d > 0 ? 1 : 0;
            else if (isBearish)
                correct = return20d < 0 ? 1 : 0;
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
    `).get(t.symbol, t.date);
        if (futureSnap && t.price_at_transition) {
            const return60d = ((futureSnap.close - t.price_at_transition) / t.price_at_transition) * 100;
            db.prepare('UPDATE phase_transitions SET price_60d_after = ?, return_60d = ? WHERE id = ?')
                .run(futureSnap.close, +return60d.toFixed(2), t.id);
            updated++;
        }
    }
    if (updated > 0)
        console.log(`[HISTORY] Updated ${updated} transition outcomes`);
    return updated;
}
// Compute accuracy metrics for a given algorithm version
function computeAccuracyMetrics(algorithmVersion) {
    const version = algorithmVersion || getActiveAlgorithmVersion();
    const transitions = db.prepare(`
    SELECT * FROM phase_transitions WHERE algorithm_version = ?
  `).all(version);
    const evaluated = transitions.filter(t => t.prediction_correct !== null);
    const correct = evaluated.filter(t => t.prediction_correct === 1);
    const incorrect = evaluated.filter(t => t.prediction_correct === 0);
    const pending = transitions.filter(t => t.prediction_correct === null);
    // Per-phase metrics
    const phaseMetrics = {};
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
            avgReturn20d: returns.length > 0 ? +(returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2) : 0,
        };
    }
    // Per-bias metrics
    const biasMetrics = {};
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
            avgReturn20d: returns.length > 0 ? +(returns.reduce((a, b) => a + b, 0) / returns.length).toFixed(2) : 0,
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
function getDbStats() {
    const snapshotCount = db.prepare('SELECT COUNT(*) as cnt FROM daily_snapshots').get().cnt;
    const transitionCount = db.prepare('SELECT COUNT(*) as cnt FROM phase_transitions').get().cnt;
    const symbolCount = db.prepare('SELECT COUNT(DISTINCT symbol) as cnt FROM daily_snapshots').get().cnt;
    const dateRange = db.prepare('SELECT MIN(date) as earliest, MAX(date) as latest FROM daily_snapshots').get();
    const activeVersion = getActiveAlgorithmVersion();
    const pendingUpdates = db.prepare('SELECT COUNT(*) as cnt FROM algorithm_update_requests WHERE status = ?').get('pending').cnt;
    return {
        snapshotCount,
        transitionCount,
        symbolCount,
        dateRange: { earliest: dateRange?.earliest, latest: dateRange?.latest },
        activeAlgorithmVersion: activeVersion,
        pendingAlgorithmUpdates: pendingUpdates,
        dbPath: DB_PATH,
        dbSizeBytes: fs_1.default.existsSync(DB_PATH) ? fs_1.default.statSync(DB_PATH).size : 0,
    };
}
function closeDatabase() {
    if (db)
        db.close();
}
//# sourceMappingURL=history-store.js.map