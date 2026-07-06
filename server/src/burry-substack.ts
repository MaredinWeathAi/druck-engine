// ═══════════════════════════════════════════════════════════════════
// BURRY SUBSTACK INGESTION ENGINE — Druck Engine v15.0
// ═══════════════════════════════════════════════════════════════════
// Automated ingestion, parsing, and analysis of Michael Burry's
// "Cassandra Unchained" Substack posts. Extracts positions, thesis
// points, conviction levels, and historical pattern references to
// build a real-time Burry Lens narrative.
//
// Data flow:
//   RSS Feed → Post Detection → Content Fetch → NLP Extraction →
//   SQLite Storage → Narrative Generation → API Endpoints
// ═══════════════════════════════════════════════════════════════════

import { Router } from 'express';
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();

// ─── LLM INTEGRATION ───

let burryLLMFailures = 0;
let burryLLMLastFailure = 0;
const BURRY_LLM_COOLDOWN = 60 * 60 * 1000; // 1 hour after 3 failures

// Simple LLM narrative cache — avoids hammering API on repeated calls
let cachedLLMNarrative: { text: string; timestamp: number; symbol: string } | null = null;
const NARRATIVE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function callBurryLLM(system: string, userMessage: string, maxTokens: number): Promise<string | null> {
  if (burryLLMFailures >= 3 && (Date.now() - burryLLMLastFailure) < BURRY_LLM_COOLDOWN) {
    console.log(`[BurryLLM] Circuit breaker open — ${burryLLMFailures} failures, cooldown active`);
    return null;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  if (!apiKey || !apiKey.startsWith('sk-ant')) {
    console.log(`[BurryLLM] No valid API key (prefix: ${apiKey.slice(0, 6)}...)`);
    return null;
  }

  try {
    console.log(`[BurryLLM] Calling claude-sonnet-4-6 with ${userMessage.length} chars...`);
    const anthropic = new Anthropic({ apiKey, timeout: 60000 });
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }],
    });
    burryLLMFailures = 0;
    console.log(`[BurryLLM] Success — ${msg.content[0]?.type === 'text' ? msg.content[0].text.length : 0} chars returned`);
    return msg.content[0]?.type === 'text' ? msg.content[0].text : null;
  } catch (err: any) {
    burryLLMFailures++;
    burryLLMLastFailure = Date.now();
    const errType = err?.constructor?.name || 'Unknown';
    const errStatus = err?.status || 'n/a';
    console.error(`[BurryLLM] API error (#${burryLLMFailures}) [${errType} status=${errStatus}]:`, err?.message?.slice(0, 200));
    return null;
  }
}

async function generateLLMBurryNarrative(symbol?: string): Promise<string> {
  // Check cache
  const cacheKey = symbol || 'general';
  if (cachedLLMNarrative && cachedLLMNarrative.symbol === cacheKey &&
      (Date.now() - cachedLLMNarrative.timestamp) < NARRATIVE_CACHE_TTL) {
    return cachedLLMNarrative.text;
  }

  const state = getBurryCurrentState();
  if (state.totalPosts === 0) return generateBurryNarrative(symbol);

  let d: Database.Database;
  try {
    d = getDb();
  } catch (err: any) {
    console.error('[BurryLLM] DB error:', err.message);
    return generateBurryNarrative(symbol);
  }

  try {

  // Gather raw materials for synthesis
  const recentPosts = d.prepare(`
    SELECT title, post_date, sentiment, conviction_level, content_text,
           tickers_mentioned, key_themes, post_type
    FROM burry_posts
    ORDER BY post_date DESC
    LIMIT 15
  `).all() as any[];

  const allPositions = d.prepare(`
    SELECT bp.ticker, bp.direction, bp.action, bp.price, bp.position_size,
           bp.instrument_type, bp.option_details, bp.rationale, p.post_date, p.title as post_title
    FROM burry_positions bp
    JOIN burry_posts p ON bp.post_id = p.id
    ORDER BY p.post_date DESC
  `).all() as any[];

  const themes = d.prepare(`
    SELECT theme_name as theme, mention_count as cnt, last_mentioned as last_seen
    FROM burry_themes
    WHERE status = 'active'
    ORDER BY mention_count DESC
    LIMIT 12
  `).all() as any[];

  // Build the analytical pieces Burry emphasizes
  const analyticalPosts = d.prepare(`
    SELECT title, post_date, content_text
    FROM burry_posts
    WHERE post_type IN ('deep_analysis', 'thesis_development')
       OR key_themes LIKE '%tragic_algebra%'
       OR key_themes LIKE '%expert_vs_skilled%'
       OR key_themes LIKE '%stone_classification%'
       OR key_themes LIKE '%aict_tiering%'
    ORDER BY post_date DESC
    LIMIT 8
  `).all() as any[];

  // Get author comments/replies for additional insight
  const authorComments = d.prepare(`
    SELECT bc.comment_text, bc.subscriber_question, bc.comment_date,
           bc.tickers_mentioned, bc.is_author_reply, bp.title as post_title
    FROM burry_comments bc
    JOIN burry_posts bp ON bc.post_id = bp.id
    WHERE bc.is_author_comment = 1 OR bc.is_author_reply = 1
    ORDER BY bc.comment_date DESC
    LIMIT 20
  `).all() as any[];

  // Build context for LLM
  const positionsMap = new Map<string, any[]>();
  for (const p of allPositions) {
    if (!positionsMap.has(p.ticker)) positionsMap.set(p.ticker, []);
    positionsMap.get(p.ticker)!.push(p);
  }

  const positionSummaries: string[] = [];
  for (const [ticker, actions] of positionsMap) {
    const latest = actions[0];
    const hist = actions.map((a: any) => `${a.post_date}: ${a.action} ${a.price ? '@$'+a.price : ''} (${a.instrument_type})`).join('; ');
    positionSummaries.push(`${ticker} [${latest.direction}]: Latest=${latest.action} ${latest.price ? '@$'+latest.price : ''} (${latest.position_size || 'unknown size'}). History: ${hist}. Rationale: ${latest.rationale || 'n/a'}`);
  }

  // Label posts by temporal tier for the LLM
  const now = Date.now();
  function temporalTier(dateStr: string): string {
    const postDate = new Date(dateStr).getTime();
    const daysDiff = Math.floor((now - postDate) / (1000 * 60 * 60 * 24));
    if (daysDiff <= 14) return 'CURRENT';
    if (daysDiff <= 56) return 'RECENT';
    if (daysDiff <= 180) return 'FOUNDATIONAL';
    return 'HISTORICAL';
  }

  const recentPostSummaries = recentPosts.map((p: any) => {
    const content = p.content_text?.substring(0, 500) || '';
    const tier = temporalTier(p.post_date);
    return `[${tier}] "${p.title}" (${p.post_date}) [${p.sentiment}, ${p.conviction_level}]: ${content}`;
  }).join('\n\n');

  const analyticalSummaries = analyticalPosts.map((p: any) => {
    return `"${p.title}" (${p.post_date}): ${p.content_text?.substring(0, 600) || ''}`;
  }).join('\n\n');

  const themeSummary = themes.map((t: any) => `${t.theme} (${t.cnt}x, last: ${t.last_seen})`).join(', ');

  // If ticker-specific, add ticker context
  let tickerContext = '';
  if (symbol) {
    const upper = symbol.toUpperCase();
    const tickerPosts = d.prepare(`
      SELECT title, post_date, sentiment, content_text
      FROM burry_posts
      WHERE tickers_mentioned LIKE ?
      ORDER BY post_date DESC
      LIMIT 5
    `).all(`%"${upper}"%`) as any[];

    const tickerPositions = positionsMap.get(upper) || [];
    tickerContext = `\n\nSPECIFIC TICKER FOCUS: ${upper}
Posts mentioning ${upper}: ${tickerPosts.map((p: any) => `"${p.title}" (${p.post_date}): ${p.content_text?.substring(0, 300)}`).join('\n')}
Position history: ${tickerPositions.map((p: any) => `${p.post_date}: ${p.action} @$${p.price} (${p.instrument_type}${p.option_details ? ', '+p.option_details : ''})`).join('; ')}`;
  }

  // Current date for temporal context
  const today = new Date().toISOString().split('T')[0];

  const system = `You are synthesizing Michael Burry's current investment thinking based on his "Cassandra Unchained" Substack.

You must write as a deeply knowledgeable analyst who has internalized Burry's entire framework. Channel his voice — direct, data-driven, historically grounded, contrarian.

TODAY'S DATE: ${today}

CRITICAL — TEMPORAL CONTEXT RULES:
1. Posts from the last 2 weeks = CURRENT THINKING. Weight these highest. These reflect his live positioning.
2. Posts from 2-8 weeks ago = RECENT CONTEXT. Still relevant but check if subsequent posts have updated the thesis.
3. Posts from 2-6 months ago = FOUNDATIONAL FRAMEWORK. Treat as background thesis, NOT current signals. Market conditions may have changed materially since these were written.
4. Posts from 6+ months ago = HISTORICAL BACKGROUND. Useful for understanding thesis evolution, but DO NOT apply old observations to the current environment unless Burry has explicitly reaffirmed them recently.
5. When referencing older posts, ALWAYS note "as of [date]" and acknowledge that market conditions at that time may differ from today.
6. If Burry said something bearish about NVDA in November 2025 but has not updated since, do NOT present it as his current view. Note it as his framework analysis from that period.

KEY FRAMEWORKS TO REFERENCE:
- TRAGIC ALGEBRA: SBC dilution destroys intrinsic value. PV = CF/(d-g+y) where y=dilution. Even 1% dilution destroys 20% of value.
- IV15: Intrinsic Value requiring 15%+ annual returns for 15+ years. P/IV15 < 1.0 = attractive.
- ΔE (Delta Earnings): Owners' earnings vs GAAP. Adjusts for SBC, buybacks to nowhere.
- CAPITAL CYCLE THEORY: Stock market peaks occur MIDWAY through investment booms, not at end.
- STONE CLASSIFICATION: Granite (hardest moat) → Sandstone → Limestone → Chalk (crumbling).
- AICT (AI Competitive Threat): 5 tiers from existential to minimal.
- EXPERT vs SKILLED SOFTWARE: Expert software (wraps specialized knowledge) more defensible than skilled-human software.
- TOKENMAXXING: Quota-driven AI overconsumption.
- THE BEZZLE: Temporary demand being capitalized as permanent.

BURRY'S POSTURE: Long quality compounders at depressed valuations (ADBE, PYPL, VEEV, ZTS, MOH, HCA, BABA, JD, LULU, SFM, FISV, MELI) + Hong Kong deep value (Tencent, Meituan, Haidilao, Haier). Short the AI/semiconductor complex (PLTR puts, NVDA puts, QQQ puts, SOXX puts, ORCL puts, TSLA outright short). ~20% cash.

Be specific. Use numbers. Reference the frameworks. Write like someone who has read every post, not like a generic summary. Always ground observations in their temporal context.

${symbol ? `Focus the narrative on ${symbol.toUpperCase()} and what Burry's framework says about it. Pay special attention to the most recent mentions and whether earlier analysis has been updated.` : 'Synthesize the overall investment posture, key theses, and what Burry is watching next. Clearly distinguish between current active positions and older framework analysis.'}`;

  // Build comment context if we have any
  let commentContext = '';
  if (authorComments.length > 0) {
    const commentSummaries = authorComments.map((c: any) => {
      const tier = temporalTier(c.comment_date);
      const prefix = c.is_author_reply ? `[REPLY on "${c.post_title}"]` : `[COMMENT on "${c.post_title}"]`;
      const question = c.subscriber_question ? `\n  Subscriber asked: "${c.subscriber_question.substring(0, 150)}"` : '';
      return `[${tier}] ${prefix} (${c.comment_date}): ${c.comment_text.substring(0, 300)}${question}`;
    }).join('\n');
    commentContext = `\n\nBURRY'S COMMENTS & REPLIES (${authorComments.length} found — these reveal deeper thinking and clarifications):
${commentSummaries}`;
  }

  const userMessage = `Here is the raw data from Burry's Substack (${state.totalPosts} posts, ${state.postsLast30Days} in last 30 days):

RECENT POSTS (labeled by temporal tier — CURRENT/RECENT/FOUNDATIONAL/HISTORICAL):
${recentPostSummaries}

ALL POSITIONS (${positionSummaries.length} tickers):
${positionSummaries.join('\n')}

DOMINANT THEMES: ${themeSummary}

KEY ANALYTICAL PIECES:
${analyticalSummaries}
${tickerContext}${commentContext}

Synthesize this into a ${symbol ? `focused narrative on ${symbol.toUpperCase()}` : 'comprehensive investment narrative'} that captures Burry's current thinking, thesis evolution, and positioning. Be specific with numbers, entry prices, and framework applications. Always ground observations in their temporal context — distinguish what Burry is saying NOW vs what he said months ago. 600-900 words.`;

  console.log(`[BurryLLM] Calling LLM with ${userMessage.length} char prompt for ${cacheKey}`);
  const llmResult = await callBurryLLM(system, userMessage, 2000);

  if (llmResult) {
    console.log(`[BurryLLM] LLM success — ${llmResult.length} chars`);
    cachedLLMNarrative = { text: llmResult, timestamp: Date.now(), symbol: cacheKey };
    return llmResult;
  }

  console.log('[BurryLLM] LLM returned null, falling back to template');
  // Fallback to template-based narrative
  return generateBurryNarrative(symbol);

  } catch (err: any) {
    console.error('[BurryLLM] Error in narrative generation:', err.message);
    return generateBurryNarrative(symbol);
  }
}

