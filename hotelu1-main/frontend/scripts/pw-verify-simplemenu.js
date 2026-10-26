const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = 5092;
const API = 'http://localhost:3001';
const TABLE_ID = 'V-TDZ';          // guest-facing label
const TABLE_NAME = `T${TABLE_ID}`; // formatted server-side label

/* Feed the guest page the session/order bookkeeping it normally writes
   after placing an order, then render the QR checkout with an ACTIVE
   order so the order tracker (the code that was crashing) mounts. */
async function seedOrder() {
  const res = await fetch(`${API}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_name: TABLE_NAME,
      type: 'DINE_IN',
      payment_first: true,
      payment_method: 'cash',
      items: [
        { menuItemId: 52, name: 'Lassi', quantity: 1 },
        { menuItemId: 53, name: 'Apple Juice', quantity: 2 },
      ],
    }),
  });
  const data = await res.json().catch(() => null);
  if (res.status === 409) {
    /* Table still occupied from a previous run — reuse that open order. */
    const q = await fetch(`${API}/api/orders?type=DINE_IN&tableId=${encodeURIComponent(TABLE_NAME)}`);
    const list = await q.json().catch(() => []);
    const open = (Array.isArray(list) ? list : []).find(
      (o) => String(o.table_name || '').toUpperCase().includes(TABLE_ID)
    );
    if (open && open.id) return open.id;
    throw new Error('table occupied but no open order found');
  }
  if (!res.ok || !data || !data.id) throw new Error('order create failed: ' + JSON.stringify(data));
  return data.id;
}

(async () => {
  const orderId = await seedOrder();
  console.log('seeded order', orderId);

  const srv = require('http');
  const fs = require('fs');
  const ROOT = path.join(__dirname, '..', 'build');
  const server = srv.createServer((req, res) => {
    let f = path.join(ROOT, req.url.split('?')[0]);
    if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html');
    res.writeHead(200);
    fs.createReadStream(f).pipe(res);
  });
  await new Promise((r) => server.listen(PORT, r));

  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 375, height: 812, isMobile: true });
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push('PAGEERROR: ' + e.message));

  await page.evaluateOnNewDocument(
    (ordersKey, sessionKey, orderId) => {
      localStorage.setItem(sessionKey, 'verify-session-token');
      localStorage.setItem(ordersKey, JSON.stringify([orderId]));
    },
    `qrOrders:${TABLE_NAME}`,
    `qrSession:${TABLE_NAME}`,
    orderId
  );

  const crashedBefore = consoleErrors.some((c) => /before initialization/i.test(c));
  await page.goto(`http://localhost:${PORT}/qr-ordering?tableId=${TABLE_ID}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch((e) => consoleErrors.push('goto: ' + e.message));
  await new Promise((r) => setTimeout(r, 6000));

  const bodyText = await page.evaluate(() => document.body.innerText);
  const crashed = /Something went wrong/i.test(bodyText);
  const trackerShown = bodyText.includes(`Order #${orderId}`);
  console.log(JSON.stringify({
    orderId,
    crashed,
    trackerShown,
    tdzError: consoleErrors.some((c) => /before initialization/i.test(c)),
    sample: bodyText.slice(0, 160).replace(/\n/g, ' | '),
    consoleErrors: consoleErrors.slice(0, 5),
  }, null, 2));

  await page.screenshot({ path: path.join(__dirname, '..', '.pw-shots', 'simplemenu-tracker.png'), fullPage: false });
  await browser.close();
  server.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
