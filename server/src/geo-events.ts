/**
 * Geopolitical & Macro Event Engine
 * ===================================
 * Real-time geopolitical and macroeconomic event detection with
 * 1st/2nd/3rd order effect chain mapping across sectors and positions.
 *
 * Features:
 * - Multi-source news ingestion (web search across diverse, credible sources)
 * - Event classification (geopolitical, monetary, fiscal, trade, conflict, energy, regulatory)
 * - Cascading effect chain analysis (1st → 2nd → 3rd order effects)
 * - Portfolio exposure mapping
 * - Severity scoring and priority ranking
 * - Claude-powered analysis for nuanced interpretation
 * - Earnings calendar integration (Yahoo Finance + GuruFocus)
 */

import { Router, Request, Response } from 'express';

const router = Router();

// ============================================================================
// TYPES
// ============================================================================

type EventCategory =
  | 'geopolitical_conflict'
  | 'monetary_policy'
  | 'fiscal_policy'
  | 'trade_war'
  | 'energy_shock'
  | 'regulatory'
  | 'pandemic_health'
  | 'currency_crisis'
  | 'sovereign_debt'
  | 'election_political'
  | 'natural_disaster'
  | 'tech_disruption'
  | 'sanctions'
  | 'supply_chain';

type Severity = 'low' | 'moderate' | 'high' | 'critical';

interface EffectChain {
  order: 1 | 2 | 3;
  sector: string;
  effect: string;
  direction: 'positive' | 'negative' | 'mixed';
  magnitude: 'minor' | 'moderate' | 'major';
  tickers: string[];
  timeframe: string;
}

interface GeoEvent {
  id: string;
  timestamp: string;
  title: string;
  summary: string;
  category: EventCategory;
  severity: Severity;
  region: string;
  sources: string[];
  effectChains: EffectChain[];
  portfolioExposure: { ticker: string; impact: string; direction: 'positive' | 'negative' | 'neutral' }[];
  analysisNotes: string;
  lastUpdated: string;
}

interface EarningsEntry {
  ticker: string;
  companyName: string;
  reportDate: string;
  daysUntil: number;
  estimatedEPS: number | null;
  previousEPS: number | null;
  surpriseHistory: { quarter: string; surprise: number }[];
  source: string;
}

// ============================================================================
// TRACKED INSTRUMENTS (from the Druck Engine universe)
// ============================================================================

const TRACKED_TICKERS = [
  // Mega-cap tech
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'ARM',
  // Semis
  'TSM', 'INTC', 'MU', 'AMD', 'QCOM', 'MRVL',
  // Financials
  'GS', 'BAC', 'C', 'WFC', 'ALLY',
  // Airlines
  'DAL', 'AAL', 'UAL',
  // Energy
  'XOM', 'CVX', 'OXY',
  // Consumer/Media
  'WBD', 'NFLX', 'DIS',
  // Industrials
  'LIN', 'HON', 'BA', 'RTX',
  // Other guru favorites
  'UBER', 'NET', 'CRM', 'BABA', 'DKNG', 'LUMN', 'HMC', 'PFE',
  // ETFs/Indices for macro
  'SPY', 'QQQ', 'IWM', 'TLT', 'HYG', 'USO', 'GLD', 'UUP', 'EEM', 'FXI'
];

// ============================================================================
// SECTOR / EFFECT CHAIN MAPPINGS
// ============================================================================

const SECTOR_TICKER_MAP: Record<string, string[]> = {
  'technology': ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'NVDA', 'CRM', 'NET'],
  'semiconductors': ['NVDA', 'TSM', 'INTC', 'MU', 'AMD', 'AVGO', 'ARM', 'QCOM', 'MRVL'],
  'airlines': ['DAL', 'AAL', 'UAL'],
  'energy': ['XOM', 'CVX', 'OXY', 'USO'],
  'financials': ['GS', 'BAC', 'C', 'WFC', 'ALLY'],
  'defense': ['RTX', 'BA'],
  'industrials': ['LIN', 'HON', 'BA'],
  'consumer_discretionary': ['TSLA', 'AMZN', 'UBER', 'DKNG', 'NFLX', 'DIS'],
  'healthcare': ['PFE'],
  'china_exposed': ['BABA', 'TSM', 'AAPL', 'NVDA', 'FXI', 'EEM'],
  'safe_havens': ['GLD', 'TLT', 'UUP'],
  'media': ['WBD', 'NFLX', 'DIS', 'META'],
  'telecom': ['LUMN'],
  'auto': ['TSLA', 'HMC'],
};