// ─── DATABASE SETUP ───

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = path.join(DATA_DIR, 'druck-history.db');
let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

// ─── INIT BURRY TABLES ───

export function initBurryTables(): void {
  const d = getDb();

  // Posts table — stores all Substack posts
  d.exec(`
    CREATE TABLE IF NOT EXISTS burry_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      post_date TEXT NOT NULL,
      url TEXT NOT NULL,
      content_text TEXT,
      post_type TEXT NOT NULL DEFAULT 'trading_post',
      likes_count INTEGER DEFAULT 0,
      comments_count INTEGER DEFAULT 0,
      restacks_count INTEGER DEFAULT 0,
      is_paid INTEGER DEFAULT 1,
      tickers_mentioned TEXT,
      key_themes TEXT,
      sentiment TEXT DEFAULT 'neutral',
      conviction_level TEXT DEFAULT 'moderate',
      word_count INTEGER DEFAULT 0,
      ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Positions table — extracted trades and positions
  d.exec(`
    CREATE TABLE IF NOT EXISTS burry_positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      ticker TEXT NOT NULL,
      action TEXT NOT NULL,
      direction TEXT NOT NULL DEFAULT 'long',
      price REAL,
      position_size TEXT,
      instrument_type TEXT DEFAULT 'stock',
      option_details TEXT,
      rationale TEXT,
      conviction TEXT DEFAULT 'moderate',
      extracted_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES burry_posts(id)
    )
  `);

  // Themes table — recurring analytical themes
  d.exec(`
    CREATE TABLE IF NOT EXISTS burry_themes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      theme_name TEXT NOT NULL,
      description TEXT,
      first_mentioned TEXT,
      last_mentioned TEXT,
      mention_count INTEGER DEFAULT 1,
      related_tickers TEXT,
      status TEXT DEFAULT 'active'
    )
  `);

  // Historical references — when Burry draws historical parallels
  d.exec(`
    CREATE TABLE IF NOT EXISTS burry_historical_refs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      reference_period TEXT NOT NULL,
      comparison_text TEXT,
      current_analog TEXT,
      FOREIGN KEY (post_id) REFERENCES burry_posts(id)
    )
  `);

  // Comments table — Burry's comments on his own posts + his replies to subscribers
  d.exec(`
    CREATE TABLE IF NOT EXISTS burry_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      comment_id TEXT UNIQUE,
      parent_comment_id TEXT,
      is_author_comment INTEGER NOT NULL DEFAULT 0,
      is_author_reply INTEGER NOT NULL DEFAULT 0,
      author_name TEXT,
      comment_text TEXT NOT NULL,
      comment_date TEXT,
      subscriber_question TEXT,
      tickers_mentioned TEXT,
      key_themes TEXT,
      sentiment TEXT DEFAULT 'neutral',
      ingested_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (post_id) REFERENCES burry_posts(id)
    )
  `);

  // RSS poll state
  d.exec(`
    CREATE TABLE IF NOT EXISTS burry_rss_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_poll_at TEXT,
      last_guid TEXT,
      poll_count INTEGER DEFAULT 0
    )
  `);

  // Initialize RSS state if empty
  const stateCount = d.prepare('SELECT COUNT(*) as cnt FROM burry_rss_state').get() as any;
  if (stateCount.cnt === 0) {
    d.prepare('INSERT INTO burry_rss_state (id, last_poll_at, poll_count) VALUES (1, NULL, 0)').run();
  }

  console.log('[BURRY] Substack tables initialized');
}

// ─── CONSTANTS ───

const SUBSTACK_BASE = 'https://michaeljburry.substack.com';
const RSS_URL = `${SUBSTACK_BASE}/feed`;
const POLL_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// Known tickers Burry has discussed — SW50 universe + positions + comps
const KNOWN_TICKERS = new Set([
  // ── Current Longs ──
  'ADBE', 'BABA', 'PYPL', 'VEEV', 'ZTS', 'SFM', 'LULU', 'FMCC', 'FNMA',
  'JD', 'MELI', 'BRKR', 'BRKRP', 'FISV', 'MSCI', 'HCA', 'MOH',
  // ── Sold / Former Longs ──
  'GME', 'EBAY', 'CRM', 'ADSK', 'MSFT', 'SLM', 'FOUR',
  // ── Shorts / Puts ──
  'PLTR', 'NVDA', 'ORCL', 'QQQ', 'SOXX', 'SPY', 'TSLA', 'INTC',
  // ── SW50: Office SaaS (Cat 1) ──
  'PAYC', 'FRSH', 'PCTY', 'MNDY', 'NOW', 'HUBS', 'WDAY',
  // ── SW50: Productivity Tools (Cat 2) ──
  'INTU', 'DOCU', 'U',
  // ── SW50: Cybersecurity (Cat 3) ──
  'ZS', 'PANW', 'CRWD',
  // ── SW50: Dev & Infrastructure (Cat 4) ──
  'GTLB', 'ESTC', 'NTAP', 'TEAM', 'SNOW', 'DDOG', 'NET', 'FROG',
  // ── SW50: Payments (Cat 5) ──
  'XYZ', 'TOST', 'WEX',
  // ── SW50: Serial Acquirers (Cat 6) ──
  'CSU', 'ROP', 'GPN',
  // ── SW50: Software-Adjacent (Cat 7) ──
  'PATH', 'ZM', 'BSY', 'SHOP', 'IOT',
  // ── SW50: Regulatory & Enterprise (Cat 8) ──
  'VRSK', 'TYL', 'DSGX', 'CDN', 'SNPS', 'CDNS', 'SPSC',
  // ── D'ai universe additional names ──
  'MDB', 'CFLT', 'BILL', 'PCOR', 'DOCN', 'PD', 'APPF', 'TENB',
  'QLYS', 'RPD', 'VRNS', 'S',
  // ── Memory / Semi ──
  'MU', 'DRAM', 'SMH', 'AMAT',
  // ── Defense (PLTR comps) ──
  'LMT', 'GD', 'NOC',
  // ── China ADRs ──
  'PDD', 'BIDU', 'TCEHY',
  // ── Macro / Other mentioned ──
  'ADP', 'W', 'AGO', 'CRVW', 'VIAV',
  'AAPL', 'GOOGL', 'AMZN', 'META', 'AMD', 'AVGO', 'CSCO',
]);

// ─── RSS PARSING ───

interface RSSItem {
  title: string;
  description: string;
  link: string;
  guid: string;
  pubDate: string;
  slug: string;
}

function parseRSSXML(xml: string): RSSItem[] {
  const items: RSSItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const getTag = (tag: string): string => {
      const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?(.*?)(?:\\]\\]>)?<\\/${tag}>`, 's');
      const m = itemXml.match(r);
      return m ? m[1].trim() : '';
    };

    const link = getTag('link');
    const slug = link.replace(`${SUBSTACK_BASE}/p/`, '').replace(/\/$/, '');

    items.push({
      title: getTag('title'),
      description: getTag('description'),
      link,
      guid: getTag('guid'),
      pubDate: getTag('pubDate'),
      slug,
    });
  }

  return items;
}

// ─── CONTENT EXTRACTION ───

function classifyPostType(title: string, content: string): string {
  const t = title.toLowerCase();
  if (t.includes('trading post')) return 'trading_post';
  if (t.includes('short thoughts')) return 'short_thoughts';
  if (t.includes('heretic') || t.includes('guide')) return 'deep_dive';
  if (t.includes('abridged')) return 'abridged';
  if (t.includes('charity') || t.includes('brain tumor')) return 'charity';
  if (t.includes('software') || t.includes('payments')) return 'sector_analysis';
  if (t.includes('gamestop') || t.includes('fannie') || t.includes('freddie')) return 'company_analysis';
  if (t.includes('recurrence') || t.includes('algebra') || t.includes('accounting')) return 'deep_dive';
  if (content.length > 5000) return 'deep_dive';
  return 'commentary';
}

function extractSentiment(content: string): string {
  const lower = content.toLowerCase();

  // Strong bearish signals
  const bearish = [
    'bubble', 'mania', 'crash', 'overvalued', 'sand castle', 'death',
    'bullwhip', 'glut', 'insane', 'fraud', 'blowoff', 'head fake',
    'hype', 'bezzle', 'peak', 'top', 'short', 'puts',
  ];

  // Strong bullish signals
  const bullish = [
    'undervalued', 'buying', 'added', 'full position', 'accretive',
    'launch fast', 'fly high', 'attractive', 'deploy', 'opportunity',
    'serially whacked', 'buybacks',
  ];

  let bearScore = 0;
  let bullScore = 0;

  for (const w of bearish) {
    const matches = lower.split(w).length - 1;
    bearScore += matches;
  }
  for (const w of bullish) {
    const matches = lower.split(w).length - 1;
    bullScore += matches;
  }

  if (bearScore > bullScore * 2) return 'strongly_bearish';
  if (bearScore > bullScore) return 'bearish';
  if (bullScore > bearScore * 2) return 'strongly_bullish';
  if (bullScore > bearScore) return 'bullish';
  return 'mixed';
}

function extractConviction(content: string): string {
  const lower = content.toLowerCase();
  if (lower.includes('full position') || lower.includes('massively') || lower.includes('continue to hold')) return 'high';
  if (lower.includes('small add') || lower.includes('may') || lower.includes('considering')) return 'moderate';
  if (lower.includes('watching') || lower.includes('interesting') || lower.includes('exploring')) return 'low';
  return 'moderate';
}

interface ExtractedPosition {
  ticker: string;
  action: string;
  direction: string;
  price: number | null;
  positionSize: string | null;
  instrumentType: string;
  optionDetails: string | null;
  rationale: string | null;
  conviction: string;
}

