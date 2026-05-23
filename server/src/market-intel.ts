/**
 * Market Intelligence System — News Anomaly Detection Engine
 * ===========================================================
 * Expectation-based market shift detection across multiple data sources.
 * Identifies surprise events (positive/negative) and classifies impact potential.
 *
 * Translated from Python prototype into TypeScript for the Druck Engine.
 *
 * Features:
 * - Signal types: earnings, regulatory, macro, sentiment, guru, etc.
 * - Impact levels: noise → monitor → significant → major → critical
 * - Expectation-based surprise magnitude (0-100)
 * - Cascade potential analysis
 * - Searchable headline cache (10k)
 * - Daily digest generation (11:30am & 3:30pm ET)
 * - Guru holdings from CSV (Q1 2026 13F data)
 * - REST API endpoints for Druck Engine integration
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';

const router = Router();

// ============================================================================
// ENUMS & TYPES
// ============================================================================

type SignalType =
  | 'earnings_surprise'
  | 'guidance_change'
  | 'regulatory_action'
  | 'insider_trade'
  | 'sector_rotation'
  | 'macro_event'
  | 'sentiment_shift'
  | 'competitive_threat'
  | 'product_launch'
  | 'acquisition'
  | 'litigation'
  | 'supply_chain';

type ImpactMagnitude = 'noise' | 'monitor' | 'significant' | 'major' | 'critical';

type SurpriseDirection = 'positive' | 'negative' | 'mixed';

type ActionRecommendation =
  | 'immediate_sell'
  | 'sell_overweight'
  | 'add_on_dip'
  | 'add_position'
  | 'monitor_closely'
  | 'monitor'
  | 'ignore';

type PortfolioRelevance = 'your_position' | 'guru_holding' | 'sector_exposure' | 'macro';

type CascadePotential = 'low' | 'medium' | 'high';

interface MarketSignal {
  id: string;
  ticker: string;
  companyName: string;
  signalType: SignalType;
  headline: string;
  surpriseMagnitude: number; // 0-100, 50 = baseline
  impactMagnitude: ImpactMagnitude;
  direction: SurpriseDirection;
  timestamp: string;
  newsSource: string;
  socialSentiment: { mentions: number; sentimentScore: number; trend: string };
  portfolioRelevance: PortfolioRelevance;
  affectedPositions: string[];
  cascadePotential: CascadePotential;
  scenarioImpact: { base: number; bull: number; bear: number };
  actionRecommendation: ActionRecommendation;
  urgencyFlag: boolean;
  deepDiveLink: string;
  notes: string;
  researchQueue: boolean;
  marketReactionPct: number;
  tags: string[];
}

interface HeadlineEntry {
  headlineId: string;
  ticker: string;
  headline: string;
  signalType: SignalType;
  impactLevel: ImpactMagnitude;
  direction: SurpriseDirection;
  timestamp: string;
  source: string;
  marketReactionPct: number;
  urgency: boolean;
  actionRecommended: ActionRecommendation;
  deepDiveLink: string;
  cascadePotential: CascadePotential;
  portfolioRelevance: PortfolioRelevance;
  sentimentScore: number;
  socialMentions: number;
  notes: string;
  tags: string[];
}

interface DigestSection {
  title: string;
  description: string;
  headlines: HeadlineEntry[];
  keyTakeaway: string;
}

interface DailyDigest {
  digestId: string;
  runTime: string;
  timestamp: string;
  totalSignals: number;
  criticalSection: DigestSection;
  majorEventsSection: DigestSection;
  sectorRotationsSection: DigestSection;
  macroImpactsSection: DigestSection;
  portfolioRelevanceSection: DigestSection;
  researchPriorities: ResearchItem[];
  executiveSummary: string;
  nextRunTime: string;
}

interface ResearchItem {
  priority: string;
  ticker: string;
  headline: string;
  action: string;
  deepDive: string;
  deadline: string;
}

interface GuruPosition {
  rank: number;
  ticker: string;
  companyName: string;
  burryPct: number;
  klarmanPct: number;
  druckenmillerPct: number;
  einhornPct: number;
  greenbergPct: number;
  ackmanPct: number;
  abramsPct: number;
  tepperPct: number;
  largestPosition: number;
  fundWithLargest: string;
  statusNotes: string;
  guruCount?: number;        // How many gurus hold this
  consensusWeight?: number;  // Sum of all guru weights
}

interface SearchFilters {
  ticker?: string;
  impact?: ImpactMagnitude;
  signalType?: SignalType;
  direction?: SurpriseDirection;
  urgency?: boolean;
  source?: string;
}

// ============================================================================
// EXPECTATION BASELINE
// ============================================================================

const EXPECTATION_BASELINE = {
  earnings: {
    beatThreshold: 5,     // >5% beat = surprising
    missThreshold: 5,     // >5% miss = surprising
    guidanceRaiseThreshold: 2,
    guidanceLowerThreshold: 3,
  },
  regulatory: {
    dojLawsuit: { expected: false, surpriseScore: 95 },
    secInvestigation: { expected: false, surpriseScore: 85 },
    fdaApproval: { expected: false, surpriseScore: 80 },
    fdaRejection: { expected: false, surpriseScore: 90 },
    sanctions: { expected: false, surpriseScore: 90 },
  },
  macro: {
    fedRateDecision: { calendar: true, volatility: 'medium' },
    inflationSurpriseThreshold: 0.2,
    oilSpikeThreshold: 5,
    geopoliticalEvent: { expected: false, surpriseScore: 85 },
  },
};

// ============================================================================
// ANOMALY DETECTOR
// ============================================================================

class AnomalyDetector {
  calculateSurpriseMagnitude(
    signalType: SignalType,
    actual: number,
    expected: number
  ): number {
    if (expected === 0) expected = 0.0001;
    const pctChange = ((actual - expected) / Math.abs(expected)) * 100;

    if (signalType === 'earnings_surprise') {
      if (pctChange > 20) return 90;
      if (pctChange > 10) return 75;
      if (pctChange > 5) return 65;
      if (pctChange < -20) return 10;
      if (pctChange < -10) return 25;
      if (pctChange < -5) return 35;
      return 50;
    }

    return Math.max(0, Math.min(100, 50 + pctChange / 2));
  }

  assessCascadePotential(
    signalType: SignalType,
    impact: ImpactMagnitude,
    affectedSectors: string[],
    marketCapPct: number
  ): CascadePotential {
    if (signalType === 'litigation' && (impact === 'major' || impact === 'critical')) {
      if (marketCapPct > 2) return 'high';
    }
    if (signalType === 'macro_event') return 'high';
    if (signalType === 'earnings_surprise' && marketCapPct > 1) return 'medium';
    if (signalType === 'supply_chain' && affectedSectors.length > 2) return 'high';
    return 'low';
  }

  calculateActionRecommendation(
    signalType: SignalType,
    direction: SurpriseDirection,
    impact: ImpactMagnitude,
    cascade: CascadePotential,
    portfolioRelevance: PortfolioRelevance
  ): { action: ActionRecommendation; urgency: boolean } {
    if (impact === 'critical') {
      if (direction === 'negative' && (portfolioRelevance === 'your_position' || portfolioRelevance === 'guru_holding')) {
        return { action: 'immediate_sell', urgency: true };
      }
      if (direction === 'positive' && (portfolioRelevance === 'your_position' || portfolioRelevance === 'guru_holding')) {
        return { action: 'add_on_dip', urgency: true };
      }
    }
    if (impact === 'major') {
      if (cascade === 'high') {
        return direction === 'negative'
          ? { action: 'sell_overweight', urgency: true }
          : { action: 'add_position', urgency: false };
      }
    }
    if (impact === 'significant') return { action: 'monitor_closely', urgency: false };
    if (impact === 'monitor') return { action: 'monitor', urgency: false };
    return { action: 'ignore', urgency: false };
  }

  detectEarningsSurprise(params: {
    ticker: string;
    companyName: string;
    epsActual: number;
    epsExpected: number;
    epsBeatPct: number;
    guidance?: string;
    stockReactionPct?: number;
    portfolioRelevance?: PortfolioRelevance;
  }): MarketSignal {
    const { ticker, companyName, epsActual, epsExpected, epsBeatPct, guidance, stockReactionPct = 0, portfolioRelevance = 'macro' } = params;

    const surpriseMag = this.calculateSurpriseMagnitude('earnings_surprise', epsActual, epsExpected);
    const direction: SurpriseDirection = epsBeatPct > 0 ? 'positive' : 'negative';

    let impact: ImpactMagnitude;
    const absBeat = Math.abs(epsBeatPct);
    if (absBeat < 5) impact = 'noise';
    else if (absBeat < 10) impact = 'monitor';
    else if (absBeat < 20) impact = 'significant';
    else impact = 'major';

    if (guidance && Math.abs(stockReactionPct) > 10) impact = 'significant';

    const cascade = this.assessCascadePotential('earnings_surprise', impact, ['sector_varies'], 0.5);
    const { action, urgency } = this.calculateActionRecommendation('earnings_surprise', direction, impact, cascade, portfolioRelevance);

    const reactionPct = direction === 'negative' ? -Math.abs(stockReactionPct) : Math.abs(stockReactionPct);

    return {
      id: `${ticker}_${Date.now()}`,
      ticker,
      companyName,
      signalType: 'earnings_surprise',
      headline: `${companyName} reports earnings: ${epsBeatPct > 0 ? '+' : ''}${epsBeatPct.toFixed(1)}% vs expectations`,
      surpriseMagnitude: surpriseMag,
      impactMagnitude: impact,
      direction,
      timestamp: new Date().toISOString(),
      newsSource: 'earnings_calendar',
      socialSentiment: { mentions: 0, sentimentScore: 0, trend: 'neutral' },
      portfolioRelevance,
      affectedPositions: [ticker],
      cascadePotential: cascade,
      scenarioImpact: { base: 0, bull: epsBeatPct * 1.5, bear: epsBeatPct * 0.5 },
      actionRecommendation: action,
      urgencyFlag: urgency,
      deepDiveLink: `drunkenmiller://analysis/${ticker}/earnings`,
      notes: `Stock reaction: ${stockReactionPct > 0 ? '+' : ''}${stockReactionPct.toFixed(1)}%. ${guidance || 'No guidance change.'}`,
      researchQueue: ['significant', 'major', 'critical'].includes(impact),
      marketReactionPct: reactionPct,
      tags: [`impact_${impact}`, `type_earnings_surprise`, `direction_${direction}`],
    };
  }

  detectRegulatorySurprise(params: {
    ticker: string;
    companyName: string;
    actionType: string;
    description: string;
    industryImpact: string[];
    marketCapMillions: number;
    portfolioRelevance?: PortfolioRelevance;
  }): MarketSignal {
    const { ticker, companyName, actionType, description, industryImpact, marketCapMillions, portfolioRelevance = 'your_position' } = params;

    let impact: ImpactMagnitude;
    let direction: SurpriseDirection;
    let surpriseMag: number;

    switch (actionType) {
      case 'doj_lawsuit':
        impact = 'major'; direction = 'negative'; surpriseMag = 95; break;
      case 'fda_approval':
        impact = 'major'; direction = 'positive'; surpriseMag = 85; break;
      case 'fda_rejection':
        impact = 'critical'; direction = 'negative'; surpriseMag = 95; break;
      default:
        impact = 'significant'; direction = 'negative'; surpriseMag = 80;
    }

    const cascade = this.assessCascadePotential('regulatory_action', impact, industryImpact, marketCapMillions / 100000);
    const { action, urgency } = this.calculateActionRecommendation('regulatory_action', direction, impact, cascade, portfolioRelevance);

    const baseImpact = direction === 'negative' ? -20 : 15;

    return {
      id: `${ticker}_reg_${Date.now()}`,
      ticker,
      companyName,
      signalType: 'regulatory_action',
      headline: `${companyName}: ${actionType.toUpperCase()} - ${description.substring(0, 80)}`,
      surpriseMagnitude: surpriseMag,
      impactMagnitude: impact,
      direction,
      timestamp: new Date().toISOString(),
      newsSource: 'sec_filing',
      socialSentiment: { mentions: 0, sentimentScore: 0, trend: 'neutral' },
      portfolioRelevance,
      affectedPositions: [ticker, ...industryImpact.map(s => `affected_${s}`)],
      cascadePotential: cascade,
      scenarioImpact: {
        base: baseImpact,
        bull: direction === 'positive' ? 10 : -30,
        bear: direction === 'negative' ? -50 : 0,
      },
      actionRecommendation: action,
      urgencyFlag: urgency,
      deepDiveLink: `drunkenmiller://analysis/${ticker}/regulatory`,
      notes: `Affects: ${industryImpact.join(', ')}. Market cap: $${marketCapMillions.toFixed(0)}M`,
      researchQueue: true,
      marketReactionPct: baseImpact,
      tags: [`impact_${impact}`, `type_regulatory_action`, `direction_${direction}`, 'urgent'],
    };
  }

  detectMacroEvent(params: {
    eventType: string;
    headline: string;
    description: string;
    affectedSectors: string[];
    impactEstimate: number;
  }): MarketSignal {
    const { eventType, headline, description, affectedSectors, impactEstimate } = params;

    const direction: SurpriseDirection = impactEstimate > 0 ? 'positive' : impactEstimate < 0 ? 'negative' : 'mixed';
    const absImpact = Math.abs(impactEstimate);
    let impact: ImpactMagnitude;
    if (absImpact >= 5) impact = 'critical';
    else if (absImpact >= 3) impact = 'major';
    else if (absImpact >= 1) impact = 'significant';
    else impact = 'monitor';

    return {
      id: `MACRO_${Date.now()}`,
      ticker: 'MACRO',
      companyName: eventType,
      signalType: 'macro_event',
      headline,
      surpriseMagnitude: 50 + impactEstimate * 5,
      impactMagnitude: impact,
      direction,
      timestamp: new Date().toISOString(),
      newsSource: 'macro_data',
      socialSentiment: { mentions: 0, sentimentScore: 0, trend: 'neutral' },
      portfolioRelevance: 'macro',
      affectedPositions: affectedSectors,
      cascadePotential: 'high',
      scenarioImpact: { base: impactEstimate, bull: impactEstimate * 1.5, bear: impactEstimate * 0.5 },
      actionRecommendation: impact === 'critical' ? 'immediate_sell' : 'monitor_closely',
      urgencyFlag: impact === 'critical',
      deepDiveLink: `drunkenmiller://analysis/MACRO/${eventType.toLowerCase().replace(/ /g, '_')}`,
      notes: description,
      researchQueue: ['significant', 'major', 'critical'].includes(impact),
      marketReactionPct: impactEstimate,
      tags: [`impact_${impact}`, 'type_macro_event', `direction_${direction}`],
    };
  }

  detectSentimentShift(params: {
    ticker: string;
    companyName: string;
    mentions: number;
    baselineMentions: number;
    sentimentScore: number;
    trend: string;
    portfolioRelevance?: PortfolioRelevance;
  }): MarketSignal {
    const { ticker, companyName, mentions, baselineMentions, sentimentScore, trend, portfolioRelevance = 'macro' } = params;

    const spikeMultiplier = baselineMentions > 0 ? mentions / baselineMentions : mentions;
    let impact: ImpactMagnitude;
    if (spikeMultiplier >= 10) impact = 'major';
    else if (spikeMultiplier >= 5) impact = 'significant';
    else if (spikeMultiplier >= 2) impact = 'monitor';
    else impact = 'noise';

    const direction: SurpriseDirection = sentimentScore > 20 ? 'positive' : sentimentScore < -20 ? 'negative' : 'mixed';
    const { action, urgency } = this.calculateActionRecommendation('sentiment_shift', direction, impact, 'medium', portfolioRelevance);

    return {
      id: `${ticker}_sent_${Date.now()}`,
      ticker,
      companyName,
      signalType: 'sentiment_shift',
      headline: `${companyName}: Social sentiment spike ${spikeMultiplier.toFixed(0)}x normal volume`,
      surpriseMagnitude: Math.min(100, 50 + spikeMultiplier * 5),
      impactMagnitude: impact,
      direction,
      timestamp: new Date().toISOString(),
      newsSource: 'social_sentiment',
      socialSentiment: { mentions, sentimentScore, trend },
      portfolioRelevance,
      affectedPositions: [ticker],
      cascadePotential: spikeMultiplier >= 10 ? 'high' : 'medium',
      scenarioImpact: { base: sentimentScore / 10, bull: sentimentScore / 5, bear: -sentimentScore / 10 },
      actionRecommendation: action,
      urgencyFlag: urgency,
      deepDiveLink: `drunkenmiller://analysis/${ticker}/sentiment`,
      notes: `${mentions} mentions (${spikeMultiplier.toFixed(1)}x baseline). Sentiment: ${sentimentScore}. Trend: ${trend}`,
      researchQueue: ['significant', 'major', 'critical'].includes(impact),
      marketReactionPct: sentimentScore / 10,
      tags: [`impact_${impact}`, 'type_sentiment_shift', `direction_${direction}`],
    };
  }

  detectGuruMove(params: {
    ticker: string;
    companyName: string;
    guruName: string;
    fundName: string;
    positionPct: number;
    changePct: number;
    actionDesc: string;
  }): MarketSignal {
    const { ticker, companyName, guruName, fundName, positionPct, changePct, actionDesc } = params;

    let impact: ImpactMagnitude;
    if (positionPct > 20) impact = 'major';      // Huge conviction (like Burry 66% PLTR)
    else if (positionPct > 10) impact = 'significant';
    else if (changePct > 50) impact = 'significant'; // Large add
    else impact = 'monitor';

    const direction: SurpriseDirection = changePct > 0 ? 'positive' : 'negative';
    const { action, urgency } = this.calculateActionRecommendation('insider_trade', direction, impact, 'medium', 'guru_holding');

    return {
      id: `${ticker}_guru_${Date.now()}`,
      ticker,
      companyName,
      signalType: 'insider_trade',
      headline: `${guruName} (${fundName}): ${actionDesc} — ${ticker} now ${positionPct.toFixed(1)}% of portfolio`,
      surpriseMagnitude: Math.min(100, 50 + Math.abs(changePct) / 2),
      impactMagnitude: impact,
      direction,
      timestamp: new Date().toISOString(),
      newsSource: '13f_filing',
      socialSentiment: { mentions: 0, sentimentScore: 0, trend: 'neutral' },
      portfolioRelevance: 'guru_holding',
      affectedPositions: [ticker],
      cascadePotential: positionPct > 20 ? 'high' : 'low',
      scenarioImpact: { base: changePct / 10, bull: changePct / 5, bear: -changePct / 20 },
      actionRecommendation: action,
      urgencyFlag: urgency,
      deepDiveLink: `drunkenmiller://analysis/${ticker}/guru`,
      notes: `${guruName}/${fundName}: ${positionPct.toFixed(1)}% of portfolio. Change: ${changePct > 0 ? '+' : ''}${changePct.toFixed(1)}%`,
      researchQueue: ['significant', 'major', 'critical'].includes(impact),
      marketReactionPct: 0,
      tags: [`impact_${impact}`, 'type_insider_trade', `direction_${direction}`, `guru_${guruName.toLowerCase().replace(/ /g, '_')}`],
    };
  }
}

// ============================================================================
// SIGNAL PUBLISHER (Searchable Cache)
// ============================================================================

class SignalPublisher {
  private headlinesCache: HeadlineEntry[] = [];
  private maxCacheSize = 10000;

  addSignal(signal: MarketSignal): HeadlineEntry {
    const headline: HeadlineEntry = {
      headlineId: signal.id,
      ticker: signal.ticker,
      headline: signal.headline,
      signalType: signal.signalType,
      impactLevel: signal.impactMagnitude,
      direction: signal.direction,
      timestamp: signal.timestamp,
      source: signal.newsSource,
      marketReactionPct: signal.marketReactionPct,
      urgency: signal.urgencyFlag,
      actionRecommended: signal.actionRecommendation,
      deepDiveLink: signal.deepDiveLink,
      cascadePotential: signal.cascadePotential,
      portfolioRelevance: signal.portfolioRelevance,
      sentimentScore: signal.socialSentiment.sentimentScore,
      socialMentions: signal.socialSentiment.mentions,
      notes: signal.notes,
      tags: signal.tags,
    };

    this.headlinesCache.push(headline);
    if (this.headlinesCache.length > this.maxCacheSize) {
      this.headlinesCache.shift(); // FIFO eviction
    }

    return headline;
  }

  search(query: string = '', filters: SearchFilters = {}): HeadlineEntry[] {
    let results = [...this.headlinesCache].reverse(); // most recent first

    if (query) {
      const q = query.toLowerCase();
      results = results.filter(
        h => h.headline.toLowerCase().includes(q) || h.ticker.toLowerCase().includes(q)
      );
    }

    if (filters.ticker) results = results.filter(h => h.ticker === filters.ticker);
    if (filters.impact) results = results.filter(h => h.impactLevel === filters.impact);
    if (filters.signalType) results = results.filter(h => h.signalType === filters.signalType);
    if (filters.direction) results = results.filter(h => h.direction === filters.direction);
    if (filters.urgency !== undefined) results = results.filter(h => h.urgency === filters.urgency);
    if (filters.source) results = results.filter(h => h.source === filters.source);

    return results;
  }

  getRecent(limit = 50): HeadlineEntry[] {
    return [...this.headlinesCache].reverse().slice(0, limit);
  }

  getUrgent(): HeadlineEntry[] {
    return this.search('', { urgency: true });
  }

  getByImpact(impact: ImpactMagnitude, limit = 20): HeadlineEntry[] {
    return this.search('', { impact }).slice(0, limit);
  }

  getStats(): { critical: number; major: number; significant: number; monitor: number; noise: number; total: number } {
    const c = this.headlinesCache;
    return {
      critical: c.filter(h => h.impactLevel === 'critical').length,
      major: c.filter(h => h.impactLevel === 'major').length,
      significant: c.filter(h => h.impactLevel === 'significant').length,
      monitor: c.filter(h => h.impactLevel === 'monitor').length,
      noise: c.filter(h => h.impactLevel === 'noise').length,
      total: c.length,
    };
  }

  getAllHeadlines(): HeadlineEntry[] {
    return this.headlinesCache;
  }
}

// ============================================================================
// DIGEST GENERATOR
// ============================================================================

class DigestGenerator {
  private publisher: SignalPublisher;

  constructor(publisher: SignalPublisher) {
    this.publisher = publisher;
  }

  generateDigest(runTime: '11:30am' | '3:30pm'): DailyDigest {
    const headlines = this.publisher.getRecent(500);
    const now = new Date();

    const critical = this.buildSection(
      'CRITICAL ALERTS',
      headlines.filter(h => h.impactLevel === 'critical'),
      'critical'
    );
    const major = this.buildSection(
      'MAJOR EVENTS',
      headlines.filter(h => h.impactLevel === 'major'),
      'major'
    );
    const sectors = this.buildSection(
      'SECTOR ROTATIONS',
      headlines.filter(h => h.signalType === 'sector_rotation'),
      'sector'
    );
    const macro = this.buildSection(
      'MACRO IMPACTS',
      headlines.filter(h => h.signalType === 'macro_event'),
      'macro'
    );
    const portfolio = this.buildSection(
      'YOUR PORTFOLIO',
      headlines.filter(h => h.portfolioRelevance === 'your_position' || h.portfolioRelevance === 'guru_holding'),
      'portfolio'
    );

    const researchPriorities = this.buildResearchQueue(headlines);
    const summary = this.buildExecutiveSummary(runTime, headlines, critical, major);

    return {
      digestId: `digest_${runTime.replace(':', '')}_${now.toISOString().split('T')[0]}`,
      runTime,
      timestamp: now.toISOString(),
      totalSignals: headlines.length,
      criticalSection: critical,
      majorEventsSection: major,
      sectorRotationsSection: sectors,
      macroImpactsSection: macro,
      portfolioRelevanceSection: portfolio,
      researchPriorities,
      executiveSummary: summary,
      nextRunTime: runTime === '11:30am' ? '3:30pm ET' : '11:30am ET (next day)',
    };
  }

  private buildSection(title: string, headlines: HeadlineEntry[], type: string): DigestSection {
    if (headlines.length === 0) {
      return {
        title,
        description: `No ${type} signals since last digest.`,
        headlines: [],
        keyTakeaway: type === 'critical' ? 'Market stable — no emergency signals.' : `No significant ${type} events.`,
      };
    }

    const neg = headlines.filter(h => h.direction === 'negative').length;
    const pos = headlines.filter(h => h.direction === 'positive').length;
    let takeaway = `${headlines.length} signal(s): `;
    if (neg > 0) takeaway += `${neg} negative`;
    if (pos > 0) takeaway += `${neg > 0 ? ', ' : ''}${pos} positive`;
    takeaway += '.';

    return {
      title,
      description: `${headlines.length} ${type} signal(s) detected.`,
      headlines,
      keyTakeaway: takeaway,
    };
  }

  private buildResearchQueue(headlines: HeadlineEntry[]): ResearchItem[] {
    const priorities: ResearchItem[] = [];

    const criticals = headlines.filter(h => h.impactLevel === 'critical').slice(0, 3);
    for (const h of criticals) {
      priorities.push({
        priority: 'P5-CRITICAL',
        ticker: h.ticker,
        headline: h.headline,
        action: h.actionRecommended,
        deepDive: h.deepDiveLink,
        deadline: 'ASAP (1-2 hours)',
      });
    }

    const majors = headlines.filter(h => h.impactLevel === 'major').slice(0, 3);
    for (const h of majors) {
      priorities.push({
        priority: 'P4-MAJOR',
        ticker: h.ticker,
        headline: h.headline,
        action: h.actionRecommended,
        deepDive: h.deepDiveLink,
        deadline: 'Today (before market close)',
      });
    }

    const portfolio = headlines.filter(h => h.portfolioRelevance === 'your_position' || h.portfolioRelevance === 'guru_holding').slice(0, 2);
    for (const h of portfolio) {
      priorities.push({
        priority: 'P3-PORTFOLIO',
        ticker: h.ticker,
        headline: h.headline,
        action: h.actionRecommended,
        deepDive: h.deepDiveLink,
        deadline: 'Tomorrow',
      });
    }

    return priorities;
  }

  private buildExecutiveSummary(
    runTime: string,
    headlines: HeadlineEntry[],
    critical: DigestSection,
    major: DigestSection
  ): string {
    const lines: string[] = [];
    lines.push(`=== Market Intelligence Digest — ${runTime} ET ===`);
    lines.push('');
    lines.push(`Total signals: ${headlines.length}`);
    lines.push(`  Critical: ${critical.headlines.length}`);
    lines.push(`  Major: ${major.headlines.length}`);
    lines.push(`  Significant: ${headlines.filter(h => h.impactLevel === 'significant').length}`);
    lines.push('');

    if (critical.headlines.length > 0) {
      lines.push('CRITICAL ALERTS:');
      for (const h of critical.headlines.slice(0, 3)) {
        lines.push(`  ${h.ticker}: ${h.headline.substring(0, 60)}...`);
        lines.push(`    Action: ${h.actionRecommended.replace(/_/g, ' ').toUpperCase()}`);
      }
      lines.push('');
    }

    if (major.headlines.length > 0) {
      lines.push('MAJOR EVENTS:');
      for (const h of major.headlines.slice(0, 3)) {
        lines.push(`  ${h.ticker}: ${h.headline.substring(0, 60)}...`);
        lines.push(`    Reaction: ${h.marketReactionPct > 0 ? '+' : ''}${h.marketReactionPct.toFixed(1)}%`);
      }
      lines.push('');
    }

    if (critical.headlines.length > 0) {
      lines.push(`IMMEDIATE ACTION: ${critical.headlines.length} critical alert(s) need analysis.`);
    } else if (major.headlines.length > 0) {
      lines.push(`KEY WATCH: ${major.headlines.length} major event(s) — monitor for cascade effects.`);
    } else {
      lines.push('Market stable with no critical signals.');
    }

    lines.push('');
    lines.push(`Next digest: ${runTime === '11:30am' ? '3:30pm ET' : '11:30am ET (next day)'}`);
    return lines.join('\n');
  }
}

// ============================================================================
// GURU HOLDINGS LOADER
// ============================================================================

function loadGuruPositions(): GuruPosition[] {
  // Try loading from server/data directory
  const csvPaths = [
    path.join(__dirname, '..', 'data', 'guru_top30_positions_q1_2026.csv'),
    path.join(__dirname, '..', '..', 'data', 'guru_top30_positions_q1_2026.csv'),
  ];

  for (const csvPath of csvPaths) {
    try {
      if (!fs.existsSync(csvPath)) continue;
      const raw = fs.readFileSync(csvPath, 'utf-8');
      const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('PORTFOLIO') && !l.startsWith(','));
      const header = lines[0];
      const rows = lines.slice(1);

      const positions: GuruPosition[] = [];
      for (const row of rows) {
        const cols = row.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (!cols[0] || !cols[1]) continue;

        const parsePct = (s: string) => {
          const n = parseFloat(s?.replace('%', '') || '0');
          return isNaN(n) ? 0 : n;
        };

        const burry = parsePct(cols[3]);
        const klarman = parsePct(cols[4]);
        const druck = parsePct(cols[5]);
        const einhorn = parsePct(cols[6]);
        const greenberg = parsePct(cols[7]);
        const ackman = parsePct(cols[8]);
        const abrams = parsePct(cols[9]);
        const tepper = parsePct(cols[10]);
        const allPcts = [burry, klarman, druck, einhorn, greenberg, ackman, abrams, tepper];
        const guruCount = allPcts.filter(p => p > 0).length;
        const consensusWeight = allPcts.reduce((sum, p) => sum + p, 0);

        positions.push({
          rank: parseInt(cols[0]) || 0,
          ticker: cols[1],
          companyName: cols[2] || '',
          burryPct: burry,
          klarmanPct: klarman,
          druckenmillerPct: druck,
          einhornPct: einhorn,
          greenbergPct: greenberg,
          ackmanPct: ackman,
          abramsPct: abrams,
          tepperPct: tepper,
          largestPosition: parsePct(cols[11]),
          fundWithLargest: cols[12] || '',
          statusNotes: cols[13] || '',
          guruCount,
          consensusWeight,
        });
      }

      console.log(`  Guru holdings: Loaded ${positions.length} positions from CSV`);
      return positions;
    } catch (e) {
      // Continue to next path
    }
  }

  console.log('  Guru holdings: Using built-in top positions');
  // Fallback built-in data — 8 gurus (Q1 2026 13F)
  const fallback: Omit<GuruPosition, 'guruCount' | 'consensusWeight'>[] = [
    { rank: 1, ticker: 'PLTR', companyName: 'Palantir Technologies', burryPct: 66, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 0, abramsPct: 0, tepperPct: 0, largestPosition: 66, fundWithLargest: 'Burry/Scion', statusNotes: 'New $912M position; overwhelming conviction' },
    { rank: 2, ticker: 'AMZN', companyName: 'Amazon.com Inc', burryPct: 0, klarmanPct: 12.7, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 0, abramsPct: 0, tepperPct: 6.8, largestPosition: 12.7, fundWithLargest: 'Klarman/Baupost', statusNotes: 'Massive 120% add; Tepper also holds' },
    { rank: 3, ticker: 'QSR', companyName: 'Restaurant Brands Intl', burryPct: 0, klarmanPct: 11.67, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 16.8, abramsPct: 0, tepperPct: 0, largestPosition: 16.8, fundWithLargest: 'Ackman/Pershing Square', statusNotes: 'Klarman + Ackman top conviction' },
    { rank: 4, ticker: 'OMF', companyName: 'OneMain Holdings', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 12.25, ackmanPct: 0, abramsPct: 0, tepperPct: 0, largestPosition: 12.25, fundWithLargest: 'Greenberg/Brave Warrior', statusNotes: 'Consumer finance' },
    { rank: 5, ticker: 'NVDA', companyName: 'NVIDIA Corporation', burryPct: 13.5, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 0, abramsPct: 0, tepperPct: 0, largestPosition: 13.5, fundWithLargest: 'Burry/Scion', statusNotes: 'AI infrastructure' },
    { rank: 6, ticker: 'NTRA', companyName: 'Natera Inc', burryPct: 0, klarmanPct: 0, druckenmillerPct: 12.8, einhornPct: 0, greenbergPct: 0, ackmanPct: 0, abramsPct: 0, tepperPct: 0, largestPosition: 12.8, fundWithLargest: 'Druckenmiller/Duquesne', statusNotes: 'Genetic testing' },
    { rank: 7, ticker: 'PFE', companyName: 'Pfizer Inc', burryPct: 11.1, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 0, abramsPct: 0, tepperPct: 0, largestPosition: 11.1, fundWithLargest: 'Burry/Scion', statusNotes: '610% add' },
    { rank: 8, ticker: 'ANTM', companyName: 'Anthem Inc', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 10.28, greenbergPct: 7.3, ackmanPct: 0, abramsPct: 0, tepperPct: 0, largestPosition: 10.28, fundWithLargest: 'Einhorn/Greenlight', statusNotes: 'Multi-guru holding' },
    { rank: 9, ticker: 'HLT', companyName: 'Hilton Worldwide', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 19.2, abramsPct: 0, tepperPct: 0, largestPosition: 19.2, fundWithLargest: 'Ackman/Pershing Square', statusNotes: 'Ackman largest holding' },
    { rank: 10, ticker: 'GOOGL', companyName: 'Alphabet Inc', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 15.5, abramsPct: 12.8, tepperPct: 8.2, largestPosition: 15.5, fundWithLargest: 'Ackman/Pershing Square', statusNotes: '3-guru consensus' },
    { rank: 11, ticker: 'TMUS', companyName: 'T-Mobile US', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 0, abramsPct: 22.1, tepperPct: 0, largestPosition: 22.1, fundWithLargest: 'Abrams/Abrams Capital', statusNotes: 'Concentrated telecom' },
    { rank: 12, ticker: 'META', companyName: 'Meta Platforms', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 0, abramsPct: 15.5, tepperPct: 7.1, largestPosition: 15.5, fundWithLargest: 'Abrams/Abrams Capital', statusNotes: 'Abrams + Tepper adding' },
    { rank: 13, ticker: 'BABA', companyName: 'Alibaba Group', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 0, abramsPct: 0, tepperPct: 14.8, largestPosition: 14.8, fundWithLargest: 'Tepper/Appaloosa', statusNotes: 'China reopening bet' },
    { rank: 14, ticker: 'CP', companyName: 'Canadian Pacific Kansas City', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 13.1, abramsPct: 0, tepperPct: 0, largestPosition: 13.1, fundWithLargest: 'Ackman/Pershing Square', statusNotes: 'Concentrated rail play' },
    { rank: 15, ticker: 'NKE', companyName: 'Nike Inc', burryPct: 0, klarmanPct: 0, druckenmillerPct: 0, einhornPct: 0, greenbergPct: 0, ackmanPct: 8.7, abramsPct: 0, tepperPct: 5.5, largestPosition: 8.7, fundWithLargest: 'Ackman/Pershing Square', statusNotes: 'Ackman + Tepper new positions' },
  ];

  return fallback.map(pos => {
    const pcts = [pos.burryPct, pos.klarmanPct, pos.druckenmillerPct, pos.einhornPct, pos.greenbergPct, pos.ackmanPct, pos.abramsPct, pos.tepperPct];
    return {
      ...pos,
      guruCount: pcts.filter(p => p > 0).length,
      consensusWeight: pcts.reduce((s, p) => s + p, 0),
    };
  });
}

// ============================================================================
// DEMO SIGNAL GENERATION
// ============================================================================

function generateDemoSignals(detector: AnomalyDetector, guruPositions: GuruPosition[]): MarketSignal[] {
  const signals: MarketSignal[] = [];
  const now = new Date();

  // 1. Earnings surprise: MOH (your position + guru holding)
  signals.push(detector.detectEarningsSurprise({
    ticker: 'MOH',
    companyName: 'Molina Healthcare',
    epsActual: 3.45,
    epsExpected: 3.20,
    epsBeatPct: 7.8,
    guidance: 'Raised FY2026 guidance by 5%',
    stockReactionPct: 8.5,
    portfolioRelevance: 'your_position',
  }));

  // 2. Regulatory: ANTM DOJ lawsuit
  signals.push(detector.detectRegulatorySurprise({
    ticker: 'ANTM',
    companyName: 'Anthem Inc',
    actionType: 'doj_lawsuit',
    description: 'DOJ files antitrust lawsuit against Anthem over regional healthcare consolidation',
    industryImpact: ['healthcare', 'insurance', 'pharmacy'],
    marketCapMillions: 145000,
    portfolioRelevance: 'your_position',
  }));

  // 3. Macro: Oil spike
  signals.push(detector.detectMacroEvent({
    eventType: 'Oil Price Spike',
    headline: 'Crude oil surges 7% on Iran escalation threat — energy sector rallying',
    description: 'Geopolitical risk escalation driving oil above $95. Airlines and cruise lines face margin pressure. Energy services (HAL) benefit.',
    affectedSectors: ['energy', 'airlines', 'cruise', 'transportation'],
    impactEstimate: 3.5,
  }));

  // 4. Sentiment spike: PLTR (Burry's 66% position)
  signals.push(detector.detectSentimentShift({
    ticker: 'PLTR',
    companyName: 'Palantir Technologies',
    mentions: 12500,
    baselineMentions: 800,
    sentimentScore: 72,
    trend: 'rapidly_bullish',
    portfolioRelevance: 'guru_holding',
  }));

  // 5. NVDA earnings beat
  signals.push(detector.detectEarningsSurprise({
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    epsActual: 6.12,
    epsExpected: 5.58,
    epsBeatPct: 9.7,
    guidance: 'Raised FY2026 datacenter guidance +12%',
    stockReactionPct: 6.3,
    portfolioRelevance: 'guru_holding',
  }));

  // 6. Guru moves from Q1 2026 data
  const guruMoves = [
    { ticker: 'PLTR', companyName: 'Palantir Technologies', guruName: 'Burry', fundName: 'Scion', positionPct: 66, changePct: 100, actionDesc: 'NEW massive position' },
    { ticker: 'AMZN', companyName: 'Amazon.com Inc', guruName: 'Klarman', fundName: 'Baupost', positionPct: 12.7, changePct: 120, actionDesc: 'Added 120%' },
    { ticker: 'PFE', companyName: 'Pfizer Inc', guruName: 'Burry', fundName: 'Scion', positionPct: 11.1, changePct: 610.65, actionDesc: 'Added 610%' },
    { ticker: 'QSR', companyName: 'Restaurant Brands International', guruName: 'Klarman', fundName: 'Baupost', positionPct: 11.67, changePct: 103.8, actionDesc: 'Added 104%' },
    { ticker: 'NTRA', companyName: 'Natera Inc', guruName: 'Druckenmiller', fundName: 'Duquesne', positionPct: 12.8, changePct: 0, actionDesc: 'Maintained largest position' },
  ];

  for (const m of guruMoves) {
    signals.push(detector.detectGuruMove(m));
  }

  // 7. Sector rotation
  const sectorSignal: MarketSignal = {
    id: `SECTOR_${Date.now()}`,
    ticker: 'XLE',
    companyName: 'Energy Sector',
    signalType: 'sector_rotation',
    headline: 'Sector rotation: Funds flowing from healthcare to energy on oil spike + regulatory concerns',
    surpriseMagnitude: 70,
    impactMagnitude: 'significant',
    direction: 'mixed',
    timestamp: new Date(now.getTime() - 2 * 3600000).toISOString(),
    newsSource: 'flow_data',
    socialSentiment: { mentions: 0, sentimentScore: 0, trend: 'neutral' },
    portfolioRelevance: 'sector_exposure',
    affectedPositions: ['XLE', 'HAL', 'MOH', 'ANTM'],
    cascadePotential: 'medium',
    scenarioImpact: { base: 2.3, bull: 4, bear: -1 },
    actionRecommendation: 'monitor_closely',
    urgencyFlag: false,
    deepDiveLink: 'drunkenmiller://analysis/XLE/sector_rotation',
    notes: 'Healthcare -1.2%, Energy +2.3%. Triggered by ANTM DOJ + oil spike.',
    researchQueue: true,
    marketReactionPct: 2.3,
    tags: ['impact_significant', 'type_sector_rotation', 'direction_mixed'],
  };
  signals.push(sectorSignal);

  // Stagger timestamps so they look like they came in throughout the day
  const baseTime = now.getTime();
  for (let i = 0; i < signals.length; i++) {
    const offset = (signals.length - i) * 15 * 60 * 1000; // 15 min apart
    signals[i].timestamp = new Date(baseTime - offset).toISOString();
  }

  return signals;
}

// ============================================================================
// SYSTEM STATE
// ============================================================================

const detector = new AnomalyDetector();
const publisher = new SignalPublisher();
const digestGenerator = new DigestGenerator(publisher);
let guruPositions: GuruPosition[] = [];
let lastRefresh: string | null = null;
let demoLoaded = false;

function initializeSystem() {
  guruPositions = loadGuruPositions();

  if (!demoLoaded) {
    const demoSignals = generateDemoSignals(detector, guruPositions);
    for (const signal of demoSignals) {
      publisher.addSignal(signal);
    }
    demoLoaded = true;
    lastRefresh = new Date().toISOString();
    console.log(`  Market Intel: ${demoSignals.length} demo signals loaded`);
  }
}

// Initialize on module load
initializeSystem();

// ============================================================================
// REST API ENDPOINTS
// ============================================================================

// GET /intel/status — System status
router.get('/intel/status', (req: Request, res: Response) => {
  const stats = publisher.getStats();
  res.json({
    status: 'online',
    lastRefresh,
    stats,
    guruPositionsLoaded: guruPositions.length,
    nextDigest: '3:30pm ET',
  });
});

// GET /intel/headlines — Recent headlines (with optional limit)
router.get('/intel/headlines', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  const headlines = publisher.getRecent(limit);
  res.json({ headlines, count: headlines.length });
});

// GET /intel/search — Search headlines
router.get('/intel/search', (req: Request, res: Response) => {
  const query = (req.query.q as string) || '';
  const filters: SearchFilters = {};
  if (req.query.ticker) filters.ticker = req.query.ticker as string;
  if (req.query.impact) filters.impact = req.query.impact as ImpactMagnitude;
  if (req.query.signal_type) filters.signalType = req.query.signal_type as SignalType;
  if (req.query.direction) filters.direction = req.query.direction as SurpriseDirection;
  if (req.query.urgency === 'true') filters.urgency = true;
  if (req.query.source) filters.source = req.query.source as string;

  const results = publisher.search(query, filters);
  res.json({ results, count: results.length, query, filters });
});

// GET /intel/headlines/:ticker — Ticker-specific headlines
router.get('/intel/headlines/:ticker', (req: Request, res: Response) => {
  const ticker = (req.params.ticker as string).toUpperCase();
  const results = publisher.search('', { ticker });
  res.json({ ticker, headlines: results, count: results.length });
});

// GET /intel/critical — Urgent/critical alerts only
router.get('/intel/critical', (req: Request, res: Response) => {
  const urgent = publisher.getUrgent();
  const critical = publisher.getByImpact('critical');
  const combined = [...new Map([...urgent, ...critical].map(h => [h.headlineId, h])).values()];
  res.json({ alerts: combined, count: combined.length });
});

// GET /intel/digest — Generate daily digest
router.get('/intel/digest', (req: Request, res: Response) => {
  const runTime = (req.query.run_time as string) === '3:30pm' ? '3:30pm' : '11:30am';
  const digest = digestGenerator.generateDigest(runTime as '11:30am' | '3:30pm');
  res.json(digest);
});

// GET /intel/research — Research queue
router.get('/intel/research', (req: Request, res: Response) => {
  const headlines = publisher.getRecent(200);
  const criticals = headlines.filter(h => h.impactLevel === 'critical').slice(0, 3);
  const majors = headlines.filter(h => h.impactLevel === 'major').slice(0, 3);
  const portfolio = headlines.filter(h => h.portfolioRelevance === 'your_position' || h.portfolioRelevance === 'guru_holding').slice(0, 2);

  const queue: ResearchItem[] = [];
  for (const h of criticals) queue.push({ priority: 'P5-CRITICAL', ticker: h.ticker, headline: h.headline, action: h.actionRecommended, deepDive: h.deepDiveLink, deadline: 'ASAP (1-2 hours)' });
  for (const h of majors) queue.push({ priority: 'P4-MAJOR', ticker: h.ticker, headline: h.headline, action: h.actionRecommended, deepDive: h.deepDiveLink, deadline: 'Today' });
  for (const h of portfolio) queue.push({ priority: 'P3-PORTFOLIO', ticker: h.ticker, headline: h.headline, action: h.actionRecommended, deepDive: h.deepDiveLink, deadline: 'Tomorrow' });

  res.json({ queue, count: queue.length });
});

// GET /intel/guru — Guru positions
router.get('/intel/guru', (req: Request, res: Response) => {
  res.json({ positions: guruPositions, count: guruPositions.length });
});

// GET /intel/guru/:ticker — Guru positions for specific ticker
router.get('/intel/guru/:ticker', (req: Request, res: Response) => {
  const ticker = (req.params.ticker as string).toUpperCase();
  const matches = guruPositions.filter(g => g.ticker === ticker);
  res.json({ ticker, positions: matches });
});

// POST /intel/signal — Add a new signal (manual or from external source)
router.post('/intel/signal', (req: Request, res: Response) => {
  try {
    const body = req.body;
    let signal: MarketSignal;

    switch (body.type) {
      case 'earnings':
        signal = detector.detectEarningsSurprise(body);
        break;
      case 'regulatory':
        signal = detector.detectRegulatorySurprise(body);
        break;
      case 'macro':
        signal = detector.detectMacroEvent(body);
        break;
      case 'sentiment':
        signal = detector.detectSentimentShift(body);
        break;
      case 'guru':
        signal = detector.detectGuruMove(body);
        break;
      default:
        res.status(400).json({ error: 'Unknown signal type. Use: earnings, regulatory, macro, sentiment, guru' });
        return;
    }

    const headline = publisher.addSignal(signal);
    res.json({ success: true, signal, headline });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /intel/refresh — Regenerate demo signals
router.post('/intel/refresh', (req: Request, res: Response) => {
  demoLoaded = false;
  initializeSystem();
  const stats = publisher.getStats();
  res.json({ success: true, message: 'System refreshed with demo signals', stats });
});

export default router;
