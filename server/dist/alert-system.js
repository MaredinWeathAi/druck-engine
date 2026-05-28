"use strict";
/**
 * Inflection Alert System
 * ========================
 * Generates, stores, and manages alerts from the Inflection Engine.
 *
 * Features:
 *   - Alert generation from phase transitions, exhaustion triggers, divergence signals
 *   - Confidence scoring (based on pillar agreement + signal strength)
 *   - Cooldown logic (no repeat alerts within configurable window)
 *   - Alert history with expiry
 *   - Priority classification (CRITICAL / HIGH / MEDIUM / LOW)
 *
 * Alert Types:
 *   - PHASE_TRANSITION: Stock moving between lifecycle phases
 *   - BUY_NOW: Selling exhaustion threshold met
 *   - SHORT_NOW: Buying exhaustion threshold met
 *   - DIVERGENCE: Technical divergence detected
 *   - EARNINGS_REACTION: Unusual earnings reaction
 *   - INDUSTRY_SHIFT: Industry-level inflection signal
 *   - PILLAR_EXTREME: Any pillar hits extreme (>85 or <15)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generatePhaseTransitionAlert = generatePhaseTransitionAlert;
exports.generateExhaustionAlert = generateExhaustionAlert;
exports.generateDivergenceAlert = generateDivergenceAlert;
exports.generatePillarExtremeAlert = generatePillarExtremeAlert;
exports.generateEarningsReactionAlert = generateEarningsReactionAlert;
exports.generateIndustryShiftAlert = generateIndustryShiftAlert;
const express_1 = require("express");
const router = (0, express_1.Router)();
// ============================================================================
// ALERT STORE (in-memory, persists for session)
// ============================================================================
const alertStore = [];
const COOLDOWN_DAYS = 5; // No repeat alert for same ticker+type within N days
const ALERT_EXPIRY_DAYS = 30; // Alerts expire after N days
const MAX_ALERTS = 500; // Max alerts in store
function generateId() {
    return `alert_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
function isInCooldown(ticker, type) {
    const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();
    return alertStore.some(a => a.ticker === ticker && a.type === type
        && now - new Date(a.timestamp).getTime() < cooldownMs);
}
function addAlert(alert) {
    // Check cooldown
    if (isInCooldown(alert.ticker, alert.type))
        return null;
    const now = new Date();
    const full = {
        ...alert,
        id: generateId(),
        timestamp: now.toISOString(),
        expiresAt: new Date(now.getTime() + ALERT_EXPIRY_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        acknowledged: false,
    };
    alertStore.unshift(full);
    // Trim store
    while (alertStore.length > MAX_ALERTS)
        alertStore.pop();
    return full;
}
// ============================================================================
// ALERT GENERATORS
// ============================================================================
function generatePhaseTransitionAlert(ticker, previousPhase, currentPhase, pillars) {
    if (!previousPhase || previousPhase === currentPhase.phase)
        return null;
    const priority = currentPhase.phase === 'SELLING_EXHAUSTION' || currentPhase.phase === 'BUYING_EXHAUSTION' ? 'HIGH'
        : currentPhase.phase === 'NARRATIVE_REVERSAL' || currentPhase.phase === 'NARRATIVE_COLLAPSE' ? 'HIGH'
            : 'MEDIUM';
    return addAlert({
        ticker,
        type: 'PHASE_TRANSITION',
        priority,
        title: `${ticker} entered ${currentPhase.phase.replace(/_/g, ' ')}`,
        description: `Phase transition from ${previousPhase.replace(/_/g, ' ')} → ${currentPhase.phase.replace(/_/g, ' ')}. ${currentPhase.description}`,
        confidence: currentPhase.confidence,
        phase: currentPhase.phase,
        pillars,
        actionBias: currentPhase.actionBias,
        metadata: { previousPhase, riskLevel: currentPhase.riskLevel },
    });
}
function generateExhaustionAlert(ticker, exhaustion, pillars, phase) {
    if (!exhaustion.triggered)
        return null;
    const type = exhaustion.type === 'BUYING_EXHAUSTION' ? 'SHORT_NOW' : 'BUY_NOW';
    const isBuy = type === 'BUY_NOW';
    const metCriteria = exhaustion.criteria.filter(c => c.met);
    const criteriaStr = metCriteria.map(c => c.label).join(', ');
    return addAlert({
        ticker,
        type,
        priority: 'CRITICAL',
        title: isBuy ? `🟢 BUY NOW: ${ticker}` : `⚠️ SHORT NOW: ${ticker}`,
        description: `${exhaustion.type.replace(/_/g, ' ')} triggered (${exhaustion.points}/${exhaustion.maxPoints} points). Criteria met: ${criteriaStr}`,
        confidence: Math.min(95, Math.round((exhaustion.points / exhaustion.maxPoints) * 100)),
        phase,
        pillars,
        actionBias: isBuy ? 'BUY' : 'SHORT',
        metadata: { points: exhaustion.points, maxPoints: exhaustion.maxPoints, criteria: exhaustion.criteria },
    });
}
function generateDivergenceAlert(ticker, divergenceType, strength, price, pillars) {
    const isDecel = divergenceType === 'DECEL_DIVERGENCE';
    return addAlert({
        ticker,
        type: 'DIVERGENCE',
        priority: strength >= 3 ? 'HIGH' : 'MEDIUM',
        title: `${ticker}: ${isDecel ? 'Bearish' : 'Bullish'} divergence (${strength}/3)`,
        description: isDecel
            ? `Price rising but momentum fading — ${strength}/3 acceleration indicators confirming deceleration at $${price.toFixed(2)}`
            : `Price falling but momentum building — ${strength}/3 acceleration indicators confirming acceleration at $${price.toFixed(2)}`,
        confidence: Math.min(90, strength * 30),
        phase: null,
        pillars,
        actionBias: isDecel ? 'REDUCE' : 'ACCUMULATE',
        metadata: { divergenceType, strength, price },
    });
}
function generatePillarExtremeAlert(ticker, pillars, phase) {
    const extremes = [];
    if (pillars.technical > 85)
        extremes.push('Technical: EXTREMELY BULLISH');
    if (pillars.technical < 15)
        extremes.push('Technical: EXTREMELY BEARISH');
    if (pillars.fundamental > 85)
        extremes.push('Fundamental: EXTREMELY STRONG');
    if (pillars.fundamental < 15)
        extremes.push('Fundamental: EXTREMELY WEAK');
    if (pillars.valuation > 85)
        extremes.push('Valuation: EXTREMELY CHEAP');
    if (pillars.valuation < 15)
        extremes.push('Valuation: EXTREMELY EXPENSIVE');
    if (pillars.inflection > 85)
        extremes.push('Inflection: STRONG ACCELERATION');
    if (pillars.inflection < 15)
        extremes.push('Inflection: STRONG DECELERATION');
    if (extremes.length === 0)
        return null;
    const bullishExtremes = extremes.filter(e => e.includes('BULLISH') || e.includes('STRONG') || e.includes('CHEAP')).length;
    const bearishExtremes = extremes.filter(e => e.includes('BEARISH') || e.includes('WEAK') || e.includes('EXPENSIVE') || e.includes('DECELERATION')).length;
    return addAlert({
        ticker,
        type: 'PILLAR_EXTREME',
        priority: extremes.length >= 2 ? 'HIGH' : 'MEDIUM',
        title: `${ticker}: ${extremes.length} pillar extreme${extremes.length > 1 ? 's' : ''} detected`,
        description: extremes.join('; '),
        confidence: Math.min(90, extremes.length * 25 + 20),
        phase,
        pillars,
        actionBias: bullishExtremes > bearishExtremes ? 'BUY' : bearishExtremes > bullishExtremes ? 'SELL' : 'HOLD',
        metadata: { extremes, bullishExtremes, bearishExtremes },
    });
}
function generateEarningsReactionAlert(ticker, reactionType, description, pillars) {
    const isBullish = reactionType === 'negative_surprise_recovery';
    return addAlert({
        ticker,
        type: 'EARNINGS_REACTION',
        priority: 'HIGH',
        title: `${ticker}: Unusual earnings reaction`,
        description,
        confidence: 70,
        phase: null,
        pillars,
        actionBias: isBullish ? 'ACCUMULATE' : 'REDUCE',
        metadata: { reactionType },
    });
}
function generateIndustryShiftAlert(industry, inflectionScore, cyclicalPosition, activeSignals, totalDrivers, recommendation) {
    if (activeSignals < totalDrivers * 0.5)
        return null; // Only alert if majority of drivers signaling
    return addAlert({
        ticker: industry.toUpperCase(),
        type: 'INDUSTRY_SHIFT',
        priority: inflectionScore > 70 ? 'HIGH' : 'MEDIUM',
        title: `${industry}: Industry inflection — ${activeSignals}/${totalDrivers} drivers improving`,
        description: recommendation,
        confidence: Math.min(85, inflectionScore),
        phase: null,
        pillars: null,
        actionBias: cyclicalPosition === 'early_cycle' ? 'BUY' : cyclicalPosition === 'downturn' ? 'SELL' : 'HOLD',
        metadata: { industry, inflectionScore, cyclicalPosition, activeSignals, totalDrivers },
    });
}
// ============================================================================
// REST ENDPOINTS
// ============================================================================
// GET /api/alerts/status
router.get('/status', (_req, res) => {
    const now = Date.now();
    const active = alertStore.filter(a => new Date(a.expiresAt).getTime() > now);
    const critical = active.filter(a => a.priority === 'CRITICAL');
    const unacked = active.filter(a => !a.acknowledged);
    res.json({
        module: 'Inflection Alert System',
        version: '1.0.0',
        totalAlerts: alertStore.length,
        activeAlerts: active.length,
        criticalAlerts: critical.length,
        unacknowledgedAlerts: unacked.length,
        cooldownDays: COOLDOWN_DAYS,
        alertExpiryDays: ALERT_EXPIRY_DAYS,
        alertTypes: ['PHASE_TRANSITION', 'BUY_NOW', 'SHORT_NOW', 'DIVERGENCE', 'EARNINGS_REACTION', 'INDUSTRY_SHIFT', 'PILLAR_EXTREME'],
    });
});
// GET /api/alerts — Get all active alerts
router.get('/', (req, res) => {
    const now = Date.now();
    let alerts = alertStore.filter(a => new Date(a.expiresAt).getTime() > now);
    // Filter by type
    const type = req.query.type;
    if (type)
        alerts = alerts.filter(a => a.type === type);
    // Filter by ticker
    const ticker = req.query.ticker;
    if (ticker)
        alerts = alerts.filter(a => a.ticker === ticker.toUpperCase());
    // Filter by priority
    const priority = req.query.priority;
    if (priority)
        alerts = alerts.filter(a => a.priority === priority);
    // Filter unacknowledged only
    if (req.query.unacked === 'true')
        alerts = alerts.filter(a => !a.acknowledged);
    // Limit
    const limit = parseInt(req.query.limit) || 50;
    alerts = alerts.slice(0, limit);
    res.json({ count: alerts.length, alerts });
});
// GET /api/alerts/critical — Critical alerts only
router.get('/critical', (_req, res) => {
    const now = Date.now();
    const critical = alertStore.filter(a => a.priority === 'CRITICAL' && new Date(a.expiresAt).getTime() > now);
    res.json({ count: critical.length, alerts: critical });
});
// GET /api/alerts/feed — Formatted alert feed for dashboard
router.get('/feed', (req, res) => {
    const now = Date.now();
    const limit = parseInt(req.query.limit) || 20;
    const alerts = alertStore
        .filter(a => new Date(a.expiresAt).getTime() > now)
        .slice(0, limit)
        .map(a => ({
        id: a.id,
        time: a.timestamp,
        ticker: a.ticker,
        type: a.type,
        priority: a.priority,
        title: a.title,
        confidence: a.confidence,
        actionBias: a.actionBias,
        acknowledged: a.acknowledged,
    }));
    res.json({ count: alerts.length, alerts });
});
// POST /api/alerts/:id/acknowledge — Acknowledge an alert
router.post('/:id/acknowledge', (req, res) => {
    const alert = alertStore.find(a => a.id === req.params.id);
    if (!alert)
        return res.status(404).json({ error: 'Alert not found' });
    alert.acknowledged = true;
    res.json({ status: 'acknowledged', alert });
});
// POST /api/alerts/acknowledge-all — Acknowledge all alerts
router.post('/acknowledge-all', (_req, res) => {
    let count = 0;
    alertStore.forEach(a => { if (!a.acknowledged) {
        a.acknowledged = true;
        count++;
    } });
    res.json({ status: 'ok', acknowledged: count });
});
// DELETE /api/alerts/clear — Clear all alerts (admin)
router.delete('/clear', (_req, res) => {
    const count = alertStore.length;
    alertStore.length = 0;
    res.json({ status: 'cleared', removed: count });
});
// GET /api/alerts/summary — Dashboard summary
router.get('/summary', (_req, res) => {
    const now = Date.now();
    const active = alertStore.filter(a => new Date(a.expiresAt).getTime() > now);
    // Group by type
    const byType = {};
    const byTicker = {};
    const byPriority = {};
    active.forEach(a => {
        byType[a.type] = (byType[a.type] || 0) + 1;
        byTicker[a.ticker] = (byTicker[a.ticker] || 0) + 1;
        byPriority[a.priority] = (byPriority[a.priority] || 0) + 1;
    });
    // Top tickers by alert count
    const topTickers = Object.entries(byTicker)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([ticker, count]) => ({ ticker, alertCount: count }));
    // Most recent BUY NOW / SHORT NOW
    const recentBuy = active.find(a => a.type === 'BUY_NOW');
    const recentShort = active.find(a => a.type === 'SHORT_NOW');
    res.json({
        totalActive: active.length,
        byType,
        byPriority,
        topTickers,
        latestBuyNow: recentBuy ? { ticker: recentBuy.ticker, title: recentBuy.title, confidence: recentBuy.confidence } : null,
        latestShortNow: recentShort ? { ticker: recentShort.ticker, title: recentShort.title, confidence: recentShort.confidence } : null,
    });
});
exports.default = router;
//# sourceMappingURL=alert-system.js.map