#!/usr/bin/env node
// Batch ingest Burry Substack posts into Railway
const BASE = 'https://web-production-4989c.up.railway.app';

const posts = [
  {
    title: "Trading Post June 12, 2026",
    slug: "trading-post-june-12-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-june-12-2026",
    date: "2026-06-12",
    content: `The market continues to punish the stocks of large, well-established businesses with significant owners earnings, little debt, and large buybacks.

BUY ADBE @ $199.59 (full position). Adobe is a large, well-established business with significant owners earnings, little debt, and large buybacks.

BUY BABA @ $111.90 (full position). Alibaba remains deeply undervalued.

BUY PYPL @ $40.98 (full position). PayPal continues to trade at depressed valuations despite strong cash generation.

BUY VEEV @ $159.05 (full position). Veeva Systems offers predictable, high-margin healthcare cloud revenue.

All four positions are full positions. The market's punishment of quality companies creates opportunity for patient investors focused on owners' earnings and intrinsic value.`
  },
  {
    title: "MEGA Trading Post/Short Thoughts Mash-Up June 2, 2026",
    slug: "mega-trading-postshort-thoughts-mash",
    url: "https://michaeljburry.substack.com/p/mega-trading-postshort-thoughts-mash",
    date: "2026-06-02",
    content: `Trades, Short Philosophy, SpaceX bits, and Memory Chips Misremembering.

SHORT/PUTS positions: PLTR (short stock + puts), NVDA (puts), ORCL (puts), QQQ (puts), SOXX (puts).

BUY ZTS @ $76.10 (mid position). Zoetis is an animal health compounder with predictable earnings.
BUY SFM @ $78.19 (mid position). Sprouts Farmers Market offers growth at reasonable value.
BUY PYPL @ $44.88 (added to full position). PayPal at these levels offers significant upside.
BUY LULU @ $129.44 (added to position). lululemon at summer vacuum prices.
BUY FMCC @ $6.22 (speculative position). Fannie Mae common with GSE reform catalyst.

Memory Chips - The DRAM Bullwhip Effect:
The current memory chip narrative mirrors the supply-side dynamics I've seen repeatedly. Samsung Electronics, which was my #2 position just a year ago, is up almost 4x. The DRAM industry is experiencing classic bullwhip dynamics where perceived AI demand has created ordering patterns far exceeding actual end-user requirements. This will compress margins violently when reality catches up.

The memory chip cycle is following the same pattern as 2000 - component makers being swept into the bubble narrative at the very last stage. Samsung, Applied Materials, and the semiconductor equipment manufacturers are behaving exactly as they did entering the March 2000 top.

SpaceX and the private market bubble in AI infrastructure spending. The capital expenditure commitments being made by hyperscalers are historically unprecedented and will require returns that may never materialize.`
  },
  {
    title: "Trading Post June 8, 2026",
    slug: "trading-post-june-8-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-june-8-2026",
    date: "2026-06-08",
    content: `Buying a Long-Term Compounder on a Simple Rule.

BUY HCA @ market (low-normal position). HCA Healthcare is a new position. HCA is the largest for-profit hospital operator in the US. The company has significant owners' earnings, strong pricing power in an inflationary environment, and a disciplined capital allocation program. At current prices, it offers compelling value for a long-term compounder.

Samsung Electronics thesis update: Buy at tangible book value. Samsung is trading near tangible book, which has historically been a floor. The DRAM cycle is peaking but the underlying business has substantial value in foundry, displays, and the broader electronics ecosystem. When the memory cycle turns, Samsung at book value offers asymmetric upside.

No positions sold today. Continuing to build the long book with quality compounders while maintaining the leveraged short position against the AI bubble.`
  },
  {
    title: "Trading Post June 5, 2026",
    slug: "trading-post-june-5-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-june-5-2026",
    date: "2026-06-05",
    content: `lululemon athletica's (LULU) Earnings Call & Trades.

Substantially increased LULU position in the low-mid $110s. The summer CEO vacuum is creating a buying opportunity. The new CEO doesn't start until after summer. Without catalysts until later this year, shares are falling hard. But the business fundamentals are strong - direct-to-consumer model, high margins, loyal customer base.

BUY LULU @ $110-115 range (substantially increased position, now approaching full).
BUY PYPL @ low $40s (added to full position).

SOLD MSFT (entire position). Sold Microsoft to make room for LULU and PYPL additions. Even MSFT, one of the better large tech companies, faces AI spending risks and declining growth rates that make it less attractive than depressed quality companies at current levels.

LULU earnings deep-dive: Revenue grew modestly, margins held up better than expected, inventory management improved. The market is pricing in worst-case CEO transition scenarios. My IV15 analysis suggests LULU offers 15%+ annual returns from these levels over a multi-year holding period. The brand is strong, the customer is loyal, and the business model generates significant free cash flow.`
  },
  {
    title: "Short Thoughts May 10, 2026",
    slug: "short-thoughts-may-10-2026",
    url: "https://michaeljburry.substack.com/p/short-thoughts-may-10-2026",
    date: "2026-05-11",
    content: `About That Boy Who Cried Wolf.

The boy who cried wolf. So many times, no wolf. In the end, what happened? There was a wolf. But nobody was listening.

I am now a meme for the number of times I have called a crash. I have become the boy who cried wolf.

Still, I got it right in 2000, got it right in 2007. Got it right in 2019, helped by COVID, and I called the meme stock crash in mid 2021. I called the bank stock run in 2023.

Today however, I am telling. I am calling something. The market has jumped the shark. The end of this is nigh.

The NASDAQ 100, complete reversal pattern matching: the entire recovery from the 2000 crash barely to new highs completely reversed. The Roaring 20s. The 1970s Middle East oil crisis.

This past week the Philadelphia Semiconductor Index hit a new high in near vertical fashion. Samsung Electronics, which was the #2 position in my fund just a year ago, is up almost 4x in the last year.

Jonathan Krinsky at BTIG: the SPX has NEVER had less than 55% of components above their 50 DMAs when the index itself was at least 7% above its 50 DMA. Since 1990, Friday was just the third time ever SPX had more new lows than highs on a day when the SPX itself made a new high. The only other dates that saw breadth close to this weak with the SPX this far above its 50 DMA was 12/28/98, 11/19/99, and 3/27/00.

In The Tragic Algebra Recurrence, I showed the NASDAQ 100's true PE is closer to 43x than the 30x Wall Street tells us. Including all adjustments for SBC, depreciation, CIP, M&A costs, capital leases, Wall Street may be overstating by more than 50% the earnings at our fastest growing, most highly valued companies.

NVDA's growing contracts with TSMC securing over one hundred billion dollars of capacity. CSCO in 2001 and 2002 wrote down years of its best earnings on the same types of contracts.

This is the scene of the bloody car crash, minutes before it happens.

I am holding a significant leveraged short position against a portfolio of companies I find depressed and cheap. Strategy: raise cash, reduce exposure to tech stocks, replace beloved positions with low cost OTM LEAP calls, prepare to deploy when it makes more sense.

I am scrubbing the numbers, battening down my theses, tightening my standards. Any stock I own must offer, with a good degree of predictability, 15% or more annual returns for a long period of time. My IV15 standard.

Potential catalysts: Iran conflict, oil situation, private credit contagion affecting data center buildout, Treasury mandating foreign holders exchange for 100-year treasuries (Scott Bessent's idea).

In 2000, there was no catalyst. In 2007, no catalyst until late year. In 1929, no proximate cause. There is no telling. So I am telling.`
  },
  {
    title: "Trading Post Monday May 4, 2026",
    slug: "trading-post-monday-may-4-2026",
    url: "https://michaeljburry.substack.com/p/trading-post-monday-may-4-2026",
    date: "2026-05-04",
    content: `This was a busier day than I had anticipated.

First, tending to the shorts.

BUY SOXX January 2027 Strike 330 Puts @ $14s (added to position).
BUY QQQ March 2027 Strike $525 Puts @ $14s (new strike and expiry).
BUY NVDA March 2027 Strike $125 Puts @ $5s (new strike and expiry).

Nvidia remains one of the cheaper ways to short the AI data center bubble. I continue to expect 1500 basis points of gross margin contraction and growth shrinking to near zero over the next four years.

Puts on the SOXX, QQQ, PLTR, NVDA, and ORCL are now a little above my normal maximum. Outright shorts - PLTR and TSLA - are another few percent.

SHORT PLTR @ $147s (opened outright short ahead of earnings). I am shorting the company because it is worth low double digits at best. I am shorting the business model. I am shorting the entire premise upon which the company rests. I am shorting the CEO.

Palantir's market cap of over $350B fully diluted exceeds Lockheed Martin (LMT), General Dynamics (GD), and Northrup Grumman (NOC) combined by over $50B. Those three have 38x more revenue and about 30x owners' earnings.

BUY LULU @ $130.40 (more than doubled position). Summer vacuum, no catalysts until later this year.
BUY JD @ $30.10 (increased JD ADS position).

SOLD GME (entire position). The Instant Berkshire thesis was broken. Never compatible with >5x Debt/EBITDA, never ok with interest coverage under 4.0x. GME is the first full position sale since I started this Substack. Earlier sales of SLM and FOUR were not full positions.

Will add substantially to small Temple & Webster (TPW AU) position tonight.`
  },
  {
    title: "Short Thoughts May 25, 2026",
    slug: "short-thoughts-may-25-2026",
    url: "https://michaeljburry.substack.com/p/short-thoughts-may-25-2026",
    date: "2026-05-25",
    content: `Patterns, NVIDIA's Settled State & the Hong Kong Crackdown.

NVIDIA Volume Analysis: NVIDIA's 50-day moving average volume is at its lowest since 1999. Diamond-handed shareholders through crashes of 56% (2018 crypto winter), 67% (2021 speculative top), and 43% (2025 DeepSeek/tariff shock). Volume trending lower as stock rallies indicates everyone that can buy has bought. Options volume also falling — speculative positions declining during trending rally.

Shares outstanding turnover metric: NVIDIA traded 5.1x shares outstanding in 2021-2022 crash, 1.6x in 2018 (59 days), 0.73x in 2025 (62 days).

The conditions for an aggressive fall are as strong as they have been in the history of the stock. Could the next fall be more dramatic than 56%, 67% and 43%? The options and stock market volume says yes, and the fundamentals agree.

Fibonacci Retracement critique: Meaningless snake oil that only works if enough people believe it. But machines/algorithms brought it back since 2021. Machines have reached critical mass, lead steer status.

Hong Kong positions: Tencent (700 HK), Meituan (3690 HK), Haidilao (6862 HK), Haier Smart Home (6690 HK). Plus BABA and JD via ADS in New York.

China broker crackdown: Futu, Tiger Brokers, Longbridge fined $330M. Does not affect Stock Connect or fundamental business thesis. 2-year grace period for liquidation suggests knuckle-rapping, not destruction.

Haidilao: CEO Zhang Yong bought 11.4M shares at HK$13.39. Stock near 5-year lows around HK$11. Shares traded 3.93x total outstanding, 10.3x float since falling below HK$20 in late 2021 — between 3-5x turnover sets up potential bottom.

Meituan: 70M food orders/day, 18M non-food orders/day. 780,000+ drone delivery orders completed. Hotel/travel at 89% gross margins. iFood in Brazil suing Meituan's Keeta subsidiary.

CDS curves: Tencent, Alibaba, Meituan all safer than Oracle and CoreWeave. CoreWeave default risk judged existential by bond markets.

Monitoring BYD (1211 HK) waiting for mid-HK$70s entry.

Markets are very good at pricing narrative, and very poor at pricing the structural, fundamental reality beneath the narrative.`
  },
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
    console.error('Error:', err.message);

    // Try individual ingestion as fallback
    console.log('\nFalling back to individual ingestion...');
    for (const post of posts) {
      try {
        const resp = await fetch(`${BASE}/api/burry/ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(post)
        });
        const data = await resp.json();
        console.log(`${post.slug}: ${data.status || 'ok'}`);
      } catch (e) {
        console.error(`${post.slug}: FAILED - ${e.message}`);
      }
    }
  }
}

ingestBatch();