function extractPositions(content: string, title: string): ExtractedPosition[] {
  const positions: ExtractedPosition[] = [];
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();

    // Pattern 1: "BUY TICKER @ $PRICE" or "SELL TICKER @ $PRICE"
    const tradeMatch = trimmed.match(/^(BUY|SELL)\s+([A-Z]{1,5})\s+(?:@|at)\s*\$?([\d,.]+)\s*(.*)?$/i);
    if (tradeMatch) {
      const action = tradeMatch[1].toUpperCase();
      const ticker = tradeMatch[2].toUpperCase();
      const price = parseFloat(tradeMatch[3].replace(',', ''));
      const rest = tradeMatch[4] || '';

      positions.push({
        ticker,
        action: action === 'BUY' ? 'buy' : 'sell',
        direction: action === 'BUY' ? 'long' : 'short',
        price,
        positionSize: rest.includes('full position') ? 'full' : rest.includes('mid position') ? 'mid' : rest.includes('small') ? 'small' : null,
        instrumentType: 'stock',
        optionDetails: null,
        rationale: rest || null,
        conviction: rest.includes('full position') ? 'high' : 'moderate',
      });
      continue;
    }

    // Pattern 2: "I added to TICKER (SYMBOL) at $PRICE"
    const addedMatch = trimmed.match(/(?:added to|purchased|bought)\s+(?:[\w\s]+\s+)?\(([A-Z]{1,5})\)\s+(?:at|@)\s*\$?([\d,.]+)/i);
    if (addedMatch) {
      positions.push({
        ticker: addedMatch[1].toUpperCase(),
        action: 'add',
        direction: 'long',
        price: parseFloat(addedMatch[2].replace(',', '')),
        positionSize: null,
        instrumentType: 'stock',
        optionDetails: null,
        rationale: trimmed.substring(0, 200),
        conviction: 'moderate',
      });
      continue;
    }

    // Pattern 3: Option rolls - "SELL TICKER MM/DD/YYYY PXXX & BUY TICKER MM/DD/YYYY PXXX"
    const optionRollMatch = trimmed.match(/SELL\s+([A-Z]{1,5})\s+(\d{2}\/\d{2}\/\d{4})\s+P(\d+)\s*&\s*BUY\s+\1\s+(\d{2}\/\d{2}\/\d{4})\s+P(\d+)/i);
    if (optionRollMatch) {
      const ticker = optionRollMatch[1].toUpperCase();
      positions.push({
        ticker,
        action: 'roll',
        direction: 'short',
        price: null,
        positionSize: null,
        instrumentType: 'put_option',
        optionDetails: `Roll: Sell ${optionRollMatch[2]} P${optionRollMatch[3]} → Buy ${optionRollMatch[4]} P${optionRollMatch[5]}`,
        rationale: trimmed.substring(0, 300),
        conviction: 'high',
      });
      continue;
    }
  }

  // Pattern 4: Inline mentions - "I added to TICKER at $PRICE"
  const inlineAddPattern = /I (?:added to|bought|purchased)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+\(([A-Z]{1,5})\)\s+at\s+\$?([\d,.]+)/g;
  let inlineMatch;
  while ((inlineMatch = inlineAddPattern.exec(content)) !== null) {
    const ticker = inlineMatch[2].toUpperCase();
    // Avoid duplicates
    if (!positions.find(p => p.ticker === ticker && p.action === 'add')) {
      positions.push({
        ticker,
        action: 'add',
        direction: 'long',
        price: parseFloat(inlineMatch[3].replace(',', '')),
        positionSize: null,
        instrumentType: 'stock',
        optionDetails: null,
        rationale: null,
        conviction: 'moderate',
      });
    }
  }

  return positions;
}

function extractTickersMentioned(content: string): string[] {
  const tickers = new Set<string>();

  // Find parenthetical tickers: (AAPL), (NVDA), etc
  const parenMatches = content.matchAll(/\(([A-Z]{1,5})\)/g);
  for (const m of parenMatches) {
    if (KNOWN_TICKERS.has(m[1])) tickers.add(m[1]);
  }

  // Find standalone uppercase tickers (more careful)
  const words = content.split(/[\s,;.!?()]+/);
  for (const w of words) {
    if (/^[A-Z]{2,5}$/.test(w) && KNOWN_TICKERS.has(w)) {
      tickers.add(w);
    }
  }

  return Array.from(tickers);
}

function extractKeyThemes(content: string): string[] {
  const themes: string[] = [];
  const lower = content.toLowerCase();

  const themePatterns: [string, string][] = [
    ['ai_bubble', 'bubble|mania|ai hype|ai buildout|llm|language model'],
    ['dot_com_analog', '2000|internet mania|march 10|dot.?com'],
    ['value_investing', 'intrinsic value|owners earnings|buyback|accretive|undervalued|p/e|price.to.earnings'],
    ['short_selling', 'short|puts|shorting|bear|hedge|derivatives'],
    ['memory_chips', 'dram|hbm|memory|micron|samsung|sk hynix|semiconductor'],
    ['software_saas', 'software|saas|cloud|subscription'],
    ['china_tech', 'china|alibaba|hong kong|baba|jd|pdd|tencent'],
    ['earnings_analysis', 'earnings|revenue|margin|gross margin|operating margin'],
    ['historical_pattern', 'history|pattern|recurrence|analog|cycle|cyclical'],
    ['bullwhip_effect', 'bullwhip|supply.demand|glut|shortage|inventory|hoarding'],
    ['fed_macro', 'fed|interest rate|inflation|monetary|fiscal'],
    ['corporate_governance', 'buyback|management|ceo|board|compensation|stock.based'],
    ['options_strategy', 'puts|calls|strike|expiry|roll|maturity|options'],
    ['iv15_valuation', 'iv15|intrinsic value|overvalued|undervalued|fair value'],
    ['tokenmaxxing', 'tokenmaxxing|token.?maxxing|quota.driven|leaderboard.driven|overconsumption'],
    ['compression', 'compression|compress|seat.loss|internalize|replaced by ai|killed.*code'],
    ['bezzle', 'bezzle|galbraith|wealth effect|psychic wealth'],
    ['private_credit', 'private credit|covenant.lite|shadow lend|structured credit|saaspocalypse'],
    ['geopolitical', 'iran|war|oil|geopolit|conflict|tariff|sanctions'],
    ['gamestop', 'gamestop|gme|ryan cohen|instant berkshire|ebay deal'],
    ['offshore_finance', 'offshore|bermuda|cayman|reinsur|athene|apollo.*debt|abs|data.center.*backed'],
    ['tragic_algebra', 'tragic algebra|sbc|stock.based compensation|dilut|omega|owners.earnings vs'],
    ['expert_vs_skilled', 'expert software|skilled human|productivity tool|wrapped around'],
    ['stone_classification', 'granite|sandstone|limestone|chalk|stone classif'],
    ['aict_tiering', 'aict|ai competitive threat|existential|manageable|minimal'],
    ['sw50_analysis', 'sw50|software.+payments|productivity tools|cybersecurity|serial acquir'],
    ['zero_trust', 'zero trust|zscaler|identity.+data|deception tech|glasswing'],
    ['consumption_model', 'consumption model|falcon flex|usage.based|seat.based'],
    ['charity', 'charity|brain tumor|cancer|donation|glioblastoma|nbts'],
  ];

  for (const [theme, pattern] of themePatterns) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(lower)) {
      themes.push(theme);
    }
  }

  return themes;
}

function extractHistoricalReferences(content: string): Array<{ period: string; comparison: string; analog: string }> {
  const refs: Array<{ period: string; comparison: string; analog: string }> = [];
  const lower = content.toLowerCase();

  // Year references
  const yearPatterns = [
    { year: '2000', keywords: ['internet', 'nasdaq', 'dot.?com', 'march 10'] },
    { year: '1998-2002', keywords: ['dram', 'price.fixing', 'cartel', 'memory'] },
    { year: '2007-2008', keywords: ['subprime', 'mortgage', 'cds', 'housing'] },
    { year: '1929', keywords: ['depression', 'crash', '1929'] },
  ];

  for (const p of yearPatterns) {
    for (const kw of p.keywords) {
      if (new RegExp(kw, 'i').test(lower)) {
        // Extract surrounding context
        const idx = lower.indexOf(kw.replace('.?', ''));
        if (idx >= 0) {
          const start = Math.max(0, idx - 100);
          const end = Math.min(content.length, idx + 200);
          refs.push({
            period: p.year,
            comparison: content.substring(start, end).trim(),
            analog: kw,
          });
        }
        break; // One ref per period is enough
      }
    }
  }

  return refs;
}

// ─── POST STORAGE ───

