"use strict";
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initBurryTables = initBurryTables;
exports.startRSSPolling = startRSSPolling;
exports.stopRSSPolling = stopRSSPolling;
const express_1 = require("express");
const better_sqlite3_1 = __importDefault(require("better-sqlite3"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const router = (0, express_1.Router)();
// ─── LLM INTEGRATION ───
let burryLLMFailures = 0;
let burryLLMLastFailure = 0;
const BURRY_LLM_COOLDOWN = 60 * 60 * 1000; // 1 hour after 3 failures
// Simple LLM narrative cache — avoids hammering API on repeated calls
let cachedLLMNarrative = null;
const NARRATIVE_CACHE_TTL = 15 * 60 * 1000; // 15 minutes
async function callBurryLLM(system, userMessage, maxTokens) {
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
        const anthropic = new sdk_1.default({ apiKey, timeout: 25000 });
        const msg = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: maxTokens,
            system,
            messages: [{ role: 'user', content: userMessage }],
        });
        burryLLMFailures = 0;
        console.log(`[BurryLLM] Success — ${msg.content[0]?.type === 'text' ? msg.content[0].text.length : 0} chars returned`);
        return msg.content[0]?.type === 'text' ? msg.content[0].text : null;
    }
    catch (err) {
        burryLLMFailures++;
        burryLLMLastFailure = Date.now();
        const errType = err?.constructor?.name || 'Unknown';
        const errStatus = err?.status || 'n/a';
        console.error(`[BurryLLM] API error (#${burryLLMFailures}) [${errType} status=${errStatus}]:`, err?.message?.slice(0, 200));
        return null;
    }
}
async function generateLLMBurryNarrative(symbol) {
    // Check cache
    const cacheKey = symbol || 'general';
    if (cachedLLMNarrative && cachedLLMNarrative.symbol === cacheKey &&
        (Date.now() - cachedLLMNarrative.timestamp) < NARRATIVE_CACHE_TTL) {
        return cachedLLMNarrative.text;
    }
    const state = getBurryCurrentState();
    if (state.totalPosts === 0)
        return generateBurryNarrative(symbol);
    let d;
    try {
        d = getDb();
    }
    catch (err) {
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
  `).all();
        const allPositions = d.prepare(`
    SELECT bp.ticker, bp.direction, bp.action, bp.price, bp.position_size,
           bp.instrument_type, bp.option_details, bp.rationale, p.post_date, p.title as post_title
    FROM burry_positions bp
    JOIN burry_posts p ON bp.post_id = p.id
    ORDER BY p.post_date DESC
  `).all();
        const themes = d.prepare(`
    SELECT theme_name as theme, mention_count as cnt, last_mentioned as last_seen
    FROM burry_themes
    WHERE status = 'active'
    ORDER BY mention_count DESC
    LIMIT 12
  `).all();
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
  `).all();
        // Get author comments/replies for additional insight
        const authorComments = d.prepare(`
    SELECT bc.comment_text, bc.subscriber_question, bc.comment_date,
           bc.tickers_mentioned, bc.is_author_reply, bp.title as post_title
    FROM burry_comments bc
    JOIN burry_posts bp ON bc.post_id = bp.id
    WHERE bc.is_author_comment = 1 OR bc.is_author_reply = 1
    ORDER BY bc.comment_date DESC
    LIMIT 20
  `).all();
        // Build context for LLM
        const positionsMap = new Map();
        for (const p of allPositions) {
            if (!positionsMap.has(p.ticker))
                positionsMap.set(p.ticker, []);
            positionsMap.get(p.ticker).push(p);
        }
        const positionSummaries = [];
        for (const [ticker, actions] of positionsMap) {
            const latest = actions[0];
            const hist = actions.map((a) => `${a.post_date}: ${a.action} ${a.price ? '@$' + a.price : ''} (${a.instrument_type})`).join('; ');
            positionSummaries.push(`${ticker} [${latest.direction}]: Latest=${latest.action} ${latest.price ? '@$' + latest.price : ''} (${latest.position_size || 'unknown size'}). History: ${hist}. Rationale: ${latest.rationale || 'n/a'}`);
        }
        // Label posts by temporal tier for the LLM
        const now = Date.now();
        function temporalTier(dateStr) {
            const postDate = new Date(dateStr).getTime();
            const daysDiff = Math.floor((now - postDate) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 14)
                return 'CURRENT';
            if (daysDiff <= 56)
                return 'RECENT';
            if (daysDiff <= 180)
                return 'FOUNDATIONAL';
            return 'HISTORICAL';
        }
        const recentPostSummaries = recentPosts.map((p) => {
            const content = p.content_text?.substring(0, 500) || '';
            const tier = temporalTier(p.post_date);
            return `[${tier}] "${p.title}" (${p.post_date}) [${p.sentiment}, ${p.conviction_level}]: ${content}`;
        }).join('\n\n');
        const analyticalSummaries = analyticalPosts.map((p) => {
            return `"${p.title}" (${p.post_date}): ${p.content_text?.substring(0, 600) || ''}`;
        }).join('\n\n');
        const themeSummary = themes.map((t) => `${t.theme} (${t.cnt}x, last: ${t.last_seen})`).join(', ');
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
    `).all(`%"${upper}"%`);
            const tickerPositions = positionsMap.get(upper) || [];
            tickerContext = `\n\nSPECIFIC TICKER FOCUS: ${upper}
Posts mentioning ${upper}: ${tickerPosts.map((p) => `"${p.title}" (${p.post_date}): ${p.content_text?.substring(0, 300)}`).join('\n')}
Position history: ${tickerPositions.map((p) => `${p.post_date}: ${p.action} @$${p.price} (${p.instrument_type}${p.option_details ? ', ' + p.option_details : ''})`).join('; ')}`;
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
            const commentSummaries = authorComments.map((c) => {
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
    }
    catch (err) {
        console.error('[BurryLLM] Error in narrative generation:', err.message);
        return generateBurryNarrative(symbol);
    }
}
// ─── DATABASE SETUP ───
const DATA_DIR = process.env.DATA_DIR || path_1.default.join(process.cwd(), 'data');
if (!fs_1.default.existsSync(DATA_DIR))
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
const DB_PATH = path_1.default.join(DATA_DIR, 'druck-history.db');
let db;
function getDb() {
    if (!db) {
        db = new better_sqlite3_1.default(DB_PATH);
        db.pragma('journal_mode = WAL');
    }
    return db;
}
// ─── INIT BURRY TABLES ───
function initBurryTables() {
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
    const stateCount = d.prepare('SELECT COUNT(*) as cnt FROM burry_rss_state').get();
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
function parseRSSXML(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1];
        const getTag = (tag) => {
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
function classifyPostType(title, content) {
    const t = title.toLowerCase();
    if (t.includes('trading post'))
        return 'trading_post';
    if (t.includes('short thoughts'))
        return 'short_thoughts';
    if (t.includes('heretic') || t.includes('guide'))
        return 'deep_dive';
    if (t.includes('abridged'))
        return 'abridged';
    if (t.includes('charity') || t.includes('brain tumor'))
        return 'charity';
    if (t.includes('software') || t.includes('payments'))
        return 'sector_analysis';
    if (t.includes('gamestop') || t.includes('fannie') || t.includes('freddie'))
        return 'company_analysis';
    if (t.includes('recurrence') || t.includes('algebra') || t.includes('accounting'))
        return 'deep_dive';
    if (content.length > 5000)
        return 'deep_dive';
    return 'commentary';
}
function extractSentiment(content) {
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
    if (bearScore > bullScore * 2)
        return 'strongly_bearish';
    if (bearScore > bullScore)
        return 'bearish';
    if (bullScore > bearScore * 2)
        return 'strongly_bullish';
    if (bullScore > bearScore)
        return 'bullish';
    return 'mixed';
}
function extractConviction(content) {
    const lower = content.toLowerCase();
    if (lower.includes('full position') || lower.includes('massively') || lower.includes('continue to hold'))
        return 'high';
    if (lower.includes('small add') || lower.includes('may') || lower.includes('considering'))
        return 'moderate';
    if (lower.includes('watching') || lower.includes('interesting') || lower.includes('exploring'))
        return 'low';
    return 'moderate';
}
function extractPositions(content, title) {
    const positions = [];
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
function extractTickersMentioned(content) {
    const tickers = new Set();
    // Find parenthetical tickers: (AAPL), (NVDA), etc
    const parenMatches = content.matchAll(/\(([A-Z]{1,5})\)/g);
    for (const m of parenMatches) {
        if (KNOWN_TICKERS.has(m[1]))
            tickers.add(m[1]);
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
function extractKeyThemes(content) {
    const themes = [];
    const lower = content.toLowerCase();
    const themePatterns = [
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
function extractHistoricalReferences(content) {
    const refs = [];
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
function storePost(post) {
    const d = getDb();
    const postType = classifyPostType(post.title, post.content);
    const sentiment = extractSentiment(post.content);
    const conviction = extractConviction(post.content);
    const tickers = extractTickersMentioned(post.content);
    const themes = extractKeyThemes(post.content);
    const wordCount = post.content.split(/\s+/).length;
    // Pre-delete child records if this slug already exists (INSERT OR REPLACE
    // deletes then inserts, which fails on FK constraints without CASCADE)
    const existingPost = d.prepare('SELECT id FROM burry_posts WHERE slug = ?').get(post.slug);
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
  `).run(post.slug, post.title, post.subtitle, post.date, post.url, post.content, postType, post.likes || 0, post.comments || 0, post.restacks || 0, JSON.stringify(tickers), JSON.stringify(themes), sentiment, conviction, wordCount);
    const postId = d.prepare('SELECT id FROM burry_posts WHERE slug = ?').get(post.slug);
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
            insertPos.run(postId.id, p.ticker, p.action, p.direction, p.price, p.positionSize, p.instrumentType, p.optionDetails, p.rationale, p.conviction);
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
        const existing = d.prepare('SELECT * FROM burry_themes WHERE theme_name = ?').get(theme);
        if (existing) {
            d.prepare(`
        UPDATE burry_themes SET last_mentioned = ?, mention_count = mention_count + 1,
          related_tickers = ? WHERE theme_name = ?
      `).run(post.date, JSON.stringify(tickers), theme);
        }
        else {
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
let pollTimer = null;
async function fetchRSS() {
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
    }
    catch (err) {
        console.error(`[BURRY] RSS fetch error: ${err.message}`);
        return null;
    }
}
async function pollForNewPosts() {
    const xml = await fetchRSS();
    if (!xml)
        return { newPosts: 0, titles: [] };
    const items = parseRSSXML(xml);
    const d = getDb();
    // Update poll state
    d.prepare(`UPDATE burry_rss_state SET last_poll_at = datetime('now'), poll_count = poll_count + 1 WHERE id = 1`).run();
    const newTitles = [];
    let newCount = 0;
    for (const item of items) {
        // Check if we already have this post
        const existing = d.prepare('SELECT id FROM burry_posts WHERE slug = ?').get(item.slug);
        if (existing)
            continue;
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
function startRSSPolling() {
    if (pollTimer)
        return;
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
function stopRSSPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
        console.log('[BURRY] RSS polling stopped');
    }
}
function getBurryCurrentState() {
    const d = getDb();
    const totalPosts = d.prepare('SELECT COUNT(*) as cnt FROM burry_posts').get().cnt;
    const last30 = d.prepare(`SELECT COUNT(*) as cnt FROM burry_posts WHERE post_date >= date('now', '-30 days')`).get().cnt;
    // Get latest positions by ticker (most recent action)
    const longPositions = d.prepare(`
    SELECT bp.ticker, bp.price, bp.position_size, bp.action, p.post_date
    FROM burry_positions bp
    JOIN burry_posts p ON bp.post_id = p.id
    WHERE bp.direction = 'long'
    ORDER BY p.post_date DESC
  `).all();
    // Dedupe to latest per ticker
    const longMap = new Map();
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
  `).all();
    const shortMap = new Map();
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
  `).all();
    // Overall sentiment from recent posts
    const recentSentiments = d.prepare(`
    SELECT sentiment, COUNT(*) as cnt FROM burry_posts
    WHERE post_date >= date('now', '-30 days')
    GROUP BY sentiment ORDER BY cnt DESC
  `).all();
    // Latest post
    const latest = d.prepare(`
    SELECT title, post_date, sentiment, tickers_mentioned FROM burry_posts
    ORDER BY post_date DESC LIMIT 1
  `).get();
    // Historical references aggregated
    const histRefs = d.prepare(`
    SELECT reference_period, COUNT(*) as cnt FROM burry_historical_refs
    GROUP BY reference_period ORDER BY cnt DESC
  `).all();
    // Conviction signals from recent posts
    const signals = [];
    const recentPosts = d.prepare(`
    SELECT content_text, conviction_level FROM burry_posts
    WHERE post_date >= date('now', '-14 days') AND content_text IS NOT NULL
    ORDER BY post_date DESC LIMIT 5
  `).all();
    for (const p of recentPosts) {
        if (p.conviction_level === 'high')
            signals.push('High conviction in recent posts');
        if (p.content_text?.toLowerCase().includes('full position'))
            signals.push('Adding to full positions');
        if (p.content_text?.toLowerCase().includes('double down'))
            signals.push('Doubling down');
    }
    return {
        totalPosts,
        postsLast30Days: last30,
        activePositions: {
            longs: Array.from(longMap.values()),
            shorts: Array.from(shortMap.values()),
        },
        dominantThemes: themes.map((t) => ({ theme: t.theme_name, count: t.mention_count, lastMentioned: t.last_mentioned })),
        overallSentiment: recentSentiments[0]?.sentiment || 'unknown',
        latestPost: latest ? {
            title: latest.title,
            date: latest.post_date,
            sentiment: latest.sentiment,
            tickers: JSON.parse(latest.tickers_mentioned || '[]'),
        } : null,
        historicalAnalogs: histRefs.map((r) => ({ period: r.reference_period, count: r.cnt })),
        convictionSignals: [...new Set(signals)],
    };
}
function generateBurryNarrative(symbol) {
    const state = getBurryCurrentState();
    if (state.totalPosts === 0) {
        return 'Burry Substack data not yet ingested. Run initial content import to populate.';
    }
    // If ticker-specific, check Burry's view on it
    if (symbol) {
        return generateTickerNarrative(symbol, state);
    }
    // General Burry state narrative
    const parts = [];
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
function generateTickerNarrative(symbol, state) {
    const d = getDb();
    const upper = symbol.toUpperCase();
    // Check if Burry has mentioned this ticker
    const tickerPosts = d.prepare(`
    SELECT title, post_date, sentiment, content_text, post_type
    FROM burry_posts
    WHERE tickers_mentioned LIKE ?
    ORDER BY post_date DESC
    LIMIT 10
  `).all(`%"${upper}"%`);
    const positions = d.prepare(`
    SELECT bp.*, p.post_date, p.title as post_title
    FROM burry_positions bp
    JOIN burry_posts p ON bp.post_id = p.id
    WHERE bp.ticker = ?
    ORDER BY p.post_date DESC
  `).all(upper);
    if (tickerPosts.length === 0 && positions.length === 0) {
        return `BURRY LENS [${upper}]: No direct mentions or positions found in Burry's Substack posts. This ticker does not appear to be in his current universe.`;
    }
    const parts = [];
    parts.push(`BURRY LENS [${upper}]`);
    // Position status
    if (positions.length > 0) {
        const latestPos = positions[0];
        const direction = latestPos.direction === 'long' ? 'LONG' : 'SHORT';
        parts.push(`\nPOSITION: ${direction}`);
        parts.push(`Latest action: ${latestPos.action} ${latestPos.price ? '@$' + latestPos.price : ''} on ${latestPos.post_date}`);
        if (latestPos.position_size)
            parts.push(`Size: ${latestPos.position_size}`);
        if (latestPos.instrument_type !== 'stock')
            parts.push(`Instrument: ${latestPos.instrument_type}`);
        if (latestPos.option_details)
            parts.push(`Details: ${latestPos.option_details}`);
        if (latestPos.rationale)
            parts.push(`Rationale: ${latestPos.rationale.substring(0, 200)}`);
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
            const sentences = latestContent.split(/[.!?]+/).filter((s) => s.toUpperCase().includes(upper) || s.includes(`(${upper})`));
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
function searchPosts(query, limit = 20) {
    const d = getDb();
    const searchTerm = `%${query}%`;
    return d.prepare(`
    SELECT id, slug, title, subtitle, post_date, url, post_type, sentiment,
           conviction_level, tickers_mentioned, key_themes, word_count, likes_count
    FROM burry_posts
    WHERE content_text LIKE ? OR title LIKE ?
    ORDER BY post_date DESC
    LIMIT ?
  `).all(searchTerm, searchTerm, limit);
}
// ─── API ROUTES ───
// GET /burry/status — Overview and stats
router.get('/burry/status', (_req, res) => {
    try {
        const d = getDb();
        const totalPosts = d.prepare('SELECT COUNT(*) as cnt FROM burry_posts').get().cnt;
        const totalPositions = d.prepare('SELECT COUNT(*) as cnt FROM burry_positions').get().cnt;
        const totalThemes = d.prepare('SELECT COUNT(*) as cnt FROM burry_themes').get().cnt;
        const rssState = d.prepare('SELECT * FROM burry_rss_state WHERE id = 1').get();
        const latestPost = d.prepare('SELECT title, post_date FROM burry_posts ORDER BY post_date DESC LIMIT 1').get();
        // Comment counts
        let totalComments = 0;
        let authorComments = 0;
        try {
            totalComments = d.prepare('SELECT COUNT(*) as cnt FROM burry_comments').get().cnt;
            authorComments = d.prepare('SELECT COUNT(*) as cnt FROM burry_comments WHERE is_author_comment = 1 OR is_author_reply = 1').get().cnt;
        }
        catch { /* table may not exist yet on older deploys */ }
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /burry/narrative — Full Burry Lens narrative (LLM-powered with template fallback)
router.get('/burry/narrative', async (req, res) => {
    try {
        const symbol = req.query.symbol;
        const mode = req.query.mode; // 'llm' or 'template'
        if (mode === 'template') {
            const narrative = generateBurryNarrative(symbol);
            return res.json({ narrative, symbol: symbol || 'general', mode: 'template', timestamp: new Date().toISOString() });
        }
        // Default: try LLM, fallback to template
        const narrative = await generateLLMBurryNarrative(symbol);
        const isLLM = cachedLLMNarrative?.symbol === (symbol || 'general');
        res.json({ narrative, symbol: symbol || 'general', mode: isLLM ? 'llm' : 'template', timestamp: new Date().toISOString() });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /burry/state — Current positions and themes
router.get('/burry/state', (_req, res) => {
    try {
        const state = getBurryCurrentState();
        res.json(state);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /burry/posts — All posts with pagination
router.get('/burry/posts', (req, res) => {
    try {
        const d = getDb();
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const postType = req.query.type;
        let query = `SELECT id, slug, title, subtitle, post_date, url, post_type, sentiment,
                  conviction_level, tickers_mentioned, key_themes, word_count, likes_count
                 FROM burry_posts`;
        const params = [];
        if (postType) {
            query += ' WHERE post_type = ?';
            params.push(postType);
        }
        query += ' ORDER BY post_date DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);
        const posts = d.prepare(query).all(...params);
        const total = d.prepare(`SELECT COUNT(*) as cnt FROM burry_posts ${postType ? 'WHERE post_type = ?' : ''}`).get(...(postType ? [postType] : [])).cnt;
        res.json({ posts, total, limit, offset });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /burry/posts/:slug — Single post detail
router.get('/burry/posts/:slug', (req, res) => {
    try {
        const d = getDb();
        const post = d.prepare('SELECT * FROM burry_posts WHERE slug = ?').get(req.params.slug);
        if (!post)
            return res.status(404).json({ error: 'Post not found' });
        const postObj = post;
        const positions = d.prepare('SELECT * FROM burry_positions WHERE post_id = ?').all(postObj.id);
        const histRefs = d.prepare('SELECT * FROM burry_historical_refs WHERE post_id = ?').all(postObj.id);
        res.json({ ...postObj, positions, historical_references: histRefs });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /burry/positions — All extracted positions
router.get('/burry/positions', (req, res) => {
    try {
        const d = getDb();
        const ticker = req.query.ticker;
        const direction = req.query.direction;
        let query = `
      SELECT bp.*, p.title as post_title, p.post_date, p.url as post_url
      FROM burry_positions bp
      JOIN burry_posts p ON bp.post_id = p.id
    `;
        const conditions = [];
        const params = [];
        if (ticker) {
            conditions.push('bp.ticker = ?');
            params.push(ticker.toUpperCase());
        }
        if (direction) {
            conditions.push('bp.direction = ?');
            params.push(direction);
        }
        if (conditions.length > 0)
            query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY p.post_date DESC LIMIT 100';
        const positions = d.prepare(query).all(...params);
        res.json({ positions, count: positions.length });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /burry/themes — Recurring themes
router.get('/burry/themes', (_req, res) => {
    try {
        const d = getDb();
        const themes = d.prepare('SELECT * FROM burry_themes ORDER BY mention_count DESC').all();
        res.json({ themes });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /burry/search — Full text search
router.get('/burry/search', (req, res) => {
    try {
        const q = req.query.q;
        if (!q)
            return res.status(400).json({ error: 'Query parameter "q" required' });
        const results = searchPosts(q);
        res.json({ query: q, results, count: results.length });
    }
    catch (err) {
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
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /burry/ingest-batch — Batch ingestion
router.post('/burry/ingest-batch', (req, res) => {
    try {
        const { posts } = req.body;
        if (!Array.isArray(posts))
            return res.status(400).json({ error: 'posts array required' });
        const results = [];
        for (const post of posts) {
            try {
                const postId = storePost(post);
                results.push({ slug: post.slug, status: 'ok', post_id: postId });
            }
            catch (err) {
                results.push({ slug: post.slug, status: 'error', error: err.message });
            }
        }
        res.json({ ingested: results.filter(r => r.status === 'ok').length, errors: results.filter(r => r.status === 'error').length, results });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// POST /burry/poll — Trigger immediate RSS poll
router.post('/burry/poll', async (_req, res) => {
    try {
        const result = await pollForNewPosts();
        res.json({ status: 'ok', ...result });
    }
    catch (err) {
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
    `).all(symbol);
        const mentions = d.prepare(`
      SELECT id, title, post_date, sentiment, post_type
      FROM burry_posts
      WHERE tickers_mentioned LIKE ?
      ORDER BY post_date DESC
    `).all(`%"${symbol}"%`);
        res.json({
            symbol,
            narrative,
            position_history: positions,
            post_mentions: mentions,
            total_mentions: mentions.length,
            has_position: positions.length > 0,
            latest_direction: positions[0]?.direction || null,
        });
    }
    catch (err) {
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
        const post = d.prepare('SELECT id FROM burry_posts WHERE slug = ?').get(post_slug);
        if (!post)
            return res.status(404).json({ error: `Post with slug "${post_slug}" not found` });
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
            insertComment.run(post.id, c.comment_id || `${post_slug}-${ingested}`, c.parent_comment_id || null, isAuthor ? 1 : 0, isReply ? 1 : 0, c.author_name || 'Unknown', c.text || '', c.date || new Date().toISOString().split('T')[0], isReply ? c.subscriber_question || null : null, JSON.stringify(tickers), JSON.stringify(themes), sentiment);
            ingested++;
        }
        console.log(`[BURRY] Ingested ${ingested} comments for post "${post_slug}" (author comments: ${comments.filter((c) => c.is_author).length})`);
        res.json({ status: 'ok', post_slug, ingested });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// GET /burry/comments — Get Burry's comments (author comments and replies only)
router.get('/burry/comments', (req, res) => {
    try {
        const d = getDb();
        const postSlug = req.query.post;
        const onlyAuthor = req.query.author !== 'false'; // Default: only Burry's comments
        let query = `
      SELECT bc.*, bp.title as post_title, bp.slug as post_slug, bp.post_date
      FROM burry_comments bc
      JOIN burry_posts bp ON bc.post_id = bp.id
    `;
        const conditions = [];
        const params = [];
        if (onlyAuthor) {
            conditions.push('(bc.is_author_comment = 1 OR bc.is_author_reply = 1)');
        }
        if (postSlug) {
            conditions.push('bp.slug = ?');
            params.push(postSlug);
        }
        if (conditions.length > 0)
            query += ' WHERE ' + conditions.join(' AND ');
        query += ' ORDER BY bc.comment_date DESC LIMIT 100';
        const comments = d.prepare(query).all(...params);
        const totalAuthor = d.prepare('SELECT COUNT(*) as cnt FROM burry_comments WHERE is_author_comment = 1 OR is_author_reply = 1').get().cnt;
        res.json({
            comments,
            count: comments.length,
            total_author_comments: totalAuthor,
        });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
//# sourceMappingURL=burry-substack.js.map