// Known geopolitical effect chain templates
const EFFECT_TEMPLATES: Record<string, { effects: Omit<EffectChain, 'tickers'>[] }> = {
  'middle_east_conflict': {
    effects: [
      { order: 1, sector: 'energy', effect: 'Oil prices spike on supply disruption fears', direction: 'negative', magnitude: 'major', timeframe: 'immediate (hours-days)' },
      { order: 1, sector: 'defense', effect: 'Defense stocks rally on increased military spending expectations', direction: 'positive', magnitude: 'moderate', timeframe: 'immediate (days)' },
      { order: 2, sector: 'airlines', effect: 'Fuel costs surge, margin compression', direction: 'negative', magnitude: 'major', timeframe: 'weeks' },
      { order: 2, sector: 'consumer_discretionary', effect: 'Consumer confidence drops, discretionary spending declines', direction: 'negative', magnitude: 'moderate', timeframe: 'weeks-months' },
      { order: 3, sector: 'financials', effect: 'Credit spreads widen, lending slows', direction: 'negative', magnitude: 'minor', timeframe: 'months' },
      { order: 3, sector: 'safe_havens', effect: 'Flight to safety: gold, treasuries, dollar rally', direction: 'positive', magnitude: 'moderate', timeframe: 'weeks-months' },
    ]
  },
  'fed_rate_hike': {
    effects: [
      { order: 1, sector: 'financials', effect: 'Net interest margins expand for banks', direction: 'positive', magnitude: 'moderate', timeframe: 'immediate' },
      { order: 1, sector: 'technology', effect: 'Growth stocks derate on higher discount rates', direction: 'negative', magnitude: 'moderate', timeframe: 'immediate' },
      { order: 2, sector: 'consumer_discretionary', effect: 'Higher borrowing costs reduce consumer spending', direction: 'negative', magnitude: 'moderate', timeframe: 'months' },
      { order: 2, sector: 'auto', effect: 'Auto loan rates rise, demand softens', direction: 'negative', magnitude: 'moderate', timeframe: 'months' },
      { order: 3, sector: 'safe_havens', effect: 'Dollar strengthens, EM currencies weaken', direction: 'mixed', magnitude: 'moderate', timeframe: 'months' },
    ]
  },
  'fed_rate_cut': {
    effects: [
      { order: 1, sector: 'technology', effect: 'Growth stocks rerate higher on lower discount rates', direction: 'positive', magnitude: 'moderate', timeframe: 'immediate' },
      { order: 1, sector: 'financials', effect: 'Net interest margins compress', direction: 'negative', magnitude: 'minor', timeframe: 'weeks' },
      { order: 2, sector: 'consumer_discretionary', effect: 'Lower borrowing costs boost consumer spending', direction: 'positive', magnitude: 'moderate', timeframe: 'months' },
      { order: 2, sector: 'auto', effect: 'Auto loan rates drop, demand recovers', direction: 'positive', magnitude: 'moderate', timeframe: 'months' },
      { order: 3, sector: 'china_exposed', effect: 'Weaker dollar boosts EM flows', direction: 'positive', magnitude: 'minor', timeframe: 'months' },
    ]
  },
  'china_trade_escalation': {
    effects: [
      { order: 1, sector: 'china_exposed', effect: 'Direct tariff impact on China-revenue companies', direction: 'negative', magnitude: 'major', timeframe: 'immediate' },
      { order: 1, sector: 'semiconductors', effect: 'Export controls disrupt chip supply chains', direction: 'negative', magnitude: 'major', timeframe: 'weeks' },
      { order: 2, sector: 'technology', effect: 'Hardware costs rise, consumer electronics prices up', direction: 'negative', magnitude: 'moderate', timeframe: 'months' },
      { order: 2, sector: 'auto', effect: 'Supply chain disruptions, parts shortages', direction: 'negative', magnitude: 'moderate', timeframe: 'months' },
      { order: 3, sector: 'safe_havens', effect: 'Risk-off sentiment drives gold and treasury demand', direction: 'positive', magnitude: 'minor', timeframe: 'weeks-months' },
    ]
  },
  'energy_supply_shock': {
    effects: [
      { order: 1, sector: 'energy', effect: 'Oil/gas producers benefit from higher prices', direction: 'positive', magnitude: 'major', timeframe: 'immediate' },
      { order: 2, sector: 'airlines', effect: 'Jet fuel costs spike, margins crushed', direction: 'negative', magnitude: 'major', timeframe: 'weeks' },
      { order: 2, sector: 'industrials', effect: 'Higher input costs, margin pressure', direction: 'negative', magnitude: 'moderate', timeframe: 'weeks-months' },
      { order: 3, sector: 'consumer_discretionary', effect: 'Gas prices reduce disposable income', direction: 'negative', magnitude: 'moderate', timeframe: 'months' },
      { order: 3, sector: 'technology', effect: 'Data center energy costs rise', direction: 'negative', magnitude: 'minor', timeframe: 'months' },
    ]
  },
  'sanctions_escalation': {
    effects: [
      { order: 1, sector: 'energy', effect: 'Sanctioned energy exports disrupted', direction: 'mixed', magnitude: 'major', timeframe: 'immediate' },
      { order: 1, sector: 'financials', effect: 'Banks face compliance costs, transaction bans', direction: 'negative', magnitude: 'moderate', timeframe: 'immediate' },
      { order: 2, sector: 'china_exposed', effect: 'Secondary sanctions risk for companies with sanctioned country ties', direction: 'negative', magnitude: 'moderate', timeframe: 'weeks' },
      { order: 3, sector: 'defense', effect: 'Geopolitical escalation increases defense budgets', direction: 'positive', magnitude: 'minor', timeframe: 'months' },
    ]
  },
  'pandemic_outbreak': {
    effects: [
      { order: 1, sector: 'airlines', effect: 'Travel restrictions, demand collapse', direction: 'negative', magnitude: 'major', timeframe: 'immediate' },
      { order: 1, sector: 'healthcare', effect: 'Pharma/biotech rally on treatment demand', direction: 'positive', magnitude: 'major', timeframe: 'immediate' },
      { order: 2, sector: 'technology', effect: 'Remote work beneficiaries see demand surge', direction: 'positive', magnitude: 'moderate', timeframe: 'weeks' },
      { order: 2, sector: 'consumer_discretionary', effect: 'Brick-and-mortar retail crushed', direction: 'negative', magnitude: 'major', timeframe: 'weeks-months' },
      { order: 3, sector: 'financials', effect: 'Loan defaults rise, credit quality deteriorates', direction: 'negative', magnitude: 'moderate', timeframe: 'months' },
    ]
  },
  'regulatory_crackdown': {
    effects: [
      { order: 1, sector: 'technology', effect: 'Targeted companies face fines, business model changes', direction: 'negative', magnitude: 'moderate', timeframe: 'immediate' },
      { order: 2, sector: 'media', effect: 'Content/ad regulation impacts revenue models', direction: 'negative', magnitude: 'moderate', timeframe: 'months' },
      { order: 3, sector: 'consumer_discretionary', effect: 'Compliance costs passed to consumers', direction: 'negative', magnitude: 'minor', timeframe: 'months' },
    ]
  },
  'currency_crisis': {
    effects: [
      { order: 1, sector: 'china_exposed', effect: 'EM currency collapse hits exporters and multinationals', direction: 'negative', magnitude: 'major', timeframe: 'immediate' },
      { order: 1, sector: 'safe_havens', effect: 'Dollar and gold rally on safe-haven flows', direction: 'positive', magnitude: 'moderate', timeframe: 'immediate' },
      { order: 2, sector: 'financials', effect: 'EM debt exposure creates bank contagion risk', direction: 'negative', magnitude: 'moderate', timeframe: 'weeks' },
      { order: 3, sector: 'technology', effect: 'International revenue translation losses', direction: 'negative', magnitude: 'minor', timeframe: 'months' },
    ]
  },
};

