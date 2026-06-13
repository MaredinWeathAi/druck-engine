#!/usr/bin/env node
// Generate seed OHLCV data for all instruments from Yahoo Finance
// Run from a machine where Yahoo Finance is not IP-blocked

const fs = require('fs');
const path = require('path');

async function main() {
  const YF = require('./server/node_modules/yahoo-finance2');
  const yf = new YF.default();

  // All unique symbols from INSTRUMENTS array
  const symbols = [...new Set([
    '^TNX','DX-Y.NYB','CL=F','XHB','IYT','XRT','KRE','SMH','ITB',
    'SPY','QQQ','IWM','^VIX','RSP','DIA','MDY',
    'XLK','XLF','XLE','XLV','XLI','XLP','XLY','XLU','XLRE','XLC','XLB',
    'IGV','SKYY','CIBR','BOTZ','XBI','IHI','XPH',
    'KBE','IAI','KIE','XOP','OIH','AMLP',
    'ITA','PAVE','JETS','IBUY','PBJ','VNQ','MORT',
    'ARKK','ICLN','TAN','KWEB',
    'EFA','VWO','EEM','IEMG','VEA','ACWI',
    'VGK','EWG','EWU','EWQ','EWP','EWI','EWL',
    'EWJ','FXI','MCHI','EWY','EWT','INDA','EWA','EWH','THD','EPHE',
    'EWZ','EWW','ECH','ARGT','TUR','RSX','EZA','EWS','QAT','KSA',
    'GC=F','GLD','SI=F','SLV','GDX','GDXJ',
    'BZ=F','NG=F','USO','UNG','URA',
    'HG=F','COPX','LIT','SLX',
    'ZW=F','ZC=F','ZS=F','DBA','MOO','DBC','GSG',
    'EURUSD=X','JPY=X','GBP=X','BTC-USD','ETH-USD','CNY=X','MXN=X',
    '^IRX','^FVX','^TYX',
    'SHY','IEI','IEF','TLH','TLT',
    'HYG','JNK','LQD','BKLN',
    'TIP','STIP','EMB','BNDX','BWX','MBB',
  ])];

  console.log(`Fetching ${symbols.length} instruments...`);

  const endDate = new Date();
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);

  const seed = {};
  let success = 0;
  let failed = 0;

  // Fetch in batches of 3 with 2s delay
  for (let i = 0; i < symbols.length; i += 3) {
    const batch = symbols.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(async (sym) => {
        try {
          const result = await Promise.race([
            yf.chart(sym, { period1: startDate, period2: endDate, interval: '1d' }, { validateResult: false }),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
          ]);
          const quotes = result?.quotes || [];
          if (quotes.length < 20) return { sym, bars: null };
          const bars = quotes
            .filter(q => q.close != null && q.close > 0)
            .map(q => [
              new Date(q.date).toISOString().split('T')[0],
              +(q.open || q.close).toFixed(4),
              +(q.high || q.close).toFixed(4),
              +(q.low || q.close).toFixed(4),
              +q.close.toFixed(4),
              q.volume || 0,
            ]);
          return { sym, bars };
        } catch (e) {
          return { sym, bars: null, err: e.message };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.bars && r.value.bars.length >= 20) {
        seed[r.value.sym] = r.value.bars;
        success++;
        process.stdout.write(`\r  ${success} ok, ${failed} fail (${r.value.sym}: ${r.value.bars.length} bars)`);
      } else {
        failed++;
        const sym = r.status === 'fulfilled' ? r.value.sym : '?';
        const err = r.status === 'fulfilled' ? (r.value.err || 'no data') : r.reason?.message;
        console.log(`\n  SKIP ${sym}: ${(err || '').slice(0, 60)}`);
      }
    }

    // Delay between batches
    if (i + 3 < symbols.length) {
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  console.log(`\n\nDone: ${success} success, ${failed} failed out of ${symbols.length}`);

  // Write compact seed file
  const outPath = path.join(__dirname, 'server', 'data', 'seed-bars.json');
  const json = JSON.stringify(seed);
  fs.writeFileSync(outPath, json);
  const sizeMB = (Buffer.byteLength(json) / 1024 / 1024).toFixed(2);
  console.log(`Seed file: ${outPath} (${sizeMB} MB, ${Object.keys(seed).length} instruments)`);
}

main().catch(e => { console.error(e); process.exit(1); });
