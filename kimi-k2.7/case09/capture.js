const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('WebGL') || text.includes('ERROR') || text.includes('warning') || text.includes('Shader')) {
      console.log(`[${msg.type()}] ${text}`);
    }
  });
  page.on('pageerror', err => console.log('PAGE ERROR:', err.message));
  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(7000);
  await page.screenshot({ path: 'preview.png', fullPage: false });
  await browser.close();
})();