// ============================================================================
// IN-MEMORY EVENT STORE
// ============================================================================

let eventStore: GeoEvent[] = [];
let earningsStore: EarningsEntry[] = [];
let lastEventScan: number = 0;
let lastEarningsScan: number = 0;

const EVENT_CACHE_MS = 30 * 60 * 1000;     // 30 min for events
const EARNINGS_CACHE_MS = 6 * 60 * 60 * 1000; // 6 hours for earnings

// ============================================================================
// NEWS SEARCH ENGINE (multi-source)
// ============================================================================

interface NewsItem {
  title: string;
  snippet: string;
  source: string;
  url: string;
  date: string;
}

/**
 * Search for geopolitical/macro news across diverse sources.
 * Uses multiple search queries to capture different angles and perspectives.
 */
async function searchGeoNews(): Promise<NewsItem[]> {
  const searchQueries = [
    // Broad geopolitical
    'major geopolitical events today global markets impact',
    'geopolitical crisis conflict escalation markets',
    // Monetary/fiscal
    'federal reserve rate decision monetary policy',
    'central bank policy change interest rates global',
    // Trade/sanctions
    'trade war tariffs sanctions economic impact',
    // Energy/commodities
    'oil price shock energy supply disruption OPEC',
    // Regional tensions
    'Middle East conflict Iran oil strait hormuz',
    'China Taiwan tensions trade restrictions',
    'Russia Ukraine sanctions energy Europe',
    // Market-moving regulatory
    'antitrust regulation big tech SEC enforcement',
  ];

  const allNews: NewsItem[] = [];

  for (const query of searchQueries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + ' when:3d')}&hl=en-US&gl=US&ceid=US:en`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DruckEngine/7.0)' }
      });

      if (response.ok) {
        const text = await response.text();
        // Parse RSS XML
        const items = parseRSSItems(text);
        allNews.push(...items);
      }
    } catch (err) {
      // Continue with other queries
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const unique = allNews.filter(item => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
}

function parseRSSItems(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const description = extractTag(itemXml, 'description');
    const pubDate = extractTag(itemXml, 'pubDate');
    const source = extractTag(itemXml, 'source');

    if (title) {
      items.push({
        title: decodeHTMLEntities(title),
        snippet: decodeHTMLEntities(description || ''),
        source: source || extractDomain(link || ''),
        url: link || '',
        date: pubDate || new Date().toISOString(),
      });
    }
  }
  return items;
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA
  const cdataRegex = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

function decodeHTMLEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ''); // strip HTML tags
}

// ============================================================================
// CLAUDE-POWERED EVENT ANALYSIS
// ============================================================================

async function analyzeEventsWithClaude(
  newsItems: NewsItem[],
  anthropicApiKey: string
): Promise<GeoEvent[]> {
  if (!anthropicApiKey || newsItems.length === 0) {
    return classifyEventsLocally(newsItems);
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: anthropicApiKey });

    // Send batch of headlines for analysis
    const headlines = newsItems.slice(0, 40).map((n, i) =>
      `[${i}] ${n.title} (${n.source}, ${n.date})\n    ${n.snippet.substring(0, 200)}`
    ).join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: `You are a geopolitical and macro analyst for a hedge fund. Analyze these headlines and identify SIGNIFICANT geopolitical or macroeconomic events that could move markets. Ignore routine corporate news, earnings, and minor stories. Focus on:
- Military conflicts, tensions, escalations
- Central bank policy changes (Fed, ECB, BOJ, PBOC)
- Trade wars, tariffs, sanctions
- Energy supply disruptions (OPEC, pipeline, shipping)
- Regulatory crackdowns
- Currency crises
- Major political events (elections, coups, policy shifts)

For each significant event, provide the 1st, 2nd, and 3rd order effects on market sectors.

Headlines:
${headlines}

Respond in JSON format:
{
  "events": [
    {
      "title": "Brief event title",
      "summary": "2-3 sentence summary of what happened and why it matters",
      "category": "geopolitical_conflict|monetary_policy|fiscal_policy|trade_war|energy_shock|regulatory|sanctions|currency_crisis|election_political",
      "severity": "low|moderate|high|critical",
      "region": "Middle East|Europe|Asia-Pacific|Americas|Global",
      "sourceIndices": [0, 3, 7],
      "effects": [
        {
          "order": 1,
          "sector": "energy|airlines|technology|semiconductors|financials|defense|industrials|consumer_discretionary|healthcare|china_exposed|safe_havens|media|auto",
          "effect": "What happens to this sector",
          "direction": "positive|negative|mixed",
          "magnitude": "minor|moderate|major",
          "timeframe": "immediate|weeks|months"
        }
      ],
      "analysisNotes": "Nuanced context — what to watch for, historical parallels, contrarian considerations"
    }
  ]
}

