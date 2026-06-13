#!/usr/bin/env node
// Batch ingest Burry Substack posts - Batch 6: January-February 2026
const BASE = 'https://web-production-4989c.up.railway.app';

const posts = [
  {
    title: "Foundations: My Summer of 1994",
    slug: "foundations-my-summer-of-1994",
    url: "https://michaeljburry.substack.com/p/foundations-my-summer-of-1994",
    date: "2026-01-01",
    content: `A History Lesson at the American Hospital Association.

Personal memoir connecting Burry's medical career to his investing philosophy. Burry trained as a physician (neurology resident at Stanford) before transitioning to investing. This piece explores:

- His experience at the American Hospital Association and how healthcare system economics shaped his analytical approach
- The connection between medical diagnosis (pattern recognition under uncertainty) and investment analysis
- Why his medical background gives him an edge in evaluating healthcare companies (MOH, HCA)
- The intellectual foundations that led him from medicine to value investing

This is character-building context that explains why Burry approaches markets like a diagnostician — looking for patterns, maintaining skepticism about surface-level symptoms, and searching for underlying causes.`
  },
  {
    title: "Short Thoughts: January 5, 2026",
    slug: "short-thoughts-january-5-2026",
    url: "https://michaeljburry.substack.com/p/short-thoughts-january-5-2026",
    date: "2026-01-05",
    content: `Cassandra Divines Venezuela.

Short-form commentary on macro themes:
- Venezuela situation and geopolitical implications
- Oil market dynamics and potential supply disruptions
- Connection between geopolitical instability and market complacency
- Early signals of the Iran conflict that would later impact CPI and oil prices

This is early-stage monitoring of the geopolitical risks that later become significant catalysts (Operation Epic Fury, Iran conflict impacting gasoline prices +28%).`
  },
  {
    title: "Short Thoughts: January 12, 2026",
    slug: "short-thoughts-january-12-2026",
    url: "https://michaeljburry.substack.com/p/short-thoughts-january-12-2026",
    date: "2026-01-12",
    content: `Medicaid Fraud, Mandatory Cumulative Convertible Preferred & More.

Multiple short topics:

1. MEDICAID FRAUD: Analysis of fraud patterns in Medicaid managed care — directly relevant to his MOH thesis. Understanding the regulatory environment and fraud risk helps frame why MOH's disciplined approach creates an advantage.

2. MANDATORY CUMULATIVE CONVERTIBLE PREFERRED: Introduction to the Bruker preferred stock (BRKRP) that becomes his 3rd largest position. Explains the mechanics of mandatory convertible preferred shares and why they offer asymmetric risk/reward.

3. Additional market observations and shorter investment thoughts.

KEY POSITION: BRKRP (Bruker Mandatory Convertible Preferred) — introduced here, later becomes 3rd largest position by May 2026.`
  },
  {
    title: "The Payments Giants: FEE FI FOUR Umm...",
    slug: "the-payments-giants-fee-fi-four-umm",
    url: "https://michaeljburry.substack.com/p/the-payments-giants-fee-fi-four-umm",
    date: "2026-01-15",
    content: `From 10,000 Feet to Deep Dives — Major Payments Industry Analysis.

COMPREHENSIVE PAYMENTS SECTOR ANALYSIS covering the major payment companies and their moats, competitive positioning, and valuation:

Key companies analyzed:
- PYPL (PayPal): Eventually becomes a full position. Burry identifies it as deeply undervalued with strong cash generation, $6B buyback TTM on $41B market cap, ΔE of 96%, P/IV15 of 0.88
- FISV (Fiserv): Held position, stronger moat than PayPal but more expensive at P/IV15 of 1.26
- FOUR (Shift4 Payments): Position later partially sold
- V (Visa/now XYZ): Analyzed as part of the payments ecosystem
- Other payment processors and fintech companies

FRAMEWORK:
- IV15 (Intrinsic Value 15) applied to payments companies: What price offers 15%+ annual returns for 15+ years?
- ΔE (Delta Earnings): Owners' earnings relative to GAAP net income — adjusts for SBC, buybacks
- Moat analysis: Network effects, switching costs, regulatory barriers
- Fee-based business models: Recurring revenue vs transaction-based

This is the foundational piece for understanding Burry's payments sector positions and his later deeper analysis in the SW50 series.`
  },
  {
    title: "Final Stop GameStop: The Jig is Up",
    slug: "final-stop-gamestop-the-jig-is-up",
    url: "https://michaeljburry.substack.com/p/final-stop-gamestop-the-jig-is-up",
    date: "2026-01-26",
    content: `Job's Patience to the Test — Pre-Sale Analysis of GME.

GAMESTOP THESIS DETERIORATION:

Burry's detailed analysis of why the GameStop thesis is breaking down. Key concerns that foreshadow his full exit in May 2026:

- The "Instant Berkshire" thesis: GameStop's pivot to becoming a diversified holding company using its meme-stock-driven cash hoard
- Debt levels approaching danger zone: Debt/EBITDA rising toward the 5x threshold
- Interest coverage declining toward the 4.0x minimum
- Management's capital allocation decisions becoming inconsistent with the original value thesis
- The eBay acquisition attempt (later covered in May 2026) as a sign of thesis violation

THESIS VIOLATION FRAMEWORK:
Burry uses absolute rules for position exits:
- Never compatible with >5x Debt/EBITDA
- Never okay with interest coverage under 4.0x
- When these thresholds are breached, sell immediately regardless of emotional attachment

This piece is the analytical precursor to the full GME sale on May 4, 2026 — "the first full position sale since I started this Substack."

Broader lesson: Even positions with enormous past profits must be evaluated on current fundamentals. Thesis violations are non-negotiable exit signals.`
  },
  {
    title: "Short Thoughts: February 2, 2026",
    slug: "short-thoughts-february-2-2026",
    url: "https://michaeljburry.substack.com/p/short-thoughts-february-2-2026",
    date: "2026-02-02",
    content: `Earnings are in bloom.

Q4 2025 earnings season commentary:
- Key observations on earnings quality across technology companies
- Application of Tragic Algebra SBC framework to fresh quarterly data
- Preliminary signals of the patterns that lead to the broader "Boy Who Cried Wolf" warning in May
- Market reaction analysis — stocks being rewarded for AI spending commitments regardless of underlying earnings quality

Continued development of the thesis that GAAP earnings are systematically overstated across the technology sector.`
  },
  {
    title: "February 2026 Cassandra Unchained Charity of the Month",
    slug: "february-2026-cassandra-unchained-charity",
    url: "https://michaeljburry.substack.com/p/february-2026-cassandra-unchained-charity",
    date: "2026-02-03",
    content: `Fistula Foundation — Charity of the Month.

Monthly charity spotlight. February 2026 features the Fistula Foundation. No investment content.`
  },
  {
    title: "Palantir's New Clothes: Foundry, AIP, & the Failure of Reason",
    slug: "palantirs-new-clothes-foundry-aip",
    url: "https://michaeljburry.substack.com/p/palantirs-new-clothes-foundry-aip",
    date: "2026-02-12",
    content: `"You think it is helpful having a fluorescent green praying mantis coming into their offices telling them about German philosophy..."

FIRST MAJOR PALANTIR SHORT THESIS:

Foundational analysis establishing the case for shorting PLTR:

1. FOUNDRY ANALYSIS: Palantir's core product examined. The technology is real but the competitive moat is weak. Large enterprises can build similar data integration platforms. The "walled garden" approach limits scalability.

2. AIP (Artificial Intelligence Platform): Burry argues AIP is a thin wrapper around commercially available LLMs (Anthropic, OpenAI). The "bootcamp" sales model creates impressive demos but struggles with production deployment and recurring revenue.

3. VALUATION ABSURDITY: Market cap of $350B+ fully diluted exceeds Lockheed Martin, General Dynamics, and Northrop Grumman COMBINED by $50B. Those three have 38x more revenue and ~30x more owners' earnings.

4. CEO ALEX KARP: Philosophical posturing without substance. PhD in philosophy, not technology. "Doctor" title is misleading.

5. SBC PROBLEM: Diluting at 4.6% annually despite buybacks. No earnings after adjusting for true SBC cost. First company with billionaire:revenue ratio >1 — five billionaires on less than $4B revenue.

6. COMMERCIAL AI WEAKNESS: "In the intermediate to long-term I see little role for Palantir in the commercial space except as a legacy player for lazy management teams."

This establishes the intellectual foundation for the PLTR short position opened on May 4-5, 2026 at $147.`
  },
  {
    title: "Palantir: An Accounting",
    slug: "palantir-an-accounting",
    url: "https://michaeljburry.substack.com/p/palantir-an-accounting",
    date: "2026-02-18",
    content: `Tales from the 10-K — Deep Dive into PLTR's Financial Statements.

FOLLOW-UP PLTR ANALYSIS — 10-K deep dive:

Building on "Palantir's New Clothes," this piece dissects Palantir's annual report line by line:

1. REVENUE QUALITY: Government vs commercial revenue mix. Government revenue more stable but limited growth. Commercial growing but high churn.

2. SBC DETAIL: Line-by-line breakdown of Palantir's stock-based compensation. The 4.6% annual dilution rate detailed with specific RSU grant schedules, vesting patterns, and the gap between GAAP SBC expense and true economic cost.

3. CUSTOMER CONCENTRATION: Heavy dependence on a small number of large government contracts. Revenue recognition timing questions.

4. ADJUSTED vs GAAP: Palantir's adjusted metrics vs reality. Company presents "adjusted" earnings that add back the entirety of SBC expense — exactly the practice Burry dissected in the Tragic Algebra.

5. CASH FLOW ANALYSIS: Operating cash flow inflated by SBC add-back. True free cash flow to equity holders is negative when accounting for the full SBC cost.

6. INSIDER SELLING: Pattern of insider sales at elevated prices while maintaining bullish public commentary.

Combined with "Palantir's New Clothes," these two pieces form the complete intellectual case for the PLTR short.`
  },
  {
    title: "Short Thought: Nvidia Ratchets Up the Risk",
    slug: "short-thought-nvidia-ratchets-up-the",
    url: "https://michaeljburry.substack.com/p/short-thought-nvidia-ratchets-up-the",
    date: "2026-02-26",
    content: `Welcome to one short thought.

NVIDIA RISK ESCALATION:

Focused analysis on how NVIDIA's risk profile is increasing:

- Growing contracts with TSMC securing over $100B of capacity — the same type of contractual commitment that led to massive writedowns for Cisco in 2001-2002
- The parallel to Cisco's capacity contracts: when demand contracted, Cisco wrote down years of its best earnings
- NVIDIA's growing fixed commitments in an environment where AI demand may be plateauing
- Volume analysis showing declining trading volume during price advances — a technical warning sign
- 1,500 basis points of gross margin contraction expected over next 4 years as competition arrives

This is the analytical foundation for the NVDA puts position (Jan 2027 $115 puts, Mar 2027 $125 puts) that Burry builds through May-June 2026.`
  },
  {
    title: "Hong Kong Stocks: Structure & Strategy",
    slug: "hong-kong-stocks-structure-and-strategy",
    url: "https://michaeljburry.substack.com/p/hong-kong-stocks-structure-and-strategy",
    date: "2026-02-26",
    content: `VIEs: Vulnerability, Virtue & Value — Part 1 of Hong Kong Analysis.

HONG KONG INVESTMENT THESIS — STRUCTURAL ANALYSIS:

1. VIE (Variable Interest Entity) STRUCTURE: Detailed explanation of how Chinese companies list in Hong Kong and the US. The VIE structure creates legal risk but also creates valuation discounts that Burry sees as opportunities.

2. HONG KONG vs ADS: Why Burry prefers Hong Kong-listed shares in some cases (direct listing, no VIE) and US-listed ADS in others (BABA, JD).

3. KEY DISTINCTIONS:
- Directly listed HK shares (no VIE): Haier Smart Home 6690 HK, Haidilao 6862 HK
- Hong Kong primary, VIE structure: Tencent 700 HK, Meituan 3690 HK
- US ADS with VIE: BABA, JD

4. VALUATION ANALYSIS: These companies trade at historic low valuations due to:
- China regulatory risk perception
- US-China tensions
- Western investor exodus from Chinese equities
- Currency concerns

5. CDS (Credit Default Swap) analysis: Tencent, Alibaba, Meituan CDS curves show they are safer than Oracle and CoreWeave. CoreWeave default risk judged existential by bond markets.

This is Part 1 of the foundational analysis for Burry's Hong Kong positions.`
  },
  {
    title: "History Rhymes: Large Language Models Off to a Bad Start?",
    slug: "history-rhymes-large-language-models",
    url: "https://michaeljburry.substack.com/p/history-rhymes-large-language-models",
    date: "2026-02-28",
    content: `New York Times, Saturday, June 19, 1880.

LLM CRITIQUE — AI ACCURACY AND MISINFORMATION:

Burry's analysis of fundamental problems with Large Language Models, drawing a parallel to a historical New York Times article about early technology misinformation:

1. HISTORICAL PARALLEL: A newspaper from 1880 shows how new technologies have always generated confident but inaccurate narratives. LLMs are the modern equivalent — generating authoritative-sounding content that is often wrong.

2. LLM FACTUAL ERRORS: Burry has personally tried to correct Google AI and other LLMs about the dot-com bubble history. They initially admit they were wrong but get it wrong again on subsequent questioning. The models reinforce popular (false) narratives rather than discovering truth.

3. AI BUBBLE NARRATIVE REINFORCEMENT: LLMs trained on the internet's consensus view will reinforce the bull case for AI, creating a feedback loop where AI tools validate the very bubble that funds them.

4. IMPLICATIONS FOR INVESTING: AI-generated research is particularly dangerous because it sounds authoritative while reinforcing consensus thinking. The edge in investing comes from independent analysis, not from processing more information faster.

5. CONNECTION TO TRAGIC ALGEBRA: If AI tools can't even get basic historical facts right, how reliable are AI-generated earnings estimates and valuations?

This piece connects Burry's AI skepticism (as an investor short the AI bubble) to his broader intellectual framework about independent thinking vs narrative following.`
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
