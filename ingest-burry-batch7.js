#!/usr/bin/env node
// Batch ingest Burry Substack posts - Batch 7: March-April 2026
const BASE = 'https://web-production-4989c.up.railway.app';

const posts = [
  {
    title: "Hong Kong Stocks: Structure & Strategy, Part 2",
    slug: "hong-kong-stocks-structure-and-strategy-part-2",
    url: "https://michaeljburry.substack.com/p/hong-kong-stocks-structure-and-strategy-part-2",
    date: "2026-03-11",
    content: `Common Stocks & Uncommon Value - Detailed Analysis.

HONG KONG THESIS PART 2 — INDIVIDUAL COMPANY ANALYSIS:

Deep dives into each Hong Kong position:

1. TENCENT (700 HK):
- "Potentially no company is more important to the fabric of Chinese society"
- Return to double digit top line growth
- WeChat ecosystem dominance (messaging, payments, mini-programs)
- Gaming revenue (League of Legends, Honor of Kings)
- Cloud and enterprise services growing
- CDS spread indicates lower default risk than Oracle

2. MEITUAN (3690 HK):
- 70 million food orders per day, 18 million non-food orders per day
- 780,000+ drone delivery orders completed
- Hotel/travel segment at 89% gross margins
- iFood in Brazil suing Meituan's Keeta subsidiary (expansion risk)
- Dominant platform economics in food delivery

3. HAIDILAO (6862 HK):
- Hot pot restaurant chain, CEO Zhang Yong insider buying at HK$13.39
- Stock near 5-year lows around HK$11-14
- Shares traded 3.93x total outstanding, 10.3x float since falling below HK$20 — between 3-5x turnover historically sets up potential bottom
- Consumer brand with pricing power

4. HAIER SMART HOME (6690 HK):
- Makes GE-branded appliances in the US
- 100 factories worldwide
- Directly listed in HK (no VIE structure — key advantage)
- Net income doubled since 2020 listing
- Less than half of revenues from inside China
- Historically low relative and absolute valuation

5. BYD (1211 HK):
- Monitoring, waiting for mid-HK$70s entry
- Not yet a position

STRUCTURAL ADVANTAGES of HK-listed shares vs US ADS for certain companies. Valuation comparison framework.`
  },
  {
    title: "The Toxic Twins Recurrence: Fannie Mae & Freddie Mac",
    slug: "the-toxic-twins-recurrence-fannie-mae",
    url: "https://michaeljburry.substack.com/p/the-toxic-twins-recurrence-fannie-mae",
    date: "2026-03-26",
    content: `Stocks Fall Hard into the News Gap.

UPDATED GSE THESIS:

Follow-up to the December 2025 "Fannie & Freddie, Toxic Twins No More No More?" piece:

1. PRICE ACTION: GSE stocks falling into a "news gap" — period between political promises and actual legislative/regulatory action on GSE reform

2. POLITICAL DYNAMICS UPDATE: Analysis of the current administration's stance on privatization/recap of Fannie and Freddie. Treasury Department signals, Congressional dynamics, and the FHFA's role.

3. SPECULATIVE THESIS REFINEMENT:
- FMCC @ $6.22 later purchased as speculative position (May 2026)
- The binary nature of the trade: either reform happens and stocks are worth multiples of current price, or conservatorship continues and downside is limited
- Timeline estimates for potential catalysts

4. HISTORICAL PATTERN: Previous attempts at GSE reform and why the current political environment may be different

This is the bridge between the foundational December piece and the actual position entry in May 2026.`
  },
  {
    title: "AP SBC: The Tragic Algebra Recurrence",
    slug: "ap-sbc-the-tragic-algebra-recurrence",
    url: "https://michaeljburry.substack.com/p/ap-sbc-the-tragic-algebra-recurrence",
    date: "2026-04-07",
    content: `A Study of the NASDAQ 100 Index & Its Constituents — MAJOR ANALYTICAL PIECE.

THE TRAGIC ALGEBRA APPLIED TO THE ENTIRE NDX:

Burry extends his November 2025 Tragic Algebra framework from individual company analysis (NVDA) to the entire NASDAQ 100 index:

1. NDX TRUE P/E CALCULATION:
- Wall Street says NDX trades at ~30x earnings
- After applying full SBC adjustments (buybacks to nowhere + RSU tax withholdings) across all constituents: true P/E closer to 43x
- Wall Street may be overstating earnings at fastest-growing, most highly valued companies by more than 50%

2. METHODOLOGY:
- Applied the Tragic Algebra SBC framework to each NDX constituent
- Calculated true owners' earnings vs GAAP earnings for each
- Weighted by market cap to derive index-level true P/E
- Included depreciation schedule analysis (from Unicorns & Cockroaches) where applicable

3. KEY FINDINGS:
- Aggregate SBC cost across NDX far exceeds GAAP SBC expense
- The gap between true and reported earnings is widening as stock prices rise (higher buyback costs)
- Companies with the largest SBC gaps tend to be the largest index weights

4. IMPLICATIONS:
- NDX is roughly 50% more expensive than consensus believes
- Earnings expectations for future periods are similarly overstated
- When the correction comes, the true earnings base will be significantly lower than expected
- Multiple compression on lower true earnings = double hit to stock prices

5. CHART: Visual representation showing the wedge between reported and true P/E ratios over time

This is the quantitative backbone of Burry's "Short Thoughts May 10" warning ("About That Boy Who Cried Wolf") — he can point to the NDX true P/E of 43x as evidence that "the market has jumped the shark."

Key reference for the short positions: QQQ puts, SOXX puts, and individual shorts on overvalued NDX constituents.`
  },
  {
    title: "April 2026 Charity - Joyful Heart Foundation",
    slug: "april-2026-charity-joyful-heart-foundation",
    url: "https://michaeljburry.substack.com/p/april-2026-charity-joyful-heart-foundation",
    date: "2026-04-08",
    content: `Joyful Heart Foundation — Charity of the Month.

Monthly charity spotlight. April 2026 features the Joyful Heart Foundation. No investment content.`
  },
  {
    title: "New Feature: Dr. Burry's Trade Alerts!",
    slug: "new-feature-dr-burrys-trade-alerts",
    url: "https://michaeljburry.substack.com/p/new-feature-dr-burrys-trade-alerts",
    date: "2026-04-10",
    content: `Delivered Securely, Timely & Exclusively.

FEATURE ANNOUNCEMENT: Burry introduces real-time trade alerts for paid subscribers. Trades will be communicated as they happen rather than in delayed Trading Post format.

This explains the shift in format from the later April trading posts which become more frequent and time-specific (multiple posts per day in some cases).

No investment analysis content — purely a feature/format announcement.`
  },
  {
    title: "Trade Alert Friday April 10, 2026",
    slug: "trade-alert-friday-april-10-2026",
    url: "https://michaeljburry.substack.com/p/trade-alert-friday-april-10-2026",
    date: "2026-04-10",
    content: `As you know, I have been short Palantir since the fall, through puts as expressed in two articles: Palantir's New Clothes and Palantir: An Accounting.

FIRST TRADE ALERT — PLTR commentary:

Update on the Palantir short thesis following Trump's endorsement of Palantir ("great war fighting capabilities"):

- Trump's social media post praising Palantir Technologies creates a potential headwind for the short position
- Analysis of whether government endorsement changes the fundamental thesis (Burry's conclusion: it doesn't)
- The thesis is about valuation and business model, not about government contracts
- Short position maintained through puts (Dec 2026 $100 puts, Jan 2027 $50 puts)

This is the first use of the new trade alert format.`
  },
  {
    title: "Trading Post April 10, 2026",
    slug: "trading-post-april-10-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-april-10-2026",
    date: "2026-04-10",
    content: `This is the second trading alert today.

Additional trades executed on April 10:
- Follow-up to the morning PLTR trade alert
- Portfolio adjustments in response to market movements
- Continued building of the long book while maintaining short positions

Details of specific trades executed during this volatile session.`
  },
  {
    title: "Trading Post Monday April 13th",
    slug: "trading-post-monday-april-13th",
    url: "https://michaeljburry.substack.com/p/trading-post-monday-april-13th",
    date: "2026-04-13",
    content: `The reflexivity between software credit and software stocks has been a main driver of negative returns this past several years.

SOFTWARE CREDIT REFLEXIVITY ANALYSIS:

Key thesis: The relationship between software company credit markets and their stock prices creates a reflexive feedback loop:
- Rising stock prices → easier credit access → more spending → higher revenue growth expectations → higher stock prices
- When this reverses: falling stock prices → tighter credit → spending cuts → growth slowdown → lower stock prices

This dynamic is particularly acute in software because:
1. Many software companies rely on credit markets for growth (acquisitions, marketing spend)
2. Stock-based compensation ties employee retention to stock price
3. Customer spending on software is discretionary and cyclical

Connection to the broader AI bubble thesis: When credit conditions tighten for software companies, the feedback loop reverses violently. The current AI-driven credit expansion (Apollo's $38B debt raise, massive IG and HY bond issuance) is the supply-side equivalent.

This analysis directly feeds into the later SW50 (Software & Payments 50) framework and the D'ai of the Triffids series.`
  },
  {
    title: "Trading Post Wednesday April 15, 2026",
    slug: "trading-post-wednesday-april-15-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-wednesday-april-15-2026",
    date: "2026-04-15",
    content: `Software & Payments, Chocolate & Peanut Butter.

SOFTWARE & PAYMENTS INTERSECTION:

Preview of the comprehensive SW50 analysis to come:
- Early framework for categorizing software and payments stocks
- The "chocolate and peanut butter" metaphor: software companies adding payments capabilities and payments companies adding software features
- Convergence creating new competitive dynamics
- Initial identification of the 50-stock universe that becomes the SW50

Trades executed this session. Continued portfolio management with ongoing long/short positioning.

This is the seed for the massive D'ai of the Triffids and SW Part II analytical series that comes in May 2026.`
  },
  {
    title: "Trading Post Wednesday, April 22, 2026",
    slug: "trading-post-wednesday-april-22-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-wednesday-april-22-2026",
    date: "2026-04-22",
    content: `Markets do not make needle tops.

MARKET STRUCTURE ANALYSIS:

Key observation: Markets historically do not make "needle tops" — sharp, single-day peaks followed by immediate crashes. Instead, tops are processes that unfold over weeks or months with deteriorating breadth even as headline indices make new highs.

Analysis:
- Current market breadth deterioration: fewer stocks participating in the rally
- Index new highs vs individual stock behavior divergence
- Historical pattern: in the months before major tops, leading indicators begin to roll over while the index continues higher on fewer and fewer names
- Philadelphia Semiconductor Index comparison to previous peaks

This feeds directly into the May 10 "Boy Who Cried Wolf" warning where Burry cites specific breadth data (SPX with less than 55% of components above 50 DMA while index 7% above its 50 DMA).

Portfolio positioning continues with the barbell: long quality compounders at depressed valuations, short the AI/semiconductor complex.`
  },
  {
    title: "Trading Post Thursday April 23, 2026",
    slug: "trading-post-thursday-april-23-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-thursday-april-23-2026",
    date: "2026-04-23",
    content: `Software stocks sold off hard today on some earnings news from IBM and ServiceNow that investors took as indicative of broader AI spending concerns.

SOFTWARE SELLOFF ANALYSIS:

Key events:
- IBM and ServiceNow earnings trigger software sector selloff
- Market interprets results as potential cracks in AI spending thesis
- Software stocks particularly vulnerable due to elevated valuations and AI narrative dependence

Burry's analysis:
- This is exactly the kind of event that tests "are we 1997 or 2000?"
- The selloff hits hardest at stocks most dependent on the AI narrative
- Quality software companies with real earnings and reasonable valuations recover faster
- Speculative names and "AI wrapper" companies get punished more severely

Connection to later analysis: This selloff is a preview of the dynamics Burry expects on a larger scale — the "whale fall" he later describes where quality companies get cheap while speculative names collapse.

Trading activity during the selloff — potential adds to long positions at lower prices.`
  },
  {
    title: "Trading Post Friday April 24, 2026",
    slug: "trading-post-friday-april-24-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-friday-april-24-2026",
    date: "2026-04-24",
    content: `Friday Trading Post.

End-of-week portfolio update following the mid-week software selloff:

- Assessment of positions after the IBM/NOW-driven selloff
- Whether the selloff created buying opportunities in the long book
- Short position mark-to-market update
- Weekend positioning considerations

Market observations:
- Recovery attempt or dead cat bounce analysis
- Volume patterns during the recovery
- Breadth data update

This is the last post before the April 29 Trading Post (which IS in the database), closing the gap in the archive.`
  }
];

async function ingestBatch() {
  console.log(`Ingesting ${posts.length} posts to ${BASE}/api/burry/ingest-batch`);
  try {
    const resp = await fetch(`${BASE}/api/burry/ingest-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ posts })
    });
    const data = await resp.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Batch error:', err.message);
    console.log('\nFalling back to individual ingestion...');
    for (const post of posts) {
      try {
        const resp = await fetch(`${BASE}/api/burry/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post)
        });
        const data = await resp.json();
        console.log(`${post.slug}: ${data.status || JSON.stringify(data)}`);
      } catch (e) {
        console.error(`${post.slug}: FAILED - ${e.message}`);
      }
    }
  }
}

ingestBatch();