Only include events with genuine market impact. If nothing significant is happening, return {"events": []}. Return ONLY valid JSON.`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{"events":[]}';

    // Clean potential markdown fences
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return (parsed.events || []).map((evt: any, idx: number) => {
      const effectChains: EffectChain[] = (evt.effects || []).map((e: any) => ({
        ...e,
        tickers: SECTOR_TICKER_MAP[e.sector] || [],
      }));

      // Map portfolio exposure from effect chains
      const exposureMap = new Map<string, { impact: string; direction: string }>();
      for (const chain of effectChains) {
        for (const ticker of chain.tickers) {
          if (!exposureMap.has(ticker) || chain.order < (exposureMap.get(ticker) as any).order) {
            exposureMap.set(ticker, { impact: chain.effect, direction: chain.direction });
          }
        }
      }

      return {
        id: `geo-${Date.now()}-${idx}`,
        timestamp: new Date().toISOString(),
        title: evt.title,
        summary: evt.summary,
        category: evt.category,
        severity: evt.severity,
        region: evt.region,
        sources: (evt.sourceIndices || []).map((i: number) => newsItems[i]?.source || 'unknown'),
        effectChains,
        portfolioExposure: Array.from(exposureMap.entries()).map(([ticker, info]) => ({
          ticker,
          impact: info.impact,
          direction: info.direction as 'positive' | 'negative' | 'neutral',
        })),
        analysisNotes: evt.analysisNotes || '',
        lastUpdated: new Date().toISOString(),
      };
    });
  } catch (err) {
    console.error('Claude geo-event analysis error:', err);
    return classifyEventsLocally(newsItems);
  }
}

/**
 * Fallback local classification when Claude API isn't available
 */
function classifyEventsLocally(newsItems: NewsItem[]): GeoEvent[] {
  const events: GeoEvent[] = [];
  const keywords: Record<string, { category: EventCategory; template: string; severity: Severity }> = {
    'iran': { category: 'geopolitical_conflict', template: 'middle_east_conflict', severity: 'high' },
    'strait of hormuz': { category: 'energy_shock', template: 'energy_supply_shock', severity: 'critical' },
    'opec': { category: 'energy_shock', template: 'energy_supply_shock', severity: 'moderate' },
    'federal reserve': { category: 'monetary_policy', template: 'fed_rate_hike', severity: 'high' },
    'rate cut': { category: 'monetary_policy', template: 'fed_rate_cut', severity: 'high' },
    'rate hike': { category: 'monetary_policy', template: 'fed_rate_hike', severity: 'high' },
    'tariff': { category: 'trade_war', template: 'china_trade_escalation', severity: 'high' },
    'sanction': { category: 'sanctions', template: 'sanctions_escalation', severity: 'high' },
    'china taiwan': { category: 'geopolitical_conflict', template: 'china_trade_escalation', severity: 'critical' },
    'russia ukraine': { category: 'geopolitical_conflict', template: 'sanctions_escalation', severity: 'high' },
    'oil spike': { category: 'energy_shock', template: 'energy_supply_shock', severity: 'high' },
    'pipeline': { category: 'energy_shock', template: 'energy_supply_shock', severity: 'moderate' },
    'antitrust': { category: 'regulatory', template: 'regulatory_crackdown', severity: 'moderate' },
    'pandemic': { category: 'pandemic_health', template: 'pandemic_outbreak', severity: 'critical' },
    'currency crash': { category: 'currency_crisis', template: 'currency_crisis', severity: 'high' },
  };

  for (const item of newsItems) {
    const lower = (item.title + ' ' + item.snippet).toLowerCase();
    for (const [keyword, config] of Object.entries(keywords)) {
      if (lower.includes(keyword)) {
        const template = EFFECT_TEMPLATES[config.template];
        if (template) {
          const effectChains: EffectChain[] = template.effects.map(e => ({
            ...e,
            tickers: SECTOR_TICKER_MAP[e.sector] || [],
          }));

          // Build portfolio exposure from effect chains
          const exposureMap = new Map<string, { impact: string; direction: 'positive' | 'negative' | 'neutral' }>();
          for (const chain of effectChains) {
            for (const t of chain.tickers) {
              if (!exposureMap.has(t)) {
                exposureMap.set(t, {
                  impact: chain.effect,
                  direction: chain.direction === 'mixed' ? 'neutral' : chain.direction,
                });
              }
            }
          }

          events.push({
            id: `geo-local-${Date.now()}-${events.length}`,
            timestamp: item.date,
            title: item.title,
            summary: item.snippet || item.title,
            category: config.category,
            severity: config.severity,
            region: 'Global',
            sources: [item.source],
            effectChains,
            portfolioExposure: Array.from(exposureMap.entries()).map(([ticker, info]) => ({
              ticker,
              impact: info.impact,
              direction: info.direction,
            })),
            analysisNotes: 'Classified by keyword matching (Claude analysis unavailable)',
            lastUpdated: new Date().toISOString(),
          });
        }
        break; // One classification per headline
      }
    }
  }

  // Deduplicate: keep at most 3 events per category (most recent)
  const byCategory = new Map<string, GeoEvent[]>();
  for (const evt of events) {
    if (!byCategory.has(evt.category)) byCategory.set(evt.category, []);
    byCategory.get(evt.category)!.push(evt);
  }
  const deduped: GeoEvent[] = [];
  for (const [, catEvents] of byCategory) {
    deduped.push(...catEvents.slice(0, 3));
  }

  return deduped;
}

// ============================================================================
// EARNINGS CALENDAR
// ============================================================================

async function fetchEarningsCalendar(): Promise<EarningsEntry[]> {
  const entries: EarningsEntry[] = [];
  const now = new Date();

  // Use yahoo-finance2 for earnings dates
  try {
    const yahooFinance = await import('yahoo-finance2');
    const yf = yahooFinance.default;

    // Process in batches to avoid rate limits
    const batchSize = 5;
    for (let i = 0; i < TRACKED_TICKERS.length; i += batchSize) {
      const batch = TRACKED_TICKERS.slice(i, i + batchSize);

      const promises = batch.map(async (ticker) => {
        try {
          // Skip ETFs for earnings
          if (['SPY', 'QQQ', 'IWM', 'TLT', 'HYG', 'USO', 'GLD', 'UUP', 'EEM', 'FXI'].includes(ticker)) {
            return null;
          }

          const quote = await yf.quote(ticker) as any;
          // yahoo-finance2 may use different field names depending on version
          const earningsDate = quote?.earningsTimestamp
            || quote?.earningsCallTimestampStart
            || quote?.earnings?.earningsDate?.[0];

          if (earningsDate) {
            // Handle both unix timestamp (seconds) and Date objects
            const reportDate = typeof earningsDate === 'number'
              ? new Date(earningsDate > 1e12 ? earningsDate : earningsDate * 1000)
              : new Date(earningsDate);
            const daysUntil = Math.ceil((reportDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            // Only include upcoming earnings (next 60 days) or very recent (last 7 days)
            if (daysUntil >= -7 && daysUntil <= 60) {
              return {
                ticker,
                companyName: quote?.shortName || quote?.longName || ticker,
                reportDate: reportDate.toISOString().split('T')[0],
                daysUntil,
                estimatedEPS: quote?.epsForward || null,
                previousEPS: quote?.epsTrailingTwelveMonths || null,
                surpriseHistory: [], // Would need additional API call
                source: 'yahoo-finance',
              } as EarningsEntry;
            }
          }
          return null;
        } catch {
          return null;
        }
      });

      const results = await Promise.all(promises);
      entries.push(...results.filter((r): r is EarningsEntry => r !== null));

      // Rate limit between batches
      if (i + batchSize < TRACKED_TICKERS.length) {
        await new Promise(r => setTimeout(r, 500));
      }
    }
  } catch (err) {
    console.error('Yahoo Finance earnings fetch error:', err);
  }

  // Sort by days until (soonest first)
  entries.sort((a, b) => a.daysUntil - b.daysUntil);
  return entries;
}

// Also try GuruFocus for additional earnings data
async function fetchGuruFocusEarnings(apiKey: string): Promise<EarningsEntry[]> {
  if (!apiKey) return [];

  const entries: EarningsEntry[] = [];
  const now = new Date();

  // GuruFocus earnings calendar endpoint
  try {
    const today = now.toISOString().split('T')[0];
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const url = `https://api.gurufocus.com/public/user/${apiKey}/stock/earnings_calendar?start_date=${today}&end_date=${futureDate}`;
    const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

    if (response.ok) {
      const data = await response.json() as any;
      if (Array.isArray(data)) {
        for (const item of data) {
          const ticker = item.symbol || item.ticker;
          if (TRACKED_TICKERS.includes(ticker)) {
            const reportDate = item.date || item.report_date;
            const daysUntil = Math.ceil((new Date(reportDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            entries.push({
              ticker,
              companyName: item.company || ticker,
              reportDate,
              daysUntil,
              estimatedEPS: item.estimate || null,
              previousEPS: item.actual_last || null,
              surpriseHistory: [],
              source: 'gurufocus',
            });
          }
        }
      }
    }
  } catch (err) {
    // GuruFocus earnings calendar may not be available on all plans
  }

  return entries;
}

// ============================================================================
// MAIN SCAN FUNCTION
// ============================================================================

async function runEventScan(anthropicApiKey: string, guruFocusApiKey: string): Promise<{
  events: GeoEvent[];
  earnings: EarningsEntry[];
  scanTime: string;
}> {
  const now = Date.now();

  // Check cache
  if (now - lastEventScan < EVENT_CACHE_MS && eventStore.length > 0) {
    return {
      events: eventStore,
      earnings: earningsStore,
      scanTime: new Date(lastEventScan).toISOString(),
    };
  }

  console.log('[GeoEvents] Running event scan...');

  // Fetch news and earnings in parallel
  const [newsItems, yahooEarnings, gfEarnings] = await Promise.all([
    searchGeoNews(),
    now - lastEarningsScan > EARNINGS_CACHE_MS ? fetchEarningsCalendar() : Promise.resolve(earningsStore),
    now - lastEarningsScan > EARNINGS_CACHE_MS ? fetchGuruFocusEarnings(guruFocusApiKey) : Promise.resolve([]),
  ]);

  console.log(`[GeoEvents] Found ${newsItems.length} news items`);

  // Analyze events with Claude
  const events = await analyzeEventsWithClaude(newsItems, anthropicApiKey);
  console.log(`[GeoEvents] Identified ${events.length} significant events`);

  // Merge earnings from both sources (Yahoo takes precedence, GF supplements)
  const earningsMerged = [...yahooEarnings];
  const existingTickers = new Set(yahooEarnings.map(e => e.ticker));
  for (const gfEntry of gfEarnings) {
    if (!existingTickers.has(gfEntry.ticker)) {
      earningsMerged.push(gfEntry);
    }
  }
  earningsMerged.sort((a, b) => a.daysUntil - b.daysUntil);

  // Update stores
  eventStore = events;
  if (now - lastEarningsScan > EARNINGS_CACHE_MS) {
    earningsStore = earningsMerged;
    lastEarningsScan = now;
  }
  lastEventScan = now;

  return {
    events: eventStore,
    earnings: earningsStore,
    scanTime: new Date().toISOString(),
  };
}

// ============================================================================
// API ROUTES
// ============================================================================

// Inject API keys from main server
let _anthropicKey = '';
let _guruFocusKey = '';

export function setGeoEventKeys(anthropicKey: string, guruFocusKey: string) {
  _anthropicKey = anthropicKey;
  _guruFocusKey = guruFocusKey;
}

/**
 * GET /api/geo-events/scan
 * Full event scan — returns active geopolitical events + earnings calendar
 */
router.get('/scan', async (req: Request, res: Response) => {
  try {
    const result = await runEventScan(_anthropicKey, _guruFocusKey);
    res.json({
      status: 'ok',
      eventCount: result.events.length,
      earningsCount: result.earnings.length,
      scanTime: result.scanTime,
      events: result.events,
      earnings: result.earnings,
    });
  } catch (err: any) {
    console.error('[GeoEvents] Scan error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Event scan failed' });
  }
});

