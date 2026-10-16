/* Headless responsive audit v2: measures horizontal overflow at small viewports.
   Reuses a single page per viewport to avoid Chrome crash-on-close. */
const puppeteer = require('puppeteer-core');

const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const VIEWPORTS = [
  { name: 'small-phone', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const PAGES = [
  { name: 'login', path: '/login' },
  { name: 'qr-ordering', path: '/qr-ordering' },
  { name: 'order-confirmation', path: '/order-confirmation/T1' },
  { name: 'dashboard', path: '/dashboard' },
  { name: 'orders', path: '/orders' },
  { name: 'dinein', path: '/dinein' },
  { name: 'billing', path: '/billing' },
  { name: 'reports', path: '/reports' },
  { name: 'menu', path: '/menu' },
  { name: 'users', path: '/users' },
  { name: 'settings', path: '/settings' },
  { name: 'takeaway', path: '/takeaway' },
  { name: 'qr-management', path: '/qr-management' },
  { name: 'inventory', path: '/inventory' },
  { name: 'attendance', path: '/attendance' },
  { name: 'payroll', path: '/payroll' },
  { name: 'notifications', path: '/notifications' },
  { name: 'staff', path: '/staff' },
];

const FAKE_USER = { id: 1, name: 'Test User', role: 'admin', branch_id: null };

(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
  });

  const results = [];
  for (const vp of VIEWPORTS) {
    let page;
    try {
      page = await browser.newPage();
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.evaluateOnNewDocument((user) => {
        localStorage.setItem('token', 'audit-fake-token');
        localStorage.setItem('user', JSON.stringify(user));
      }, FAKE_USER);
      // Abort external font/css requests so pages settle fast offline
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        if (!req.url().startsWith('http://localhost:3456')) req.abort();
        else req.continue();
      });
    } catch (e) {
      console.log(`FATAL ${vp.name}: ${e.message.slice(0, 120)}`);
      continue;
    }

    for (const pg of PAGES) {
      try {
        await page.goto('http://localhost:3456' + pg.path, {
          waitUntil: 'domcontentloaded',
          timeout: 15000,
        });
        await new Promise((r) => setTimeout(r, 900));
        const audit = await page.evaluate(() => {
          const doc = document.scrollingElement;
          const vw = document.documentElement.clientWidth;
          const overflowers = [];
          const all = document.querySelectorAll('*');
          for (let i = 0; i < all.length && overflowers.length < 6; i++) {
            const el = all[i];
            const r = el.getBoundingClientRect();
            if (
              r.width > vw + 2 &&
              r.right > vw + 2 &&
              el.scrollWidth <= el.clientWidth + 2
            ) {
              const cls = (
                (el.className && el.className.baseVal !== undefined
                  ? el.className.baseVal
                  : el.className) || ''
              )
                .toString()
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 4)
                .join('.');
              overflowers.push(
                `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''} w=${Math.round(r.width)}`
              );
            }
          }
          return { scrollW: doc.scrollWidth, clientW: vw, overflowers };
        });
        results.push({
          viewport: vp.name,
          page: pg.name,
          overflows: audit.scrollW > audit.clientW + 2,
          scrollW: audit.scrollW,
          clientW: audit.clientW,
          culprits: audit.overflowers,
        });
      } catch (e) {
        results.push({ viewport: vp.name, page: pg.name, error: e.message.slice(0, 100) });
      }
    }
    try {
      await page.close();
    } catch (e) {
      /* ignore */
    }
  }
  await browser.close().catch(() => {});

  const bad = results.filter((r) => r.overflows);
  const errs = results.filter((r) => r.error);
  console.log(`checked=${results.length} overflowing=${bad.length} errors=${errs.length}`);
  for (const b of bad) {
    console.log(
      `\n[${b.viewport}] ${b.page}: scrollW=${b.scrollW} > clientW=${b.clientW}\n  ` +
        (b.culprits || []).join('\n  ')
    );
  }
  for (const e of errs.slice(0, 6)) console.log(`[err] ${e.viewport} ${e.page}: ${e.error}`);
})();
