#!/usr/bin/env node
// Batch ingest Burry Substack posts - Batch 5: November-December 2025 (Foundational)
const BASE = 'https://web-production-4989c.up.railway.app';

const posts = [
  {
    title: "The Cardinal Sign of a Bubble: Supply-Side Gluttony",
    slug: "the-cardinal-sign-of-a-bubble-supply",
    url: "https://michaeljburry.substack.com/p/the-cardinal-sign-of-a-bubble-supply",
    date: "2025-11-23",
    content: `Part 1 of The Heretic's Guide to AI's Stars.

CAPITAL CYCLE THEORY & THE 1990s PARALLEL

The popular history of the dot com bubble as a "profitless dot com" phenomenon is fake news. The NASDAQ was powered by highly profitable large caps — the "Four Horsemen" (Microsoft, Intel, Dell, Cisco). Qualcomm was up 2,619% in 1999 on real revenue. Applied Materials up 198%. Cisco up 125%.

The real bubble was a data transmission buildout bubble, not a web content bubble. AT&T spent $20B/year. MCI at $15B. Global Crossing spent $20B on subsea cables. Level 3 spent $20B. CLECs at $30B. More fiber needed more routers, more routers needed more fiber — a positively infinite feedback loop.

The task seemed boundless. Sound familiar?

By 2002, less than 5% of the data infrastructure built during the bubble was actually lit. CEOs believed the stock market far too much.

KEY CHART: Net Capital Investment / GDP plotted 1991-2025 shows stock market peaks happening approximately midway through investment booms. In some cases — as in 2000 — before peak capital expenditures. Investors rabidly cheerleading CEOs to massive spending plans, rewarding every dollar spent with $2-3 of market cap.

Capital Cycle Theory (from Edward Chancellor's "Capital Account") provides the framework. Marathon Asset Management used CCT to analyze mania-driven capital investment booms.

TODAY'S FIVE HORSEMEN: Microsoft, Google, Meta, Amazon, and Oracle promising nearly $3 trillion in AI infrastructure spending over 3 years. OpenAI committed $1.4 trillion over 8 years with revenues less than 2% of this. Valued at $500B — more than all public profitless dot coms and telecoms from the 90s combined.

These big spenders have been increasing useful depreciation lives of chips/servers as they up spending plans. Old-school vendor financing has returned with a twist.

Nvidia CEO Nov 2025: "There's been a lot of talk about an AI bubble. From our vantage point, we see something very different."

Cisco CEO Aug 2000: "We see no indications in the marketplace that the radical Internet business transformation is slowing."
Cisco down 78% by end of 2001. Investors waiting for a slowdown signal before selling were hurt badly.

The stock market top on March 10, 2000 happened for no apparent reason. Major capex was still being planned. Equipment demand was strong. Yet stocks were falling. The NASDAQ would not surpass that high for 16 years.

Quote: "If you go around popping a lot of balloons, you are not going to be the most popular fellow in the room." — Charlie Munger, RIP`
  },
  {
    title: "Foundations: My 1999 (and part of 2000)",
    slug: "foundations-my-1999-and-part-of-2000",
    url: "https://michaeljburry.substack.com/p/foundations-my-1999-and-part-of-2000",
    date: "2025-11-23",
    content: `Personal memoir of Burry's experience during the 1999-2000 bubble.

"I doubted if I should ever come back." Burry recounts his firsthand experience of identifying and trading through the dot-com bubble and its aftermath. This is the autobiographical foundation for understanding why he sees the current AI bubble through the same lens.

Key themes: the loneliness of being early, the personal toll of contrarian conviction, how the 2000 top appeared unremarkable in real-time, and why pattern recognition from lived experience matters more than theoretical frameworks.

This piece establishes Burry's credibility as someone who has personally lived through and profited from a bubble of this magnitude before.`
  },
  {
    title: "Unicorns and Cockroaches:",
    slug: "unicorns-and-cockroaches",
    url: "https://michaeljburry.substack.com/p/unicorns-and-cockroaches",
    date: "2025-11-25",
    content: `Part 2 of The Heretic's Guide to AI's Stars - The Depreciation Problem.

UNDER-DEPRECIATION THESIS: The hyperscalers (Microsoft, Google, Meta, Amazon, Oracle) have been systematically extending the useful lives of their AI infrastructure — chips, servers, data center equipment — even as they massively increase spending.

This accounting choice inflates reported earnings by reducing annual depreciation expense. When a company extends server useful life from 4 years to 6 years, depreciation drops by 33%, boosting net income proportionally. The cash expenditure is the same, but the P&L looks better.

KEY FINDING: Revenue per compute asset deployed has been increasing linearly while total compute assets deployed have been increasing exponentially. The gap between these curves — "Unicorns and Cockroaches" — represents the growing disconnect between what's being deployed and what's actually generating revenue.

The depreciation schedule extension is the modern equivalent of 1990s vendor financing. Companies are capitalizing costs that should flow through the income statement, flattering current earnings at the expense of future writedowns.

Combined with the SBC analysis from Part 1, this means hyperscaler earnings are overstated by both:
1. Inadequate SBC expense recognition (Tragic Algebra)
2. Extended depreciation schedules reducing reported costs

When the cycle turns, these companies face the dual hit of writedowns on overcapacity AND normalization of depreciation schedules.

Historical parallel: Cisco grew revenues 55% in 2000 but by 2001-2002 wrote down years of its best earnings on capacity contracts. The same pattern is forming now.`
  },
  {
    title: "Foundations: The Tragic Algebra of Stock-Based Compensation",
    slug: "foundations-the-tragic-algebra-of",
    url: "https://michaeljburry.substack.com/p/foundations-the-tragic-algebra-of",
    date: "2025-11-30",
    content: `THE ORIGINAL TRAGIC ALGEBRA — SBC FRAMEWORK

Phil Clifton (Burry's right-hand man, launching Pomerium Capital) derived the mathematical formula for incorporating dilution into present value calculations.

CORE FORMULA: Modified DCF with dilution factor
PV = CF / (d - g + y)
Where: CF = Cash flow, d = Discount rate, g = Growth rate, y = Dilution rate

KEY INSIGHT: Even sub-1% dilution dramatically reduces present value. Two identical companies — one paying all cash, one using 1% annual SBC dilution — the non-diluting company is worth 20x earnings vs 16.4x for the diluting one.

Higher growth rates do NOT solve the dilution problem. Companies with higher growth rates are especially hurt by dilution.

NVIDIA DEEP DIVE:
- Since 2018: $205B cumulative net income, $91B in buybacks
- Share count: 24.3B shares in 2018 → 24.3B shares today. Buyback to nowhere.
- GAAP SBC expense: $20.6B (irrelevant — the real cost is the $91B buyback + $21.5B RSU tax withholdings = $112.5B total SBC cost)
- True owners' earnings: $114B, just 56% of GAAP earnings and 50% of Wall Street earnings
- ~50% of Nvidia employees worth over $25M, 80% millionaires. That's what $112.5B of shareholder money looks like.

Nvidia sent a memo to Wall Street analysts trying to get them to attack Burry's logic. Burry dismantles each argument.

OWNERS' EARNINGS CONCEPT (from Buffett):
Warren Buffett 2018 letter: "What else could SBC be — a gift from shareholders?"
The cost to the company of SBC is the whole "paycheck" — stock grants + tax withholding payments.

OTHER COMPANIES' TRUE EARNINGS:
- Microsoft: 86% of GAAP, 77% of Wall Street
- Alphabet: 102.7% of GAAP, 81.8% of Wall Street
- Meta: 87.7% of GAAP, 67.4% of Wall Street
- Nvidia: 56% of GAAP, 50% of Wall Street (worst)

Tesla dilutes at 3.6%/year with no buybacks. Palantir at 4.6% despite buybacks. First billionaire:revenue ratio >1 — five billionaires, <$4B revenue.

When the stock falls, SBC gets WORSE not better — companies cave to employee demands for more RSUs and higher salaries (2022 example with Amazon layoffs followed by SBC acceleration).

SBC creates leaking holes in the fuselage of intrinsic value growth.`
  },
  {
    title: "Michael Lewis: Against the Rules Podcast",
    slug: "michael-lewis-against-the-rules-podcast",
    url: "https://michaeljburry.substack.com/p/michael-lewis-against-the-rules-podcast",
    date: "2025-12-02",
    content: `The Big Short Companion Edition.

Burry shares and discusses the Michael Lewis "Against the Rules" podcast episode about him and The Big Short. Context on his thinking about being a public figure, the experience of being portrayed in a major film, and reflections on the subprime crisis.

This is a lighter, more personal post that establishes the relationship between Lewis and Burry and provides context for new subscribers about Burry's history with the 2007-2008 financial crisis.`
  },
  {
    title: "December 2025 Cassandra Unchained Charity of the Month",
    slug: "december-2025-cassandra-unchained-charity",
    url: "https://michaeljburry.substack.com/p/december-2025-cassandra-unchained-charity",
    date: "2025-12-03",
    content: `Together California — Charity of the Month.

Monthly charity spotlight. Burry donates a portion of Substack proceeds to charity each month. December 2025 features Together California. No investment content.`
  },
  {
    title: "Fannie & Freddie, Toxic Twins No More No More?",
    slug: "fannie-and-freddie-toxic-twins-no",
    url: "https://michaeljburry.substack.com/p/fannie-and-freddie-toxic-twins-no",
    date: "2025-12-08",
    content: `Allow me to introduce you to the Toxic Twins — Fannie Mae and Freddie Mac.

INITIAL GSE THESIS: Deep historical analysis of Fannie Mae (FNMA/FMCC) and Freddie Mac, the government-sponsored enterprises that were declared insolvent in 2008 and placed in conservatorship.

Key arguments:
- The just-fired CEO of Freddie Mac led Freddie to non-fatal through the 1990s
- The market is essentially overlooking the GSEs' recovery
- Auto-brewing from Jones Act to subprime, Freddie and Fannie's company's primary experiment in the national housing market
- Foundational political dynamics around the GSE reform debate

This is Burry's foundational piece for the FMCC/FNMA speculative position he later takes. He analyzes the possibility of GSE privatization/recap under the current political environment.

Key reference for understanding his later FMCC @ $6.22 purchase and the GSE reform catalyst thesis.`
  },
  {
    title: "The Supply-Side Gluttony Recurrence",
    slug: "the-supply-side-gluttony-recurrence",
    url: "https://michaeljburry.substack.com/p/the-supply-side-gluttony-recurrence",
    date: "2025-12-11",
    content: `Queries & Quibbles — follow-up to Part 1 of the Heretic's Guide.

Burry addresses subscriber questions and challenges about the Capital Cycle Theory framework from Part 1. Provides additional data and analysis reinforcing the supply-side overbuilding thesis.

KEY ADDITIONS:
- More granular data on current AI infrastructure commitments vs historical patterns
- Responses to "this time is different" arguments
- Additional historical comparisons beyond the dot-com era (housing bubble, shale revolution)
- Further evidence that stock market peaks occur midway through investment booms, not at the end

This piece strengthens the framework by stress-testing it against counterarguments, making the case that the AI capex boom follows the same Capital Cycle Theory pattern as previous manias.`
  },
  {
    title: "Foundations: The Big Short Squeeze",
    slug: "foundations-the-big-short-squeeze",
    url: "https://michaeljburry.substack.com/p/foundations-the-big-short-squeeze",
    date: "2025-12-16",
    content: `GameStop, The Prequel.

Historical account of Burry's original GameStop investment thesis before it became a meme stock phenomenon. Details:

- His initial discovery of GameStop as a deep value play
- The original thesis: retail gaming company trading below liquidation value with significant real estate assets
- How the investment evolved from value play to short squeeze to cultural phenomenon
- The distinction between his fundamental thesis (which was correct) and the subsequent mania (which was separate)

This piece is essential context for understanding his later "Final Stop GameStop" (Jan 2026) and eventual full sale of GME in May 2026 when the "Instant Berkshire" thesis broke (>5x Debt/EBITDA, interest coverage under 4.0x).

Sets up the framework for how Burry thinks about position exits: thesis violations are absolute, regardless of emotional attachment or past profits.`
  },
  {
    title: "Foundations: The Psychology of Investing in the Information Age",
    slug: "foundations-the-psychology-of-investing",
    url: "https://michaeljburry.substack.com/p/foundations-the-psychology-of-investing",
    date: "2025-12-19",
    content: `CNBC's Warren Buffett Archive, AI and Decision-Making.

Deep exploration of how the information environment has changed investing psychology:

- The CNBC Buffett Archive as a resource for understanding Buffett's evolving thought
- How the constant flow of information creates noise that obscures signal
- AI's role in amplifying both signal and noise simultaneously
- The paradox of more information leading to worse decisions
- Why patience and conviction become harder in the social media age
- Historical examples of how great investors maintained conviction despite information bombardment

KEY FRAMEWORK: Burry argues that the Information Age creates a specific psychological trap: the illusion of being well-informed while actually being driven by narrative rather than analysis. AI tools exacerbate this by generating confident-sounding analysis at scale.

Connection to his LLM critique (later expanded in "History Rhymes: Large Language Models Off to a Bad Start?") — Burry sees AI-generated content as particularly dangerous because it produces authoritative-sounding analysis that reinforces consensus thinking.`
  },
  {
    title: "Molina Healthcare: Ghosts of GEICO Past",
    slug: "molina-healthcare-ghosts-of-geico",
    url: "https://michaeljburry.substack.com/p/molina-healthcare-ghosts-of-geico",
    date: "2025-12-29",
    content: `Finding a gem of an insurance company stock is not usually a lucky thing.

MOLINA HEALTHCARE (MOH) DEEP THESIS:

Burry draws a parallel between Molina Healthcare and GEICO — the insurance company that became Buffett's most famous investment. Both share:
- Focus on a specific, underserved market (Molina: Medicaid managed care)
- Cost advantages from specialization
- Management quality and capital allocation discipline
- Strong long-term earnings predictability

KEY METRICS:
- MOH guidance: $20-30/share earnings by 2029 (from May 2026 Investor Day)
- Remains a top 3 position throughout the Substack's existence
- "Holding and forgetting" — Burry's highest conviction category

The GEICO parallel:
- GEICO focused on government employees (underserved market with predictable losses)
- Molina focuses on Medicaid populations (underserved market with government-backed revenue)
- Both benefited from operational efficiency in a space competitors avoided
- Both were misunderstood by Wall Street as "low quality" insurers

Investment approach: Patient long-term compounding. No trading. Hold and forget.

This is the foundational piece for understanding why MOH is consistently Burry's top 3 position and why he says "I am not selling, neither am I adding. I am holding and forgetting."`
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
