"use strict";
// ═══════════════════════════════════════════════════════════════════
// MORNING MARKET LENS — Druckenmiller 272-Chart Framework (Phase 1)
// ═══════════════════════════════════════════════════════════════════
// ~30 priority instruments, Three Death Nails, Leading Groups,
// Breadth Health, What Changed, Aria Narrative
// ═══════════════════════════════════════════════════════════════════
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSTRUMENTS = void 0;
exports.refreshMorningLens = refreshMorningLens;
const express_1 = require("express");
const yahoo_finance2_1 = __importDefault(require("yahoo-finance2"));
const sdk_1 = __importDefault(require("@anthropic-ai/sdk"));
const inflection_engine_1 = require("./inflection-engine");
const history_store_1 = require("./history-store");
const router = (0, express_1.Router)();
// Initialize yahoo-finance2 v3 (requires instantiation with config)
// Use try/catch to handle constructor option changes across patch versions
let yahooFinance;
try {
    yahooFinance = new yahoo_finance2_1.default({
        validation: { logErrors: false, logOptions: { enabled: false } },
        suppressNotices: ['yahooSurvey', 'ripHistorical'],
    });
}
catch {
    // Fallback: construct with no options if schema changed
    try {
        yahooFinance = new yahoo_finance2_1.default();
    }
    catch {
        yahooFinance = new yahoo_finance2_1.default({});
    }
}
const INSTRUMENTS = [
    // ═══════════════════════════════════════════════════════════════
    // DEATH NAIL TRIO
    // ═══════════════════════════════════════════════════════════════
    { symbol: '^TNX', name: 'US 10Y Yield', bucket: 'fixed_income', group: 'US Treasuries', druckRationale: 'Death Nail #1 — rising rates squeeze multiples and housing', isDeathNail: true },
    { symbol: 'DX-Y.NYB', name: 'US Dollar Index (DXY)', bucket: 'fx', group: 'Dollar', druckRationale: 'Death Nail #2 — strong dollar tightens global financial conditions', isDeathNail: true },
    { symbol: 'CL=F', name: 'WTI Crude Oil', bucket: 'commodities', group: 'Energy', druckRationale: 'Death Nail #3 — rising oil is a tax on the consumer and input costs', isDeathNail: true },
    // ═══════════════════════════════════════════════════════════════
    // LEADING GROUPS (Inside of the Market)
    // ═══════════════════════════════════════════════════════════════
    { symbol: 'XHB', name: 'Homebuilders', bucket: 'equities', group: 'Leading Groups', druckRationale: '#1 leading group — rate-sensitive, first to break before recessions', isLeadingGroup: true },
    { symbol: 'IYT', name: 'Transports', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Goods movement — trucking and rails lead industrial slowdowns', isLeadingGroup: true },
    { symbol: 'XRT', name: 'Retailers', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Consumer durables demand — spending weakness shows here first', isLeadingGroup: true },
    { symbol: 'KRE', name: 'Regional Banks', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Credit cycle — regional banks break before the economy does', isLeadingGroup: true },
    { symbol: 'SMH', name: 'Semiconductors', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Modern replacement for chemicals — capex and AI demand tell', isLeadingGroup: true },
    { symbol: 'ITB', name: 'Home Construction', bucket: 'equities', group: 'Leading Groups', druckRationale: 'Pure homebuilding exposure — more concentrated than XHB', isLeadingGroup: true },
    // ═══════════════════════════════════════════════════════════════
    // MAJOR US INDICES
    // ═══════════════════════════════════════════════════════════════
    { symbol: 'SPY', name: 'S&P 500', bucket: 'equities', group: 'Indices', druckRationale: 'Master tape — the reference benchmark for all signals' },
    { symbol: 'QQQ', name: 'Nasdaq 100', bucket: 'equities', group: 'Indices', druckRationale: 'Growth/secular leadership — tech and AI concentration' },
    { symbol: 'IWM', name: 'Russell 2000', bucket: 'equities', group: 'Indices', druckRationale: 'Domestic cyclicality and breadth proxy' },
    { symbol: '^VIX', name: 'VIX', bucket: 'equities', group: 'Indices', druckRationale: 'Volatility regime — complacency vs fear gauge' },
    { symbol: 'RSP', name: 'S&P 500 Equal Weight', bucket: 'equities', group: 'Indices', druckRationale: 'Mega-cap concentration risk — diverges from SPY in blow-off tops' },
    { symbol: 'DIA', name: 'Dow Jones', bucket: 'equities', group: 'Indices', druckRationale: 'Blue chip industrials — old economy leadership gauge' },
    { symbol: 'MDY', name: 'S&P MidCap 400', bucket: 'equities', group: 'Indices', druckRationale: 'Mid-cap growth — sweet spot between small-cap risk and large-cap safety' },
    // ═══════════════════════════════════════════════════════════════
    // GICS SECTOR SPDR ETFs (Complete S&P Sector Coverage)
    // ═══════════════════════════════════════════════════════════════
    { symbol: 'XLK', name: 'Technology', bucket: 'equities', group: 'Sectors', druckRationale: 'Secular growth anchor — underperformance vs utilities = risk-off' },
    { symbol: 'XLF', name: 'Financials', bucket: 'equities', group: 'Sectors', druckRationale: 'Rate-sensitive sector — benefits from steepening curve, leads credit cycle' },
    { symbol: 'XLE', name: 'Energy', bucket: 'equities', group: 'Sectors', druckRationale: 'Oil-linked — inflation passthrough and geopolitical proxy' },
    { symbol: 'XLV', name: 'Healthcare', bucket: 'equities', group: 'Sectors', druckRationale: 'Defensive growth — policy risk and innovation cycle' },
    { symbol: 'XLI', name: 'Industrials', bucket: 'equities', group: 'Sectors', druckRationale: 'Capex and infrastructure cycle — ISM manufacturing proxy' },
    { symbol: 'XLP', name: 'Consumer Staples', bucket: 'equities', group: 'Sectors', druckRationale: 'Defensive anchor — outperformance signals risk-off rotation' },
    { symbol: 'XLY', name: 'Consumer Discretionary', bucket: 'equities', group: 'Sectors', druckRationale: 'Cyclical consumer — underperformance vs staples = late cycle' },
    { symbol: 'XLU', name: 'Utilities', bucket: 'equities', group: 'Sectors', druckRationale: 'Bond proxy + defensive — outperformance vs tech = late cycle warning' },
    { symbol: 'XLRE', name: 'Real Estate', bucket: 'equities', group: 'Sectors', druckRationale: 'Rate-sensitive assets — cap rate expansion/compression with duration' },
    { symbol: 'XLC', name: 'Communications', bucket: 'equities', group: 'Sectors', druckRationale: 'Meta/Google heavy — ad spending proxy and secular growth overlap' },
    { symbol: 'XLB', name: 'Materials', bucket: 'equities', group: 'Sectors', druckRationale: 'Commodity-linked equities — global demand barometer' },
    // ═══════════════════════════════════════════════════════════════
    // INDUSTRY / SUB-SECTOR ETFs
    // ═══════════════════════════════════════════════════════════════
    // -- Technology Sub-Sectors --
    { symbol: 'IGV', name: 'Software', bucket: 'equities', group: 'Tech Industries', druckRationale: 'Enterprise software — SaaS recurring revenue proxy, rate-sensitive valuations' },
    { symbol: 'SKYY', name: 'Cloud Computing', bucket: 'equities', group: 'Tech Industries', druckRationale: 'Cloud infrastructure spend — secular digital transformation gauge' },
    { symbol: 'CIBR', name: 'Cybersecurity', bucket: 'equities', group: 'Tech Industries', druckRationale: 'Cybersecurity spend — non-discretionary IT budget, geopolitical risk driver' },
    { symbol: 'BOTZ', name: 'Robotics & AI', bucket: 'equities', group: 'Tech Industries', druckRationale: 'AI/automation capex — secular theme with industrial cycle overlay' },
    // SOXX removed — duplicate semiconductor coverage (SMH in Leading Groups)
    // -- Healthcare Sub-Sectors --
    { symbol: 'XBI', name: 'Biotech', bucket: 'equities', group: 'Healthcare Industries', druckRationale: 'Speculative biotech — risk appetite gauge, M&A activity proxy' },
    { symbol: 'IHI', name: 'Medical Devices', bucket: 'equities', group: 'Healthcare Industries', druckRationale: 'Med-tech innovation — procedure volume and hospital capex cycle' },
    { symbol: 'XPH', name: 'Pharmaceuticals', bucket: 'equities', group: 'Healthcare Industries', druckRationale: 'Big pharma — defensive yield with patent cliff and pipeline risk' },
    // -- Financials Sub-Sectors --
    { symbol: 'KBE', name: 'Banks', bucket: 'equities', group: 'Financial Industries', druckRationale: 'Broad banking — NIM sensitivity, credit quality, curve shape' },
    { symbol: 'IAI', name: 'Broker-Dealers & Exchanges', bucket: 'equities', group: 'Financial Industries', druckRationale: 'Capital markets activity — IPO/M&A cycle, trading volume proxy' },
    { symbol: 'KIE', name: 'Insurance', bucket: 'equities', group: 'Financial Industries', druckRationale: 'Insurance cycle — underwriting profitability, catastrophe risk' },
    // -- Energy Sub-Sectors --
    { symbol: 'XOP', name: 'Oil & Gas E&P', bucket: 'equities', group: 'Energy Industries', druckRationale: 'Upstream oil — pure commodity leverage, highest beta to oil prices' },
    { symbol: 'OIH', name: 'Oil Services', bucket: 'equities', group: 'Energy Industries', druckRationale: 'Oilfield services — capex cycle, rig count, drilling activity' },
    { symbol: 'AMLP', name: 'MLPs (Midstream)', bucket: 'equities', group: 'Energy Industries', druckRationale: 'Pipeline infrastructure — fee-based cash flow, yield play with energy overlay' },
    // -- Industrials Sub-Sectors --
    { symbol: 'ITA', name: 'Aerospace & Defense', bucket: 'equities', group: 'Industrial Sub-Sectors', druckRationale: 'Defense spending — geopolitical premium, long-cycle government contracts' },
    { symbol: 'PAVE', name: 'Infrastructure', bucket: 'equities', group: 'Industrial Sub-Sectors', druckRationale: 'US infrastructure build-out — fiscal stimulus, construction cycle' },
    { symbol: 'JETS', name: 'Airlines', bucket: 'equities', group: 'Industrial Sub-Sectors', druckRationale: 'Consumer travel demand — fuel cost sensitivity, economic cycle indicator' },
    // -- Consumer Sub-Sectors --
    { symbol: 'IBUY', name: 'Online Retail', bucket: 'equities', group: 'Consumer Industries', druckRationale: 'E-commerce penetration — consumer spending migration online' },
    { symbol: 'PBJ', name: 'Food & Beverage', bucket: 'equities', group: 'Consumer Industries', druckRationale: 'Staples sub-sector — food inflation passthrough, defensive earnings' },
    // -- Real Estate Sub-Sectors --
    { symbol: 'VNQ', name: 'REITs (Broad)', bucket: 'equities', group: 'Real Estate Industries', druckRationale: 'Broad REIT exposure — rate-sensitive income, property cycle' },
    { symbol: 'MORT', name: 'Mortgage REITs', bucket: 'equities', group: 'Real Estate Industries', druckRationale: 'Mortgage market stress — spread compression, prepayment risk' },
    // -- Thematic / Macro --
    { symbol: 'ARKK', name: 'ARK Innovation', bucket: 'equities', group: 'Thematic', druckRationale: 'Speculative growth proxy — retail sentiment and liquidity gauge' },
    { symbol: 'ICLN', name: 'Clean Energy', bucket: 'equities', group: 'Thematic', druckRationale: 'Energy transition — policy-driven, subsidy-dependent growth' },
    { symbol: 'TAN', name: 'Solar', bucket: 'equities', group: 'Thematic', druckRationale: 'Solar industry — IRA subsidy beneficiary, rate-sensitive project economics' },
    { symbol: 'KWEB', name: 'China Internet', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Chinese tech — regulatory risk, US-China decoupling barometer' },
    // HACK removed — duplicate cybersecurity coverage (CIBR in Tech Industries)
    // ═══════════════════════════════════════════════════════════════
    // INTERNATIONAL / REGIONAL ETFs
    // ═══════════════════════════════════════════════════════════════
    // -- Broad International --
    { symbol: 'EFA', name: 'EAFE (Developed ex-US)', bucket: 'equities', group: 'International', druckRationale: 'Developed markets ex-US — Europe, Australia, Far East aggregate' },
    { symbol: 'VWO', name: 'Emerging Markets (Vanguard)', bucket: 'equities', group: 'International', druckRationale: 'Broad EM — China/India/Brazil/Taiwan, dollar-sensitive' },
    { symbol: 'EEM', name: 'Emerging Markets (iShares)', bucket: 'equities', group: 'International', druckRationale: 'Most liquid EM ETF — options market for EM hedging' },
    { symbol: 'IEMG', name: 'EM Core (iShares)', bucket: 'equities', group: 'International', druckRationale: 'Broader EM coverage — includes small-caps, lower cost than EEM' },
    { symbol: 'VEA', name: 'Developed Markets (Vanguard)', bucket: 'equities', group: 'International', druckRationale: 'Broad developed ex-US — high liquidity, low cost benchmark' },
    { symbol: 'ACWI', name: 'All Country World', bucket: 'equities', group: 'International', druckRationale: 'Global equity benchmark — US + international in one, allocation gauge' },
    // -- Europe --
    { symbol: 'VGK', name: 'Europe (Vanguard)', bucket: 'equities', group: 'Europe', druckRationale: 'Broad Europe — ECB policy, energy crisis, Euro direction' },
    { symbol: 'EWG', name: 'Germany (iShares)', bucket: 'equities', group: 'Europe', druckRationale: 'European industrial engine — manufacturing PMI, China export exposure' },
    { symbol: 'EWU', name: 'United Kingdom (iShares)', bucket: 'equities', group: 'Europe', druckRationale: 'UK equities — BoE policy, commodity-heavy FTSE, GBP sensitivity' },
    { symbol: 'EWQ', name: 'France (iShares)', bucket: 'equities', group: 'Europe', druckRationale: 'French equities — luxury sector exposure, political risk premium' },
    { symbol: 'EWP', name: 'Spain (iShares)', bucket: 'equities', group: 'Europe', druckRationale: 'Southern Europe — banking exposure, tourism cycle, ECB peripheral risk' },
    { symbol: 'EWI', name: 'Italy (iShares)', bucket: 'equities', group: 'Europe', druckRationale: 'Italian equities — BTP-Bund spread, banking system health' },
    { symbol: 'EWL', name: 'Switzerland (iShares)', bucket: 'equities', group: 'Europe', druckRationale: 'Swiss defensives — Nestle/Novartis/Roche, safe haven proxy' },
    // -- Asia-Pacific --
    { symbol: 'EWJ', name: 'Japan (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Japan equities — BoJ yield curve control, yen carry trade unwind risk' },
    { symbol: 'FXI', name: 'China Large-Cap (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Chinese large-caps — stimulus gauge, property crisis, US-China tensions' },
    { symbol: 'MCHI', name: 'China (MSCI iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Broader China — includes A-shares, better coverage than FXI' },
    { symbol: 'EWY', name: 'South Korea (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Korea/Samsung heavy — semiconductor cycle, global trade proxy' },
    { symbol: 'EWT', name: 'Taiwan (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Taiwan/TSMC heavy — chip supply chain, geopolitical flashpoint' },
    { symbol: 'INDA', name: 'India (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'India growth story — demographic dividend, manufacturing shift from China' },
    { symbol: 'EWA', name: 'Australia (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Australia — commodity exporter, China demand proxy, housing market' },
    { symbol: 'EWH', name: 'Hong Kong (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Hong Kong — China gateway, USD-pegged, financial hub stress gauge' },
    { symbol: 'THD', name: 'Thailand (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Thai equities — tourism recovery, EM Asia manufacturing shift' },
    { symbol: 'EPHE', name: 'Philippines (iShares)', bucket: 'equities', group: 'Asia-Pacific', druckRationale: 'Philippines — remittance economy, EM frontier growth' },
    // -- Latin America --
    { symbol: 'EWZ', name: 'Brazil (iShares)', bucket: 'equities', group: 'Latin America', druckRationale: 'Brazil — commodity superpower, Selic rate cycle, fiscal risk' },
    { symbol: 'EWW', name: 'Mexico (iShares)', bucket: 'equities', group: 'Latin America', druckRationale: 'Mexico — nearshoring beneficiary, US trade dependency, peso carry' },
    { symbol: 'ECH', name: 'Chile (iShares)', bucket: 'equities', group: 'Latin America', druckRationale: 'Chile — copper mining leverage, LatAm rate cycle leader' },
    { symbol: 'ARGT', name: 'Argentina (Global X)', bucket: 'equities', group: 'Latin America', druckRationale: 'Argentina — Milei reform play, sovereign spread compression bet' },
    // -- Other EM / Frontier --
    { symbol: 'TUR', name: 'Turkey (iShares)', bucket: 'equities', group: 'Other EM', druckRationale: 'Turkey — orthodox policy pivot, lira stabilization, re-rating thesis' },
    { symbol: 'RSX', name: 'Russia (VanEck)', bucket: 'equities', group: 'Other EM', druckRationale: 'Russia exposure — sanctions proxy, energy geopolitics (may be halted)' },
    { symbol: 'EZA', name: 'South Africa (iShares)', bucket: 'equities', group: 'Other EM', druckRationale: 'South Africa — mining/gold exposure, rand, EM risk sentiment' },
    { symbol: 'EWS', name: 'Singapore (iShares)', bucket: 'equities', group: 'Other EM', druckRationale: 'Singapore — Asia financial hub, REIT-heavy, trade flow proxy' },
    { symbol: 'QAT', name: 'Qatar (iShares)', bucket: 'equities', group: 'Other EM', druckRationale: 'Qatar — LNG superpower, Gulf petrodollar, sovereign wealth' },
    { symbol: 'KSA', name: 'Saudi Arabia (iShares)', bucket: 'equities', group: 'Other EM', druckRationale: 'Saudi Arabia — OPEC price-setter, Vision 2030, Aramco proxy' },
    // ═══════════════════════════════════════════════════════════════
    // COMMODITIES
    // ═══════════════════════════════════════════════════════════════
    // -- Precious Metals --
    { symbol: 'GC=F', name: 'Gold Futures', bucket: 'commodities', group: 'Precious Metals', druckRationale: 'Real rates and debasement signal — rises when faith in fiat drops' },
    { symbol: 'GLD', name: 'Gold ETF (SPDR)', bucket: 'commodities', group: 'Precious Metals', druckRationale: 'Physical gold ETF — most liquid gold vehicle, central bank demand proxy' },
    { symbol: 'SI=F', name: 'Silver Futures', bucket: 'commodities', group: 'Precious Metals', druckRationale: 'Industrial + monetary hybrid — confirms gold or diverges' },
    { symbol: 'SLV', name: 'Silver ETF (iShares)', bucket: 'commodities', group: 'Precious Metals', druckRationale: 'Silver ETF — retail precious metals demand gauge' },
    { symbol: 'GDX', name: 'Gold Miners', bucket: 'commodities', group: 'Precious Metals', druckRationale: 'Gold miners — leveraged gold play, margin expansion in rising gold' },
    { symbol: 'GDXJ', name: 'Junior Gold Miners', bucket: 'commodities', group: 'Precious Metals', druckRationale: 'Junior miners — speculative gold exposure, M&A targets' },
    // -- Energy Commodities --
    { symbol: 'BZ=F', name: 'Brent Crude', bucket: 'commodities', group: 'Energy', druckRationale: 'Global oil benchmark — pairs with WTI for spread analysis' },
    { symbol: 'NG=F', name: 'Natural Gas', bucket: 'commodities', group: 'Energy', druckRationale: 'Heating/power/LNG — weather-driven with geopolitical overlay' },
    { symbol: 'USO', name: 'US Oil Fund', bucket: 'commodities', group: 'Energy', druckRationale: 'Crude oil ETF — retail oil exposure, contango/backwardation gauge' },
    { symbol: 'UNG', name: 'US Natural Gas Fund', bucket: 'commodities', group: 'Energy', druckRationale: 'Nat gas ETF — weather/storage play, LNG export demand' },
    { symbol: 'URA', name: 'Uranium ETF', bucket: 'commodities', group: 'Energy', druckRationale: 'Nuclear renaissance play — secular energy transition demand' },
    // -- Industrial Metals --
    { symbol: 'HG=F', name: 'Copper Futures', bucket: 'commodities', group: 'Industrial Metals', druckRationale: 'Dr. Copper — global industrial demand barometer' },
    { symbol: 'COPX', name: 'Copper Miners', bucket: 'commodities', group: 'Industrial Metals', druckRationale: 'Copper equity exposure — leveraged to copper price, EV supply chain' },
    { symbol: 'LIT', name: 'Lithium & Battery ETF', bucket: 'commodities', group: 'Industrial Metals', druckRationale: 'EV supply chain — battery metals demand cycle' },
    { symbol: 'SLX', name: 'Steel', bucket: 'commodities', group: 'Industrial Metals', druckRationale: 'Steel equities — infrastructure build, China demand, tariff proxy' },
    // -- Agriculture --
    { symbol: 'ZW=F', name: 'Wheat Futures', bucket: 'commodities', group: 'Agriculture', druckRationale: 'Staple food commodity — geopolitical supply disruption risk' },
    { symbol: 'ZC=F', name: 'Corn Futures', bucket: 'commodities', group: 'Agriculture', druckRationale: 'Feed + ethanol — links energy and food inflation chains' },
    { symbol: 'ZS=F', name: 'Soybean Futures', bucket: 'commodities', group: 'Agriculture', druckRationale: 'China demand proxy — US-China trade barometer' },
    { symbol: 'DBA', name: 'Agriculture ETF', bucket: 'commodities', group: 'Agriculture', druckRationale: 'Broad agriculture — food inflation basket, weather risk diversified' },
    { symbol: 'MOO', name: 'Agribusiness', bucket: 'commodities', group: 'Agriculture', druckRationale: 'Agribusiness equities — Deere, Archer Daniels, food supply chain' },
    // -- Broad Commodities --
    { symbol: 'DBC', name: 'Commodity Index (Invesco)', bucket: 'commodities', group: 'Broad', druckRationale: 'Broad commodity benchmark — energy-heavy, inflation correlation' },
    { symbol: 'GSG', name: 'Commodity Index (iShares)', bucket: 'commodities', group: 'Broad', druckRationale: 'S&P GSCI tracking — broad commodity exposure, energy-weighted' },
    // ═══════════════════════════════════════════════════════════════
    // CURRENCIES
    // ═══════════════════════════════════════════════════════════════
    { symbol: 'EURUSD=X', name: 'EUR/USD', bucket: 'fx', group: 'Major Crosses', druckRationale: 'Largest cross — ECB-Fed differential drives global capital flows' },
    { symbol: 'JPY=X', name: 'USD/JPY', bucket: 'fx', group: 'Major Crosses', druckRationale: 'Carry trade barometer — BoJ policy drives global risk appetite' },
    { symbol: 'GBP=X', name: 'GBP/USD', bucket: 'fx', group: 'Major Crosses', druckRationale: 'BoE policy — Soros/Druckenmiller famously traded the pound' },
    { symbol: 'BTC-USD', name: 'Bitcoin', bucket: 'fx', group: 'Digital', druckRationale: 'Liquidity/debasement tell — leads risk-on moves in loose policy' },
    { symbol: 'ETH-USD', name: 'Ethereum', bucket: 'fx', group: 'Digital', druckRationale: 'DeFi/smart contract platform — risk-on speculative gauge' },
    { symbol: 'CNY=X', name: 'USD/CNY', bucket: 'fx', group: 'EM FX', druckRationale: 'Yuan — PBOC policy, trade war barometer, EM anchor currency' },
    { symbol: 'MXN=X', name: 'USD/MXN', bucket: 'fx', group: 'EM FX', druckRationale: 'Peso — high-carry EM currency, US trade dependency, nearshoring' },
    // ═══════════════════════════════════════════════════════════════
    // FIXED INCOME
    // ═══════════════════════════════════════════════════════════════
    // -- US Treasuries (Yields) --
    { symbol: '^IRX', name: 'US 3-Month T-Bill', bucket: 'fixed_income', group: 'US Treasuries', druckRationale: 'Fed policy rate proxy — front end of the curve' },
    { symbol: '^FVX', name: 'US 5Y Yield', bucket: 'fixed_income', group: 'US Treasuries', druckRationale: 'Belly of the curve — intermediate rate expectations' },
    { symbol: '^TYX', name: 'US 30Y Yield', bucket: 'fixed_income', group: 'US Treasuries', druckRationale: 'Long end — term premium and inflation expectations' },
    // -- Duration ETFs --
    { symbol: 'SHY', name: '1-3 Year Treasury ETF', bucket: 'fixed_income', group: 'Duration', druckRationale: 'Short duration — Fed funds rate sensitivity and cash alternative' },
    { symbol: 'IEI', name: '3-7 Year Treasury ETF', bucket: 'fixed_income', group: 'Duration', druckRationale: 'Intermediate duration — belly of the curve exposure' },
    { symbol: 'IEF', name: '7-10 Year Treasury ETF', bucket: 'fixed_income', group: 'Duration', druckRationale: 'Mid-duration — 10Y rate sensitivity without long-end vol' },
    { symbol: 'TLH', name: '10-20 Year Treasury ETF', bucket: 'fixed_income', group: 'Duration', druckRationale: '20Y proxy — the most important duration bucket for rate cycle analysis' },
    { symbol: 'TLT', name: 'Long Treasury ETF (20Y+)', bucket: 'fixed_income', group: 'Duration', druckRationale: 'Duration trade — flight to quality vs inflation fear' },
    // -- Credit --
    { symbol: 'HYG', name: 'High Yield Bond ETF', bucket: 'fixed_income', group: 'Credit', druckRationale: 'Credit risk appetite — widening = stress, tightening = risk-on' },
    { symbol: 'JNK', name: 'High Yield (SPDR)', bucket: 'fixed_income', group: 'Credit', druckRationale: 'Junk bonds — higher-yield HY exposure, default risk gauge' },
    { symbol: 'LQD', name: 'Investment Grade Corp', bucket: 'fixed_income', group: 'Credit', druckRationale: 'IG corporate bonds — spread compression/widening, duration + credit risk' },
    { symbol: 'BKLN', name: 'Senior Loans (Leveraged)', bucket: 'fixed_income', group: 'Credit', druckRationale: 'Floating rate loans — rate-hedged credit, CLO underlying, default risk' },
    // -- Inflation / TIPS --
    { symbol: 'TIP', name: 'TIPS Bond ETF', bucket: 'fixed_income', group: 'Inflation', druckRationale: 'Inflation breakeven proxy — real vs nominal rate expectations' },
    { symbol: 'STIP', name: 'Short-Term TIPS', bucket: 'fixed_income', group: 'Inflation', druckRationale: 'Near-term inflation expectations — front-end breakevens' },
    // -- International Bonds --
    { symbol: 'EMB', name: 'EM Sovereign Bonds (USD)', bucket: 'fixed_income', group: 'International Bonds', druckRationale: 'EM sovereign debt — dollar-denominated, spread risk, EM stress gauge' },
    { symbol: 'BNDX', name: 'International Bond (Vanguard)', bucket: 'fixed_income', group: 'International Bonds', druckRationale: 'Global ex-US bonds — hedged, global rate cycle diversification' },
    { symbol: 'BWX', name: 'Intl Treasury (SPDR)', bucket: 'fixed_income', group: 'International Bonds', druckRationale: 'Foreign government bonds — unhedged, FX + rate exposure' },
    // -- Mortgage --
    { symbol: 'MBB', name: 'Mortgage-Backed Securities', bucket: 'fixed_income', group: 'Mortgage', druckRationale: 'Agency MBS — prepayment risk, Fed balance sheet, housing finance' },
];
exports.INSTRUMENTS = INSTRUMENTS;
// ─── DATA STORAGE ───
let instrumentSnapshots = new Map();
let previousPhaseMap = new Map(); // previous refresh phases
let phaseTransitions = []; // detected transitions
let currentSignals = null;
let previousSignals = null;
let whatChanged = [];
let ariaLatestNarrative = '';
let ariaTimestamp = '';
let lensLastRefresh = 0;
let lensRefreshErrors = [];
const LENS_CACHE_MS = 4 * 60 * 60 * 1000; // 4 hours
async function fetchOHLC(symbol, period = '1y') {
    const maxRetries = 4;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            if (period === '2y')
                startDate.setFullYear(startDate.getFullYear() - 2);
            else if (period === '5y')
                startDate.setFullYear(startDate.getFullYear() - 5);
            else
                startDate.setFullYear(startDate.getFullYear() - 1);
            // Use chart() with validation: false to prevent schema validation errors
            // (Yahoo sometimes returns valid data with missing meta fields like currency/regularMarketPrice)
            const result = await yahooFinance.chart(symbol, {
                period1: startDate,
                period2: endDate,
                interval: '1d',
            }, { validateResult: false });
            // chart() returns { quotes: [...], meta: {...} }
            const quotes = result?.quotes || result || [];
            if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
                if (attempt < maxRetries) {
                    const delayMs = attempt * 4000; // escalating: 4s, 8s, 12s
                    console.warn(`[YF] No data for ${symbol} (attempt ${attempt}/${maxRetries}), retrying in ${delayMs / 1000}s...`);
                    await new Promise(r => setTimeout(r, delayMs));
                    continue;
                }
                console.warn(`[YF] No data for ${symbol} after ${maxRetries} attempts`);
                return [];
            }
            return quotes
                .filter((q) => q.close != null && q.close > 0)
                .map((q) => ({
                date: new Date(q.date),
                open: q.open || q.close,
                high: q.high || q.close,
                low: q.low || q.close,
                close: q.close,
                volume: q.volume || 0,
            }));
        }
        catch (err) {
            const msg = err?.message || 'Unknown';
            // Rate-limit or validation errors — wait longer before retry
            const isRateLimit = msg.includes('Too Many') || msg.includes('429') || msg.includes('throttle');
            const isValidation = msg.includes('validation') || msg.includes('schema') || msg.includes('Failed Yahoo');
            const delayMs = isRateLimit ? attempt * 8000 : (isValidation ? attempt * 2000 : attempt * 4000);
            if (attempt < maxRetries) {
                if (!isValidation) { // Don't spam logs for known validation issues
                    console.warn(`[YF] Error fetching ${symbol} (attempt ${attempt}/${maxRetries}): ${msg.slice(0, 80)}, retrying in ${delayMs / 1000}s...`);
                }
                await new Promise(r => setTimeout(r, delayMs));
                continue;
            }
            console.error(`[YF] Failed ${symbol} after ${maxRetries} attempts: ${msg.slice(0, 100)}`);
            return [];
        }
    }
    return [];
}
// ─── TECHNICAL ANALYSIS ENGINE ───
function calcSMA(closes, period) {
    const result = [];
    for (let i = 0; i < closes.length; i++) {
        if (i < period - 1) {
            result.push(NaN);
        }
        else {
            let sum = 0;
            for (let j = i - period + 1; j <= i; j++)
                sum += closes[j];
            result.push(sum / period);
        }
    }
    return result;
}
function calcROC(closes, period) {
    if (closes.length < period + 1)
        return 0;
    const latest = closes[closes.length - 1];
    const prior = closes[closes.length - 1 - period];
    if (!prior || prior === 0)
        return 0;
    return ((latest - prior) / prior) * 100;
}
function calcSlope(values, period) {
    if (values.length < period)
        return 0;
    const recent = values.slice(-period).filter(v => !isNaN(v));
    if (recent.length < 2)
        return 0;
    // Simple linear regression slope
    const n = recent.length;
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += recent[i];
        sumXY += i * recent[i];
        sumXX += i * i;
    }
    return (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
}
function classifyTrend(closes) {
    if (closes.length < 200) {
        // Not enough data for 200ma — use what we have
        const price = closes[closes.length - 1];
        const ma50 = closes.length >= 50 ? calcSMA(closes, 50).pop() || price : price;
        const roc20d = calcROC(closes, 20);
        return {
            state: roc20d > 2 ? 'UPTREND' : roc20d < -2 ? 'DOWNTREND' : 'SIDEWAYS',
            price,
            ma50,
            ma200: price,
            roc20d: +roc20d.toFixed(2),
            slope20d: calcSlope(closes, 20),
        };
    }
    const price = closes[closes.length - 1];
    const sma50 = calcSMA(closes, 50);
    const sma200 = calcSMA(closes, 200);
    const ma50 = sma50[sma50.length - 1];
    const ma200 = sma200[sma200.length - 1];
    const roc20d = calcROC(closes, 20);
    const slope20d = calcSlope(closes, 20);
    let state;
    if (price > ma50 && ma50 > ma200 && slope20d > 0) {
        state = 'UPTREND';
    }
    else if (price < ma50 && ma50 < ma200 && slope20d < 0) {
        state = 'DOWNTREND';
    }
    else if (price < ma50 && ma50 > ma200) {
        // Price dropped below 50ma but 50ma still above 200ma — topping
        state = 'TOPPING';
    }
    else if (price > ma50 && ma50 < ma200) {
        // Price above 50ma but 50ma still below 200ma — basing / recovery
        state = 'BASING';
    }
    else {
        state = 'SIDEWAYS';
    }
    return {
        state,
        price: +price.toFixed(4),
        ma50: +ma50.toFixed(4),
        ma200: +ma200.toFixed(4),
        roc20d: +roc20d.toFixed(2),
        slope20d,
    };
}
function aggregateToWeekly(bars) {
    const weeks = new Map();
    for (const bar of bars) {
        const d = bar.date;
        // ISO week key
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay()); // Sunday start
        const key = weekStart.toISOString().slice(0, 10);
        if (!weeks.has(key))
            weeks.set(key, []);
        weeks.get(key).push(bar.close);
    }
    // Use last close of each week
    return Array.from(weeks.values()).map(closes => closes[closes.length - 1]);
}
function aggregateToMonthly(bars) {
    const months = new Map();
    for (const bar of bars) {
        const key = `${bar.date.getFullYear()}-${String(bar.date.getMonth() + 1).padStart(2, '0')}`;
        if (!months.has(key))
            months.set(key, []);
        months.get(key).push(bar.close);
    }
    return Array.from(months.values()).map(closes => closes[closes.length - 1]);
}
// ─── SIGNAL COMPUTATIONS ───
function computeDeathNails(snapshots) {
    const components = [];
    const deathNailSymbols = [
        { symbol: '^TNX', component: 'Rising Rates' },
        { symbol: 'DX-Y.NYB', component: 'Rising Dollar' },
        { symbol: 'CL=F', component: 'Rising Oil' },
    ];
    for (const { symbol, component } of deathNailSymbols) {
        const snap = snapshots.get(symbol);
        if (!snap) {
            components.push({
                component,
                symbol,
                firing: false,
                price: 0, ma50: 0, ma200: 0, roc20d: 0,
                explanation: `No data available for ${symbol}`,
            });
            continue;
        }
        const d = snap.daily;
        // Death nail fires when: price > 50dma AND price > 200dma AND 20d ROC > 0
        const firing = d.price > d.ma50 && d.price > d.ma200 && d.roc20d > 0;
        const explanation = firing
            ? `${snap.name} at ${d.price.toFixed(2)}, above 50dma (${d.ma50.toFixed(2)}) and 200dma (${d.ma200.toFixed(2)}), 20d ROC +${d.roc20d.toFixed(1)}%`
            : `${snap.name} at ${d.price.toFixed(2)} — not all conditions met (50dma: ${d.ma50.toFixed(2)}, 200dma: ${d.ma200.toFixed(2)}, 20d ROC: ${d.roc20d.toFixed(1)}%)`;
        components.push({ component, symbol, firing, price: d.price, ma50: d.ma50, ma200: d.ma200, roc20d: d.roc20d, explanation });
    }
    const firingCount = components.filter(c => c.firing).length;
    return {
        count: firingCount,
        masterFiring: firingCount === 3,
        components,
    };
}
function computeLeadingGroups(snapshots) {
    const spySnap = snapshots.get('SPY');
    const spy30d = spySnap?.changePct30d || 0;
    const leadingSymbols = INSTRUMENTS.filter(i => i.isLeadingGroup);
    const groups = [];
    for (const inst of leadingSymbols) {
        const snap = snapshots.get(inst.symbol);
        if (!snap) {
            groups.push({
                symbol: inst.symbol, name: inst.name, health: 'NEUTRAL',
                trendState: 'SIDEWAYS', relPerf3m: 0,
                explanation: `No data for ${inst.symbol}`,
            });
            continue;
        }
        const d = snap.daily;
        // Relative performance vs SPY (3-month approximation using 30d change)
        const relPerf = snap.changePct30d - spy30d;
        let health;
        if (d.state === 'UPTREND' || d.state === 'BASING') {
            health = relPerf >= -3 ? 'HEALTHY' : 'NEUTRAL';
        }
        else if (d.state === 'DOWNTREND') {
            health = 'BROKEN';
        }
        else if (d.state === 'TOPPING') {
            health = relPerf < -5 ? 'BROKEN' : 'NEUTRAL';
        }
        else {
            health = 'NEUTRAL';
        }
        const explanation = `${inst.name}: ${d.state}, rel perf vs SPY: ${relPerf >= 0 ? '+' : ''}${relPerf.toFixed(1)}%`;
        groups.push({ symbol: inst.symbol, name: inst.name, health, trendState: d.state, relPerf3m: +relPerf.toFixed(1), explanation });
    }
    const brokenCount = groups.filter(g => g.health === 'BROKEN').length;
    const healthyCount = groups.filter(g => g.health === 'HEALTHY').length;
    // Divergence warning: 4+ broken while SPY still positive
    const divergenceWarning = brokenCount >= 4 && spy30d > 0;
    return { healthyCount, brokenCount, divergenceWarning, groups };
}
function computeBreadth(snapshots) {
    const rsp = snapshots.get('RSP');
    const spy = snapshots.get('SPY');
    let rspSpyRatio = 1;
    let rspSpyTrend = 'FLAT';
    let breadthHealth = 'HEALTHY';
    if (rsp && spy && spy.daily.price > 0) {
        rspSpyRatio = +(rsp.daily.price / spy.daily.price).toFixed(4);
        // If RSP underperforming SPY over 30d = narrowing breadth
        const rspChg = rsp.changePct30d;
        const spyChg = spy.changePct30d;
        const diff = rspChg - spyChg;
        if (diff > 1)
            rspSpyTrend = 'RISING';
        else if (diff < -1)
            rspSpyTrend = 'FALLING';
        else
            rspSpyTrend = 'FLAT';
        if (diff < -3)
            breadthHealth = 'BROKEN';
        else if (diff < -1)
            breadthHealth = 'WEAKENING';
        else
            breadthHealth = 'HEALTHY';
    }
    return { rspSpyRatio, rspSpyTrend, breadthHealth };
}
function computeDefensivesVsCyclicals(snapshots) {
    function getRatioTrend(numSymbol, denSymbol) {
        const num = snapshots.get(numSymbol);
        const den = snapshots.get(denSymbol);
        if (!num || !den || den.daily.price === 0)
            return { ratio: 1, trend13w: 'FLAT' };
        const ratio = +(num.daily.price / den.daily.price).toFixed(4);
        // Approximate 13-week trend using 30d changes
        const numChg = num.changePct30d;
        const denChg = den.changePct30d;
        const diff = numChg - denChg;
        let trend = 'FLAT';
        if (diff > 1.5)
            trend = 'RISING';
        else if (diff < -1.5)
            trend = 'FALLING';
        return { ratio, trend13w: trend };
    }
    return {
        xlpXly: getRatioTrend('XLP', 'XLY'),
        xluXlk: getRatioTrend('XLU', 'XLK'),
        goldCopper: getRatioTrend('GC=F', 'HG=F'),
    };
}
function computeCurveCredit(snapshots) {
    const tnx = snapshots.get('^TNX');
    const irx = snapshots.get('^IRX');
    const hyg = snapshots.get('HYG');
    // 2s10s approximation: 10Y - 3M (since we don't have 2Y from Yahoo easily)
    const yield10y = tnx?.daily.price || 0; // ^TNX is already in percentage form
    const yield3m = irx?.daily.price || 0;
    const yieldCurve = +((yield10y - yield3m) * 100).toFixed(0); // Convert to bps
    return {
        yieldCurve2s10s: yieldCurve,
        hySpread: 0, // We get this from FRED in the main module
    };
}
// ─── WHAT CHANGED DIFF ENGINE ───
function computeWhatChanged(current, previous) {
    const diffs = [];
    const now = new Date().toISOString();
    if (!previous) {
        diffs.push({ time: now, category: 'death_nail', message: 'Morning Lens initialized — first signal snapshot captured.', severity: 'info' });
        return diffs;
    }
    // Death Nail changes
    if (current.deathNails.count !== previous.deathNails.count) {
        diffs.push({
            time: now,
            category: 'death_nail',
            message: `Death Nail count: ${previous.deathNails.count}/3 → ${current.deathNails.count}/3${current.deathNails.masterFiring ? ' — MASTER ALERT FIRING' : ''}`,
            severity: current.deathNails.masterFiring ? 'critical' : 'warning',
        });
    }
    for (let i = 0; i < current.deathNails.components.length; i++) {
        const curr = current.deathNails.components[i];
        const prev = previous.deathNails.components[i];
        if (prev && curr.firing !== prev.firing) {
            diffs.push({
                time: now,
                category: 'death_nail',
                symbol: curr.symbol,
                message: `${curr.component}: ${prev.firing ? 'FIRING → DORMANT' : 'DORMANT → FIRING'} — ${curr.explanation}`,
                severity: curr.firing ? 'critical' : 'info',
            });
        }
    }
    // Leading Group changes
    for (let i = 0; i < current.leadingGroups.groups.length; i++) {
        const curr = current.leadingGroups.groups[i];
        const prev = previous.leadingGroups.groups.find(g => g.symbol === curr.symbol);
        if (prev && curr.health !== prev.health) {
            diffs.push({
                time: now,
                category: 'leading_group',
                symbol: curr.symbol,
                message: `${curr.name}: ${prev.health} → ${curr.health} — ${curr.explanation}`,
                severity: curr.health === 'BROKEN' ? 'warning' : 'info',
            });
        }
    }
    // Divergence warning
    if (current.leadingGroups.divergenceWarning && !previous.leadingGroups.divergenceWarning) {
        diffs.push({
            time: now,
            category: 'leading_group',
            message: `DIVERGENCE WARNING: ${current.leadingGroups.brokenCount} of 6 leading groups BROKEN while SPY still positive — 1987/2007-style divergence`,
            severity: 'critical',
        });
    }
    // Breadth changes
    if (current.breadth.breadthHealth !== previous.breadth.breadthHealth) {
        diffs.push({
            time: now,
            category: 'breadth',
            message: `Breadth health: ${previous.breadth.breadthHealth} → ${current.breadth.breadthHealth}. RSP/SPY trend: ${current.breadth.rspSpyTrend}`,
            severity: current.breadth.breadthHealth === 'BROKEN' ? 'warning' : 'info',
        });
    }
    // Defensives vs cyclicals
    const ratioNames = [
        { key: 'xlpXly', name: 'XLP/XLY (Staples vs Discretionary)' },
        { key: 'xluXlk', name: 'XLU/XLK (Utilities vs Tech)' },
        { key: 'goldCopper', name: 'Gold/Copper' },
    ];
    for (const { key, name } of ratioNames) {
        const currR = current.defensivesVsCyclicals[key];
        const prevR = previous.defensivesVsCyclicals[key];
        if (currR.trend13w !== prevR.trend13w) {
            diffs.push({
                time: now,
                category: 'defensives',
                message: `${name} ratio: 13-week trend flipped from ${prevR.trend13w} to ${currR.trend13w}${currR.trend13w === 'RISING' ? ' — defensive rotation building' : ''}`,
                severity: currR.trend13w === 'RISING' ? 'warning' : 'info',
            });
        }
    }
    // Trend state changes for all instruments
    const currentSnaps = Array.from(instrumentSnapshots.values());
    for (const snap of currentSnaps) {
        // We only track daily trend state changes in the diff
        // (In future, weekly/monthly changes also surface)
        // For now, compare to previous snapshot if we had one
        // This is simplified — a full impl would store previous snapshots
    }
    return diffs;
}
// ─── PHASE TRANSITION DETECTION ───
function computePhaseTransitions(newSnapshots, prevPhases) {
    const transitions = [];
    const now = new Date().toISOString();
    for (const [symbol, snap] of newSnapshots) {
        if (!snap.phaseData)
            continue;
        const prev = prevPhases.get(symbol);
        if (!prev)
            continue; // first time seeing this instrument — no transition
        // Only fire if the phase number actually changed
        if (snap.phaseData.phaseNum === prev.phaseNum)
            continue;
        const fromNum = prev.phaseNum;
        const toNum = snap.phaseData.phaseNum;
        // Determine direction based on cycle semantics
        // P1→P2→P3 = advancing (bullish deteriorating as cycle matures)
        // P4→P5→P6 = bearish cycle advancing
        // P6→P1 or P5→P1 = improving (new bullish cycle)
        // P3→P4 = deteriorating (shift to bearish)
        let direction;
        if ((fromNum <= 3 && toNum >= 4) || (fromNum === 3 && toNum === 4)) {
            direction = 'deteriorating'; // crossed from bullish to bearish phases
        }
        else if ((fromNum >= 4 && toNum <= 2) || (fromNum === 6 && toNum === 1)) {
            direction = 'improving'; // crossed from bearish back to bullish phases
        }
        else if (toNum > fromNum) {
            direction = 'advancing'; // moving forward in the cycle
        }
        else {
            direction = 'improving'; // moving backward = reverting to earlier/better phase
        }
        // Determine severity
        const fromBias = prev.actionBias;
        const toBias = snap.phaseData.actionBias;
        const biasFlipped = (fromBias.includes('BUY') && toBias.includes('SELL')) ||
            (fromBias.includes('SELL') && toBias.includes('BUY'));
        let severity;
        if (biasFlipped) {
            severity = 'critical'; // action bias flipped — requires immediate attention
        }
        else if (direction === 'deteriorating') {
            severity = 'warning';
        }
        else {
            severity = 'info';
        }
        transitions.push({
            symbol,
            name: snap.name,
            bucket: snap.bucket,
            group: snap.group,
            fromPhase: fromNum,
            toPhase: toNum,
            fromPhaseShort: `P${fromNum} ${prev.phaseShort.replace(/^P\d\s*/, '')}`,
            toPhaseShort: `P${toNum} ${snap.phaseData.phaseShort.replace(/^P\d\s*/, '')}`,
            fromBias,
            toBias,
            biasFlipped,
            direction,
            severity,
            detectedAt: now,
        });
    }
    // Sort: critical first, then warning, then info
    const severityOrder = { critical: 0, warning: 1, info: 2 };
    transitions.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
    return transitions;
}
// ─── PHASE HELPERS ───
const PHASE_NUM_MAP = {
    'NARRATIVE_EXPANSION': 1,
    'INSTITUTIONAL_ACCUMULATION': 2,
    'BUYING_EXHAUSTION': 3,
    'NARRATIVE_REVERSAL': 4,
    'SELLING_EXHAUSTION': 5,
    'NARRATIVE_COLLAPSE': 6,
};
const PHASE_SHORT_MAP = {
    'NARRATIVE_EXPANSION': 'Expansion',
    'INSTITUTIONAL_ACCUMULATION': 'Accumulation',
    'BUYING_EXHAUSTION': 'Buy Exhaustion',
    'NARRATIVE_REVERSAL': 'Reversal',
    'SELLING_EXHAUSTION': 'Sell Exhaustion',
    'NARRATIVE_COLLAPSE': 'Collapse',
};
function computePhaseForInstrument(bars, spyCloses, prevPhase) {
    // Convert OHLCBar (date: Date) to OHLCVBar (date: string) for inflection engine
    const ohlcvBars = bars.map(b => ({
        date: b.date.toISOString().split('T')[0],
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
    }));
    // Neutral defaults for non-stock instruments (ETFs, indices, commodities, FX)
    const neutralAccel = { rocAccel: null, logAccelSmooth: null, emaAccel: null, trend: 'neutral', recentSignals: [] };
    const nullFundamentals = { revenueGrowthYoY: null, epsGrowthYoY: null, operatingMargin: null, netMargin: null, roic: null, fcfYield: null, debtToEquity: null, piotroskiFScore: null, currentRatio: null };
    const nullValuation = { peForward: null, evToEbitda: null, pegRatio: null, fcfYield: null, pePctile: null, gfValueMargin: null };
    const neutralNarrative = {};
    try {
        const result = (0, inflection_engine_1.computeFullInflection)('', '', ohlcvBars, spyCloses, neutralAccel, nullFundamentals, nullValuation, neutralNarrative, prevPhase);
        if (!result)
            return null;
        const phase = result.phase.phase;
        return {
            phase,
            phaseNum: PHASE_NUM_MAP[phase] || 0,
            phaseShort: `P${PHASE_NUM_MAP[phase]} ${PHASE_SHORT_MAP[phase] || phase}`,
            actionBias: result.phase.actionBias,
            confidence: result.phase.confidence,
            overallSignal: result.overallSignal,
        };
    }
    catch (err) {
        // Silently skip — some instruments (VIX, yields) may not compute well
        return null;
    }
}
// ─── MASTER REFRESH ───
async function refreshMorningLens() {
    console.log('[LENS] Starting Morning Lens data refresh...');
    const errors = [];
    const startTime = Date.now();
    // Fetch OHLC in small batches with generous delays to avoid Yahoo Finance rate limits
    // Railway shared IPs get throttled harder — conservative settings are critical
    const allBars = new Map();
    const BATCH_SIZE = 2; // Only 2 concurrent (was 3 — less pressure on Yahoo)
    const BATCH_DELAY_MS = 3000; // 3s between batches (was 2s)
    const failedSymbols = [];
    // Shuffle instrument order so the same symbols don't always land at the tail
    // where rate-limiting is worst. Fisher-Yates shuffle on a copy.
    const shuffled = [...INSTRUMENTS];
    for (let si = shuffled.length - 1; si > 0; si--) {
        const sj = Math.floor(Math.random() * (si + 1));
        [shuffled[si], shuffled[sj]] = [shuffled[sj], shuffled[si]];
    }
    for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
        const batch = shuffled.slice(i, i + BATCH_SIZE);
        const batchResults = await Promise.allSettled(batch.map(inst => fetchOHLC(inst.symbol, '1y').then(bars => ({ symbol: inst.symbol, bars }))));
        for (let j = 0; j < batchResults.length; j++) {
            const result = batchResults[j];
            const symbol = batch[j]?.symbol || '?';
            if (result.status === 'fulfilled' && result.value.bars.length > 0) {
                allBars.set(result.value.symbol, result.value.bars);
            }
            else {
                const errMsg = result.status === 'rejected' ? (result.reason?.message || 'Rejected') : 'No data';
                errors.push(`${symbol}: ${errMsg}`);
                failedSymbols.push(symbol);
            }
        }
        // Delay between batches
        if (i + BATCH_SIZE < shuffled.length) {
            await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
        }
    }
    // RETRY PASS: Re-attempt failed symbols individually with longer delays
    // This catches rate-limit failures that resolve after a cooldown
    if (failedSymbols.length > 0 && failedSymbols.length < INSTRUMENTS.length * 0.8) {
        console.log(`[LENS] Retry pass: ${failedSymbols.length} failed symbols...`);
        await new Promise(r => setTimeout(r, 15000)); // 15s cooldown before retries (was 10s)
        for (const sym of failedSymbols) {
            try {
                const bars = await fetchOHLC(sym, '1y');
                if (bars.length > 0) {
                    allBars.set(sym, bars);
                    // Remove from errors
                    const idx = errors.findIndex(e => e.startsWith(sym + ':'));
                    if (idx >= 0)
                        errors.splice(idx, 1);
                    console.log(`[LENS] Retry succeeded: ${sym} (${bars.length} bars)`);
                }
            }
            catch (e) {
                // Still failed — leave in errors
            }
            await new Promise(r => setTimeout(r, 5000)); // 5s between individual retries
        }
    }
    const fetchDuration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[LENS] Fetched ${allBars.size}/${INSTRUMENTS.length} instruments in ${fetchDuration}s (${errors.length} errors)`);
    // Compute snapshots for each instrument
    const newSnapshots = new Map();
    // Get SPY closes for relative strength in phase computation
    const spyBars = allBars.get('SPY');
    const spyCloses = spyBars ? spyBars.map(b => b.close) : [];
    for (const inst of INSTRUMENTS) {
        const bars = allBars.get(inst.symbol);
        if (!bars || bars.length < 20)
            continue;
        const dailyCloses = bars.map(b => b.close);
        const weeklyCloses = aggregateToWeekly(bars);
        const monthlyCloses = aggregateToMonthly(bars);
        const daily = classifyTrend(dailyCloses);
        const weekly = weeklyCloses.length >= 50 ? classifyTrend(weeklyCloses) : null;
        const monthly = monthlyCloses.length >= 12 ? classifyTrend(monthlyCloses) : null;
        // Calculate change percentages
        const latestClose = dailyCloses[dailyCloses.length - 1];
        const prevClose = dailyCloses.length >= 2 ? dailyCloses[dailyCloses.length - 2] : latestClose;
        const close30dAgo = dailyCloses.length >= 22 ? dailyCloses[dailyCloses.length - 22] : dailyCloses[0];
        const changePct1d = +((latestClose - prevClose) / prevClose * 100).toFixed(2);
        const changePct30d = +((latestClose - close30dAgo) / close30dAgo * 100).toFixed(2);
        // Compute Smart Money Cycle phase using inflection engine
        // v10.1: Pass previous phase for hysteresis — prevents spurious transitions from minor moves
        const prevPhaseData = previousPhaseMap.get(inst.symbol);
        const phaseData = bars.length >= 50 ? computePhaseForInstrument(bars, spyCloses, prevPhaseData?.phase) : null;
        newSnapshots.set(inst.symbol, {
            symbol: inst.symbol,
            name: inst.name,
            bucket: inst.bucket,
            group: inst.group,
            druckRationale: inst.druckRationale,
            daily,
            weekly,
            monthly,
            changePct1d,
            changePct30d,
            phaseData,
            lastUpdated: new Date().toISOString(),
        });
    }
    // ── STALE DATA PRESERVATION ──
    // If this refresh got significantly fewer instruments than we already have,
    // it was likely a rate-limit failure — keep the previous good data instead of wiping it.
    // Also merge: for any instruments that DID succeed, update them; keep stale data for the rest.
    const previousSize = instrumentSnapshots.size;
    const newSize = newSnapshots.size;
    const MIN_SUCCESS_RATIO = 0.3; // At least 30% must succeed to accept refresh
    if (newSize === 0 && previousSize > 0) {
        console.warn(`[LENS] ⚠ Refresh returned 0 instruments but we have ${previousSize} cached — KEEPING STALE DATA`);
        lensRefreshErrors = errors;
        return; // Don't overwrite anything
    }
    // Detect phase transitions BEFORE overwriting snapshots
    const newTransitions = computePhaseTransitions(newSnapshots, previousPhaseMap);
    if (newTransitions.length > 0) {
        phaseTransitions = newTransitions;
        console.log(`[LENS] ⚡ ${newTransitions.length} phase transition(s) detected: ${newTransitions.map(t => `${t.symbol} P${t.fromPhase}→P${t.toPhase}`).join(', ')}`);
    }
    if (previousSize > 0 && newSize < previousSize * MIN_SUCCESS_RATIO) {
        console.warn(`[LENS] ⚠ Refresh only got ${newSize}/${INSTRUMENTS.length} (had ${previousSize}) — KEEPING STALE + merging updates`);
        // Merge: update what succeeded, keep stale for what didn't
        for (const [symbol, snap] of newSnapshots) {
            instrumentSnapshots.set(symbol, snap);
        }
        lensRefreshErrors = errors;
    }
    else {
        // Normal case: good refresh — replace all data
        // Store current phases as previous for next refresh
        previousPhaseMap = new Map();
        for (const [symbol, snap] of newSnapshots) {
            if (snap.phaseData)
                previousPhaseMap.set(symbol, snap.phaseData);
        }
        instrumentSnapshots = newSnapshots;
    }
    // Compute signals
    previousSignals = currentSignals;
    currentSignals = {
        deathNails: computeDeathNails(newSnapshots),
        leadingGroups: computeLeadingGroups(newSnapshots),
        breadth: computeBreadth(newSnapshots),
        defensivesVsCyclicals: computeDefensivesVsCyclicals(newSnapshots),
        curveCredit: computeCurveCredit(newSnapshots),
        timestamp: new Date().toISOString(),
    };
    // Compute what changed
    whatChanged = computeWhatChanged(currentSignals, previousSignals);
    lensLastRefresh = Date.now();
    lensRefreshErrors = errors;
    // ── Record to Historical Database ──
    try {
        const today = new Date().toISOString().split('T')[0];
        const snapshotRecords = [];
        for (const [symbol, snap] of newSnapshots) {
            const bars = allBars.get(symbol);
            const latestBar = bars && bars.length > 0 ? bars[bars.length - 1] : null;
            snapshotRecords.push({
                symbol,
                date: today,
                open: latestBar?.open || null,
                high: latestBar?.high || null,
                low: latestBar?.low || null,
                close: latestBar?.close || snap.daily.price,
                volume: latestBar?.volume || null,
                changePct1d: snap.changePct1d,
                changePct30d: snap.changePct30d,
                dailyTrend: snap.daily.state,
                weeklyTrend: snap.weekly?.state || null,
                monthlyTrend: snap.monthly?.state || null,
                phaseNum: snap.phaseData?.phaseNum || null,
                phaseShort: snap.phaseData?.phaseShort || null,
                actionBias: snap.phaseData?.actionBias || null,
                confidence: snap.phaseData?.confidence || null,
                overallSignal: snap.phaseData?.overallSignal || null,
                technicalData: {
                    ma50: snap.daily.ma50,
                    ma200: snap.daily.ma200,
                    roc20d: snap.daily.roc20d,
                    slope20d: snap.daily.slope20d,
                },
            });
        }
        if (snapshotRecords.length > 0) {
            (0, history_store_1.recordSnapshotBatch)(snapshotRecords);
        }
        // Record phase transitions
        if (newTransitions.length > 0) {
            const transitionRecords = newTransitions.map(t => {
                const snap = newSnapshots.get(t.symbol);
                return {
                    symbol: t.symbol,
                    date: today,
                    fromPhase: t.fromPhase,
                    toPhase: t.toPhase,
                    fromPhaseShort: t.fromPhaseShort,
                    toPhaseShort: t.toPhaseShort,
                    fromBias: t.fromBias,
                    toBias: t.toBias,
                    biasFlipped: t.biasFlipped,
                    direction: t.direction,
                    severity: t.severity,
                    priceAtTransition: snap?.daily.price || null,
                };
            });
            (0, history_store_1.recordTransitionBatch)(transitionRecords);
        }
        // Update prediction accuracy for older transitions
        (0, history_store_1.updateTransitionOutcomes)();
        console.log(`[HISTORY] Recorded ${snapshotRecords.length} snapshots, ${newTransitions.length} transitions`);
    }
    catch (histErr) {
        console.error(`[HISTORY] Error recording to database: ${histErr?.message}`);
    }
    console.log(`[LENS] ✓ Refresh complete — ${newSnapshots.size} instruments, Death Nails: ${currentSignals.deathNails.count}/3, Leading Groups: ${currentSignals.leadingGroups.healthyCount}H/${currentSignals.leadingGroups.brokenCount}B`);
}
// Auto-refresh on startup with resilient retry loop
// Keeps retrying with escalating delays until we get data
(async () => {
    const STARTUP_RETRIES = 5;
    const RETRY_DELAYS = [5000, 30000, 60000, 120000, 300000]; // 5s, 30s, 1m, 2m, 5m
    for (let attempt = 0; attempt < STARTUP_RETRIES; attempt++) {
        const delay = RETRY_DELAYS[attempt] || 300000;
        if (attempt > 0) {
            console.log(`[LENS] Startup retry ${attempt + 1}/${STARTUP_RETRIES} in ${delay / 1000}s...`);
        }
        await new Promise(r => setTimeout(r, delay));
        try {
            await refreshMorningLens();
            if (instrumentSnapshots.size >= INSTRUMENTS.length * 0.5) {
                console.log(`[LENS] ✓ Startup complete — ${instrumentSnapshots.size} instruments loaded`);
                break;
            }
            console.warn(`[LENS] Startup attempt ${attempt + 1}: only ${instrumentSnapshots.size}/${INSTRUMENTS.length} instruments`);
        }
        catch (err) {
            console.error(`[LENS] Startup attempt ${attempt + 1} error: ${err?.message}`);
        }
    }
})();
// Auto-refresh every 2 hours for intraday recording
// (was 4 hours — reduced to capture more intraday snapshots for historical tracking)
const INTRADAY_REFRESH_MS = 2 * 60 * 60 * 1000; // 2 hours
setInterval(() => {
    refreshMorningLens().catch(err => console.error('[LENS] Auto-refresh error:', err));
}, INTRADAY_REFRESH_MS);
// ─── ARIA NARRATIVE ───
async function generateAriaNarrative(apiKey) {
    if (!currentSignals)
        return 'Signal data not yet available. Please wait for the first data refresh.';
    try {
        const anthropic = new sdk_1.default({ apiKey });
        // Build enriched instrument data with phase information
        const enrichedInstruments = Object.fromEntries(Array.from(instrumentSnapshots.entries()).map(([k, v]) => [k, {
                name: v.name,
                bucket: v.bucket,
                group: v.group,
                dailyState: v.daily.state,
                weeklyState: v.weekly?.state || 'N/A',
                price: v.daily.price,
                ma50: v.daily.ma50,
                ma200: v.daily.ma200,
                roc20d: v.daily.roc20d,
                changePct1d: v.changePct1d,
                changePct30d: v.changePct30d,
                phase: v.phaseData ? {
                    phaseNum: v.phaseData.phaseNum,
                    phaseShort: v.phaseData.phaseShort,
                    actionBias: v.phaseData.actionBias,
                    confidence: v.phaseData.confidence,
                    overallSignal: v.phaseData.overallSignal,
                } : null,
            }]));
        const signalPayload = {
            date: new Date().toISOString().slice(0, 10),
            deathNails: currentSignals.deathNails,
            leadingGroups: currentSignals.leadingGroups,
            breadth: currentSignals.breadth,
            defensivesVsCyclicals: currentSignals.defensivesVsCyclicals,
            curveCredit: currentSignals.curveCredit,
            whatChanged,
            phaseTransitions,
            instruments: enrichedInstruments,
        };
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1200,
            system: `You are Aria, Marcelo's AI research partner at Maredin Wealth Advisors. You write his morning macro brief in his voice: direct, no fluff, no hedging, no bullet lists unless absolutely needed. 400-600 words.

STRUCTURE (follow this order):

1. PHASE TRANSITIONS (if any exist in phaseTransitions array — this is the LEAD):
   Open with any detected phase transitions. These are the most actionable signals. For each, explain the cascade: what moved, why it matters for the portfolio, and what second-order effect to expect. If a bias flipped (BUY→SELL or vice versa), flag it prominently.

2. GEOPOLITICAL-MACRO TRANSMISSION ANALYSIS:
   This is your most important analytical contribution. Look at the data and reason through the macro transmission chains. The key chains to analyze:

   • OIL CHAIN: Oil (CL=F, BZ=F) → inflation expectations → rates (^TNX, ^TYX) → TLT/duration → mortgage rates → XHB/housing → consumer
   • DOLLAR CHAIN: DXY (DX-Y.NYB) → EM stress → commodity repricing → gold/copper → industrial cycle
   • RATES CHAIN: Front-end (^IRX) vs long-end (^TYX) spread → curve shape → bank profitability (KRE) → credit availability → HYG spreads
   • GOLD-OIL-DOLLAR TRIANGLE: Gold (GC=F) vs Oil (CL=F) vs DXY — when gold rises as oil falls, it signals geopolitical risk premium unwinding. When both fall, it signals deflationary pulse.

   Look at what the PRICES are actually telling you about geopolitical events you cannot directly observe. If oil is falling while gold is rising, reason about what that implies (sanctions relief? Iran deal? supply normalization?). If the 30Y yield is diverging from the 5Y, reason about term premium and fiscal concerns vs. policy rate expectations.

   DO NOT fabricate news events. Instead, read the price action and phase data to INFER what macro/geopolitical forces may be at work, and state your inferences as market-implied readings, not facts.

3. DEATH NAILS & LEADING GROUPS: Which are firing/changed? Quick status.

4. BIGGEST TAPE DIVERGENCE: What is the most notable disagreement between instruments?

5. TODAY'S WATCH: One specific thing to monitor.

End with a portfolio implication sentence for Maredin's book. Use only the attached JSON state — do not invent data not in it. If a field is null or stale, say so.`,
            messages: [
                { role: 'user', content: `Generate this morning's brief from the following signal state:\n\n${JSON.stringify(signalPayload, null, 2)}` },
            ],
        });
        const text = response.content
            .filter((b) => b.type === 'text')
            .map((b) => b.text)
            .join('');
        ariaLatestNarrative = text;
        ariaTimestamp = new Date().toISOString();
        return text;
    }
    catch (err) {
        console.error('[ARIA] Narrative generation failed:', err?.message);
        return `Narrative unavailable: ${err?.message || 'Unknown error'}`;
    }
}
// ─── API ENDPOINTS ───
// Morning Lens health / status
router.get('/lens/status', (req, res) => {
    res.json({
        status: currentSignals ? 'ready' : 'loading',
        instrumentCount: instrumentSnapshots.size,
        totalInstruments: INSTRUMENTS.length,
        lastRefresh: lensLastRefresh ? new Date(lensLastRefresh).toISOString() : null,
        errors: lensRefreshErrors,
        deathNailCount: currentSignals?.deathNails.count || 0,
        whatChangedCount: whatChanged.length,
    });
});
// Full signal state
router.get('/lens/signals', (req, res) => {
    if (!currentSignals) {
        return res.status(503).json({ error: 'Data not yet loaded. Please wait for initial refresh.' });
    }
    res.json(currentSignals);
});
// Death Nails detail
router.get('/lens/death-nails', (req, res) => {
    if (!currentSignals)
        return res.status(503).json({ error: 'Loading...' });
    res.json(currentSignals.deathNails);
});
// Leading Groups detail
router.get('/lens/leading-groups', (req, res) => {
    if (!currentSignals)
        return res.status(503).json({ error: 'Loading...' });
    res.json(currentSignals.leadingGroups);
});
// What Changed Since Yesterday
router.get('/lens/what-changed', (req, res) => {
    res.json({
        entries: whatChanged,
        timestamp: currentSignals?.timestamp || null,
    });
});
// Phase Transitions — detected shifts between cycle phases
router.get('/lens/transitions', (req, res) => {
    res.json({
        count: phaseTransitions.length,
        transitions: phaseTransitions,
        lastRefresh: lensLastRefresh ? new Date(lensLastRefresh).toISOString() : null,
    });
});
// All instrument snapshots
router.get('/lens/instruments', (req, res) => {
    const bucket = req.query.bucket;
    let snapshots = Array.from(instrumentSnapshots.values());
    if (bucket) {
        snapshots = snapshots.filter(s => s.bucket === bucket);
    }
    res.json({
        count: snapshots.length,
        instruments: snapshots,
    });
});
// Single instrument detail
router.get('/lens/instruments/:symbol', (req, res) => {
    const symbol = decodeURIComponent(req.params.symbol);
    const snap = instrumentSnapshots.get(symbol);
    if (!snap)
        return res.status(404).json({ error: `Instrument ${symbol} not found` });
    res.json(snap);
});
// Instrument registry (list of all tracked instruments with metadata)
router.get('/lens/registry', (req, res) => {
    res.json({
        count: INSTRUMENTS.length,
        instruments: INSTRUMENTS.map(i => ({
            symbol: i.symbol,
            name: i.name,
            bucket: i.bucket,
            group: i.group,
            druckRationale: i.druckRationale,
            isDeathNail: i.isDeathNail || false,
            isLeadingGroup: i.isLeadingGroup || false,
            hasData: instrumentSnapshots.has(i.symbol),
        })),
    });
});
// Aria morning narrative
router.get('/lens/narrative', async (req, res) => {
    // Return cached narrative if recent (< 4 hours)
    if (ariaLatestNarrative && ariaTimestamp) {
        const age = Date.now() - new Date(ariaTimestamp).getTime();
        if (age < LENS_CACHE_MS) {
            return res.json({ narrative: ariaLatestNarrative, timestamp: ariaTimestamp, cached: true });
        }
    }
    // Need API key
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
        return res.json({
            narrative: 'Aria narrative unavailable — no Anthropic API key configured. Set ANTHROPIC_API_KEY in environment.',
            timestamp: new Date().toISOString(),
            cached: false,
        });
    }
    const text = await generateAriaNarrative(apiKey);
    res.json({ narrative: text, timestamp: ariaTimestamp, cached: false });
});
// Debug endpoint — shows refresh errors, fetch diagnostics, and data health
router.get('/lens/debug', (req, res) => {
    const successRate = INSTRUMENTS.length > 0
        ? ((instrumentSnapshots.size / INSTRUMENTS.length) * 100).toFixed(1)
        : '0';
    const missingSymbols = INSTRUMENTS
        .filter(i => !instrumentSnapshots.has(i.symbol))
        .map(i => i.symbol);
    res.json({
        instrumentCount: instrumentSnapshots.size,
        totalInstruments: INSTRUMENTS.length,
        successRate: `${successRate}%`,
        missingSymbols,
        missingCount: missingSymbols.length,
        lastRefresh: lensLastRefresh ? new Date(lensLastRefresh).toISOString() : null,
        lastRefreshAgo: lensLastRefresh ? `${((Date.now() - lensLastRefresh) / 60000).toFixed(1)} min ago` : null,
        errors: lensRefreshErrors.slice(0, 20),
        errorCount: lensRefreshErrors.length,
        hasSignals: !!currentSignals,
        dataHealth: instrumentSnapshots.size >= INSTRUMENTS.length * 0.9 ? 'HEALTHY'
            : instrumentSnapshots.size >= INSTRUMENTS.length * 0.5 ? 'DEGRADED'
                : instrumentSnapshots.size > 0 ? 'POOR'
                    : 'NO DATA',
    });
});
// Force refresh
router.post('/lens/refresh', async (req, res) => {
    try {
        await refreshMorningLens();
        res.json({ status: 'refreshed', instrumentCount: instrumentSnapshots.size, errors: lensRefreshErrors.slice(0, 5) });
    }
    catch (err) {
        res.status(500).json({ error: err?.message || 'Refresh failed' });
    }
});
exports.default = router;
//# sourceMappingURL=morning-lens.js.map