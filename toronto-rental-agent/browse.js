#!/usr/bin/env node
// Headless-Chromium page reader for the property scout.
// Renders a page like a real browser (executes JS, passes basic bot checks
// that block plain HTTP fetchers) and prints readable text + links so the
// agent can consume any listing site without site-specific selectors.
//
// Usage:
//   NODE_PATH=/opt/node22/lib/node_modules node browse.js <url> [--links] [--jsonld] [--screenshot out.png]
//
// HouseSigma (optional): set HS_EMAIL and HS_PASSWORD env vars and pass
// --housesigma-login to authenticate before loading the URL, which unlocks
// listing status (active/sold) and sold-price history on housesigma.com pages.
//
// Requires the session environment's network policy to allow the target
// domains (real-estate sites). If you see ERR_TUNNEL_CONNECTION_FAILED, the
// egress policy is blocking the host — fix it in the Claude Code environment
// settings, not here.

const { chromium } = require('playwright');

const args = process.argv.slice(2);
const url = args.find(a => !a.startsWith('--'));
const flag = f => args.includes(f);
const flagVal = f => { const i = args.indexOf(f); return i >= 0 ? args[i + 1] : null; };

if (!url) { console.error('usage: browse.js <url> [--links] [--jsonld] [--screenshot out.png] [--housesigma-login]'); process.exit(2); }

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    viewport: { width: 1366, height: 900 },
    locale: 'en-CA',
    timezoneId: 'America/Toronto',
  });
  const page = await ctx.newPage();

  try {
    if (flag('--housesigma-login')) {
      const { HS_EMAIL, HS_PASSWORD } = process.env;
      if (!HS_EMAIL || !HS_PASSWORD) throw new Error('--housesigma-login needs HS_EMAIL and HS_PASSWORD env vars');
      await page.goto('https://housesigma.com/web/en/signin', { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForTimeout(2500);
      await page.fill('input[type="email"], input[name="email"]', HS_EMAIL);
      await page.fill('input[type="password"]', HS_PASSWORD);
      await page.click('button[type="submit"]');
      await page.waitForTimeout(4000);
    }

    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(5000); // let SPA content render
    console.log(`URL: ${page.url()}`);
    console.log(`STATUS: ${resp ? resp.status() : 'n/a'}`);
    console.log(`TITLE: ${await page.title()}`);

    if (flag('--jsonld')) {
      const ld = await page.$$eval('script[type="application/ld+json"]', els => els.map(e => e.textContent));
      console.log('\n--- JSON-LD ---');
      ld.forEach(x => console.log(x));
    }

    console.log('\n--- TEXT ---');
    console.log((await page.evaluate(() => document.body.innerText)).slice(0, 30000));

    if (flag('--links')) {
      const links = await page.$$eval('a[href]', as =>
        [...new Set(as.map(a => `${(a.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 90)} -> ${a.href}`))]);
      console.log('\n--- LINKS ---');
      links.slice(0, 400).forEach(l => console.log(l));
    }

    const shot = flagVal('--screenshot');
    if (shot) { await page.screenshot({ path: shot, fullPage: false }); console.log(`\nscreenshot: ${shot}`); }
  } catch (e) {
    console.error(`ERROR: ${e.message.split('\n')[0]}`);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