function storePost(post: {
  slug: string;
  title: string;
  subtitle: string | null;
  date: string;
  url: string;
  content: string;
  likes?: number;
  comments?: number;
  restacks?: number;
}): number {
  const d = getDb();

  const postType = classifyPostType(post.title, post.content);
  const sentiment = extractSentiment(post.content);
  const conviction = extractConviction(post.content);
  const tickers = extractTickersMentioned(post.content);
  const themes = extractKeyThemes(post.content);
  const wordCount = post.content.split(/\s+/).length;

  // Pre-delete child records if this slug already exists (INSERT OR REPLACE
  // deletes then inserts, which fails on FK constraints without CASCADE)
  const existingPost = d.prepare('SELECT id FROM burry_posts WHERE slug = ?').get(post.slug) as any;
  if (existingPost) {
    d.prepare('DELETE FROM burry_positions WHERE post_id = ?').run(existingPost.id);
    d.prepare('DELETE FROM burry_historical_refs WHERE post_id = ?').run(existingPost.id);
  }

  const result = d.prepare(`
    INSERT OR REPLACE INTO burry_posts
      (slug, title, subtitle, post_date, url, content_text, post_type,
       likes_count, comments_count, restacks_count, is_paid,
       tickers_mentioned, key_themes, sentiment, conviction_level, word_count, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, datetime('now'))
  `).run(
    post.slug, post.title, post.subtitle, post.date, post.url,
    post.content, postType,
    post.likes || 0, post.comments || 0, post.restacks || 0,
    JSON.stringify(tickers), JSON.stringify(themes),
    sentiment, conviction, wordCount
  );

  const postId = d.prepare('SELECT id FROM burry_posts WHERE slug = ?').get(post.slug) as any;

  // Extract and store positions
  const positions = extractPositions(post.content, post.title);
  if (positions.length > 0) {
    // Clear old positions for this post (in case of re-ingestion)
    d.prepare('DELETE FROM burry_positions WHERE post_id = ?').run(postId.id);

    const insertPos = d.prepare(`
      INSERT INTO burry_positions
        (post_id, ticker, action, direction, price, position_size, instrument_type, option_details, rationale, conviction)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of positions) {
      insertPos.run(
        postId.id, p.ticker, p.action, p.direction, p.price,
        p.positionSize, p.instrumentType, p.optionDetails,
        p.rationale, p.conviction
      );
    }
  }

  // Extract and store historical references
  const histRefs = extractHistoricalReferences(post.content);
  if (histRefs.length > 0) {
    d.prepare('DELETE FROM burry_historical_refs WHERE post_id = ?').run(postId.id);
    const insertRef = d.prepare(`
      INSERT INTO burry_historical_refs (post_id, reference_period, comparison_text, current_analog)
      VALUES (?, ?, ?, ?)
    `);
    for (const r of histRefs) {
      insertRef.run(postId.id, r.period, r.comparison, r.analog);
    }
  }

  // Update themes table
  for (const theme of themes) {
    const existing = d.prepare('SELECT * FROM burry_themes WHERE theme_name = ?').get(theme) as any;
    if (existing) {
      d.prepare(`
        UPDATE burry_themes SET last_mentioned = ?, mention_count = mention_count + 1,
          related_tickers = ? WHERE theme_name = ?
      `).run(post.date, JSON.stringify(tickers), theme);
    } else {
      d.prepare(`
        INSERT INTO burry_themes (theme_name, description, first_mentioned, last_mentioned, related_tickers)
        VALUES (?, ?, ?, ?, ?)
      `).run(theme, theme.replace(/_/g, ' '), post.date, post.date, JSON.stringify(tickers));
    }
  }

  console.log(`[BURRY] Stored post: "${post.title}" (${postType}, ${sentiment}, ${positions.length} positions, ${themes.length} themes)`);
  return postId.id;
}

// ─── RSS POLLING ───

let pollTimer: ReturnType<typeof setInterval> | null = null;

async function fetchRSS(): Promise<string | null> {
  try {
    const response = await fetch(RSS_URL, {
      headers: { 'User-Agent': 'DruckEngine/15.0 RSS Reader' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      console.error(`[BURRY] RSS fetch failed: ${response.status}`);
      return null;
    }
    return await response.text();
  } catch (err: any) {
    console.error(`[BURRY] RSS fetch error: ${err.message}`);
    return null;
  }
}

async function pollForNewPosts(): Promise<{ newPosts: number; titles: string[] }> {
  const xml = await fetchRSS();
  if (!xml) return { newPosts: 0, titles: [] };

  const items = parseRSSXML(xml);
  const d = getDb();

  // Update poll state
  d.prepare(`UPDATE burry_rss_state SET last_poll_at = datetime('now'), poll_count = poll_count + 1 WHERE id = 1`).run();

  const newTitles: string[] = [];
  let newCount = 0;

  for (const item of items) {
    // Check if we already have this post
    const existing = d.prepare('SELECT id FROM burry_posts WHERE slug = ?').get(item.slug);
    if (existing) continue;

    // New post detected! Store with RSS preview content
    const dateStr = item.pubDate ? new Date(item.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];

    storePost({
      slug: item.slug,
      title: item.title,
      subtitle: item.description.substring(0, 200),
      date: dateStr,
      url: item.link,
      content: item.description, // RSS preview only; full content needs auth
    });

    newTitles.push(item.title);
    newCount++;
  }

  if (newCount > 0) {
    console.log(`[BURRY] ${newCount} new posts detected via RSS: ${newTitles.join(', ')}`);
  }

  return { newPosts: newCount, titles: newTitles };
}

export function startRSSPolling(): void {
  if (pollTimer) return;

  console.log('[BURRY] Starting RSS polling (every 30 min)');

  // Initial poll after 60 seconds
  setTimeout(async () => {
    const result = await pollForNewPosts();
    if (result.newPosts > 0) {
      console.log(`[BURRY] Initial poll found ${result.newPosts} new posts`);
    }
  }, 60_000);

  // Then every 30 minutes
  pollTimer = setInterval(async () => {
    await pollForNewPosts();
  }, POLL_INTERVAL_MS);
}

export function stopRSSPolling(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    console.log('[BURRY] RSS polling stopped');
  }
}

// ─── BURRY NARRATIVE GENERATOR ───

interface BurryCurrentState {
  totalPosts: number;
  postsLast30Days: number;
  activePositions: {
    longs: Array<{ ticker: string; lastPrice: number | null; positionSize: string | null; latestAction: string; actionDate: string }>;
    shorts: Array<{ ticker: string; instrumentType: string; optionDetails: string | null; latestAction: string; actionDate: string }>;
  };
  dominantThemes: Array<{ theme: string; count: number; lastMentioned: string }>;
  overallSentiment: string;
  latestPost: { title: string; date: string; sentiment: string; tickers: string[] } | null;
  historicalAnalogs: Array<{ period: string; count: number }>;
  convictionSignals: string[];
}

function getBurryCurrentState(): BurryCurrentState {
  const d = getDb();

  const totalPosts = (d.prepare('SELECT COUNT(*) as cnt FROM burry_posts').get() as any).cnt;
  const last30 = (d.prepare(`SELECT COUNT(*) as cnt FROM burry_posts WHERE post_date >= date('now', '-30 days')`).get() as any).cnt;

  // Get latest positions by ticker (most recent action)
  const longPositions = d.prepare(`
    SELECT bp.ticker, bp.price, bp.position_size, bp.action, p.post_date
    FROM burry_positions bp
    JOIN burry_posts p ON bp.post_id = p.id
    WHERE bp.direction = 'long'
    ORDER BY p.post_date DESC
  `).all() as any[];

  // Dedupe to latest per ticker
  const longMap = new Map<string, any>();
  for (const pos of longPositions) {
    if (!longMap.has(pos.ticker)) {
      longMap.set(pos.ticker, {
        ticker: pos.ticker,
        lastPrice: pos.price,
        positionSize: pos.position_size,
        latestAction: pos.action,
        actionDate: pos.post_date,
      });
    }
  }

  const shortPositions = d.prepare(`
    SELECT bp.ticker, bp.instrument_type, bp.option_details, bp.action, p.post_date
    FROM burry_positions bp
    JOIN burry_posts p ON bp.post_id = p.id
    WHERE bp.direction = 'short'
    ORDER BY p.post_date DESC
  `).all() as any[];

  const shortMap = new Map<string, any>();
  for (const pos of shortPositions) {
    if (!shortMap.has(pos.ticker)) {
      shortMap.set(pos.ticker, {
        ticker: pos.ticker,
        instrumentType: pos.instrument_type,
        optionDetails: pos.option_details,
        latestAction: pos.action,
        actionDate: pos.post_date,
      });
    }
  }

  // Dominant themes
  const themes = d.prepare(`
    SELECT theme_name, mention_count, last_mentioned
    FROM burry_themes
    WHERE status = 'active'
    ORDER BY mention_count DESC
    LIMIT 10
  `).all() as any[];

  // Overall sentiment from recent posts
  const recentSentiments = d.prepare(`
    SELECT sentiment, COUNT(*) as cnt FROM burry_posts
    WHERE post_date >= date('now', '-30 days')
    GROUP BY sentiment ORDER BY cnt DESC
  `).all() as any[];

  // Latest post
  const latest = d.prepare(`
    SELECT title, post_date, sentiment, tickers_mentioned FROM burry_posts
    ORDER BY post_date DESC LIMIT 1
  `).get() as any;

  // Historical references aggregated
  const histRefs = d.prepare(`
    SELECT reference_period, COUNT(*) as cnt FROM burry_historical_refs
    GROUP BY reference_period ORDER BY cnt DESC
  `).all() as any[];

  // Conviction signals from recent posts
  const signals: string[] = [];
  const recentPosts = d.prepare(`
    SELECT content_text, conviction_level FROM burry_posts
    WHERE post_date >= date('now', '-14 days') AND content_text IS NOT NULL
    ORDER BY post_date DESC LIMIT 5
  `).all() as any[];

  for (const p of recentPosts) {
    if (p.conviction_level === 'high') signals.push('High conviction in recent posts');
    if (p.content_text?.toLowerCase().includes('full position')) signals.push('Adding to full positions');
    if (p.content_text?.toLowerCase().includes('double down')) signals.push('Doubling down');
  }

  return {
    totalPosts,
    postsLast30Days: last30,
    activePositions: {
      longs: Array.from(longMap.values()),
      shorts: Array.from(shortMap.values()),
    },
    dominantThemes: themes.map((t: any) => ({ theme: t.theme_name, count: t.mention_count, lastMentioned: t.last_mentioned })),
    overallSentiment: recentSentiments[0]?.sentiment || 'unknown',
    latestPost: latest ? {
      title: latest.title,
      date: latest.post_date,
      sentiment: latest.sentiment,
      tickers: JSON.parse(latest.tickers_mentioned || '[]'),
    } : null,
    historicalAnalogs: histRefs.map((r: any) => ({ period: r.reference_period, count: r.cnt })),
    convictionSignals: [...new Set(signals)],
  };
}

function generateBurryNarrative(symbol?: string): string {
  const state = getBurryCurrentState();

  if (state.totalPosts === 0) {
    return 'Burry Substack data not yet ingested. Run initial content import to populate.';
  }

  // If ticker-specific, check Burry's view on it
  if (symbol) {
    return generateTickerNarrative(symbol, state);
  }

  // General Burry state narrative
  const parts: string[] = [];

  parts.push(`BURRY LENS — ${state.totalPosts} posts analyzed (${state.postsLast30Days} in last 30 days)`);

  if (state.latestPost) {
    parts.push(`Latest: "${state.latestPost.title}" (${state.latestPost.date}) — Sentiment: ${state.latestPost.sentiment}`);
  }

  parts.push(`\nOVERALL POSTURE: ${state.overallSentiment.toUpperCase()}`);

  if (state.activePositions.longs.length > 0) {
    parts.push(`\nACTIVE LONGS (${state.activePositions.longs.length}):`);
    for (const p of state.activePositions.longs.slice(0, 8)) {
      parts.push(`  ${p.ticker}: ${p.latestAction} ${p.lastPrice ? '@$' + p.lastPrice : ''} ${p.positionSize ? '(' + p.positionSize + ')' : ''} [${p.actionDate}]`);
    }
  }

  if (state.activePositions.shorts.length > 0) {
    parts.push(`\nACTIVE SHORTS/PUTS (${state.activePositions.shorts.length}):`);
    for (const p of state.activePositions.shorts.slice(0, 5)) {
      parts.push(`  ${p.ticker}: ${p.instrumentType} — ${p.latestAction} [${p.actionDate}]`);
    }
  }

  if (state.dominantThemes.length > 0) {
    parts.push(`\nDOMINANT THEMES:`);
    for (const t of state.dominantThemes.slice(0, 5)) {
      parts.push(`  ${t.theme.replace(/_/g, ' ')} (${t.count} mentions, last: ${t.lastMentioned})`);
    }
  }

  if (state.historicalAnalogs.length > 0) {
    parts.push(`\nHISTORICAL ANALOGS:`);
    for (const r of state.historicalAnalogs) {
      parts.push(`  ${r.period} referenced ${r.count} times`);
    }
  }

  return parts.join('\n');
}

function generateTickerNarrative(symbol: string, state: BurryCurrentState): string {
  const d = getDb();
  const upper = symbol.toUpperCase();

  // Check if Burry has mentioned this ticker
  const tickerPosts = d.prepare(`
    SELECT title, post_date, sentiment, content_text, post_type
    FROM burry_posts
    WHERE tickers_mentioned LIKE ?
    ORDER BY post_date DESC
    LIMIT 10
  `).all(`%"${upper}"%`) as any[];

  const positions = d.prepare(`
    SELECT bp.*, p.post_date, p.title as post_title
    FROM burry_positions bp
    JOIN burry_posts p ON bp.post_id = p.id
    WHERE bp.ticker = ?
    ORDER BY p.post_date DESC
  `).all(upper) as any[];

  if (tickerPosts.length === 0 && positions.length === 0) {
    return `BURRY LENS [${upper}]: No direct mentions or positions found in Burry's Substack posts. This ticker does not appear to be in his current universe.`;
  }

  const parts: string[] = [];
  parts.push(`BURRY LENS [${upper}]`);

  // Position status
  if (positions.length > 0) {
    const latestPos = positions[0];
    const direction = latestPos.direction === 'long' ? 'LONG' : 'SHORT';
    parts.push(`\nPOSITION: ${direction}`);
    parts.push(`Latest action: ${latestPos.action} ${latestPos.price ? '@$' + latestPos.price : ''} on ${latestPos.post_date}`);
    if (latestPos.position_size) parts.push(`Size: ${latestPos.position_size}`);
    if (latestPos.instrument_type !== 'stock') parts.push(`Instrument: ${latestPos.instrument_type}`);
    if (latestPos.option_details) parts.push(`Details: ${latestPos.option_details}`);
    if (latestPos.rationale) parts.push(`Rationale: ${latestPos.rationale.substring(0, 200)}`);

    // Position history
    if (positions.length > 1) {
      parts.push(`\nPOSITION HISTORY (${positions.length} actions):`);
      for (const p of positions.slice(0, 5)) {
        parts.push(`  ${p.post_date}: ${p.action} ${p.price ? '@$' + p.price : ''} (${p.instrument_type})`);
      }
    }
  }

  // What Burry has written about this ticker
  if (tickerPosts.length > 0) {
    parts.push(`\nMENTIONED IN ${tickerPosts.length} POSTS:`);
    for (const post of tickerPosts.slice(0, 5)) {
      parts.push(`  "${post.title}" (${post.post_date}) — ${post.sentiment}`);
    }

    // Extract key quotes about this ticker from most recent post
    const latestContent = tickerPosts[0]?.content_text || '';
    if (latestContent) {
      const sentences = latestContent.split(/[.!?]+/).filter(
        (s: string) => s.toUpperCase().includes(upper) || s.includes(`(${upper})`)
      );
      if (sentences.length > 0) {
        parts.push(`\nKEY QUOTES:`);
        for (const s of sentences.slice(0, 3)) {
          parts.push(`  "${s.trim().substring(0, 200)}"`);
        }
      }
    }
  }

  return parts.join('\n');
}

// ─── SEARCH ───

function searchPosts(query: string, limit: number = 20): any[] {
  const d = getDb();
  const searchTerm = `%${query}%`;

  return d.prepare(`
    SELECT id, slug, title, subtitle, post_date, url, post_type, sentiment,
           conviction_level, tickers_mentioned, key_themes, word_count, likes_count
    FROM burry_posts
    WHERE content_text LIKE ? OR title LIKE ?
    ORDER BY post_date DESC
    LIMIT ?
  `).all(searchTerm, searchTerm, limit) as any[];
}

// ─── API ROUTES ───

// GET /burry/status — Overview and stats
router.get('/burry/status', (_req, res) => {
  try {
    const d = getDb();
    const totalPosts = (d.prepare('SELECT COUNT(*) as cnt FROM burry_posts').get() as any).cnt;
    const totalPositions = (d.prepare('SELECT COUNT(*) as cnt FROM burry_positions').get() as any).cnt;
    const totalThemes = (d.prepare('SELECT COUNT(*) as cnt FROM burry_themes').get() as any).cnt;
    const rssState = d.prepare('SELECT * FROM burry_rss_state WHERE id = 1').get() as any;
    const latestPost = d.prepare('SELECT title, post_date FROM burry_posts ORDER BY post_date DESC LIMIT 1').get() as any;

    // Comment counts
    let totalComments = 0;
    let authorComments = 0;
    try {
      totalComments = (d.prepare('SELECT COUNT(*) as cnt FROM burry_comments').get() as any).cnt;
      authorComments = (d.prepare('SELECT COUNT(*) as cnt FROM burry_comments WHERE is_author_comment = 1 OR is_author_reply = 1').get() as any).cnt;
    } catch { /* table may not exist yet on older deploys */ }

    res.json({
      status: 'ok',
      substack: 'Cassandra Unchained',
      author: 'Michael Burry',
      url: SUBSTACK_BASE,
      total_posts: totalPosts,
      total_positions_extracted: totalPositions,
      total_themes: totalThemes,
      total_comments: totalComments,
      author_comments: authorComments,
      latest_post: latestPost || null,
      rss_polling: {
        active: pollTimer !== null,
        interval_minutes: 30,
        last_poll: rssState?.last_poll_at || 'never',
        poll_count: rssState?.poll_count || 0,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/narrative — Full Burry Lens narrative (LLM-powered with template fallback)
router.get('/burry/narrative', async (req, res) => {
  try {
    const symbol = req.query.symbol as string | undefined;
    const mode = req.query.mode as string | undefined; // 'llm' or 'template'

    if (mode === 'template') {
      const narrative = generateBurryNarrative(symbol);
      return res.json({ narrative, symbol: symbol || 'general', mode: 'template', timestamp: new Date().toISOString() });
    }

    // Default: try LLM, fallback to template
    const narrative = await generateLLMBurryNarrative(symbol);
    const isLLM = cachedLLMNarrative?.symbol === (symbol || 'general');
    res.json({ narrative, symbol: symbol || 'general', mode: isLLM ? 'llm' : 'template', timestamp: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/llm-test — Diagnostic: test LLM call directly
router.get('/burry/llm-test', async (_req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY || '';
  const keyInfo = apiKey ? `${apiKey.slice(0, 10)}...${apiKey.slice(-6)} (${apiKey.length} chars)` : 'MISSING';
  const isAnt = apiKey.startsWith('sk-ant');

  const diag: any = {
    key_present: !!apiKey,
    key_info: keyInfo,
    is_anthropic: isAnt,
    circuit_breaker: { failures: burryLLMFailures, last_failure: burryLLMLastFailure ? new Date(burryLLMLastFailure).toISOString() : 'never' },
    model: 'claude-sonnet-4-6',
  };

  if (!isAnt) {
    diag.error = 'No valid Anthropic key';
    return res.json(diag);
  }

  try {
    const anthropic = new Anthropic({ apiKey, timeout: 15000 });
    const msg = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 50,
      messages: [{ role: 'user', content: 'Say "LLM OK" and nothing else.' }],
    });
    diag.llm_response = msg.content[0]?.type === 'text' ? msg.content[0].text : 'non-text';
    diag.success = true;
  } catch (err: any) {
    diag.success = false;
    diag.error_type = err?.constructor?.name;
    diag.error_status = err?.status;
    diag.error_message = err?.message?.slice(0, 300);
  }

  res.json(diag);
});

// GET /burry/state — Current positions and themes
router.get('/burry/state', (_req, res) => {
  try {
    const state = getBurryCurrentState();
    res.json(state);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/posts — All posts with pagination
router.get('/burry/posts', (req, res) => {
  try {
    const d = getDb();
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const postType = req.query.type as string;

    let query = `SELECT id, slug, title, subtitle, post_date, url, post_type, sentiment,
                  conviction_level, tickers_mentioned, key_themes, word_count, likes_count
                 FROM burry_posts`;
    const params: any[] = [];

    if (postType) {
      query += ' WHERE post_type = ?';
      params.push(postType);
    }

    query += ' ORDER BY post_date DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const posts = d.prepare(query).all(...params);
    const total = (d.prepare(`SELECT COUNT(*) as cnt FROM burry_posts ${postType ? 'WHERE post_type = ?' : ''}`).get(...(postType ? [postType] : [])) as any).cnt;

    res.json({ posts, total, limit, offset });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/posts/:slug — Single post detail
router.get('/burry/posts/:slug', (req, res) => {
  try {
    const d = getDb();
    const post = d.prepare('SELECT * FROM burry_posts WHERE slug = ?').get(req.params.slug);
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const postObj = post as any;
    const positions = d.prepare('SELECT * FROM burry_positions WHERE post_id = ?').all(postObj.id);
    const histRefs = d.prepare('SELECT * FROM burry_historical_refs WHERE post_id = ?').all(postObj.id);

    res.json({ ...postObj, positions, historical_references: histRefs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/positions — All extracted positions
router.get('/burry/positions', (req, res) => {
  try {
    const d = getDb();
    const ticker = req.query.ticker as string;
    const direction = req.query.direction as string;

    let query = `
      SELECT bp.*, p.title as post_title, p.post_date, p.url as post_url
      FROM burry_positions bp
      JOIN burry_posts p ON bp.post_id = p.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (ticker) { conditions.push('bp.ticker = ?'); params.push(ticker.toUpperCase()); }
    if (direction) { conditions.push('bp.direction = ?'); params.push(direction); }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY p.post_date DESC LIMIT 100';

    const positions = d.prepare(query).all(...params);
    res.json({ positions, count: positions.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/themes — Recurring themes
router.get('/burry/themes', (_req, res) => {
  try {
    const d = getDb();
    const themes = d.prepare('SELECT * FROM burry_themes ORDER BY mention_count DESC').all();
    res.json({ themes });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/search — Full text search
router.get('/burry/search', (req, res) => {
  try {
    const q = req.query.q as string;
    if (!q) return res.status(400).json({ error: 'Query parameter "q" required' });

    const results = searchPosts(q);
    res.json({ query: q, results, count: results.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /burry/ingest — Manual post ingestion (for client-side push from Chrome)
router.post('/burry/ingest', (req, res) => {
  try {
    const { slug, title, subtitle, date, url, content } = req.body;
    if (!slug || !title || !content) {
      return res.status(400).json({ error: 'slug, title, and content are required' });
    }

    const postId = storePost({
      slug,
      title,
      subtitle: subtitle || null,
      date: date || new Date().toISOString().split('T')[0],
      url: url || `${SUBSTACK_BASE}/p/${slug}`,
      content,
    });

    res.json({ status: 'ok', post_id: postId, slug });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /burry/ingest-batch — Batch ingestion
router.post('/burry/ingest-batch', (req, res) => {
  try {
    const { posts } = req.body;
    if (!Array.isArray(posts)) return res.status(400).json({ error: 'posts array required' });

    const results: any[] = [];
    for (const post of posts) {
      try {
        const postId = storePost(post);
        results.push({ slug: post.slug, status: 'ok', post_id: postId });
      } catch (err: any) {
        results.push({ slug: post.slug, status: 'error', error: err.message });
      }
    }

    res.json({ ingested: results.filter(r => r.status === 'ok').length, errors: results.filter(r => r.status === 'error').length, results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /burry/poll — Trigger immediate RSS poll
router.post('/burry/poll', async (_req, res) => {
  try {
    const result = await pollForNewPosts();
    res.json({ status: 'ok', ...result });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/ticker/:symbol — Burry's view on a specific ticker (LLM-powered)
router.get('/burry/ticker/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const narrative = await generateLLMBurryNarrative(symbol);
    const d = getDb();

    const positions = d.prepare(`
      SELECT bp.*, p.post_date, p.title as post_title
      FROM burry_positions bp
      JOIN burry_posts p ON bp.post_id = p.id
      WHERE bp.ticker = ?
      ORDER BY p.post_date DESC
    `).all(symbol) as any[];

    const mentions = d.prepare(`
      SELECT id, title, post_date, sentiment, post_type
      FROM burry_posts
      WHERE tickers_mentioned LIKE ?
      ORDER BY post_date DESC
    `).all(`%"${symbol}"%`) as any[];

    res.json({
      symbol,
      narrative,
      position_history: positions,
      post_mentions: mentions,
      total_mentions: mentions.length,
      has_position: positions.length > 0,
      latest_direction: positions[0]?.direction || null,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /burry/ingest-comments — Batch ingest comments (from Chrome scraping)
router.post('/burry/ingest-comments', (req, res) => {
  try {
    const { post_slug, comments } = req.body;
    if (!post_slug || !Array.isArray(comments)) {
      return res.status(400).json({ error: 'post_slug and comments array required' });
    }

    const d = getDb();
    const post = d.prepare('SELECT id FROM burry_posts WHERE slug = ?').get(post_slug) as any;
    if (!post) return res.status(404).json({ error: `Post with slug "${post_slug}" not found` });

    const insertComment = d.prepare(`
      INSERT OR REPLACE INTO burry_comments
        (post_id, comment_id, parent_comment_id, is_author_comment, is_author_reply,
         author_name, comment_text, comment_date, subscriber_question,
         tickers_mentioned, key_themes, sentiment)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    let ingested = 0;
    for (const c of comments) {
      const isAuthor = (c.author_name || '').toLowerCase().includes('michael') ||
                       (c.author_name || '').toLowerCase().includes('burry') ||
                       c.is_author === true;
      const isReply = !!c.parent_comment_id && isAuthor;

      const tickers = extractTickersMentioned(c.text || '');
      const themes = extractKeyThemes(c.text || '');
      const sentiment = extractSentiment(c.text || '');

      insertComment.run(
        post.id,
        c.comment_id || `${post_slug}-${ingested}`,
        c.parent_comment_id || null,
        isAuthor ? 1 : 0,
        isReply ? 1 : 0,
        c.author_name || 'Unknown',
        c.text || '',
        c.date || new Date().toISOString().split('T')[0],
        isReply ? c.subscriber_question || null : null,
        JSON.stringify(tickers),
        JSON.stringify(themes),
        sentiment
      );
      ingested++;
    }

    console.log(`[BURRY] Ingested ${ingested} comments for post "${post_slug}" (author comments: ${comments.filter((c: any) => c.is_author).length})`);
    res.json({ status: 'ok', post_slug, ingested });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /burry/comments — Get Burry's comments (author comments and replies only)
router.get('/burry/comments', (req, res) => {
  try {
    const d = getDb();
    const postSlug = req.query.post as string;
    const onlyAuthor = req.query.author !== 'false'; // Default: only Burry's comments

    let query = `
      SELECT bc.*, bp.title as post_title, bp.slug as post_slug, bp.post_date
      FROM burry_comments bc
      JOIN burry_posts bp ON bc.post_id = bp.id
    `;
    const conditions: string[] = [];
    const params: any[] = [];

    if (onlyAuthor) {
      conditions.push('(bc.is_author_comment = 1 OR bc.is_author_reply = 1)');
    }
    if (postSlug) {
      conditions.push('bp.slug = ?');
      params.push(postSlug);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY bc.comment_date DESC LIMIT 100';

    const comments = d.prepare(query).all(...params);
    const totalAuthor = (d.prepare('SELECT COUNT(*) as cnt FROM burry_comments WHERE is_author_comment = 1 OR is_author_reply = 1').get() as any).cnt;

    res.json({
      comments,
      count: comments.length,
      total_author_comments: totalAuthor,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════════
// BURRY FRAMEWORK EVALUATOR — Apply Burry's analytical principles
// to ANY stock, not just ones he explicitly mentions.
//
// Derived from exhaustive analysis of all 64 Substack posts + 715
// author comments from "Cassandra Unchained" (Nov 2025 – Jun 2026).
//
// Key dimensions scored:
//   1. Valuation (P/S percentile, P/E vs historical, IV15 proxy)
//   2. SBC & Dilution (share count trend, buyback effectiveness)
//   3. Balance Sheet (Debt/EBITDA, interest coverage — HARD SELLS)
//   4. Moat Durability (Stone Classification + AI threat tier)
//   5. Volume Signal (shareholder turnover — Burry's key technical)
//   6. Contrarian Opportunity (whale-fall, mean reversion potential)
//   7. Capital Cycle Position (where in capex boom/bust)
//
// SILO: This module reads data passed in; it does NOT import from
// morning-lens.ts or any other analysis module.
// ═══════════════════════════════════════════════════════════════════

const GF_API_KEY = process.env.GURUFOCUS_API_KEY || '026d8ee9d10c778c6656d672b5ff1e71:544e1fff1953fece457d6152f3239e74';

export interface BurryFrameworkInput {
  symbol: string;
  price: number;
  priceVs200d: number | null;       // % above/below 200d SMA
  pctFrom52wHigh: number | null;    // % below 52-week high (negative)
  upDownRatio: number | null;       // 20-day up/down volume ratio
  sma50Above200: boolean;           // golden cross state
  rsi14: number | null;
  volumeBreakdown: {
    shareholderTurnover?: {
      turnoverPct: number;
      turnoverLabel: string;
      [key: string]: any;
    } | null;
    peak?: {
      declineFromPeak: number;
      [key: string]: any;
    } | null;
    [key: string]: any;
  } | null;
}

export interface BurryFrameworkResult {
  overallVerdict: 'ATTRACTIVE' | 'INTERESTING' | 'NEUTRAL' | 'UNATTRACTIVE' | 'AVOID';
  overallScore: number;  // 0-100
  summary: string;       // 2-3 sentence Burry-style assessment

  // Dimension scores (each 0-100, higher = more Burry-attractive)
  valuation: { score: number; grade: string; detail: string; metrics: Record<string, any> };
  balanceSheet: { score: number; grade: string; detail: string; hardSellTriggered: boolean; metrics: Record<string, any> };
  moat: { stone: string; aictTier: number; detail: string; score: number };
  volumeSignal: { score: number; detail: string };
  contrarianOpportunity: { score: number; detail: string };
  capitalCycle: { position: string; detail: string; score: number };
  sbcDilution: { score: number; detail: string; metrics: Record<string, any> };

  // Burry's principles that apply
  principlesTriggered: Array<{ principle: string; applies: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; quote: string }>;

  // Hard rules
  hardSells: string[];     // Non-negotiable sell rules triggered
  redFlags: string[];      // Concerns but not automatic sells
  greenFlags: string[];    // Positive signals Burry would note

  dataAvailable: boolean;  // false = GuruFocus fetch failed, scores are partial
}

// ─── STONE CLASSIFICATION (Moat Durability) ───
// Burry's framework: Granite > Marble > Limestone > Sandstone > Chalk
const STONE_MAP: Record<string, { stone: string; score: number }> = {
  // Granite: Regulatory/mission-critical moats
  'Healthcare': { stone: 'Granite', score: 90 },
  'Biotech/Pharma': { stone: 'Marble', score: 75 },
  'Insurance': { stone: 'Marble', score: 75 },
  'Utilities': { stone: 'Granite', score: 85 },
  // Marble: Strong brand/switching costs
  'Consumer Staples': { stone: 'Marble', score: 70 },
  'Aerospace & Defense': { stone: 'Marble', score: 75 },
  'Banks': { stone: 'Limestone', score: 60 },
  'Financials': { stone: 'Limestone', score: 60 },
  'Transports': { stone: 'Limestone', score: 55 },
  'Industrials': { stone: 'Limestone', score: 55 },
  // Limestone: Competitive but defensible
  'Materials': { stone: 'Limestone', score: 50 },
  'Energy': { stone: 'Limestone', score: 50 },
  'Real Estate': { stone: 'Limestone', score: 55 },
  'Consumer Discretionary': { stone: 'Sandstone', score: 40 },
  'Retail': { stone: 'Sandstone', score: 35 },
  'Communications': { stone: 'Sandstone', score: 40 },
  // Sandstone/Chalk: Disruption-vulnerable
  'Software': { stone: 'Sandstone', score: 30 },
  'Technology': { stone: 'Sandstone', score: 35 },
  'Semiconductors': { stone: 'Limestone', score: 50 }, // Burry sees these as cyclical, not chalk
};

// ─── AI COMPETITIVE THREAT (AICT) Tiers ───
// Tier 1 = Existential, Tier 5 = Minimal
const AICT_MAP: Record<string, number> = {
  'Software': 2,     // Severe — AI directly disrupts seat-based models
  'Technology': 2,
  'Communications': 3,
  'Retail': 3,
  'Consumer Discretionary': 3,
  'Semiconductors': 3,  // Cyclical risk, not displacement
  'Banks': 3,
  'Financials': 3,
  'Industrials': 4,
  'Transports': 4,
  'Materials': 4,
  'Energy': 4,
  'Real Estate': 4,
  'Healthcare': 4,
  'Biotech/Pharma': 4,
  'Insurance': 4,
  'Consumer Staples': 5,
  'Utilities': 5,
  'Aerospace & Defense': 5,
};

// ─── CAPITAL CYCLE — Sectors currently in capex boom (per Burry's 2025-2026 analysis) ───
const CAPEX_BOOM_SECTORS = new Set(['Semiconductors', 'Technology', 'Software', 'Communications']);

async function fetchGFSummary(symbol: string): Promise<any | null> {
  try {
    const url = `https://api.gurufocus.com/public/user/${GF_API_KEY}/stock/${encodeURIComponent(symbol)}/summary`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

export async function evaluateBurryFramework(input: BurryFrameworkInput): Promise<BurryFrameworkResult> {
  const { symbol, price, priceVs200d, pctFrom52wHigh, upDownRatio, sma50Above200, rsi14, volumeBreakdown } = input;

  // Fetch fundamentals from GuruFocus
  const gf = await fetchGFSummary(symbol);
  const dataAvailable = gf !== null;
  const ratios = gf?.summary?.ratio || {};
  const general = gf?.summary?.general || {};
  const sector = general.supersector || general.sector || '';
  const group = general.group || general.subindustry || '';

  // Detect normalized sector name for stone/AICT mapping
  const sectorName = detectSectorName(sector, group);

  // ═══ 1. VALUATION SCORE ═══
  const pe = parseFloat(ratios['P/E(ttm)']?.value) || null;
  const peLow = parseFloat(ratios['P/E(ttm)']?.his?.low) || null;
  const peHigh = parseFloat(ratios['P/E(ttm)']?.his?.high) || null;
  const peMed = parseFloat(ratios['P/E(ttm)']?.his?.med) || null;
  const fwdPe = parseFloat(ratios['Forward P/E']?.value) || null;
  const ps = parseFloat(ratios['P/S']?.value) || null;
  const psLow = parseFloat(ratios['P/S']?.his?.low) || null;
  const psHigh = parseFloat(ratios['P/S']?.his?.high) || null;
  const pb = parseFloat(ratios['P/B']?.value) || null;
  const pbLow = parseFloat(ratios['P/B']?.his?.low) || null;
  const fcfYield = parseFloat(ratios['FCF Yield (%)']?.value) || null;
  const evEbitda = parseFloat(ratios['EV-to-EBITDA']?.value) || null;

  let valScore = 50; // default neutral
  const valMetrics: Record<string, any> = { pe, fwdPe, ps, pb, fcfYield, evEbitda };
  const valNotes: string[] = [];

  if (ps !== null && psLow !== null && psHigh !== null && psHigh > psLow) {
    const psPctile = ((ps - psLow) / (psHigh - psLow)) * 100;
    valMetrics.psPercentile = Math.round(psPctile);
    // Burry: "P/S at 10-year lows" = very attractive
    if (psPctile < 10) { valScore += 25; valNotes.push('P/S near 10-year LOW — Burry sweet spot'); }
    else if (psPctile < 25) { valScore += 15; valNotes.push('P/S in bottom quartile of historical range'); }
    else if (psPctile > 80) { valScore -= 20; valNotes.push('P/S near historical HIGH — expensive'); }
    else if (psPctile > 60) { valScore -= 10; valNotes.push('P/S above historical median'); }
  }

  if (pe !== null && peMed !== null) {
    if (pe < peMed * 0.7) { valScore += 15; valNotes.push('P/E well below historical median'); }
    else if (pe > peMed * 1.3) { valScore -= 15; valNotes.push('P/E well above historical median'); }
    valMetrics.peMed = peMed;
  }

  if (fwdPe !== null) {
    if (fwdPe < 12) { valScore += 10; valNotes.push('Forward P/E < 12 — cheap'); }
    else if (fwdPe < 18) { valScore += 5; }
    else if (fwdPe > 35) { valScore -= 15; valNotes.push('Forward P/E > 35 — expensive by Burry standards'); }
    else if (fwdPe > 25) { valScore -= 5; }
  }

  if (fcfYield !== null) {
    if (fcfYield > 8) { valScore += 10; valNotes.push('FCF yield > 8% — strong cash generation'); }
    else if (fcfYield > 5) { valScore += 5; }
    else if (fcfYield < 1) { valScore -= 10; valNotes.push('FCF yield < 1% — poor cash generation'); }
  }

  // Burry: "Samsung at tangible book value — historically been a floor"
  if (pb !== null && pbLow !== null) {
    if (pb <= pbLow * 1.1) { valScore += 15; valNotes.push('Trading near tangible book floor — Burry pattern'); }
  }

  valScore = Math.max(0, Math.min(100, valScore));
  const valGrade = valScore >= 75 ? 'Deep Value' : valScore >= 60 ? 'Value' : valScore >= 40 ? 'Fair' : valScore >= 25 ? 'Rich' : 'Expensive';

  // ═══ 2. BALANCE SHEET HEALTH ═══
  const debtEbitda = parseFloat(ratios['Debt-to-EBITDA']?.value) || null;
  const interestCov = parseFloat(ratios['Interest Coverage']?.value) || null;
  const debtEquity = parseFloat(ratios['Debt-to-Equity']?.value) || null;
  const currentRatio = parseFloat(ratios['Current Ratio']?.value) || null;

  let bsScore = 60; // default moderately healthy
  const bsMetrics: Record<string, any> = { debtEbitda, interestCov, debtEquity, currentRatio };
  const bsNotes: string[] = [];
  const hardSells: string[] = [];

  // Burry HARD SELL: "Never compatible with >5x Debt/EBITDA"
  if (debtEbitda !== null) {
    if (debtEbitda > 5.0) {
      bsScore = 0;
      hardSells.push(`HARD SELL: Debt/EBITDA = ${debtEbitda.toFixed(1)}x (Burry threshold: 5.0x max — "When these thresholds are breached, sell immediately")`);
      bsNotes.push('CRITICAL: Exceeds Burry\'s absolute Debt/EBITDA limit');
    } else if (debtEbitda > 3.5) { bsScore -= 15; bsNotes.push(`Debt/EBITDA ${debtEbitda.toFixed(1)}x — approaching Burry concern zone`); }
    else if (debtEbitda < 1.5) { bsScore += 15; bsNotes.push('Low leverage — Burry prefers "little debt"'); }
    else if (debtEbitda < 2.5) { bsScore += 5; }
  }

  // Burry HARD SELL: "Never ok with interest coverage under 4.0x"
  if (interestCov !== null) {
    if (interestCov < 4.0 && interestCov > 0) {
      bsScore = Math.min(bsScore, 10);
      hardSells.push(`HARD SELL: Interest Coverage = ${interestCov.toFixed(1)}x (Burry threshold: 4.0x min — non-negotiable)`);
      bsNotes.push('CRITICAL: Below Burry\'s absolute interest coverage floor');
    } else if (interestCov > 10) { bsScore += 10; bsNotes.push('Strong interest coverage — ample debt service capacity'); }
  }

  if (currentRatio !== null) {
    if (currentRatio < 0.8) { bsScore -= 10; bsNotes.push('Weak current ratio — liquidity concern'); }
    else if (currentRatio > 2.0) { bsScore += 5; }
  }

  bsScore = Math.max(0, Math.min(100, bsScore));
  const bsGrade = hardSells.length > 0 ? 'FAIL — Hard Sell' : bsScore >= 70 ? 'Strong' : bsScore >= 50 ? 'Adequate' : bsScore >= 30 ? 'Weak' : 'Dangerous';

  // ═══ 3. SBC & DILUTION ═══
  // Burry's "Tragic Algebra of SBC" — even 1% dilution dramatically reduces intrinsic value
  const sbcRevenue = parseFloat(ratios['SBC (% of Revenue)']?.value) || null;
  const sharesGrowth = parseFloat(ratios['Shares Outstanding Growth (%)']?.value) || null;
  const buybackYield = parseFloat(ratios['Buyback Ratio (%)']?.value) || null;

  let sbcScore = 60;
  const sbcMetrics: Record<string, any> = { sbcRevenue, sharesGrowth, buybackYield };
  const sbcNotes: string[] = [];

  if (sbcRevenue !== null) {
    if (sbcRevenue > 15) { sbcScore -= 30; sbcNotes.push(`SBC = ${sbcRevenue.toFixed(1)}% of revenue — Burry: "Growth at any cost and SBC at any price is not the path"`); }
    else if (sbcRevenue > 8) { sbcScore -= 15; sbcNotes.push(`SBC = ${sbcRevenue.toFixed(1)}% of revenue — material dilution`); }
    else if (sbcRevenue > 3) { sbcScore -= 5; }
    else if (sbcRevenue < 1) { sbcScore += 15; sbcNotes.push('Minimal SBC — Burry prefers companies without significant dilution'); }
  }

  if (sharesGrowth !== null) {
    if (sharesGrowth > 2) { sbcScore -= 20; sbcNotes.push(`Share count GROWING ${sharesGrowth.toFixed(1)}%/yr despite potential buybacks — "buybacks to nowhere"`); }
    else if (sharesGrowth > 0.5) { sbcScore -= 10; sbcNotes.push('Share count still rising — buybacks not offsetting dilution'); }
    else if (sharesGrowth < -2) { sbcScore += 15; sbcNotes.push('Meaningful share count reduction — effective capital return'); }
    else if (sharesGrowth < 0) { sbcScore += 5; }
  }

  sbcScore = Math.max(0, Math.min(100, sbcScore));

  // ═══ 4. MOAT DURABILITY (Stone Classification + AICT) ═══
  const stoneData = STONE_MAP[sectorName] || { stone: 'Limestone', score: 50 };
  const aictTier = AICT_MAP[sectorName] || 3;
  let moatScore = stoneData.score;

  // Adjust moat score by AICT tier
  if (aictTier <= 2) moatScore -= 15; // Severe/existential AI threat
  else if (aictTier >= 5) moatScore += 10; // AI is additive

  moatScore = Math.max(0, Math.min(100, moatScore));

  const moatDetail = `${stoneData.stone} moat (${sectorName}) — AICT Tier ${aictTier}: ${aictTier <= 2 ? 'AI poses significant competitive threat' : aictTier >= 4 ? 'Low AI disruption risk — regulatory/switching cost moats protect' : 'Moderate AI impact — company can adapt'}`;

  // ═══ 5. VOLUME SIGNAL ═══
  let volScore = 50;
  let volDetail = '';
  const to = volumeBreakdown?.shareholderTurnover;
  const decline = volumeBreakdown?.peak?.declineFromPeak;

  if (to && to.turnoverPct > 0) {
    // Burry: 3-5x turnover sets up potential bottoms
    if (to.turnoverPct >= 300) { volScore = 90; volDetail = `Turnover ${to.turnoverPct}% — Burry: "between 3-5x turnover sets up potential bottom" — ROTATION WELL PAST COMPLETE`; }
    else if (to.turnoverPct >= 200) { volScore = 80; volDetail = `Turnover ${to.turnoverPct}% — rotation complete, new shareholder base established`; }
    else if (to.turnoverPct >= 100) { volScore = 65; volDetail = `Turnover ${to.turnoverPct}% — rotation progressing, not yet complete`; }
    else { volScore = 40; volDetail = `Turnover ${to.turnoverPct}% — early rotation, weak hands still present`; }
  } else if (decline !== undefined && decline < -5) {
    volDetail = `Stock in decline (${decline?.toFixed(1)}% from peak) but no significant turnover data`;
    volScore = 35;
  } else {
    volDetail = 'No significant decline pattern — turnover analysis not applicable';
    volScore = 50;
  }

  // Combine with up/down volume ratio
  if (upDownRatio !== null) {
    if (upDownRatio > 1.5) { volScore = Math.min(100, volScore + 10); volDetail += '. Heavy accumulation volume (Burry bullish signal)'; }
    else if (upDownRatio < 0.7) { volScore = Math.max(0, volScore - 10); volDetail += '. Distribution volume dominates'; }
  }

  // ═══ 6. CONTRARIAN OPPORTUNITY ═══
  let contrScore = 50;
  let contrDetail = '';
  const contrNotes: string[] = [];

  // "Whale fall" — quality stocks dragged down by sector panic
  if (pctFrom52wHigh !== null && pctFrom52wHigh < -30) {
    contrScore += 20;
    contrNotes.push(`${pctFrom52wHigh.toFixed(0)}% below 52-week high — potential whale-fall opportunity`);
  } else if (pctFrom52wHigh !== null && pctFrom52wHigh < -15) {
    contrScore += 10;
    contrNotes.push(`${pctFrom52wHigh.toFixed(0)}% below 52-week high — meaningful pullback`);
  } else if (pctFrom52wHigh !== null && pctFrom52wHigh > -3) {
    contrScore -= 15;
    contrNotes.push('Near all-time highs — no contrarian edge');
  }

  // RSI-based oversold/overbought
  if (rsi14 !== null) {
    if (rsi14 < 30) { contrScore += 15; contrNotes.push(`RSI ${rsi14.toFixed(0)} — oversold, contrarian buy signal`); }
    else if (rsi14 > 70) { contrScore -= 10; contrNotes.push(`RSI ${rsi14.toFixed(0)} — overbought, Burry would wait`); }
  }

  // Below 200d = potential mean reversion candidate
  if (priceVs200d !== null && priceVs200d < -15) {
    contrScore += 10;
    contrNotes.push('Well below 200d MA — mean reversion territory');
  }

  contrScore = Math.max(0, Math.min(100, contrScore));
  contrDetail = contrNotes.length > 0 ? contrNotes.join('. ') : 'No strong contrarian signals either way';

  // ═══ 7. CAPITAL CYCLE POSITION ═══
  const inCapexBoom = CAPEX_BOOM_SECTORS.has(sectorName);
  let cycleScore = 50;
  let cyclePosition = 'Mid-cycle';
  let cycleDetail = '';

  if (inCapexBoom) {
    // Burry: "Stock market peaks occur MIDWAY through investment booms, not at end"
    cycleScore = 25;
    cyclePosition = 'Late Capex Boom';
    cycleDetail = 'Sector in active capex boom — Burry (via Chancellor): "Stock market peaks occur MIDWAY through investment booms." High risk of peak-cycle pricing.';
  } else {
    // Non-boom sectors are relatively safer on capital cycle basis
    cycleScore = 60;
    cyclePosition = 'Normal Cycle';
    cycleDetail = 'Sector not in capex boom territory — no capital cycle red flag';
  }

  // ═══ AGGREGATE PRINCIPLES TRIGGERED ═══
  const principlesTriggered: Array<{ principle: string; applies: 'BULLISH' | 'BEARISH' | 'NEUTRAL'; quote: string }> = [];
  const redFlags: string[] = [];
  const greenFlags: string[] = [];

  // IV15 proxy: if FCF yield > 8% and forward P/E < 18, plausible 15%+ returns
  if (fcfYield !== null && fcfYield > 8 && fwdPe !== null && fwdPe < 18) {
    principlesTriggered.push({
      principle: 'IV15 Standard (proxy)',
      applies: 'BULLISH',
      quote: '"Any stock I own must offer, with a good degree of predictability, 15% or more annual returns for a long period of time."',
    });
    greenFlags.push('Plausible 15%+ annual returns based on FCF yield and forward P/E');
  }

  // "Large, well-established businesses with significant owners earnings, little debt, and large buybacks"
  if (debtEbitda !== null && debtEbitda < 2.5 && sharesGrowth !== null && sharesGrowth < -1) {
    principlesTriggered.push({
      principle: 'Ideal Company Profile',
      applies: 'BULLISH',
      quote: '"Large, well-established businesses with significant owners earnings, little debt, and large buybacks"',
    });
    greenFlags.push('Low debt + active share reduction — matches Burry\'s ideal profile');
  }

  // SBC concern
  if (sbcRevenue !== null && sbcRevenue > 10) {
    principlesTriggered.push({
      principle: 'Tragic Algebra of SBC',
      applies: 'BEARISH',
      quote: '"Even sub-1% dilution dramatically reduces present value. Growth at any cost and SBC at any price is not the path to acceptable long-term returns."',
    });
    redFlags.push(`SBC at ${sbcRevenue.toFixed(1)}% of revenue — Burry's "Tragic Algebra" applies`);
  }

  // Capital cycle warning
  if (inCapexBoom) {
    principlesTriggered.push({
      principle: 'Capital Cycle Theory',
      applies: 'BEARISH',
      quote: '"Stock market peaks occur MIDWAY through investment booms, not at end." — Edward Chancellor\'s Capital Account, cited repeatedly by Burry',
    });
    redFlags.push('Sector in capex boom — peak-cycle pricing risk');
  }

  // Contrarian whale fall
  if (pctFrom52wHigh !== null && pctFrom52wHigh < -25 && moatScore >= 50) {
    principlesTriggered.push({
      principle: 'Whale Fall',
      applies: 'BULLISH',
      quote: '"These stocks are part of the mass whale fall happening away from the main spectacle. In 1999 this happened too."',
    });
    greenFlags.push('Quality stock significantly below highs — potential whale-fall opportunity');
  }

  // Volume turnover bottoming signal
  if (to && to.turnoverPct >= 200 && decline !== undefined && decline < -20) {
    principlesTriggered.push({
      principle: 'Shareholder Turnover Bottoming',
      applies: 'BULLISH',
      quote: '"Shares traded 3.93x total outstanding since falling below [level] — between 3-5x turnover sets up potential bottom"',
    });
    greenFlags.push(`${to.turnoverPct}% shareholder turnover during decline — Burry bottoming signal`);
  }

  // Declining volume on rallies = bearish
  if (upDownRatio !== null && upDownRatio < 0.7 && priceVs200d !== null && priceVs200d > 10) {
    principlesTriggered.push({
      principle: 'Exhausted Buying',
      applies: 'BEARISH',
      quote: '"Declining volume during price advances = bearish — everyone that can buy has bought"',
    });
    redFlags.push('Price extended above 200d MA on declining volume — buying exhaustion');
  }

  // Near tangible book value
  if (pb !== null && pbLow !== null && pb <= pbLow * 1.15) {
    principlesTriggered.push({
      principle: 'Tangible Book Floor',
      applies: 'BULLISH',
      quote: '"Samsung at tangible book value — historically been a floor"',
    });
    greenFlags.push('Trading near historical P/B floor — Burry sees this as a floor');
  }

  // ═══ OVERALL SCORE ═══
  // Weights: Valuation 25%, Balance Sheet 20%, Volume 15%, Contrarian 15%, Moat 10%, SBC 10%, Capital Cycle 5%
  const overall = Math.round(
    valScore * 0.25 +
    bsScore * 0.20 +
    volScore * 0.15 +
    contrScore * 0.15 +
    moatScore * 0.10 +
    sbcScore * 0.10 +
    cycleScore * 0.05
  );

  // Hard sells override everything
  let overallVerdict: BurryFrameworkResult['overallVerdict'];
  if (hardSells.length > 0) {
    overallVerdict = 'AVOID';
  } else if (overall >= 72) {
    overallVerdict = 'ATTRACTIVE';
  } else if (overall >= 58) {
    overallVerdict = 'INTERESTING';
  } else if (overall >= 42) {
    overallVerdict = 'NEUTRAL';
  } else if (overall >= 28) {
    overallVerdict = 'UNATTRACTIVE';
  } else {
    overallVerdict = 'AVOID';
  }

  // Generate summary
  const summaryParts: string[] = [];
  if (hardSells.length > 0) {
    summaryParts.push(`AUTOMATIC AVOID: ${hardSells[0].split('(')[0].trim()}.`);
  } else {
    summaryParts.push(`Burry Framework Score: ${overall}/100 (${overallVerdict}).`);
  }
  if (greenFlags.length > 0) summaryParts.push(greenFlags[0] + '.');
  if (redFlags.length > 0) summaryParts.push('Concern: ' + redFlags[0] + '.');
  if (!dataAvailable) summaryParts.push('Note: GuruFocus data unavailable — scores are based on technical/volume data only.');

  return {
    overallVerdict,
    overallScore: hardSells.length > 0 ? Math.min(overall, 15) : overall,
    summary: summaryParts.join(' '),
    valuation: { score: valScore, grade: valGrade, detail: valNotes.join('. ') || 'Insufficient valuation data', metrics: valMetrics },
    balanceSheet: { score: bsScore, grade: bsGrade, detail: bsNotes.join('. ') || 'Insufficient balance sheet data', hardSellTriggered: hardSells.length > 0, metrics: bsMetrics },
    moat: { stone: stoneData.stone, aictTier, detail: moatDetail, score: moatScore },
    volumeSignal: { score: volScore, detail: volDetail || 'No volume signal' },
    contrarianOpportunity: { score: contrScore, detail: contrDetail },
    capitalCycle: { position: cyclePosition, detail: cycleDetail, score: cycleScore },
    sbcDilution: { score: sbcScore, detail: sbcNotes.join('. ') || 'No SBC data available', metrics: sbcMetrics },
    principlesTriggered,
    hardSells,
    redFlags,
    greenFlags,
    dataAvailable,
  };
}

function detectSectorName(sector: string, group: string): string {
  const s = (sector || '').toLowerCase();
  const g = (group || '').toLowerCase();
  if (g.includes('semiconductor') || g.includes('chip')) return 'Semiconductors';
  if (g.includes('software') || g.includes('saas')) return 'Software';
  if (g.includes('airline')) return 'Airlines';
  if (g.includes('bank') || g.includes('savings') || g.includes('lending')) return 'Banks';
  if (g.includes('biotech') || g.includes('pharma')) return 'Biotech/Pharma';
  if (g.includes('insurance')) return 'Insurance';
  if (g.includes('oil') || g.includes('gas') || g.includes('energy')) return 'Energy';
  if (g.includes('retail') || g.includes('store')) return 'Retail';
  if (g.includes('medical') || g.includes('health') || g.includes('hospital')) return 'Healthcare';
  if (g.includes('transport') || g.includes('railroad') || g.includes('freight')) return 'Transports';
  if (g.includes('chemical') || g.includes('material') || g.includes('metal') || g.includes('mining')) return 'Materials';
  if (g.includes('reit') || g.includes('real estate')) return 'Real Estate';
  if (g.includes('utility') || g.includes('electric') || g.includes('water')) return 'Utilities';
  if (g.includes('food') || g.includes('beverage') || g.includes('consumer staple')) return 'Consumer Staples';
  if (g.includes('aerospace') || g.includes('defense')) return 'Aerospace & Defense';
  if (g.includes('media') || g.includes('telecom') || g.includes('communication')) return 'Communications';
  if (s.includes('technology') || s.includes('tech')) return 'Technology';
  if (s.includes('financial')) return 'Financials';
  if (s.includes('health')) return 'Healthcare';
  if (s.includes('energy')) return 'Energy';
  if (s.includes('industrial')) return 'Industrials';
  if (s.includes('consumer') && s.includes('disc')) return 'Consumer Discretionary';
  if (s.includes('consumer') && s.includes('stap')) return 'Consumer Staples';
  if (s.includes('material')) return 'Materials';
  if (s.includes('communication')) return 'Communications';
  return 'Broad Market';
}

// ─── EXPORTED PER-TICKER BURRY INSIGHT (consumed by morning-lens ticker analysis) ───

export interface BurryTickerInsight {
  symbol: string;
  hasPosition: boolean;
  latestDirection: string | null;
  latestAction: string | null;
  latestPrice: number | null;
  latestDate: string | null;
  instrumentType: string | null;
  optionDetails: string | null;
  rationale: string | null;
  positionHistory: Array<{
    action: string; direction: string; price: number | null;
    instrumentType: string; optionDetails: string | null;
    postDate: string; postTitle: string;
  }>;
  postMentions: Array<{
    title: string; postDate: string; sentiment: string; postType: string;
  }>;
  totalMentions: number;
  authorComments: Array<{
    text: string; date: string; postTitle: string;
    isReply: boolean; subscriberQuestion: string | null;
  }>;
  relatedThemes: Array<{ theme: string; count: number; lastSeen: string }>;
  narrative: string; // LLM-powered narrative (cached 15min) or template fallback
}

export async function getBurryTickerInsight(symbol: string): Promise<BurryTickerInsight> {
  const upper = symbol.toUpperCase();
  let d: Database.Database;
  try { d = getDb(); } catch {
    return emptyBurryInsight(upper, 'Burry database not initialized.');
  }

  // Check if Burry tables exist / have data
  try {
    const cnt = (d.prepare('SELECT COUNT(*) as cnt FROM burry_posts').get() as any).cnt;
    if (cnt === 0) return emptyBurryInsight(upper, 'No Burry posts ingested yet.');
  } catch {
    return emptyBurryInsight(upper, 'Burry tables not initialized.');
  }

  // 1. Positions for this ticker
  const positions = d.prepare(`
    SELECT bp.action, bp.direction, bp.price, bp.position_size,
           bp.instrument_type, bp.option_details, bp.rationale,
           p.post_date, p.title as post_title
    FROM burry_positions bp
    JOIN burry_posts p ON bp.post_id = p.id
    WHERE bp.ticker = ?
    ORDER BY p.post_date DESC
  `).all(upper) as any[];

  // 2. Posts mentioning this ticker
  const mentions = d.prepare(`
    SELECT title, post_date, sentiment, post_type
    FROM burry_posts
    WHERE tickers_mentioned LIKE ?
    ORDER BY post_date DESC
    LIMIT 10
  `).all(`%"${upper}"%`) as any[];

  // 3. Burry's author comments mentioning this ticker
  let comments: any[] = [];
  try {
    comments = d.prepare(`
      SELECT bc.comment_text, bc.comment_date, bc.is_author_reply,
             bc.subscriber_question, bp.title as post_title
      FROM burry_comments bc
      JOIN burry_posts bp ON bc.post_id = bp.id
      WHERE (bc.is_author_comment = 1 OR bc.is_author_reply = 1)
        AND (bc.tickers_mentioned LIKE ? OR bc.comment_text LIKE ?)
      ORDER BY bc.comment_date DESC
      LIMIT 8
    `).all(`%"${upper}"%`, `%${upper}%`) as any[];
  } catch { /* comments table may not exist on older deploys */ }

  // 4. Themes related to this ticker
  let themes: any[] = [];
  try {
    themes = d.prepare(`
      SELECT theme_name, mention_count, last_mentioned
      FROM burry_themes
      WHERE status = 'active' AND related_tickers LIKE ?
      ORDER BY mention_count DESC
      LIMIT 6
    `).all(`%${upper}%`) as any[];
  } catch {}

  // 5. LLM narrative (uses 15-min cache internally)
  let narrative = '';
  try {
    narrative = await generateLLMBurryNarrative(upper);
  } catch {
    narrative = generateTickerNarrative(upper, getBurryCurrentState());
  }

  const latest = positions[0] || null;

  return {
    symbol: upper,
    hasPosition: positions.length > 0,
    latestDirection: latest?.direction || null,
    latestAction: latest?.action || null,
    latestPrice: latest?.price || null,
    latestDate: latest?.post_date || null,
    instrumentType: latest?.instrument_type || null,
    optionDetails: latest?.option_details || null,
    rationale: latest?.rationale || null,
    positionHistory: positions.map((p: any) => ({
      action: p.action, direction: p.direction, price: p.price,
      instrumentType: p.instrument_type, optionDetails: p.option_details,
      postDate: p.post_date, postTitle: p.post_title,
    })),
    postMentions: mentions.map((m: any) => ({
      title: m.title, postDate: m.post_date, sentiment: m.sentiment, postType: m.post_type,
    })),
    totalMentions: mentions.length,
    authorComments: comments.map((c: any) => ({
      text: c.comment_text, date: c.comment_date, postTitle: c.post_title,
      isReply: !!c.is_author_reply, subscriberQuestion: c.subscriber_question || null,
    })),
    relatedThemes: themes.map((t: any) => ({
      theme: t.theme_name, count: t.mention_count, lastSeen: t.last_mentioned,
    })),
    narrative,
  };
}

function emptyBurryInsight(symbol: string, reason: string): BurryTickerInsight {
  return {
    symbol, hasPosition: false, latestDirection: null, latestAction: null,
    latestPrice: null, latestDate: null, instrumentType: null, optionDetails: null,
    rationale: null, positionHistory: [], postMentions: [], totalMentions: 0,
    authorComments: [], relatedThemes: [], narrative: reason,
  };
}

export default router;
