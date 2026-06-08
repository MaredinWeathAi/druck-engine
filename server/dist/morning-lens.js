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
let phaseEntryDates = new Map(); // when each instrument entered its current phase
let phaseTransitions = []; // detected transitions
let currentSignals = null;
let previousSignals = null;
let whatChanged = [];
let ariaLatestNarrative = '';
let ariaTimestamp = '';
let lensLastRefresh = 0;
let lensRefreshErrors = [];
const LENS_CACHE_MS = 4 * 60 * 60 * 1000; // 4 hours
// Yahoo-only symbols: futures (=F), yields (^TNX, ^FVX, ^TYX, ^IRX), FX (=X)
const YAHOO_ONLY_PATTERN = /[=]F$|^\^TNX$|^\^FVX$|^\^TYX$|^\^IRX$|[=]X$/;
async function fetchOHLC(symbol, period = '1y') {
    const isYahooOnly = YAHOO_ONLY_PATTERN.test(symbol);
    const years = period === '5y' ? 5 : period === '2y' ? 2 : 1;
    // ── CHECK PERSISTENT SQLite CACHE (survives deploys) — 6 hour TTL ──
    try {
        const ageMin = (0, history_store_1.getBarCacheAge)(symbol);
        if (ageMin !== null && ageMin < 360) {
            const dbCached = (0, history_store_1.getCachedBars)(symbol);
            if (dbCached && dbCached.bars.length >= 50) {
                return dbCached.bars.map((b) => ({
                    date: new Date(b.date), open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume || 0,
                }));
            }
        }
    }
    catch { }
    // ── TRY GURUFOCUS FIRST for non-Yahoo-only symbols ──
    if (!isYahooOnly) {
        try {
            const gfUrl = `https://api.gurufocus.com/public/user/${GURUFOCUS_API_KEY}/stock/${encodeURIComponent(symbol)}/price`;
            const gfResponse = await fetch(gfUrl);
            if (gfResponse.ok) {
                const gfData = await gfResponse.json();
                if (Array.isArray(gfData) && gfData.length >= 50) {
                    const cutoffDate = new Date();
                    cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
                    const cutoffStr = cutoffDate.toISOString().split('T')[0];
                    const bars = [];
                    for (const entry of gfData) {
                        if (!Array.isArray(entry) || entry.length < 2)
                            continue;
                        const rawDate = entry[0];
                        const price = entry[1];
                        if (!price || price <= 0)
                            continue;
                        const parts = rawDate.split('-');
                        if (parts.length !== 3)
                            continue;
                        const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                        if (isoDate < cutoffStr)
                            continue;
                        bars.push({ date: new Date(isoDate), open: price, high: price, low: price, close: price, volume: 0 });
                    }
                    if (bars.length >= 50) {
                        // Try to enhance with Yahoo OHLCV (non-blocking, 6s timeout)
                        try {
                            const endDate = new Date();
                            const startDate = new Date();
                            startDate.setFullYear(startDate.getFullYear() - years);
                            const yResult = await Promise.race([
                                yahooFinance.chart(symbol, { period1: startDate, period2: endDate, interval: '1d' }, { validateResult: false }),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000)),
                            ]);
                            const yQuotes = yResult?.quotes || [];
                            if (yQuotes.length >= 50) {
                                const volMap = {};
                                for (const q of yQuotes) {
                                    if (q.close && q.date) {
                                        const d = new Date(q.date).toISOString().split('T')[0];
                                        volMap[d] = { o: q.open || q.close, h: q.high || q.close, l: q.low || q.close, v: q.volume || 0 };
                                    }
                                }
                                for (const bar of bars) {
                                    const key = bar.date.toISOString().split('T')[0];
                                    const yData = volMap[key];
                                    if (yData) {
                                        bar.open = yData.o;
                                        bar.high = yData.h;
                                        bar.low = yData.l;
                                        bar.volume = yData.v;
                                    }
                                }
                            }
                        }
                        catch { } // Yahoo enhancement is best-effort
                        // Persist to SQLite for deploy survival
                        try {
                            (0, history_store_1.setCachedBars)(symbol, bars.map(b => ({ date: b.date.toISOString().split('T')[0], open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume })));
                        }
                        catch { }
                        return bars;
                    }
                }
            }
        }
        catch (err) {
            console.warn(`[GF] GuruFocus failed for ${symbol}: ${err?.message}`);
        }
    }
    // ── FALLBACK TO YAHOO (primary for futures/yields/FX, fallback for everything else) ──
    const maxRetries = 4;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setFullYear(startDate.getFullYear() - years);
            const result = await yahooFinance.chart(symbol, {
                period1: startDate,
                period2: endDate,
                interval: '1d',
            }, { validateResult: false });
            const quotes = result?.quotes || result || [];
            if (!quotes || !Array.isArray(quotes) || quotes.length === 0) {
                if (attempt < maxRetries) {
                    const delayMs = attempt * 4000;
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
// ═══════════════════════════════════════════════════════════════════════════
// v12 PHASE SYSTEM — Druckenmiller Trade Cycle
// Phases ordered by the TRADE lifecycle, not the market cycle.
// P1 = where you BUY. P6 = where you WAIT for the next P1.
// This is a confirmation tool — the technicals confirm what the macro suggests.
// Druckenmiller acts 1-2 quarters AHEAD of these readings using macro judgment.
// ═══════════════════════════════════════════════════════════════════════════
const PHASE_NUM_MAP = {
    'SELLING_EXHAUSTION': 1, // P1: BUY — decline stopped, smart money accumulates
    'NARRATIVE_COLLAPSE': 1, // P1: BUY — deep capitulation, max opportunity (merged with P1)
    'NARRATIVE_EXPANSION': 2, // P2: RIDE — trend confirmed, hold and add on dips
    'INSTITUTIONAL_ACCUMULATION': 3, // P3: TRIM — momentum fading, start taking profits
    'BUYING_EXHAUSTION': 4, // P4: EXIT — exhausted or broken, get out
    'NARRATIVE_REVERSAL': 5, // P5: AVOID — confirmed downtrend, no longs
};
const PHASE_SHORT_MAP = {
    'SELLING_EXHAUSTION': 'Buy',
    'NARRATIVE_COLLAPSE': 'Buy',
    'NARRATIVE_EXPANSION': 'Ride',
    'INSTITUTIONAL_ACCUMULATION': 'Trim',
    'BUYING_EXHAUSTION': 'Exit',
    'NARRATIVE_REVERSAL': 'Avoid',
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
        // Track time-in-phase
        if (phaseData) {
            const prevEntry = phaseEntryDates.get(inst.symbol);
            if (!prevEntry || prevEntry.phase !== phaseData.phase) {
                // Phase changed — record new entry date
                phaseEntryDates.set(inst.symbol, { phase: phaseData.phase, enteredDate: new Date().toISOString().split('T')[0] });
            }
            const entry = phaseEntryDates.get(inst.symbol);
            if (entry) {
                phaseData.phaseEnteredDate = entry.enteredDate;
                const entered = new Date(entry.enteredDate);
                const now = new Date();
                phaseData.daysInPhase = Math.floor((now.getTime() - entered.getTime()) / (1000 * 60 * 60 * 24));
            }
        }
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
            if (snap.phaseData) {
                previousPhaseMap.set(symbol, snap.phaseData);
                // Record phase snapshot for long-term tracking
                try {
                    const d = snap.daily || {};
                    const ext = (d.price && d.ma200) ? ((d.price / d.ma200 - 1) * 100) : 0;
                    (0, history_store_1.recordPhaseVerdictSnapshot)(symbol, 'morning_lens', {
                        price: d.price || 0, phaseNum: snap.phaseData.phaseNum, phaseShort: snap.phaseData.phaseShort,
                        verdict: snap.phaseData.actionBias || '', archetype: '',
                        extensionPct: ext, upDownRatio: null, failedBreakdowns: 0,
                        confidence: snap.phaseData.confidence || 0,
                    });
                }
                catch { }
            }
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
    // On startup: also run watchlist analysis after instruments load
    setTimeout(() => {
        runWatchlistMonitor().catch(err => console.error('[WATCHLIST] Startup analysis error:', err));
    }, 45000); // 45s after startup — instruments should be loaded by then
})();
// ─── WATCHLIST MONITOR — extracted as a reusable function ───
// Uses the full ticker analysis endpoint internally for proper verdicts + sizing
async function runWatchlistMonitor() {
    const watchlistItems = (0, history_store_1.getWatchlist)();
    if (watchlistItems.length === 0)
        return { analyzed: 0, changes: 0, errors: 0 };
    console.log(`[WATCHLIST] Monitoring ${watchlistItems.length} tickers for phase changes...`);
    let analyzed = 0, changes = 0, errors = 0;
    for (const item of watchlistItems) {
        try {
            // Hit the full ticker analysis internally via HTTP to self
            // This ensures we get verdicts, sizing, sub-phases — everything
            const port = process.env.PORT || 3000;
            const url = `http://localhost:${port}/api/lens/ticker/${encodeURIComponent(item.symbol)}`;
            const resp = await fetch(url);
            if (!resp.ok) {
                errors++;
                continue;
            }
            const data = await resp.json();
            if (data.error) {
                errors++;
                continue;
            }
            // updateWatchlistAnalysis is already called inside the ticker endpoint
            // but we need to check for phase changes here
            const oldPhaseNum = item.phase_num;
            const newPhaseNum = data.phase?.phaseNum;
            if (oldPhaseNum && newPhaseNum && oldPhaseNum !== newPhaseNum)
                changes++;
            analyzed++;
        }
        catch (err) {
            errors++;
        }
        await new Promise(r => setTimeout(r, 3000)); // 3s between tickers to avoid rate limiting
    }
    console.log(`[WATCHLIST] Monitor complete — ${analyzed} analyzed, ${changes} phase change(s), ${errors} errors`);
    return { analyzed, changes, errors };
}
// Auto-refresh every 2 hours for intraday recording
const INTRADAY_REFRESH_MS = 2 * 60 * 60 * 1000; // 2 hours
setInterval(() => {
    refreshMorningLens().catch(err => console.error('[LENS] Auto-refresh error:', err));
    // Run watchlist monitoring 60s after main refresh
    setTimeout(() => {
        runWatchlistMonitor().catch(err => console.error('[WATCHLIST] Monitor error:', err));
    }, 60000);
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
// ── Market Regime — phase breadth across all instruments ──
// Purely informational — tells the user "what is the market as a whole doing?"
// Does NOT modify individual phase classifications.
router.get('/lens/regime', (req, res) => {
    const allSnaps = Array.from(instrumentSnapshots.values());
    const withPhase = allSnaps.filter(s => s.phaseData);
    const total = withPhase.length;
    if (total === 0) {
        return res.json({ status: 'loading', message: 'Phase data not yet computed' });
    }
    // Phase counts — overall and by bucket
    const phaseCounts = {};
    const bucketPhases = {};
    const phaseNames = ['NARRATIVE_EXPANSION', 'INSTITUTIONAL_ACCUMULATION', 'BUYING_EXHAUSTION', 'NARRATIVE_REVERSAL', 'SELLING_EXHAUSTION', 'NARRATIVE_COLLAPSE'];
    for (const phase of phaseNames) {
        phaseCounts[phase] = 0;
    }
    for (const snap of withPhase) {
        const phase = snap.phaseData.phase;
        phaseCounts[phase] = (phaseCounts[phase] || 0) + 1;
        if (!bucketPhases[snap.bucket]) {
            bucketPhases[snap.bucket] = {};
            for (const p of phaseNames)
                bucketPhases[snap.bucket][p] = 0;
        }
        bucketPhases[snap.bucket][phase] = (bucketPhases[snap.bucket][phase] || 0) + 1;
    }
    // Compute breadth percentages
    const expansionPct = Math.round(((phaseCounts.NARRATIVE_EXPANSION || 0) / total) * 100);
    const distributionPct = Math.round(((phaseCounts.INSTITUTIONAL_ACCUMULATION || 0) / total) * 100);
    const exhaustionPct = Math.round(((phaseCounts.BUYING_EXHAUSTION || 0) / total) * 100);
    const reversalPct = Math.round(((phaseCounts.NARRATIVE_REVERSAL || 0) / total) * 100);
    const sellExhPct = Math.round(((phaseCounts.SELLING_EXHAUSTION || 0) / total) * 100);
    const collapsePct = Math.round(((phaseCounts.NARRATIVE_COLLAPSE || 0) / total) * 100);
    // Uptrend breadth = P1 + P2 (instruments still above 200d with golden cross)
    const uptrendBreadth = expansionPct + distributionPct;
    // Downtrend breadth = P4 + P5 (confirmed below 200d)
    const downtrendBreadth = reversalPct + sellExhPct;
    // Stress = P3 + P4 (exhaustion + reversal — things breaking)
    const stressBreadth = exhaustionPct + reversalPct;
    // Regime classification
    let regime;
    let regimeDescription;
    if (uptrendBreadth >= 70) {
        regime = 'BROAD_EXPANSION';
        regimeDescription = 'Broad expansion — most instruments in uptrends. Late-cycle risk: crowded positioning, complacency.';
    }
    else if (uptrendBreadth >= 50 && stressBreadth < 25) {
        regime = 'HEALTHY_TREND';
        regimeDescription = 'Healthy trend — majority in uptrends with manageable stress. Selective leadership opportunities.';
    }
    else if (uptrendBreadth >= 40 && stressBreadth >= 25) {
        regime = 'DIVERGENT';
        regimeDescription = 'Divergent market — split between uptrends and stress. Sector selection critical. Be surgical.';
    }
    else if (downtrendBreadth >= 40) {
        regime = 'BROAD_STRESS';
        regimeDescription = 'Broad stress — defensive positioning. Majority below 200d. Focus on capital preservation.';
    }
    else if (sellExhPct + collapsePct >= 30) {
        regime = 'CAPITULATION';
        regimeDescription = 'Capitulation zone — widespread selling exhaustion. Contrarian opportunities forming.';
    }
    else {
        regime = 'TRANSITIONAL';
        regimeDescription = 'Transitional — no dominant regime. Mixed signals. Wait for clarity.';
    }
    // Average confidence across all instruments
    const avgConf = Math.round(withPhase.reduce((sum, s) => sum + (s.phaseData?.confidence || 50), 0) / total);
    // Per-bucket breakdown
    const bucketSummaries = {};
    for (const [bucket, phases] of Object.entries(bucketPhases)) {
        const bucketTotal = Object.values(phases).reduce((a, b) => a + b, 0);
        const bucketUptrend = ((phases.NARRATIVE_EXPANSION || 0) + (phases.INSTITUTIONAL_ACCUMULATION || 0));
        bucketSummaries[bucket] = {
            total: bucketTotal,
            phases,
            uptrendPct: Math.round((bucketUptrend / bucketTotal) * 100),
            dominantPhase: Object.entries(phases).sort((a, b) => b[1] - a[1])[0]?.[0] || 'UNKNOWN',
        };
    }
    res.json({
        regime,
        regimeDescription,
        total,
        phaseCounts,
        breadth: {
            uptrendPct: uptrendBreadth,
            downtrendPct: downtrendBreadth,
            stressPct: stressBreadth,
            expansionPct,
            distributionPct,
            exhaustionPct,
            reversalPct,
            sellingExhaustionPct: sellExhPct,
            collapsePct,
        },
        averageConfidence: avgConf,
        byBucket: bucketSummaries,
        lastRefresh: lensLastRefresh ? new Date(lensLastRefresh).toISOString() : null,
    });
});
// ── Industry Valuations — GuruFocus ETF-level P/E, P/S, forward estimates ──
// Cached daily — fetches from GuruFocus /stock/{ETF}/summary endpoint
const VALUATION_CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
let valuationCache = new Map();
let valuationLastFetch = 0;
// ETFs to fetch valuations for (sector/industry ETFs only — not FX, commodities, bonds)
const VALUATION_ETFS = [
    'XHB', 'SMH', 'XLE', 'XLF', 'XLK', 'XLI', 'XLP', 'XLU', 'XLV', 'XLY', 'XBI', 'KRE',
    'IYT', 'XRT', 'XLC', 'XLB', 'ITA', 'PAVE', 'XOP', 'OIH', 'IGV', 'SKYY', 'CIBR',
    'BOTZ', 'ARKK', 'JETS', 'IAI', 'KBE', 'KIE', 'MORT', 'VNQ', 'XLRE', 'XPH', 'IHI',
    'IBUY', 'PBJ', 'AMLP', 'GDX', 'GDXJ', 'GLD', 'TLT', 'SPY', 'QQQ', 'IWM', 'DIA',
    'EEM', 'EFA', 'EWY', 'EWT', 'EWZ', 'FXI',
];
// Valuation type for cyclical vs growth (determines if valuation amplifies or dampens narrative)
// Based on 20yr empirical study: cyclicals benefit from buying cheap, growth doesn't penalize expensive
const VALUATION_TYPE = {
    XHB: 'cyclical', ITB: 'cyclical', XLE: 'cyclical', XOP: 'cyclical', OIH: 'cyclical',
    XLF: 'cyclical', KRE: 'cyclical', KBE: 'cyclical', KIE: 'cyclical', MORT: 'cyclical',
    IYT: 'cyclical', JETS: 'cyclical', XRT: 'cyclical', IBUY: 'cyclical',
    XLI: 'cyclical', PAVE: 'cyclical', XLB: 'cyclical', ITA: 'cyclical',
    XLY: 'cyclical', XLC: 'cyclical',
    // Growth: expensive keeps working — valuation amplifier dampened
    SMH: 'growth', XLK: 'growth', IGV: 'growth', SKYY: 'growth', CIBR: 'growth',
    BOTZ: 'growth', ARKK: 'growth', QQQ: 'growth',
    // Neutral
    XLV: 'neutral', XBI: 'neutral', XPH: 'neutral', IHI: 'neutral',
    XLP: 'neutral', PBJ: 'neutral', XLU: 'neutral',
    SPY: 'neutral', DIA: 'neutral', IWM: 'neutral',
};
const GURUFOCUS_API_KEY = process.env.GURUFOCUS_API_KEY || '026d8ee9d10c778c6656d672b5ff1e71:544e1fff1953fece457d6152f3239e74';
async function fetchValuations() {
    if (Date.now() - valuationLastFetch < VALUATION_CACHE_DURATION && valuationCache.size > 0) {
        return; // still fresh
    }
    console.log('[VALUATIONS] Fetching industry valuations from GuruFocus...');
    for (const sym of VALUATION_ETFS) {
        try {
            const url = `https://api.gurufocus.com/public/user/${GURUFOCUS_API_KEY}/stock/${sym}/summary`;
            const response = await fetch(url);
            if (!response.ok)
                continue;
            const data = await response.json();
            const ratios = data?.summary?.ratio || {};
            const peData = ratios['P/E(ttm)'] || {};
            const fpeData = ratios['Forward P/E'] || {};
            const psData = ratios['P/S'] || {};
            const epsGrowth = ratios['EPS Growth (%)'] || {};
            const revGrowth = ratios['Revenue Growth (%)'] || {};
            const fwdEps = ratios['Future 3-5Y EPS without NRI Growth Rate Estimate'] || {};
            const peVal = parseFloat(peData.value) || null;
            const peLow = parseFloat(peData.his?.low) || null;
            const peHigh = parseFloat(peData.his?.high) || null;
            const peMed = parseFloat(peData.his?.med) || null;
            // Compute percentile within historical range
            let pePercentile = null;
            if (peVal !== null && peLow !== null && peHigh !== null && peHigh > peLow) {
                pePercentile = Math.round(((peVal - peLow) / (peHigh - peLow)) * 100);
                pePercentile = Math.max(0, Math.min(100, pePercentile));
            }
            const psVal = parseFloat(psData.value) || null;
            const psLow = parseFloat(psData.his?.low) || null;
            const psHigh = parseFloat(psData.his?.high) || null;
            let psPercentile = null;
            if (psVal !== null && psLow !== null && psHigh !== null && psHigh > psLow) {
                psPercentile = Math.round(((psVal - psLow) / (psHigh - psLow)) * 100);
            }
            valuationCache.set(sym, {
                pe: peVal,
                fwdPe: parseFloat(fpeData.value) || null,
                ps: psVal,
                peLow, peHigh, peMed, pePercentile,
                psLow, psHigh, psPercentile,
                epsGrowth: parseFloat(epsGrowth.value) || null,
                revGrowth: parseFloat(revGrowth.value) || null,
                fwdEpsGrowth: parseFloat(fwdEps.value) || null,
                valType: VALUATION_TYPE[sym] || 'neutral',
                lastUpdated: new Date().toISOString(),
            });
            // Rate limit — 1 request per second
            await new Promise(r => setTimeout(r, 1000));
        }
        catch (err) {
            // Skip silently
        }
    }
    valuationLastFetch = Date.now();
    console.log(`[VALUATIONS] Cached ${valuationCache.size} ETF valuations`);
}
// Fetch on startup (delayed to not block lens refresh)
setTimeout(() => fetchValuations(), 60000);
// Endpoint
router.get('/lens/valuations', async (req, res) => {
    if (valuationCache.size === 0) {
        await fetchValuations();
    }
    const result = {};
    valuationCache.forEach((val, sym) => { result[sym] = val; });
    res.json({
        count: valuationCache.size,
        lastFetch: valuationLastFetch ? new Date(valuationLastFetch).toISOString() : null,
        valuations: result,
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
// ═══════════════════════════════════════════════════════════════════════════
// COMPREHENSIVE TICKER ANALYSIS — Druckenmiller 5-Pillar Framework
// ═══════════════════════════════════════════════════════════════════════════
// 1. Relative Strength vs Sector Peers (ratio charts)
// 2. Price vs Structural Anchors (52wk high, 200d MA)
// 3. Volume Demand Profile (20d up/down volume ratio)
// 4. Earnings Reactions (last 4 quarters, next-day moves)
// 5. Failed Breakdowns (bear traps in past year)
// + Phase classification + Druckenmiller verdict synthesis
// Sector ETF mapping by GICS-like categories
const SECTOR_ETF_MAP = {
    'Technology': { primary: 'XLK', secondary: 'QQQ', name: 'Technology' },
    'Semiconductors': { primary: 'SMH', secondary: 'XLK', name: 'Semiconductors' },
    'Software': { primary: 'IGV', secondary: 'XLK', name: 'Software' },
    'Financials': { primary: 'XLF', secondary: 'KRE', name: 'Financials' },
    'Banks': { primary: 'KRE', secondary: 'XLF', name: 'Regional Banks' },
    'Healthcare': { primary: 'XLV', secondary: 'XBI', name: 'Healthcare' },
    'Biotech': { primary: 'XBI', secondary: 'XLV', name: 'Biotech' },
    'Energy': { primary: 'XLE', secondary: 'XOP', name: 'Energy' },
    'Industrials': { primary: 'XLI', secondary: 'IYT', name: 'Industrials' },
    'Consumer Discretionary': { primary: 'XLY', secondary: 'XRT', name: 'Consumer Discretionary' },
    'Consumer Staples': { primary: 'XLP', secondary: 'PBJ', name: 'Consumer Staples' },
    'Homebuilders': { primary: 'ITB', secondary: 'XHB', name: 'Homebuilders' },
    'Materials': { primary: 'XLB', secondary: 'SLX', name: 'Materials' },
    'Utilities': { primary: 'XLU', secondary: 'XLU', name: 'Utilities' },
    'Real Estate': { primary: 'VNQ', secondary: 'XLRE', name: 'Real Estate' },
    'Communications': { primary: 'XLC', secondary: 'XLC', name: 'Communications' },
    'Airlines': { primary: 'JETS', secondary: 'IYT', name: 'Airlines' },
    'Retail': { primary: 'XRT', secondary: 'XLY', name: 'Retail' },
    'default': { primary: 'SPY', secondary: 'RSP', name: 'Broad Market' },
};
// ═══ TICKER DATA CACHE — prevents hammering Yahoo/GuruFocus ═══
const tickerBarCache = new Map();
const TICKER_CACHE_TTL = 2 * 60 * 60 * 1000; // 2 hours
// Full analysis result cache — stores the complete ticker analysis output
const tickerAnalysisCache = new Map();
async function fetchTickerBars(symbol, years = 2) {
    // Check in-memory cache first — if we have bars less than 2 hours old, use them
    const cached = tickerBarCache.get(symbol);
    if (cached && Date.now() - cached.fetchedAt < TICKER_CACHE_TTL && cached.bars.length >= 50) {
        return cached.bars;
    }
    // Check PERSISTENT SQLite cache (survives deploys) — use if <6 hours old
    try {
        const ageMin = (0, history_store_1.getBarCacheAge)(symbol);
        if (ageMin !== null && ageMin < 360) { // 6 hours
            const dbCached = (0, history_store_1.getCachedBars)(symbol);
            if (dbCached && dbCached.bars.length >= 50) {
                // Hydrate into in-memory cache too
                tickerBarCache.set(symbol, { bars: dbCached.bars, fetchedAt: Date.now() - (ageMin * 60 * 1000) });
                return dbCached.bars;
            }
        }
    }
    catch { }
    // PRIMARY: GuruFocus (never blocks us, reliable, has decades of data)
    try {
        const url = `https://api.gurufocus.com/public/user/${GURUFOCUS_API_KEY}/stock/${encodeURIComponent(symbol)}/price`;
        const response = await fetch(url);
        if (response.ok) {
            const priceData = await response.json();
            if (Array.isArray(priceData) && priceData.length >= 50) {
                const cutoffDate = new Date();
                cutoffDate.setFullYear(cutoffDate.getFullYear() - years);
                const cutoffStr = cutoffDate.toISOString().split('T')[0];
                const bars = [];
                for (const entry of priceData) {
                    if (!Array.isArray(entry) || entry.length < 2)
                        continue;
                    const rawDate = entry[0];
                    const price = entry[1];
                    if (price === null || price === undefined || price <= 0)
                        continue;
                    const parts = rawDate.split('-');
                    if (parts.length !== 3)
                        continue;
                    const isoDate = `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
                    if (isoDate < cutoffStr)
                        continue;
                    bars.push({ date: isoDate, open: price, high: price, low: price, close: price, volume: 0 });
                }
                if (bars.length >= 50) {
                    console.log(`[TICKER] GuruFocus: ${bars.length} bars for ${symbol}`);
                    tickerBarCache.set(symbol, { bars, fetchedAt: Date.now() });
                    (0, history_store_1.setCachedBars)(symbol, bars); // Persist to SQLite for deploy survival
                    // ENHANCE with Yahoo volume data if available (non-blocking)
                    try {
                        const endDate = new Date();
                        const startDate = new Date();
                        startDate.setFullYear(startDate.getFullYear() - years);
                        const yResult = await Promise.race([
                            yahooFinance.chart(symbol, { period1: startDate, period2: endDate, interval: '1d' }, { validateResult: false }),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
                        ]);
                        const yQuotes = yResult?.quotes || [];
                        if (yQuotes.length >= 50) {
                            // Build date→volume map from Yahoo
                            const volMap = {};
                            for (const q of yQuotes) {
                                if (q.close && q.date) {
                                    const d = new Date(q.date).toISOString().split('T')[0];
                                    volMap[d] = { o: q.open || q.close, h: q.high || q.close, l: q.low || q.close, v: q.volume || 0 };
                                }
                            }
                            // Merge volume into GuruFocus bars
                            for (const bar of bars) {
                                const yData = volMap[bar.date];
                                if (yData) {
                                    bar.open = yData.o;
                                    bar.high = yData.h;
                                    bar.low = yData.l;
                                    bar.volume = yData.v;
                                }
                            }
                            console.log(`[TICKER] Enhanced ${symbol} with Yahoo OHLCV data`);
                            tickerBarCache.set(symbol, { bars, fetchedAt: Date.now() });
                            (0, history_store_1.setCachedBars)(symbol, bars); // Persist enhanced version
                        }
                    }
                    catch {
                        // Yahoo enhancement failed — GuruFocus close-only data is still good
                    }
                    return bars;
                }
            }
        }
    }
    catch (err) {
        console.warn(`[TICKER] GuruFocus failed for ${symbol}: ${err?.message}`);
    }
    // FALLBACK: Yahoo Finance only (if GuruFocus fails entirely)
    try {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - years);
        const result = await yahooFinance.chart(symbol, {
            period1: startDate, period2: endDate, interval: '1d',
        }, { validateResult: false });
        const quotes = result?.quotes || [];
        if (quotes.length >= 50) {
            const bars = quotes
                .filter((q) => q.close !== null)
                .map((q) => ({
                date: new Date(q.date).toISOString().split('T')[0],
                open: q.open || q.close, high: q.high || q.close, low: q.low || q.close,
                close: q.close, volume: q.volume || 0,
            }));
            tickerBarCache.set(symbol, { bars, fetchedAt: Date.now() });
            (0, history_store_1.setCachedBars)(symbol, bars); // Persist Yahoo-only bars
            return bars;
        }
    }
    catch { }
    console.error(`[TICKER] Both sources failed for ${symbol}`);
    return [];
}
function computeUpDownVolumeRatio(bars, period = 20) {
    if (bars.length < period)
        return null;
    const recent = bars.slice(-period);
    let upVol = 0, downVol = 0;
    for (let i = 1; i < recent.length; i++) {
        if (recent[i].close >= recent[i - 1].close) {
            upVol += recent[i].volume;
        }
        else {
            downVol += recent[i].volume;
        }
    }
    if (downVol === 0)
        return upVol > 0 ? 2.0 : 1.0;
    return Math.round((upVol / downVol) * 100) / 100;
}
function computeRelativeStrengthSeries(stockBars, benchBars) {
    // Align by date and compute price ratio over time
    const benchMap = {};
    for (const b of benchBars)
        benchMap[b.date] = b.close;
    const dates = [];
    const ratios = [];
    for (const s of stockBars) {
        const benchClose = benchMap[s.date];
        if (benchClose && benchClose > 0) {
            dates.push(s.date);
            ratios.push(Math.round((s.close / benchClose) * 1000) / 1000);
        }
    }
    return { dates, ratios };
}
function findEarningsReactions(bars) {
    // Detect likely earnings dates by finding days with >3x average volume AND >2% move
    if (bars.length < 100)
        return [];
    const avgVol = bars.slice(-252).reduce((s, b) => s + b.volume, 0) / Math.min(bars.length, 252);
    const reactions = [];
    for (let i = 1; i < bars.length; i++) {
        const move = ((bars[i].close - bars[i - 1].close) / bars[i - 1].close) * 100;
        const volSpike = bars[i].volume > avgVol * 3;
        const bigMove = Math.abs(move) > 2;
        if (volSpike && bigMove) {
            // Check it's not too close to a previous detection (at least 45 trading days apart)
            const tooClose = reactions.some(r => i - r.idx < 45);
            if (!tooClose) {
                reactions.push({ date: bars[i].date, move: Math.round(move * 10) / 10, idx: i });
            }
        }
    }
    return reactions.slice(-4).map(r => ({ date: r.date, move: r.move }));
}
// ═══ Druckenmiller 4-Step Decision Matrix ═══
// Step 1: Macro/Liquidity Filter → Step 2: 18-Month Forward Inflection →
// Step 3: Relative Strength → Step 4: Tape Confirmation → VERDICT
// Auto-detect sector ETFs from GuruFocus
async function detectSectorETFs(symbol) {
    try {
        const url = `https://api.gurufocus.com/public/user/${GURUFOCUS_API_KEY}/stock/${symbol}/summary`;
        const response = await fetch(url);
        if (!response.ok)
            return { primary: 'SPY', secondary: 'RSP', sectorName: 'Broad Market' };
        const data = await response.json();
        const general = data?.summary?.general || {};
        const sector = (general.supersector || general.sector || '').toLowerCase();
        const group = (general.group || general.subindustry || '').toLowerCase();
        // Match by keywords
        if (group.includes('homebuilder') || group.includes('residential construction'))
            return { primary: 'ITB', secondary: 'XHB', sectorName: 'Homebuilders' };
        if (group.includes('semiconductor') || group.includes('chip'))
            return { primary: 'SMH', secondary: 'XLK', sectorName: 'Semiconductors' };
        if (group.includes('software') || group.includes('saas'))
            return { primary: 'IGV', secondary: 'XLK', sectorName: 'Software' };
        if (group.includes('airline'))
            return { primary: 'JETS', secondary: 'IYT', sectorName: 'Airlines' };
        if (group.includes('bank') || group.includes('savings') || group.includes('lending'))
            return { primary: 'KRE', secondary: 'XLF', sectorName: 'Banks' };
        if (group.includes('biotech') || group.includes('pharma'))
            return { primary: 'XBI', secondary: 'XLV', sectorName: 'Biotech/Pharma' };
        if (group.includes('insurance'))
            return { primary: 'KIE', secondary: 'XLF', sectorName: 'Insurance' };
        if (group.includes('oil') || group.includes('gas') || group.includes('energy'))
            return { primary: 'XLE', secondary: 'XOP', sectorName: 'Energy' };
        if (group.includes('retail') || group.includes('store'))
            return { primary: 'XRT', secondary: 'XLY', sectorName: 'Retail' };
        if (group.includes('auto') || group.includes('vehicle'))
            return { primary: 'XLY', secondary: 'SPY', sectorName: 'Consumer Discretionary' };
        if (group.includes('medical') || group.includes('health') || group.includes('hospital'))
            return { primary: 'XLV', secondary: 'IHI', sectorName: 'Healthcare' };
        if (group.includes('transport') || group.includes('railroad') || group.includes('freight'))
            return { primary: 'IYT', secondary: 'XLI', sectorName: 'Transports' };
        if (group.includes('chemical') || group.includes('materials') || group.includes('metal') || group.includes('mining'))
            return { primary: 'XLB', secondary: 'SLX', sectorName: 'Materials' };
        if (group.includes('reit') || group.includes('real estate'))
            return { primary: 'VNQ', secondary: 'XLRE', sectorName: 'Real Estate' };
        if (group.includes('utility') || group.includes('electric') || group.includes('water'))
            return { primary: 'XLU', secondary: 'XLU', sectorName: 'Utilities' };
        if (group.includes('food') || group.includes('beverage') || group.includes('consumer staple'))
            return { primary: 'XLP', secondary: 'PBJ', sectorName: 'Consumer Staples' };
        if (group.includes('aerospace') || group.includes('defense'))
            return { primary: 'ITA', secondary: 'XLI', sectorName: 'Aerospace & Defense' };
        if (group.includes('media') || group.includes('telecom') || group.includes('communication'))
            return { primary: 'XLC', secondary: 'SPY', sectorName: 'Communications' };
        // Fall back to sector level
        if (sector.includes('technology') || sector.includes('tech'))
            return { primary: 'XLK', secondary: 'QQQ', sectorName: 'Technology' };
        if (sector.includes('financial'))
            return { primary: 'XLF', secondary: 'KRE', sectorName: 'Financials' };
        if (sector.includes('health'))
            return { primary: 'XLV', secondary: 'XBI', sectorName: 'Healthcare' };
        if (sector.includes('energy'))
            return { primary: 'XLE', secondary: 'XOP', sectorName: 'Energy' };
        if (sector.includes('industrial'))
            return { primary: 'XLI', secondary: 'IYT', sectorName: 'Industrials' };
        if (sector.includes('consumer') && sector.includes('disc'))
            return { primary: 'XLY', secondary: 'XRT', sectorName: 'Consumer Discretionary' };
        if (sector.includes('consumer') && sector.includes('stap'))
            return { primary: 'XLP', secondary: 'PBJ', sectorName: 'Consumer Staples' };
        if (sector.includes('material'))
            return { primary: 'XLB', secondary: 'SLX', sectorName: 'Materials' };
        if (sector.includes('communication'))
            return { primary: 'XLC', secondary: 'SPY', sectorName: 'Communications' };
        return { primary: 'SPY', secondary: 'RSP', sectorName: general.sector || 'Broad Market' };
    }
    catch {
        return { primary: 'SPY', secondary: 'RSP', sectorName: 'Broad Market' };
    }
}
// ══════════════════════════════════════════════════════════════
// DRUCKENMILLER POSITION SIZING REGIME
// ══════════════════════════════════════════════════════════════
// 4 regimes based on Druckenmiller's actual sizing framework:
//   1. WAIT_AND_SEE — Tracking position only. Coiled tape, no edge.
//   2. BACK_UP_TRUCK — Max concentration. All 3 filters aligned.
//   3. TRIM — Start harvesting. Smart money leaving.
//   4. LIQUIDATE — Total exit. Structural decay confirmed.
//
// This runs PARALLEL to the verdict. The verdict says WHAT to do,
// the sizing regime says HOW MUCH capital to deploy.
// ══════════════════════════════════════════════════════════════
function classifySizingRegime(params) {
    const { upDownRatio, priceVs200d, failedBreakdowns, sma50Above200, daysSinceCross200d, rsSlope, extensionPct, verdict } = params;
    const ud = upDownRatio ?? 1.0;
    const ext = priceVs200d ?? 0;
    const above200 = ext > 0;
    const recentBreakout = above200 && daysSinceCross200d !== null && daysSinceCross200d <= 60;
    // ── REGIME 4: LIQUIDATE ──
    // Deep below declining 200d, clean breakdowns, Up/Down <0.65
    if (!above200 && ext < -15 && ud < 0.65 && failedBreakdowns === 0 && !sma50Above200) {
        const regime = 'LIQUIDATE';
        const conflictsWithVerdict = verdict.includes('ACCUMULATE') || verdict.includes('BUY') || verdict.includes('RIDE');
        return {
            regime,
            label: 'Aggressively sell',
            sizing: 'Total liquidation — exit immediately or short',
            conviction: Math.min(100, Math.round(70 + Math.abs(ext) * 0.5 + (0.65 - ud) * 50)),
            reasoning: `Structural bear market. ${Math.abs(ext).toFixed(0)}% below declining 200d, Up/Down ${ud.toFixed(2)} shows institutions dumping, zero failed breakdowns = no floor. Druckenmiller: "never average down into a structural liquidity drain."`,
            conflictsWithVerdict,
            conflictNote: conflictsWithVerdict ? `WARNING: Verdict says "${verdict}" but sizing says LIQUIDATE. The Up/Down ratio at ${ud.toFixed(2)} is screaming distribution — trust the tape over the thesis.` : '',
        };
    }
    // ── REGIME 2: BACK UP THE TRUCK ──
    // Failed breakdowns + above 200d (or recent breakout) + Up/Down >1.50
    if (failedBreakdowns >= 2 && above200 && ud > 1.50) {
        let conv = 75;
        if (recentBreakout)
            conv += 10; // Fresh breakout = highest conviction
        if (ud > 1.80)
            conv += 8; // Violent accumulation
        if (failedBreakdowns >= 4)
            conv += 5; // Massive floor
        if (sma50Above200)
            conv += 2; // Structure confirmed
        conv = Math.min(100, conv);
        const regime = 'BACK_UP_TRUCK';
        const conflictsWithVerdict = verdict.includes('AVOID') || verdict.includes('TIGHTEN') || verdict.includes('NEUTRAL');
        return {
            regime,
            label: 'Back up the truck',
            sizing: 'Max concentration — top-tier portfolio weight',
            conviction: conv,
            reasoning: `${failedBreakdowns} failed breakdowns built a launching pad. ${recentBreakout ? 'FRESH BREAKOUT above 200d — this is the entry.' : 'Above 200d with structure confirmed.'} Up/Down ${ud.toFixed(2)} = institutions violently accumulating.${sma50Above200 ? ' Golden cross confirms.' : ''} Risk is mathematically defined by the failed breakdown lows.`,
            conflictsWithVerdict,
            conflictNote: conflictsWithVerdict ? `CONFLICT: Verdict says "${verdict}" but all 3 Druckenmiller filters are aligned for max concentration.` : '',
        };
    }
    // Near-truck: has floor + above 200d but volume not quite there yet
    if (failedBreakdowns >= 2 && above200 && ud > 1.30 && ud <= 1.50) {
        const regime = 'BACK_UP_TRUCK';
        return {
            regime,
            label: 'Back up the truck',
            sizing: 'Build to concentrated weight — volume nearly confirmed',
            conviction: Math.min(85, Math.round(60 + (ud - 1.0) * 40 + failedBreakdowns * 2)),
            reasoning: `Floor confirmed (${failedBreakdowns} failed breakdowns), above 200d, but Up/Down at ${ud.toFixed(2)} is not yet at the 1.50 institutional stampede threshold. Building toward full conviction — one more quarter of heavy volume confirms.`,
            conflictsWithVerdict: false,
            conflictNote: '',
        };
    }
    // ── REGIME 3: TRIM ──
    // Above 200d but distribution starting: Up/Down <0.85, OR RS weakening
    const rsWeakening = rsSlope !== null && rsSlope < -0.03; // 3%+ RS degradation over 20d
    const heavyDistribution = ud < 0.65;
    const mildDistribution = ud < 0.85;
    const extended = extensionPct !== null && extensionPct > 15;
    if (above200 && (heavyDistribution || (mildDistribution && rsWeakening) || (mildDistribution && extended))) {
        let conv = 50;
        if (heavyDistribution)
            conv += 25;
        if (rsWeakening)
            conv += 15;
        if (extended)
            conv += 10;
        conv = Math.min(95, conv);
        const regime = 'TRIM';
        const verdictSaysBuy = verdict.includes('ACCUMULATE') || verdict.includes('BUY') || verdict.includes('RIDE');
        const verdictSaysHold = verdict.includes('HOLD') || verdict.includes('TIGHTEN');
        const conflicts = verdictSaysBuy || (heavyDistribution && verdictSaysHold);
        const rsNote = rsWeakening ? ` RS vs sector declining (${((rsSlope ?? 0) * 100).toFixed(1)}% over 20d) — smart money rotating away.` : '';
        let conflictNote = '';
        if (verdictSaysBuy) {
            conflictNote = `CONFLICT: Verdict says "${verdict}" but institutional volume says TRIM. The Up/Down ratio at ${ud.toFixed(2)} is the early warning — smart money is leaving before the story breaks.`;
        }
        else if (heavyDistribution && verdictSaysHold) {
            conflictNote = `ESCALATION: Verdict says "${verdict}" but Up/Down at ${ud.toFixed(2)} is heavy distribution — "hold" understates the urgency. Consider this an active SELL signal, not a passive hold.`;
        }
        return {
            regime,
            label: 'Start trimming',
            sizing: heavyDistribution ? 'Shave 40-50% — distribution is heavy' : 'Shave 25-30% on technical bounces',
            conviction: conv,
            reasoning: `Still above 200d but the tape is deteriorating. Up/Down ${ud.toFixed(2)}${mildDistribution ? ' shows distribution building' : ''}.${rsNote}${extended ? ` Extended ${extensionPct?.toFixed(0)}% from 200d — smart money selling into strength.` : ''} Don't wait for the earnings miss — use bounces to harvest.`,
            conflictsWithVerdict: conflicts,
            conflictNote,
        };
    }
    // Below 200d with distribution but some floor (TSLA-like: not full liquidate but not buy)
    if (!above200 && mildDistribution && failedBreakdowns >= 1) {
        return {
            regime: 'WAIT_AND_SEE',
            label: 'Wait and see',
            sizing: 'Tracking position only — or zero',
            conviction: 30,
            reasoning: `Below 200d with mild distribution (Up/Down ${ud.toFixed(2)}) but ${failedBreakdowns} failed breakdown(s) show some demand floor. Coiled spring or value trap — impossible to tell yet. Keep a tracking position and wait for volume to confirm direction.`,
            conflictsWithVerdict: false,
            conflictNote: '',
        };
    }
    // ── REGIME 1: WAIT AND SEE (DEFAULT) ──
    // Everything else: neutral tape, no strong signal either way
    const nearEquilibrium = ud >= 0.85 && ud <= 1.15;
    const near200d = Math.abs(ext) < 10;
    let conv = 25;
    if (nearEquilibrium && near200d)
        conv = 20; // Classic coil
    if (!nearEquilibrium && !near200d)
        conv = 35; // Has some direction but not enough
    return {
        regime: 'WAIT_AND_SEE',
        label: 'Wait and see',
        sizing: near200d && nearEquilibrium
            ? 'Tracking position only — let the coil resolve'
            : 'Standard baseline allocation — no edge to exploit',
        conviction: conv,
        reasoning: nearEquilibrium && near200d
            ? `Classic Druckenmiller coiled spring. Price near 200d (${ext > 0 ? '+' : ''}${ext.toFixed(1)}%), volume in equilibrium (Up/Down ${ud.toFixed(2)}). Energy building but no breakout yet. Stand perfectly still until the tape breaks one direction.`
            : `Mixed signals. Up/Down ${ud.toFixed(2)}, extension ${ext > 0 ? '+' : ''}${ext.toFixed(1)}% from 200d. Not enough conviction for aggressive sizing in either direction. Hold baseline and wait for clarity.`,
        conflictsWithVerdict: false,
        conflictNote: '',
    };
}
function generateVerdict(upDownRatio, priceVs200d, pctFrom52wHigh, failedBreakdowns, earningsReactions, sma50Above200) {
    const reasoning = [];
    const matrix = {};
    // ── "IS GOOD NEWS / BAD NEWS STILL WORKING?" TEST ──
    // The single most powerful institutional signal. If good news fails to move
    // the stock up, institutions are distributing into the good news.
    // If bad news fails to push it down, institutions are accumulating the fear.
    let newsTest = 'INSUFFICIENT_DATA';
    if (earningsReactions.length >= 2) {
        const last = earningsReactions[earningsReactions.length - 1];
        const prev = earningsReactions[earningsReactions.length - 2];
        const lastPositive = last.move > 0;
        const prevPositive = prev.move > 0;
        const improving = last.move > prev.move;
        if (lastPositive && improving) {
            newsTest = 'GOOD_NEWS_WORKING';
            reasoning.push('News test: Good news IS working — last reaction ' + last.move.toFixed(1) + '% (improving). Institutions are buying the narrative.');
        }
        else if (lastPositive && !improving) {
            newsTest = 'GOOD_NEWS_FADING';
            reasoning.push('News test: Good news is fading — positive but decelerating (' + last.move.toFixed(1) + '% vs prior ' + prev.move.toFixed(1) + '%). Watch for distribution.');
        }
        else if (!lastPositive && !improving) {
            newsTest = 'BAD_NEWS_WORKING';
            reasoning.push('News test: Bad news IS working — reactions getting worse (' + last.move.toFixed(1) + '%). Institutions are selling. No floor yet.');
        }
        else if (!lastPositive && improving) {
            newsTest = 'BAD_NEWS_FAILING';
            reasoning.push('News test: Bad news is FAILING to push lower — reaction improved to ' + last.move.toFixed(1) + '% from ' + prev.move.toFixed(1) + '%. Selling exhaustion forming.');
        }
    }
    else if (earningsReactions.length === 1) {
        const last = earningsReactions[0];
        newsTest = last.move > 3 ? 'GOOD_NEWS_WORKING' : last.move < -3 ? 'BAD_NEWS_WORKING' : 'NEUTRAL';
        reasoning.push('News test: Single reaction ' + last.move.toFixed(1) + '% — need more data for pattern.');
    }
    matrix['news_test'] = newsTest;
    // ── STEP 4: Tape Confirmation (scored from the data) ──
    // Step 1-3 (Macro, Forward Inflection, Relative Strength) require
    // fundamental data we don't have in this technical-only analysis.
    // We note this honestly and score what we CAN see.
    let tapeScore = 0; // -10 to +10
    // 200d MA position — THE primary structural anchor
    if (priceVs200d !== null) {
        if (priceVs200d > 15) {
            tapeScore += 2;
            matrix['200d_stance'] = 'ABOVE_STRONG';
            reasoning.push('Comfortably above ascending 200d (' + priceVs200d.toFixed(0) + '%) — structural uptrend confirmed');
        }
        else if (priceVs200d > 0) {
            tapeScore += 1;
            matrix['200d_stance'] = 'ABOVE';
            reasoning.push('Above 200d (' + priceVs200d.toFixed(1) + '%) — structure intact');
        }
        else if (priceVs200d > -5) {
            tapeScore -= 1;
            matrix['200d_stance'] = 'TESTING';
            reasoning.push('Testing 200d from below (' + priceVs200d.toFixed(1) + '%) — at structural decision point');
        }
        else if (priceVs200d > -20) {
            tapeScore -= 2;
            matrix['200d_stance'] = 'BELOW';
            reasoning.push('Below declining 200d (' + priceVs200d.toFixed(0) + '%) — broken structure');
        }
        else {
            tapeScore -= 3;
            matrix['200d_stance'] = 'DEEP_BELOW';
            reasoning.push('Deeply below 200d (' + priceVs200d.toFixed(0) + '%) — structural bear market. Druckenmiller: "immediate pass on the long side"');
        }
    }
    // Up/Down Volume Ratio — institutional demand footprint
    if (upDownRatio !== null) {
        if (upDownRatio > 1.5) {
            tapeScore += 3;
            matrix['volume_demand'] = 'HEAVY_ACCUMULATION';
            reasoning.push('Violent institutional accumulation (Up/Down: ' + upDownRatio.toFixed(2) + '). Large funds chasing higher, absorbing all available liquidity');
        }
        else if (upDownRatio > 1.1) {
            tapeScore += 1;
            matrix['volume_demand'] = 'MILD_BUYING';
            reasoning.push('Mild buying pressure (Up/Down: ' + upDownRatio.toFixed(2) + ')');
        }
        else if (upDownRatio < 0.7) {
            tapeScore -= 3;
            matrix['volume_demand'] = 'HEAVY_DISTRIBUTION';
            reasoning.push('Systematic institutional distribution (Up/Down: ' + upDownRatio.toFixed(2) + '). Institutions dumping blocks into any minor bounce');
        }
        else if (upDownRatio < 0.9) {
            tapeScore -= 1;
            matrix['volume_demand'] = 'MILD_DISTRIBUTION';
            reasoning.push('Mild selling pressure (Up/Down: ' + upDownRatio.toFixed(2) + '). Capital in "wait-and-see" mode');
        }
        else {
            matrix['volume_demand'] = 'EQUILIBRIUM';
            reasoning.push('Volume in equilibrium (Up/Down: ' + upDownRatio.toFixed(2) + '). No dominant institutional direction');
        }
    }
    // Failed Breakdowns — THE most explosive bullish pattern
    if (failedBreakdowns >= 3) {
        tapeScore += 3;
        matrix['failed_breakdowns'] = 'STRONG_FLOOR';
        reasoning.push(failedBreakdowns + ' failed breakdowns — massive structural launching pad. Late-coming shorts trapped repeatedly. Druckenmiller: "the single most explosive technical pattern"');
    }
    else if (failedBreakdowns >= 2) {
        tapeScore += 2;
        matrix['failed_breakdowns'] = 'FLOOR_BUILDING';
        reasoning.push(failedBreakdowns + ' failed breakdowns — support tested and defended. Institutional value buyers have drawn a line in the sand');
    }
    else if (failedBreakdowns >= 1) {
        tapeScore += 1;
        matrix['failed_breakdowns'] = 'SOME_DEFENSE';
        reasoning.push(failedBreakdowns + ' failed breakdown — some demand surfaced at the lows');
    }
    else {
        tapeScore -= 1;
        matrix['failed_breakdowns'] = 'NO_DEFENSE';
        reasoning.push('No failed breakdowns detected — supports either broke clean through or remain untested. No hidden institutional demand');
    }
    // MA structure
    if (sma50Above200) {
        tapeScore += 1;
        matrix['ma_structure'] = 'GOLDEN_CROSS';
        reasoning.push('Golden cross intact — 50d above 200d, bullish institutional positioning');
    }
    else {
        tapeScore -= 1;
        matrix['ma_structure'] = 'DEATH_CROSS';
        reasoning.push('Death cross — 50d below 200d. Druckenmiller: "won\'t fight the tape when structural anchors break"');
    }
    // Earnings trajectory — the forward inflection proxy
    if (earningsReactions.length >= 2) {
        const lastTwo = earningsReactions.slice(-2);
        const improving = lastTwo[1].move > lastTwo[0].move;
        const lastPositive = lastTwo[1].move > 0;
        const lastBig = Math.abs(lastTwo[1].move) > 8;
        if (improving && lastPositive && lastBig) {
            tapeScore += 2;
            matrix['earnings'] = 'ACCELERATING_BEATS';
            reasoning.push('Earnings trajectory accelerating — last reaction ' + lastTwo[1].move.toFixed(1) + '% (improving from ' + lastTwo[0].move.toFixed(1) + '%). This is the fundamental inflection Druckenmiller hunts for');
        }
        else if (improving && lastPositive) {
            tapeScore += 1;
            matrix['earnings'] = 'IMPROVING';
            reasoning.push('Earnings reactions improving — last: ' + lastTwo[1].move.toFixed(1) + '% (prior: ' + lastTwo[0].move.toFixed(1) + '%)');
        }
        else if (!improving && !lastPositive && lastBig) {
            tapeScore -= 2;
            matrix['earnings'] = 'DETERIORATING_FAST';
            reasoning.push('Earnings reactions deteriorating sharply — last: ' + lastTwo[1].move.toFixed(1) + '%. Structural degradation in the business model');
        }
        else if (!improving && !lastPositive) {
            tapeScore -= 1;
            matrix['earnings'] = 'DETERIORATING';
            reasoning.push('Earnings reactions negative and worsening — last: ' + lastTwo[1].move.toFixed(1) + '%');
        }
        else {
            matrix['earnings'] = 'MIXED';
            reasoning.push('Mixed earnings reactions — last: ' + lastTwo[1].move.toFixed(1) + '%');
        }
    }
    // 52-week context
    if (pctFrom52wHigh !== null) {
        if (pctFrom52wHigh > -10) {
            reasoning.push('Near 52-week highs (' + pctFrom52wHigh.toFixed(0) + '%) — strong relative performance');
        }
        else if (pctFrom52wHigh < -40) {
            reasoning.push('Deep drawdown: ' + pctFrom52wHigh.toFixed(0) + '% from 52-week high — either a value trap or a capitulation opportunity');
        }
    }
    // ── ARCHETYPE CLASSIFICATION ──
    // Based on the combination of signals, classify into Druckenmiller's 3 archetypes
    let archetype;
    let verdict;
    let signal;
    const below200 = priceVs200d !== null && priceVs200d < 0;
    const deepBelow = priceVs200d !== null && priceVs200d < -20;
    const distributing = upDownRatio !== null && upDownRatio < 0.8;
    const accumulating = upDownRatio !== null && upDownRatio > 1.3;
    const hasFloor = failedBreakdowns >= 2;
    const earningsImproving = earningsReactions.length >= 2 && earningsReactions[earningsReactions.length - 1].move > earningsReactions[earningsReactions.length - 2].move;
    if (below200 && distributing && !hasFloor) {
        // CATEGORY A: Broken Growth Story
        archetype = 'BROKEN_GROWTH';
        verdict = 'STRONG AVOID / SHORT CANDIDATE';
        signal = 'Broken growth story. Below 200d, institutional distribution, clean breakdowns with zero defense. Druckenmiller: "The path of least resistance is strictly downward. Never buy a stock just because it looks cheap relative to its past highs."';
    }
    else if (below200 && distributing && hasFloor) {
        archetype = 'CAPITULATION_FORMING';
        verdict = 'WATCH — FLOOR BUILDING';
        signal = 'Distribution still active but failed breakdowns show demand forming at the lows. The selling may be exhausting. Watch for volume ratio to flip above 1.0 before entering.';
    }
    else if (hasFloor && accumulating && (earningsImproving || !below200)) {
        // CATEGORY B or C: Event-Driven Over-Correction or Structural Turnaround
        if (below200 && earningsImproving) {
            archetype = 'EVENT_OVERCORRECTION';
            verdict = 'BUY AGGRESSIVELY';
            signal = 'Market panicked and priced in a permanent disaster over a temporary headwind. Failed breakdowns prove selling has dried up, institutions are scrambling to accumulate a heavily mispriced asset.';
        }
        else {
            archetype = 'STRUCTURAL_TURNAROUND';
            verdict = 'ACCUMULATE ON DIPS';
            signal = 'Multi-quarter operational decay has officially stopped. Margin expansion beginning to outpace expectations. Chart has transitioned from ugly to beautiful. The wind is at your back.';
        }
    }
    else if (!below200 && sma50Above200 && accumulating) {
        archetype = 'CONFIRMED_UPTREND';
        verdict = 'RIDE — ADD ON PULLBACKS';
        signal = 'Structural uptrend with institutional confirmation. Above 200d, golden cross, accumulation volume. Add on pullbacks to the 50d MA.';
    }
    else if (!below200 && sma50Above200 && !accumulating) {
        archetype = 'LATE_CYCLE';
        verdict = 'HOLD — TIGHTEN STOPS';
        signal = 'Structure intact but volume demand fading. Smart money may be distributing into strength. Tighten stops, don\'t add.';
    }
    else if (below200 && hasFloor && earningsImproving) {
        archetype = 'COILED_SPRING';
        verdict = 'WATCH FOR BREAKOUT';
        signal = 'Coiled at structural decision point. Failed breakdowns + improving earnings = energy building. If tape breaks above 200d on heavy volume, scale in aggressively.';
    }
    else if (tapeScore >= 4) {
        archetype = 'BULLISH_TAPE';
        verdict = 'ACCUMULATE';
        signal = 'Multiple bullish tape signals firing. Structure supports a long position.';
    }
    else if (tapeScore <= -4) {
        archetype = 'BEARISH_TAPE';
        verdict = 'AVOID';
        signal = 'Multiple bearish tape signals. Structure broken or deteriorating. Wait for selling exhaustion before considering entry.';
    }
    else {
        archetype = 'NEUTRAL';
        verdict = 'NEUTRAL — WAIT FOR CLARITY';
        signal = 'No dominant signal. The tape is not confirming either direction. Wait for a structural break before committing capital.';
    }
    // ── SUB-PHASE DETERMINATION ──
    // P1 Buy sub-phases: Early Discovery, Selling Exhaustion, Early Accumulation
    // P2 Ride sub-phases: Early Expansion, Mature Leadership
    let subPhase = '';
    const deepBelow40 = pctFrom52wHigh !== null && pctFrom52wHigh < -40;
    const nearHigh = pctFrom52wHigh !== null && pctFrom52wHigh > -10;
    if (archetype === 'EVENT_OVERCORRECTION' || archetype === 'CAPITULATION_FORMING') {
        // P1 - Selling Exhaustion: the decline has stopped, pain is priced in
        subPhase = 'Sell Exhaustion';
    }
    else if (archetype === 'STRUCTURAL_TURNAROUND' && below200) {
        // P1 - Early Accumulation: smart money entering, structure not yet repaired
        subPhase = 'Early Accum';
    }
    else if (archetype === 'COILED_SPRING') {
        // P1 - at decision point, could be any P1 sub-phase
        subPhase = 'Coiled Spring';
    }
    else if (archetype === 'STRUCTURAL_TURNAROUND' && !below200) {
        // P2 - Early Expansion: turnaround confirmed, trend just started
        subPhase = 'Early Expansion';
    }
    else if (archetype === 'CONFIRMED_UPTREND' && !nearHigh && accumulating) {
        // P2 - Narrative Expansion: healthy trend with institutional sponsorship
        subPhase = 'Expansion';
    }
    else if (archetype === 'CONFIRMED_UPTREND' && nearHigh) {
        // P2 - Mature Leadership: near highs, trend is old
        subPhase = 'Mature';
    }
    else if (archetype === 'LATE_CYCLE') {
        subPhase = 'Late Cycle';
    }
    else if (archetype === 'BROKEN_GROWTH' && newsTest === 'BAD_NEWS_WORKING') {
        subPhase = 'Distribution';
    }
    else if (archetype === 'BROKEN_GROWTH' && deepBelow40) {
        subPhase = 'Collapse';
    }
    else if (archetype === 'BEARISH_TAPE') {
        subPhase = newsTest === 'BAD_NEWS_FAILING' ? 'Bottoming' : 'Downtrend';
    }
    else if (archetype === 'NEUTRAL') {
        subPhase = 'Neutral';
    }
    // ── INTEGRATE NEWS TEST INTO VERDICT ──
    // News test can upgrade or downgrade the verdict
    if (newsTest === 'BAD_NEWS_FAILING' && (verdict === 'AVOID' || verdict === 'NEUTRAL — WAIT FOR CLARITY')) {
        verdict = 'WATCH — FLOOR BUILDING';
        signal += ' Bad news is failing to push lower — selling exhaustion may be forming.';
        archetype = 'CAPITULATION_FORMING';
        subPhase = 'Sell Exhaustion';
    }
    else if (newsTest === 'GOOD_NEWS_FADING' && (verdict === 'RIDE — ADD ON PULLBACKS' || verdict === 'HOLD — TIGHTEN STOPS')) {
        verdict = 'HOLD — TIGHTEN STOPS';
        signal += ' Good news is fading — institutions may be distributing into strength.';
        subPhase = 'Late Cycle';
    }
    return { verdict, archetype, signal, reasoning, matrix, subPhase, newsTest };
}
router.get('/lens/ticker/:symbol', async (req, res) => {
    const symbol = decodeURIComponent(req.params.symbol).toUpperCase();
    const forceRefresh = req.query.refresh === 'true';
    // Check analysis cache first (2-hour TTL) — makes repeat requests instant
    if (!forceRefresh) {
        const cachedAnalysis = tickerAnalysisCache.get(symbol);
        if (cachedAnalysis && Date.now() - cachedAnalysis.fetchedAt < TICKER_CACHE_TTL) {
            console.log(`[TICKER] Serving cached analysis for ${symbol} (${Math.round((Date.now() - cachedAnalysis.fetchedAt) / 60000)}m old)`);
            return res.json({ ...cachedAnalysis.data, cached: true });
        }
    }
    try {
        // Fetch stock data + SPY benchmark in parallel
        const [stockBars, spyBars] = await Promise.all([
            fetchTickerBars(symbol, 2),
            fetchTickerBars('SPY', 2),
        ]);
        if (stockBars.length < 50) {
            return res.status(404).json({ error: `Insufficient data for ${symbol} (got ${stockBars.length} bars, need 50+)` });
        }
        // Compute TA
        const spyCloses = spyBars.map(b => b.close);
        const ta = (0, inflection_engine_1.computeExtendedTA)(symbol, symbol, stockBars.map(b => ({
            date: b.date, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume,
        })), spyCloses);
        if (!ta) {
            return res.status(400).json({ error: 'TA computation failed' });
        }
        // Phase classification
        const neutralAccel = { rocAccel: null, logAccelSmooth: null, emaAccel: null, trend: 'neutral', recentSignals: [] };
        const nullFund = { revenueGrowthYoY: null, epsGrowthYoY: null, operatingMargin: null, netMargin: null, roic: null, fcfYield: null, debtToEquity: null, piotroskiFScore: null, currentRatio: null };
        const nullVal = { peForward: null, evToEbitda: null, pegRatio: null, fcfYield: null, pePctile: null, gfValueMargin: null };
        const phaseResult = (0, inflection_engine_1.computeFullInflection)(symbol, symbol, stockBars, spyCloses, neutralAccel, nullFund, nullVal, {});
        // 1. Relative Strength vs sector peers — auto-detect from GuruFocus
        const sectorInfo = await detectSectorETFs(symbol);
        const primaryETF = sectorInfo.primary;
        const secondaryETF = sectorInfo.secondary;
        const sectorName = sectorInfo.sectorName;
        // Fetch peer ETF bars for ratio computation
        const [peer1Bars, peer2Bars] = await Promise.all([
            fetchTickerBars(primaryETF, 2),
            fetchTickerBars(secondaryETF, 2),
        ]);
        const rs1 = computeRelativeStrengthSeries(stockBars, peer1Bars);
        const rs2 = computeRelativeStrengthSeries(stockBars, peer2Bars);
        // 2. Price anchors (already in ta)
        const price = stockBars[stockBars.length - 1].close;
        const pctFrom52wHigh = ta.highLow ? ta.highLow.pctFromHigh : null;
        // 3. Volume demand
        const upDownRatio = computeUpDownVolumeRatio(stockBars, 20);
        // 4. Earnings reactions
        const earningsReactions = findEarningsReactions(stockBars);
        // 5. Failed breakdowns
        const failedBreakdownCount = ta.failedBreaks.filter(b => b.type === 'failed_breakdown').length;
        // Verdict
        const verdict = generateVerdict(upDownRatio, ta.priceVsSma200, pctFrom52wHigh, failedBreakdownCount, earningsReactions, ta.sma50Above200);
        // RS slope for sizing regime: compare current RS to 20 days ago
        let rsSlope = null;
        if (rs1.ratios && rs1.ratios.length >= 20) {
            const current = rs1.ratios[rs1.ratios.length - 1];
            const ago20 = rs1.ratios[rs1.ratios.length - 20];
            if (current && ago20 && ago20 !== 0) {
                rsSlope = (current / ago20) - 1; // positive = strengthening, negative = weakening
            }
        }
        // Druckenmiller Position Sizing Regime
        const sizingRegime = classifySizingRegime({
            upDownRatio,
            priceVs200d: ta.priceVsSma200,
            failedBreakdowns: failedBreakdownCount,
            sma50Above200: ta.sma50Above200,
            daysSinceCross200d: ta.daysSinceCross200d,
            rsSlope,
            extensionPct: ta.priceVsSma200,
            verdict: verdict.verdict,
        });
        // Phase mapping for display
        const phaseDisplayMap = {
            SELLING_EXHAUSTION: { num: 1, short: 'P1 Buy' },
            NARRATIVE_COLLAPSE: { num: 1, short: 'P1 Buy' },
            NARRATIVE_EXPANSION: { num: 2, short: 'P2 Ride' },
            INSTITUTIONAL_ACCUMULATION: { num: 3, short: 'P3 Trim' },
            BUYING_EXHAUSTION: { num: 4, short: 'P4 Exit' },
            NARRATIVE_REVERSAL: { num: 5, short: 'P5 Avoid' },
        };
        const phaseInfo = phaseResult ? phaseDisplayMap[phaseResult.phase.phase] || { num: 0, short: '?' } : null;
        // Build the response and cache it
        const responseData = {
            symbol,
            price: Math.round(price * 100) / 100,
            // Phase
            phase: phaseResult ? {
                phase: phaseResult.phase.phase,
                phaseNum: phaseInfo?.num,
                phaseShort: phaseInfo?.short,
                confidence: phaseResult.phase.confidence,
                actionBias: phaseResult.phase.actionBias,
                description: phaseResult.phase.description,
                transitionSignals: phaseResult.phase.transitionSignals || [],
            } : null,
            // 1. Relative strength ratios
            relativeStrength: {
                primary: { etf: primaryETF, name: sectorName, dates: rs1.dates, ratios: rs1.ratios },
                secondary: { etf: secondaryETF, name: 'Equal Weight', dates: rs2.dates, ratios: rs2.ratios },
            },
            // 2. Structural anchors
            anchors: {
                price,
                high52w: ta.highLow?.high52w || null,
                pctFrom52wHigh: pctFrom52wHigh !== null ? Math.round(pctFrom52wHigh * 10) / 10 : null,
                sma200: ta.sma200,
                priceVs200d: ta.priceVsSma200,
                sma50: ta.sma50,
                sma50Above200: ta.sma50Above200,
            },
            // 3. Volume demand
            volumeDemand: {
                upDownRatio,
                signal: upDownRatio === null ? 'UNKNOWN' :
                    upDownRatio > 1.5 ? 'HEAVY_ACCUMULATION' :
                        upDownRatio > 1.1 ? 'MILD_BUYING' :
                            upDownRatio > 0.9 ? 'EQUILIBRIUM' :
                                upDownRatio > 0.7 ? 'MILD_DISTRIBUTION' : 'HEAVY_DISTRIBUTION',
            },
            // 4. Earnings reactions
            earningsReactions,
            // 5. Failed breakdowns
            failedBreakdowns: {
                count: failedBreakdownCount,
                details: ta.failedBreaks.filter(b => b.type === 'failed_breakdown'),
            },
            // TA details
            ta: {
                rsi14: ta.rsi14,
                macdHistogram: ta.macd?.histogram,
                macdHistSlope: ta.macdHistSlope,
                atrPct: ta.atrPct,
                extensionVelocity: ta.extensionVelocity,
                daysSinceCross200d: ta.daysSinceCross200d,
                goldenCross: ta.goldenCross,
                deathCross: ta.deathCross,
            },
            // Verdict (Druckenmiller 4-Step Matrix)
            verdict,
            // Position Sizing Regime
            sizingRegime,
            sectorDetected: sectorName,
            // Narrative (generated async by Claude API using PortGenie framework)
            narrative: await (async () => {
                const apiKey = process.env.ANTHROPIC_API_KEY || '';
                if (!apiKey)
                    return null;
                try {
                    const anthropic = new sdk_1.default({ apiKey });
                    const dataPayload = JSON.stringify({
                        symbol, price: Math.round(price * 100) / 100,
                        ma50: ta.sma50, ma200: ta.sma200,
                        extension_from_200d: ta.priceVsSma200,
                        golden_cross: ta.sma50Above200,
                        rsi: ta.rsi14 ? Math.round(ta.rsi14) : null,
                        macd_histogram: ta.macd?.histogram,
                        macd_slope: ta.macdHistSlope,
                        up_down_volume_ratio: upDownRatio,
                        failed_breakdowns: failedBreakdownCount,
                        earnings_reactions: earningsReactions.map(e => e.move),
                        pct_from_52w_high: pctFrom52wHigh,
                        sector: sectorName,
                        sector_etf_primary: primaryETF,
                        sector_etf_secondary: secondaryETF,
                        relative_strength_vs_spy: ta.rsVsSpy20d,
                        green_day_vol_ratio: ta.volume?.greenDayVolRatio || null,
                        system_verdict: verdict.verdict,
                        system_archetype: verdict.archetype,
                        system_sub_phase: verdict.subPhase,
                        news_test: verdict.newsTest,
                        sizing_regime: sizingRegime.regime,
                        sizing_conviction: sizingRegime.conviction,
                        sizing_conflicts: sizingRegime.conflictsWithVerdict,
                        atr_pct: ta.atrPct,
                        velocity: ta.extensionVelocity,
                        days_since_200d_cross: ta.daysSinceCross200d,
                    });
                    const msg = await anthropic.messages.create({
                        model: 'claude-sonnet-4-20250514',
                        max_tokens: 800,
                        system: `You are the Druck Engine narrative analyst. You use the Druckenmiller Trade Cycle phase system and the PortGenie expectations framework to analyze stocks.

CORE PRINCIPLE: Markets are expectation-discounting mechanisms. Price moves when Reality ≠ Expectations. You identify inflection points where narrative, expectations, positioning, and fundamentals diverge from price.

DECISION STACK: 1) Current Narrative (what story is the market pricing?), 2) Expectations vs Reality (what's already priced in?), 3) Institutional Positioning (capital flowing toward or away?), 4) Price Behavior (evidence, not opinion).

PHASE SYSTEM — Druckenmiller Trade Cycle (use ONLY these phase names):
  P1 = BUY — Selling exhaustion / capitulation. Decline has stopped, smart money accumulates. Best risk/reward entry.
  P2 = RIDE — Expansion confirmed. Trend healthy. Hold positions, add on dips to 50d. Stop below 200d.
  P3 = TRIM — Momentum fading or extended. Start taking profits into strength. Tighten stops.
  P4 = EXIT — Exhausted, parabolic, or broken structure. Get out. Do not initiate new positions.
  P5 = AVOID — Confirmed downtrend. No longs. Wait for P1 signal before re-entering.

ALWAYS refer to phases as P1 Buy, P2 Ride, P3 Trim, P4 Exit, or P5 Avoid. Never use other phase names.

ARCHETYPES: Broken Growth (P5 Avoid / short candidate), Event-Driven Over-Correction (P1 Buy aggressively), Structural Turnaround (P1-P2 accumulate on dips), Confirmed Uptrend (P2 Ride), Late Cycle (P3 Trim), Coiled Spring (watch for P1 confirmation).

DRUCKENMILLER RULES: "Liquidity drives markets, not earnings." Never fight the tape when structural anchors break. The most explosive pattern is a failed breakdown. Buy when pain is priced in, sell when perfection is priced in. This system is a confirmation tool — Druckenmiller acts 1-2 quarters ahead of what the technicals show.

OUTPUT FORMAT: Write 2-3 concise paragraphs. First paragraph: the macro/narrative read — what story is the market pricing for this stock and is it right? Second paragraph: the tape evidence — what the technicals confirm or deny, referencing the phase (P1-P5) explicitly. Third paragraph: the verdict — what Druckenmiller would do, stated in his voice. Be direct, confident, specific. No hedging. No "could go either way." Take a position. End with the phase classification: "This is a P[X] [Buy/Ride/Trim/Exit/Avoid] setup."

CRITICAL: You only have technical data, not fundamental data. Acknowledge what you can see and what you can't. Note that forward estimate revisions and institutional ownership changes are not available — flag this as a blind spot when relevant.`,
                        messages: [{ role: 'user', content: `Analyze this stock using the PortGenie/Druckenmiller framework. Here is the complete technical dataset:\n\n${dataPayload}` }],
                    });
                    const text = msg.content[0]?.type === 'text' ? msg.content[0].text : null;
                    return text;
                }
                catch (err) {
                    console.error('[NARRATIVE] Claude API error:', err?.message);
                    return null;
                }
            })(),
            // Price history for charting
            priceHistory: {
                dates: stockBars.slice(-252).map(b => b.date),
                closes: stockBars.slice(-252).map(b => b.close),
                volumes: stockBars.slice(-252).map(b => b.volume),
                sma50: stockBars.length >= 50 ? (() => {
                    const c = stockBars.map(b => b.close);
                    const arr = [];
                    for (let i = 0; i < c.length; i++) {
                        if (i < 49) {
                            arr.push(null);
                            continue;
                        }
                        arr.push(c.slice(i - 49, i + 1).reduce((a, b) => a + b, 0) / 50);
                    }
                    return arr.slice(-252);
                })() : [],
                sma200: stockBars.length >= 200 ? (() => {
                    const c = stockBars.map(b => b.close);
                    const arr = [];
                    for (let i = 0; i < c.length; i++) {
                        if (i < 199) {
                            arr.push(null);
                            continue;
                        }
                        arr.push(c.slice(i - 199, i + 1).reduce((a, b) => a + b, 0) / 200);
                    }
                    return arr.slice(-252);
                })() : [],
            },
        };
        // Cache the full analysis result for 2 hours
        tickerAnalysisCache.set(symbol, { data: responseData, fetchedAt: Date.now() });
        // Record phase + verdict to history for long-term tracking
        try {
            const pi = responseData.phase;
            const vi = responseData.verdict;
            if (pi && vi) {
                (0, history_store_1.recordPhaseVerdictSnapshot)(symbol, 'ticker_analysis', {
                    price: responseData.price, phaseNum: pi.phaseNum, phaseShort: pi.phaseShort,
                    verdict: vi.verdict, archetype: vi.archetype,
                    extensionPct: responseData.anchors?.priceVs200d || 0,
                    upDownRatio: responseData.volumeDemand?.upDownRatio || null,
                    failedBreakdowns: responseData.failedBreakdowns?.count || 0,
                    confidence: pi.confidence || 0,
                });
            }
        }
        catch { }
        // Auto-update watchlist if this symbol is on the watchlist
        try {
            const wl = (0, history_store_1.getWatchlist)();
            if (wl.some((w) => w.symbol === symbol.toUpperCase())) {
                (0, history_store_1.updateWatchlistAnalysis)(symbol, responseData);
            }
        }
        catch { }
        res.json(responseData);
    }
    catch (err) {
        res.status(500).json({ error: err?.message || 'Analysis failed' });
    }
});
// ═══ Watchlist API — persistent server-side storage ═══
router.get('/lens/watchlist', (_req, res) => {
    try {
        const items = (0, history_store_1.getWatchlist)();
        res.json({ count: items.length, items });
    }
    catch (err) {
        res.json({ count: 0, items: [], error: err?.message });
    }
});
router.post('/lens/watchlist/add', async (req, res) => {
    const { symbol } = req.body;
    if (!symbol)
        return res.status(400).json({ error: 'Symbol required' });
    (0, history_store_1.addWatchlistTicker)(symbol);
    // Record entry price for performance tracking
    try {
        const bars = await fetchTickerBars(symbol, 1);
        const spyBars = await fetchTickerBars('SPY', 1);
        if (bars.length > 0 && spyBars.length > 0) {
            (0, history_store_1.setWatchlistEntryPrice)(symbol, bars[bars.length - 1].close, spyBars[spyBars.length - 1].close);
        }
    }
    catch { }
    res.json({ ok: true, symbol: symbol.toUpperCase() });
});
router.post('/lens/watchlist/remove', (req, res) => {
    const { symbol } = req.body;
    if (!symbol)
        return res.status(400).json({ error: 'Symbol required' });
    (0, history_store_1.removeWatchlistTicker)(symbol);
    res.json({ ok: true, symbol: symbol.toUpperCase() });
});
router.post('/lens/watchlist/update', (req, res) => {
    const { symbol, data } = req.body;
    if (!symbol || !data)
        return res.status(400).json({ error: 'Symbol and data required' });
    (0, history_store_1.updateWatchlistAnalysis)(symbol, data);
    res.json({ ok: true, symbol: symbol.toUpperCase() });
});
router.get('/lens/watchlist/phase-log', (req, res) => {
    const symbol = req.query.symbol;
    const log = (0, history_store_1.getWatchlistPhaseLog)(symbol);
    res.json({ count: log.length, log });
});
// Phase + Verdict history for accuracy tracking
router.get('/lens/history/phase-verdict', (req, res) => {
    const symbol = req.query.symbol;
    const limit = parseInt(req.query.limit || '100');
    const history = (0, history_store_1.getPhaseVerdictHistory)(symbol, limit);
    res.json({ count: history.length, history });
});
// Foreshadow snapshot history
router.get('/lens/history/foreshadow', (_req, res) => {
    const history = (0, history_store_1.getForeshadowHistory)();
    res.json({ count: history.length, history });
});
// Druckenmiller 13F comparison history
router.get('/lens/history/druckenmiller', (_req, res) => {
    const history = (0, history_store_1.getDruckenmiller13FHistory)();
    res.json({ count: history.length, history });
});
// ══════════════════════════════════════════════════════════════
// AI INTELLIGENCE ANALYSIS — Claude-powered macro briefing
// Replaces Paradigm Watch with a Druckenmiller-style synthesis
// of ALL system data: phases, verdicts, sizing, conflicts,
// watchlist, macro regime, sector rotation, and history.
// ══════════════════════════════════════════════════════════════
router.post('/lens/ai-analysis', async (req, res) => {
    const apiKey = process.env.ANTHROPIC_API_KEY || '';
    if (!apiKey) {
        res.status(400).json({ error: 'No Anthropic API key configured' });
        return;
    }
    const userPrompt = req.body.prompt || '';
    try {
        // ── GATHER ALL SYSTEM DATA ──
        // 1. Phase distribution across all 130+ instruments
        const phaseDistro = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
        const sectorPhases = {};
        const extremeExtensions = [];
        const transitions = [];
        if (instrumentSnapshots) {
            for (const [sym, snap] of Object.entries(instrumentSnapshots)) {
                const s = snap;
                if (!s.phaseData)
                    continue;
                const pn = s.phaseData.phaseNum;
                const pk = `P${pn}`;
                phaseDistro[pk] = (phaseDistro[pk] || 0) + 1;
                const group = s.group || 'Other';
                if (!sectorPhases[group])
                    sectorPhases[group] = { p1: [], p2: [], p5: [] };
                if (pn === 1)
                    sectorPhases[group].p1.push(sym);
                else if (pn === 2)
                    sectorPhases[group].p2.push(sym);
                else if (pn === 5)
                    sectorPhases[group].p5.push(sym);
                const d = s.daily || {};
                const ext = (d.price && d.ma200) ? ((d.price / d.ma200 - 1) * 100) : 0;
                if (Math.abs(ext) > 20) {
                    extremeExtensions.push({ symbol: sym, name: s.name || sym, ext: Math.round(ext * 10) / 10, phase: s.phaseData.phaseShort });
                }
            }
        }
        // 2. Watchlist with full analysis
        const watchlist = (0, history_store_1.getWatchlist)();
        const wlSummary = watchlist.map((w) => ({
            symbol: w.symbol,
            price: w.price,
            phase: w.phase_short,
            verdict: w.verdict,
            archetype: w.archetype,
            sizing: w.sizing_regime,
            sizingConviction: w.sizing_conviction,
            sizingConflict: !!w.sizing_conflicts,
            conflictNote: w.sizing_conflict_note,
            upDownRatio: w.up_down_ratio,
            vs200d: w.price_vs_200d,
            failedBD: w.failed_breakdowns,
        }));
        // 3. Phase change log (recent)
        const phaseLog = (0, history_store_1.getWatchlistPhaseLog)();
        // 4. Historical accuracy data
        const historyRecords = (0, history_store_1.getPhaseVerdictHistory)(undefined, 500);
        const uniqueDates = new Set(historyRecords.map((h) => (h.recorded_at || '').slice(0, 10)));
        // 5. Leading indicators from the index.ts
        // (We'll include what we can from the currentSignals)
        // ── BUILD THE DATA PAYLOAD ──
        const dataPayload = JSON.stringify({
            timestamp: new Date().toISOString(),
            market_phase_distribution: phaseDistro,
            total_instruments: Object.values(phaseDistro).reduce((a, b) => a + b, 0),
            sector_phases: sectorPhases,
            extreme_extensions: extremeExtensions.sort((a, b) => Math.abs(b.ext) - Math.abs(a.ext)).slice(0, 15),
            watchlist: wlSummary,
            recent_phase_changes: phaseLog.slice(0, 20),
            history_depth: { total_records: historyRecords.length, unique_dates: uniqueDates.size },
            user_question: userPrompt || null,
        }, null, 0);
        // ── CALL CLAUDE ──
        const anthropic = new sdk_1.default({ apiKey });
        const msg = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 2000,
            system: `You are the AI Intelligence Analyst inside the Druck Engine — a Druckenmiller-style investment analysis platform. You have real-time access to the system's complete dataset: phase classifications (P1 Buy through P5 Avoid) across 130+ ETFs and indexes, a persistent watchlist with per-ticker verdicts and position sizing regimes, sector rotation data, and historical tracking.

YOUR ROLE: Synthesize all data into a Druckenmiller-caliber intelligence briefing. Think like a macro PM — find the patterns the system's individual signals can't see by themselves.

ANALYSIS FRAMEWORK — address each in order:
1. MARKET REGIME READ: What is the overall market posture? (% in P1/P2 = bullish breadth, % in P4/P5 = bear pressure). Is breadth expanding or contracting?
2. SECTOR ROTATION: Where is capital flowing? Which sectors are P1→P2 (improving) vs P2→P4 (deteriorating)? What does this imply about the macro cycle?
3. SIZING CONFLICTS: Highlight any tickers where the verdict and sizing regime disagree — these are the highest-information signals in the system.
4. WATCHLIST ACTIONS: For each watchlist ticker, give a 1-sentence decision. Be specific: "AAPL: Hold, no edge — wait for UpDn >1.5" not "AAPL looks fine."
5. BIGGEST RISK: What is the single biggest risk the system might be missing? What assumption could break?
6. BIGGEST OPPORTUNITY: Where is the highest asymmetry right now — the Druckenmiller "fat pitch"?

RULES:
- Be brutally honest. Say "I don't know" rather than hedge with "could go either way."
- Reference specific data points (Up/Down ratios, extension %, phase numbers).
- Name names — specific tickers, sectors, sizing regimes.
- If the history depth is <7 days, acknowledge the system can't yet measure its own accuracy.
- End with a 1-paragraph Druckenmiller-voice summary: what would he do right now with this data?
- If the user asked a specific question, answer it directly using the data before doing the full briefing.

FORMAT: Use clear section headers. Write concisely. No filler. No disclaimers.`,
            messages: [{ role: 'user', content: userPrompt
                        ? `User question: "${userPrompt}"\n\nHere is the complete system dataset:\n${dataPayload}`
                        : `Generate a full Druckenmiller intelligence briefing from this real-time system data:\n${dataPayload}`
                }],
        });
        const text = msg.content[0]?.type === 'text' ? msg.content[0].text : 'No response generated';
        res.json({
            analysis: text,
            metadata: {
                generatedAt: new Date().toISOString(),
                instrumentsCovered: Object.values(phaseDistro).reduce((a, b) => a + b, 0),
                watchlistSize: wlSummary.length,
                historyDepth: uniqueDates.size,
                phaseDistro,
                conflicts: wlSummary.filter((w) => w.sizingConflict).length,
            },
        });
    }
    catch (err) {
        console.error('[AI-ANALYSIS] Error:', err?.message);
        res.status(500).json({ error: err?.message || 'Analysis generation failed' });
    }
});
router.get('/lens/model-performance', async (req, res) => {
    try {
        // 1. Phase verdict history — compute forward returns where possible
        const allHistory = (0, history_store_1.getPhaseVerdictHistory)(undefined, 10000);
        const now = new Date();
        const trackingStartDate = allHistory.length > 0 ? allHistory[allHistory.length - 1].recorded_at : null;
        const trackingDays = trackingStartDate ? Math.floor((now.getTime() - new Date(trackingStartDate).getTime()) / (1000 * 60 * 60 * 24)) : 0;
        // Group history by symbol to find earliest recorded price per phase
        const symbolFirstRecord = {};
        for (const h of allHistory) {
            if (!h.symbol || !h.price)
                continue;
            if (!symbolFirstRecord[h.symbol]) {
                symbolFirstRecord[h.symbol] = { price: h.price, phase: h.phase_short || '', verdict: h.verdict || '', date: h.recorded_at, archetype: h.archetype || '' };
            }
        }
        // 2. Current instrument prices for comparison
        const currentPrices = {};
        if (instrumentSnapshots) {
            for (const [sym, snap] of instrumentSnapshots.entries()) {
                const s = snap;
                if (s.daily?.price)
                    currentPrices[sym] = s.daily.price;
            }
        }
        // Get SPY price for benchmark
        const spyPrice = currentPrices['SPY'] || null;
        const spyFirst = symbolFirstRecord['SPY'];
        const spyReturn = (spyPrice && spyFirst) ? ((spyPrice / spyFirst.price - 1) * 100) : null;
        // 3. Compute phase performance vs SPY
        const phasePerf = {};
        for (const [sym, first] of Object.entries(symbolFirstRecord)) {
            const curr = currentPrices[sym];
            if (!curr || !first.price || first.price <= 0)
                continue;
            const ret = (curr / first.price - 1) * 100;
            const phase = first.phase || 'Unknown';
            if (!phasePerf[phase])
                phasePerf[phase] = { returns: [], count: 0 };
            phasePerf[phase].returns.push(ret);
            phasePerf[phase].count++;
        }
        // Compute averages
        const phasePerfSummary = {};
        for (const [phase, data] of Object.entries(phasePerf)) {
            const avg = data.returns.reduce((a, b) => a + b, 0) / data.returns.length;
            phasePerfSummary[phase] = {
                avgReturn: Math.round(avg * 100) / 100,
                count: data.count,
                vsSpyAlpha: spyReturn !== null ? Math.round((avg - spyReturn) * 100) / 100 : null,
            };
        }
        // 4. Watchlist performance
        const watchlist = (0, history_store_1.getWatchlist)();
        const wlPerformance = watchlist.map((w) => {
            const entryPrice = w.entry_price || w.price;
            const entryDate = w.entry_date || w.added_at;
            const spyAtEntry = w.spy_price_at_entry;
            // Get current price — try from recent analysis or from instruments
            const currPrice = currentPrices[w.symbol] || w.price;
            const tickerReturn = (entryPrice && currPrice) ? ((currPrice / entryPrice - 1) * 100) : null;
            const spyReturnSince = (spyAtEntry && spyPrice) ? ((spyPrice / spyAtEntry - 1) * 100) : null;
            const alpha = (tickerReturn !== null && spyReturnSince !== null) ? (tickerReturn - spyReturnSince) : null;
            // Determine if model was correct
            let modelCorrect = null;
            if (tickerReturn !== null && w.verdict) {
                const bullishVerdict = w.verdict.includes('ACCUMULATE') || w.verdict.includes('BUY') || w.verdict.includes('RIDE');
                const bearishVerdict = w.verdict.includes('AVOID') || w.verdict.includes('SHORT') || w.verdict.includes('LIQUIDATE');
                if (bullishVerdict && tickerReturn > 0)
                    modelCorrect = 'CORRECT';
                else if (bullishVerdict && tickerReturn < -5)
                    modelCorrect = 'WRONG';
                else if (bearishVerdict && tickerReturn < 0)
                    modelCorrect = 'CORRECT';
                else if (bearishVerdict && tickerReturn > 5)
                    modelCorrect = 'WRONG';
                else
                    modelCorrect = 'INCONCLUSIVE';
            }
            return {
                symbol: w.symbol,
                entryPrice: entryPrice ? Math.round(entryPrice * 100) / 100 : null,
                entryDate,
                currentPrice: currPrice ? Math.round(currPrice * 100) / 100 : null,
                tickerReturn: tickerReturn !== null ? Math.round(tickerReturn * 100) / 100 : null,
                spyReturn: spyReturnSince !== null ? Math.round(spyReturnSince * 100) / 100 : null,
                alpha: alpha !== null ? Math.round(alpha * 100) / 100 : null,
                verdict: w.verdict,
                archetype: w.archetype,
                sizingRegime: w.sizing_regime,
                phase: w.phase_short,
                modelCorrect,
                daysHeld: entryDate ? Math.floor((now.getTime() - new Date(entryDate).getTime()) / (1000 * 60 * 60 * 24)) : null,
            };
        });
        // Compute watchlist summary
        const wlWithAlpha = wlPerformance.filter((w) => w.alpha !== null);
        const avgAlpha = wlWithAlpha.length > 0 ? wlWithAlpha.reduce((a, b) => a + b.alpha, 0) / wlWithAlpha.length : null;
        const correctCount = wlPerformance.filter((w) => w.modelCorrect === 'CORRECT').length;
        const wrongCount = wlPerformance.filter((w) => w.modelCorrect === 'WRONG').length;
        // 5. Historical performance log
        const perfHistory = (0, history_store_1.getModelPerformanceHistory)(undefined, 50);
        // 6. Sizing regime accuracy from history
        const sizingSignals = {
            BACK_UP_TRUCK: { total: 0, profitable: 0 },
            TRIM: { total: 0, profitable: 0 },
            LIQUIDATE: { total: 0, profitable: 0 },
            WAIT_AND_SEE: { total: 0, profitable: 0 },
        };
        // We can only compute this from watchlist data for now
        for (const w of wlPerformance) {
            if (w.sizingRegime && w.tickerReturn !== null && sizingSignals[w.sizingRegime]) {
                sizingSignals[w.sizingRegime].total++;
                // "Profitable" means different things per regime:
                // TRUCK/WAIT: ticker went up
                // TRIM/LIQUIDATE: avoiding further loss (ticker went down = we were right to trim)
                if (w.sizingRegime === 'BACK_UP_TRUCK' || w.sizingRegime === 'WAIT_AND_SEE') {
                    if (w.tickerReturn > 0)
                        sizingSignals[w.sizingRegime].profitable++;
                }
                else {
                    if (w.tickerReturn < 0)
                        sizingSignals[w.sizingRegime].profitable++;
                }
            }
        }
        res.json({
            trackingStartDate,
            trackingDays,
            totalHistoryRecords: allHistory.length,
            sufficientData: trackingDays >= 30,
            // Current market benchmark
            spyPrice,
            spyReturnSinceTracking: spyReturn !== null ? Math.round(spyReturn * 100) / 100 : null,
            // Phase performance since tracking started
            phasePerformance: phasePerfSummary,
            // Watchlist position performance
            watchlistPerformance: wlPerformance,
            watchlistSummary: {
                totalPositions: wlPerformance.length,
                avgAlpha: avgAlpha !== null ? Math.round(avgAlpha * 100) / 100 : null,
                correctCalls: correctCount,
                wrongCalls: wrongCount,
                inconclusiveCalls: wlPerformance.filter((w) => w.modelCorrect === 'INCONCLUSIVE').length,
                hitRate: (correctCount + wrongCount) > 0 ? Math.round(correctCount / (correctCount + wrongCount) * 100) : null,
            },
            // Sizing regime performance
            sizingPerformance: sizingSignals,
            // Historical logs (for trend charts over time)
            performanceHistory: perfHistory,
            // Periods tracked
            periods: {
                monthly: trackingDays >= 30,
                quarterly: trackingDays >= 90,
                annual: trackingDays >= 365,
            },
        });
    }
    catch (err) {
        res.status(500).json({ error: err?.message || 'Performance computation failed' });
    }
});
exports.default = router;
//# sourceMappingURL=morning-lens.js.map