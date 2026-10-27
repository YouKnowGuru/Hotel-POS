/* Mobile responsive audit: loads every admin/waiter/public route at 375x812,
   reports horizontal overflow + offending elements, saves shots.
   Usage: node scripts/pw-audit-mobile.js [admin|waiter|public] [routeFilter] */
const path = require('path');
const fs = require('fs');
const http = require('http');
const puppeteer = require('puppeteer-core');

const PORT = 5090;
const API_PORT = 3001;
const ROOT = path.join(__dirname, '..', 'build');
const SHOTS = path.join(__dirname, '..', '.pw-shots');

const CHROME_CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe',
];

const ROLES = {
  admin: { username: 'admin', password: 'admin' },
  waiter: { username: 'waiter', password: 'pass' },
};

const ADMIN_ROUTES = process.argv[3] ? [process.argv[3]] : [
  '/dashboard', '/orders', '/billing', '/dinein', '/takeaway', '/inventory',
  '/reports', '/qr-management', '/users', '/permissions',
  '/manage-sub-franchises', '/franchise-overview', '/staff', '/settings',
  '/gst-ledger', '/service-charge', '/attendance', '/payroll',
  '/notifications',
];
const WAITER_ROUTES = ['/delivery', '/orders'];
const PUBLIC_ROUTES = process.argv[3] ? [process.argv[3]] : [
  '/', '/order', '/about', '/privacy', '/terms', '/login',
  '/qr-ordering', '/order-confirmation',
];

function serveStatic() {
  const TYPES = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.map': 'application/json',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.webp': 'image/webp',
  };
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(ROOT, url);
      if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = path.join(ROOT, 'index.html');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    });
    srv.listen(PORT, () => resolve(srv));
  });
}

async function apiLogin({ username, password }) {
  const body = JSON.stringify({ username, password });
  return new Promise((resolve, reject) => {
    const req = http.request({
      host: 'localhost', port: API_PORT, path: '/api/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': body.length },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('bad login response: ' + data.slice(0, 200))); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function httpGetHomepage() {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: 'localhost', port: API_PORT, path: '/healthz' }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
  });
}

(async () => {
  const roleArg = process.argv[2] || 'admin';
  const role = ROLES[roleArg] ? roleArg : 'admin';
  const shotPrefix = roleArg;
  const routes = roleArg === 'public' ? PUBLIC_ROUTES : (role === 'waiter' && !process.argv[3] ? WAITER_ROUTES : (roleArg === 'waiter' && process.argv[3] ? [process.argv[3]] : ADMIN_ROUTES));

  // Backend healthy?
  const health = await httpGetHomepage().catch(() => null);
  if (!health) { console.error('FATAL: backend not running on ' + API_PORT); process.exit(2); }

  // Public pages need no login — point them at the real backend for menu data.
  const login = roleArg === 'public' ? { token: null, user: null } : await apiLogin(ROLES[role]);
  if (roleArg !== 'public' && !login.token) { console.error('FATAL: login failed for ' + role + ':', login); process.exit(2); }

  fs.mkdirSync(SHOTS, { recursive: true });

  const exe = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  const browser = await puppeteer.launch({
    executablePath: exe,
    headless: 'new',
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const srv = await serveStatic();
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: false });

  const results = [];
  for (const route of routes) {
    try {
      // Seed storage before app boot: token + user + API override (dev-host only trick).
      await page.goto(`http://localhost:${PORT}/login`, { waitUntil: 'domcontentloaded' });
      await page.evaluate(({ token, user, api }) => {
        try { localStorage.clear(); } catch (e) { /* ignore */ }
        if (token) localStorage.setItem('token', token);
        if (user) localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('apiUrl', api);
      }, { token: login.token, user: login.user, api: `http://localhost:${API_PORT}` });

      await page.goto(`http://localhost:${PORT}${route}`, { waitUntil: 'domcontentloaded' });
      // wait for lazy chunks + data; tolerate sockets that never settle
      await page.waitForNetworkIdle({ idleTime: 900, timeout: 15000 }).catch(() => {});
      await new Promise((r) => setTimeout(r, 700));

      const audit = await page.evaluate(() => {
        const W = window.innerWidth;
        const docW = Math.max(document.documentElement.scrollWidth, document.body ? document.body.scrollWidth : 0);
        const heading = [...document.querySelectorAll('h1,h2,[data-page-heading]')]
          .map((e) => e.textContent.trim())
          .filter(Boolean)
          .slice(0, 3)
          .join(' | ')
          .slice(0, 100);
        const offenders = [];
        if (document.body) {
          const els = document.body.querySelectorAll('*');
          for (let i = 0; i < els.length && offenders.length < 12; i++) {
            const el = els[i];
            const r = el.getBoundingClientRect();
            if (r.width > 0 && (r.right > W + 6 || r.left < -6)) {
              const cs = getComputedStyle(el);
              // fixed drawer translated far left is not an offender
              if (r.left < -6 && r.right < 20) continue;
              offenders.push({
                tag: el.tagName.toLowerCase(),
                cls: String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').slice(0, 90),
                id: el.id || undefined,
                left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
                position: cs.position, overflowX: cs.overflowX,
                causeRight: Math.round(r.right - W),
              });
            }
          }
        }
        return { W, docW, heading, overflowPx: docW - W, offenders };
      });

      const name = route.replace(/\//g, '_').slice(1) || 'root';
      await page.screenshot({ path: path.join(SHOTS, `${shotPrefix}${name}-375.png`), fullPage: false });
      results.push({ route, status: audit.overflowPx > 2 ? 'OVERFLOW' : 'ok', ...audit });
      console.log(`${route}  ->  ${audit.overflowPx > 2 ? 'OVERFLOW +' + audit.overflowPx + 'px' : 'ok'}  [${audit.heading}]${audit.offenders.length ? '  (offenders: ' + audit.offenders.length + ')' : ''}`);
    } catch (e) {
      results.push({ route, status: 'error', error: String(e.message || e) });
      console.log(`${route} -> ERROR: ${e.message || e}`);
    }
  }

  fs.writeFileSync(path.join(SHOTS, `audit-${role}.json`), JSON.stringify(results, null, 2));
  fs.writeFileSync(path.join(SHOTS, `audit-${role}-details.json`), JSON.stringify(results.filter((r) => r.offenders && r.offenders.length), null, 2));
  await browser.close();
  srv.close();
  const bad = results.filter((r) => r.status !== 'ok');
  console.log(`\n${results.length - bad.length} ok, ${bad.length} problem route(s)`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
