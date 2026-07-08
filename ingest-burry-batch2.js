#!/usr/bin/env node
// Batch ingest Burry Substack posts - Batch 2
const BASE = 'https://web-production-4989c.up.railway.app';

const posts = [
  {
    title: "Short Thoughts May 29, 2026",
    slug: "short-thoughts-may-29-2026",
    url: "https://michaeljburry.substack.com/p/short-thoughts-may-29-2026",
    date: "2026-05-29",
    content: `Sneak Peek into Heretic's Guide to AI's Stars Part IV.

Part IV of the Heretic's Guide to AI's Stars is coming along nicely. In light of the news today about Apollo's $38 billion debt raise for Google's TPUs (not NVIDIA's GPUs) for Anthropic, I have decided to pre-release one visual from Part IV.

No explanation now. That is coming in Part IV.

Key signal: Apollo raised $38 billion in DEBT for Google TPUs (not NVIDIA GPUs) for Anthropic. This is significant — AI infrastructure spending is debt-funded and shifting away from NVIDIA hardware. The debt-fueled buildout continues to accelerate while the hardware mix shifts.`
  },
  {
    title: "Trading Post May 12, 2026",
    slug: "trading-post-may-12-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-may-12-2026",
    date: "2026-05-12",
    content: `A Bit of Catch-Up. This Trading Post covers mostly yesterday's trades.

JD (JD, 9618 HK) reported results, nothing unexpected. Revenue was $45.8 billion vs. $41.5 billion last year, as the company continues to grow while profitability is a little bit less. There is no thesis violation, and it remains a top position. JD is at a historic low P/S ratio and one of the cheapest stocks in my universe, just below its IV15.

Also, this morning the CPI Index rose 3.8% year over year, boosted by gasoline prices up 28% as the Iran War starts to have an economic impact even here in the U.S.

Yesterday, I rolled puts for tax purposes:
- QQQ Strike 525 Puts from Mar 19, 2027 to March 31, 2027 at a 0.52 debit.
- NVDA Strike $115 Puts from Jan 15, 2027 to March 19, 2027 at a 0.92 debit.
- SOXX Strike $330 Puts from Jan 15, 2027 to March 19, 2027 $6.49 debit.

That SOXX debit is the price of admission to shorting a parabolic move. Volatility is high and figures into the price, but more than that demand for hedges there is high, driving the roll cost up.

Regarding MELI and ZTS. I added to each of those as they continued to fall dramatically. My back up the truck price for each remains $1300s and mid $60s, respectively. Each are already at 10-year low price-to-sales ratios. Each is favorably compared to its IV15 as well.

Following up on the Short Thoughts May 10, 2026 About That Boy Who Cried Wolf, I reduced target position sizing by 20% across my portfolio, which required partial sales of most stocks in the portfolio. Generally, the sales will be between 15% and 20% of each position.

Cash level is now a bit under 20% and can grow both from additions and from share sales.`
  },
  {
    title: "Trading Post Friday May 8, 2026",
    slug: "trading-post-friday-may-8-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-friday-may-8-2026",
    date: "2026-05-08",
    content: `TGIF. Huge rally in stocks today.

Yellow is the Philadelphia Semiconductor Index, up ~224% since the 90 Day Pause.
Violet is the S&P 500, up 48%, and the NASDAQ 100, up 69%.

Michigan Consumer Sentiment number at record low.

Stocks are not up or down because of jobs or consumer sentiment. They are going straight up because they have been going straight up. On a two letter thesis that everyone thinks they understand.

Feeling like the last months of the 1999-2000 bubble. Below, roughly a year in the life of the Philadelphia Semiconductor Index to the peak in March 2000, and present day.

Molina Healthcare (MOH) is having an Investor Day today. In 2029, Molina says, earnings will be between $20-30/share. My post on Molina from late December, Molina Healthcare: Ghosts of GEICO Past, stands. I continue to believe in this company as a long-term hold, and it remains a top 3 position. I am not selling, neither am I adding. I am holding and forgetting.

Overnight, I made some trades:
- Added to Temple & Webster, TPW AU in the high AUD 5s.
- Added to Tencent Holdings (HK 700) and Meituan (HK 3690).

BUY MELI @ $1600s (new full position). Mercado Libre is an online commerce platform akin to Amazon for Brazil, Mexico, Argentina, and other parts of South and Latin America. Sales this year will near $40 billion, ~30% higher than 2025. The company does not have stock-based compensation. Its award system is cash-settled. MELI is now well below my IV15 price, at which I expect long-term 15% annualized returns at 15 years or more.`
  },
  {
    title: "Trading Post May 7, 2026",
    slug: "trading-post-may-7-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-may-7-2026",
    date: "2026-05-07",
    content: `A Quick One.

Today I sold my positions in CRM and ADSK at small profits. Both were smallish positions and, per my evaluation not nearly as good long-term investments as what I needed to buy today.

I continue to hold MSFT, FISV, PYPL, ADBE, VEEV, and MSCI in that software and payments space.

SOLD CRM (Salesforce) at small profit.
SOLD ADSK (Autodesk) at small profit.

BUY ZTS @ $86s (full position). Zoetis is trading at yesteryear's Price/Sales level. Zoetis is a global leader in animal health with a stellar long-term record of returns on invested capital/capital allocation. The company is run very well, conservatively financed, and is now trading below my owners' earnings IV15 price - the price at which I expect 15% annualized returns for 15 years or more.

I will look to buy more if it falls to about $70. At this level the dividend is about 2%.`
  },
  {
    title: "Trading Post Wednesday May 6, 2026",
    slug: "trading-post-wednesday-may-6-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-wednesday-may-6-2026",
    date: "2026-05-06",
    content: `The NASDAQ 100 was up over 500 points today to another all-time high.

Per Jonathan Krinsky at BTIG: If we look at the top 10 performing NDX stocks in 1999, they were up an average of 559%. The top 10 in the year leading up to 3/24/00 were up an average of 622%. The top 10 NDX names over the last year are up an average of 784%, beating both the dot-com periods.

Historical Philadelphia Semiconductor Index comparison: today's index normalized at 475 vs yesteryear's peak at 669 (from 1996 base).

BUY SOXX January 2027 $330 Puts @ low $12s (added to position).
BUY NVDA January 2027 $115 Puts and March 2027 $125 Puts (added).
BUY QQQ January 2027 $550 Puts (added).

BUY Haidilao 6862 HK @ HKD low 14s (more than doubled position).
BUY Temple & Webster TPW AU @ AUD ~5.40 (more than doubled, now full position). This is now the second cheapest stock in my universe, next to JD.

BUY Haier Smart Home 6690 HK @ HKD mid 21s (new position). The company makes home appliances across 100 factories worldwide, and is the company that makes GE branded appliances in the U.S. Haier Hong Kong shares are directly listed, no VIE. Net income has doubled since its 2020 listing, reflecting consistently high ROIC, and less than half of revenues from inside China. At historically low relative and absolute valuation.

Bruker (BRKR, BRKRP) had decent earnings. I own the mandatorily convertible preferred, BRKRP, which is now my 3rd largest position.`
  },
  {
    title: "Trading Post Tuesday May 5, 2026",
    slug: "trading-post-tuesday-may-5-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-tuesday-may-5-2026",
    date: "2026-05-05",
    content: `Yesterday was a busy day, and that continued in the overnight session.

Late in the session today, the U.S. announced Operation Epic Fury is concluded, and that offensive operations against Iran have ended.

The NDX is at an all-time high Price to Sales ratio of 6.73 - remarkably, with traditional P/S nosebleed SaaS stocks down and out.

After the close yesterday, Palantir reported results. Palantir is not growing as fast as commercial AI adoption. In the intermediate to long-term I see little role for Palantir in the commercial space except as a legacy player for lazy management teams.

Shares collapsed, down $10.12 to $135.91. I continue to hold my short position. I also continue to hold Palantir puts - December 2026 puts struck at 100, and January 2027 puts struck at 50.

SHORT PLTR @ $147s (outright short, established yesterday).
HOLD PLTR December 2026 $100 Puts.
HOLD PLTR January 2027 $50 Puts.

BUY Haidilao 6862 HK @ HKD 14.16 (more than doubled down).
BUY Meituan 3690 HK @ HKD 82.75 (added).
BUY Tencent 700 HK @ HKD 468 (new position). Potentially no company is more important to the fabric of Chinese society. Return to double digit top line growth.
BUY Temple & Webster TPW AU @ AUD 5.38 (more than doubled). Never expected it to fall this far. Volume swell as stock falls suggestive of bottoming process.

BUY SOXX January 2027 $330 Puts @ $13s (added).
Considering INTC short but puts too expensive. Content shorting more SOXX.

PYPL now a full position (third doubling down). Revenue 7% growth. $6 billion buyback TTM on $41 billion market cap, essentially no net debt. ∆E of 96% - owners' earnings relative to GAAP net income. PayPal shares at current levels are in my view a long-term 16-17% CAGR investment. P/IV15 ratio of 0.88.

PayPal plans 20% workforce cuts over 2-3 years. New CEO looking to save $1.5 billion in run-rate expenses.

HOLD FISV (Fiserv), average cost $54s. 13% earnings beat was low quality (tax rate drop to 11% vs normal 20%). P/IV15 ratio of 1.26. Fiserv probably has stronger moat than PayPal.

BUY LULU @ $129s (added to position).

FOMO is clearly in play. These companies are getting dozens of years of earnings added to their valuations within the span of days.`
  },
  {
    title: "Trading Post May 18, 2026",
    slug: "trading-post-may-18-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-may-18-2026",
    date: "2026-05-18",
    content: `A Quick Note on Today's Trades.

BUY MELI @ mid-$1500s (added, low normal position). Mercado Libre is a clean long term winner. Comes cheap because not based in or operating in the United States. Since 2022, the stock rallied while P/S remained flat (fast top-line grower). Now P/S hit 10-year lows.

BUY ZTS @ low $77s (added, low normal position). This is a fat pitch, but requires patience, still coming in hot.

BUY ADBE @ low $250s (added, low normal position). On top of main purchase in low $230s.

BUY LULU @ ~$120 (added, normal/full position).

BUY PYPL (added, normal/full position).

These stocks are part of the mass whale fall happening away from the main spectacle. In 1999 this happened too. The old economy and international stuff just got ditched in favor of the All-American bubble.

Per Torsten Slok at Apollo: 87% of VC funding is directed at AI, 49% of investment grade bond issuance is AI, and 38% of high yield bond issuance is linked to AI.

During the internet boom in 1999: less than 40% of VC was internet. TMT was 80% of all VC. TMT bonds were 40-50% of HY issuance and 25-30% of IG issuance.

Over $100B investment grade debt issued in 1999-2000 became junk by 2002.

It is just an asset bubble, plain and simple. Debt issuance always starts out clean. That's how it gets sold.`
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