/**
 * GET /api/geo-events/events
 * Just the active geopolitical events (cached)
 */
router.get('/events', (req: Request, res: Response) => {
  const severity = req.query.severity as string;
  let filtered = eventStore;
  if (severity) {
    filtered = filtered.filter(e => e.severity === severity);
  }
  res.json({
    status: 'ok',
    count: filtered.length,
    events: filtered,
    lastScan: lastEventScan ? new Date(lastEventScan).toISOString() : null,
  });
});

/**
 * GET /api/geo-events/earnings
 * Earnings calendar for tracked instruments
 */
router.get('/earnings', (req: Request, res: Response) => {
  const days = parseInt(req.query.days as string) || 30;
  const filtered = earningsStore.filter(e => e.daysUntil >= -7 && e.daysUntil <= days);
  res.json({
    status: 'ok',
    count: filtered.length,
    entries: filtered,
    lastScan: lastEarningsScan ? new Date(lastEarningsScan).toISOString() : null,
  });
});

/**
 * GET /api/geo-events/exposure/:ticker
 * Check a specific ticker's exposure to current geopolitical events
 */
router.get('/exposure/:ticker', (req: Request, res: Response) => {
  const ticker = (req.params.ticker as string).toUpperCase();

  const exposedEvents = eventStore.filter(evt =>
    evt.portfolioExposure.some(p => p.ticker === ticker) ||
    evt.effectChains.some(c => c.tickers.includes(ticker))
  ).map(evt => ({
    eventId: evt.id,
    title: evt.title,
    severity: evt.severity,
    category: evt.category,
    directExposure: evt.portfolioExposure.find(p => p.ticker === ticker) || null,
    chainExposure: evt.effectChains.filter(c => c.tickers.includes(ticker)),
  }));

  const earnings = earningsStore.find(e => e.ticker === ticker);

  res.json({
    status: 'ok',
    ticker,
    eventExposure: exposedEvents,
    upcomingEarnings: earnings || null,
  });
});

/**
 * GET /api/geo-events/effect-templates
 * Returns the known effect chain templates for reference
 */
router.get('/effect-templates', (req: Request, res: Response) => {
  const templates = Object.entries(EFFECT_TEMPLATES).map(([name, data]) => ({
    name,
    effects: data.effects.map(e => ({
      ...e,
      tickers: SECTOR_TICKER_MAP[e.sector] || [],
    })),
  }));
  res.json({ status: 'ok', templates });
});

/**
 * POST /api/geo-events/analyze-custom
 * Analyze a custom event scenario — user describes an event, system maps effects
 */
router.post('/analyze-custom', async (req: Request, res: Response) => {
  const { scenario } = req.body;
  if (!scenario) {
    return res.status(400).json({ error: 'scenario is required' });
  }

  if (!_anthropicKey) {
    return res.status(400).json({ error: 'Anthropic API key not configured' });
  }

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: _anthropicKey });

    const sectors = Object.keys(SECTOR_TICKER_MAP).join(', ');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 3000,
      messages: [{
        role: 'user',
        content: `You are a geopolitical macro analyst for a hedge fund. The user describes a scenario. Map out the 1st, 2nd, and 3rd order effects across market sectors.

Available sectors: ${sectors}

Scenario: ${scenario}

Respond in JSON:
{
  "title": "Brief event title",
  "summary": "What this means for markets",
  "severity": "low|moderate|high|critical",
  "effects": [
    {
      "order": 1,
      "sector": "sector_name",
      "effect": "What happens",
      "direction": "positive|negative|mixed",
      "magnitude": "minor|moderate|major",
      "timeframe": "immediate|weeks|months"
    }
  ],
  "contrarian_view": "What could go wrong with this analysis / what the consensus might miss",
  "historical_parallel": "A similar past event and how it played out"
}

Return ONLY valid JSON.`
      }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Enrich effects with tickers
    if (parsed.effects) {
      parsed.effects = parsed.effects.map((e: any) => ({
        ...e,
        tickers: SECTOR_TICKER_MAP[e.sector] || [],
      }));
    }

    res.json({ status: 'ok', analysis: parsed });
  } catch (err: any) {
    console.error('[GeoEvents] Custom analysis error:', err?.message || err);
    res.status(500).json({ error: err?.message || 'Analysis failed' });
  }
});

export default router;
