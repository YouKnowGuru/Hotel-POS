/* Verifies the GST + Service-Charge ledgers classify home delivery as
   "Delivery" (not Dine-In): seeds a DELIVERY order, drives both pages,
   checks the type filter + pill, then removes the test order. */
const path = require('path');
const puppeteer = require('puppeteer-core');

const PORT = 5093;
const API = 'http://localhost:3001';
const CUSTOMER = 'Ledger Verify Cust';

async function api(pathname, opts = {}) {
  const res = await fetch(`${API}${pathname}`, opts);
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function seedDeliveryOrder() {
  const login = await api('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  });
  if (login.status !== 200) throw new Error('admin login failed');
  const token = login.data.token;
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  const created = await api('/api/orders', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      table_name: CUSTOMER,
      type: 'DELIVERY',
      customer_name: CUSTOMER,
      customer_phone: '17112233',
      customer_email: 'ledger-verify@example.com',
      delivery_address: 'Verification Lane 1, Thimphu',
      payment_method: 'cash',
      items: [{ menuItemId: 52, name: 'Lassi', quantity: 1 }],
    }),
  });
  if ((created.status < 200 || created.status >= 300) || !created.data || !created.data.id) {
    throw new Error('delivery order create failed: ' + JSON.stringify(created.data).slice(0, 200));
  }
  // Ledgers only list PAID orders (isOrderPaid) — mark it completed.
  const done = await api(`/api/orders/${created.data.id}`, {
    method: 'PUT', headers: auth,
    body: JSON.stringify({ status: 'completed' }),
  });
  if (done.status !== 200) console.warn('could not complete seed order:', done.status);
  return { token, orderId: created.data.id };
}

async function cleanup(orderId, token) {
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  await api(`/api/orders/${orderId}`, {
    method: 'PUT', headers: auth,
    body: JSON.stringify({ status: 'NOT_AVAILABLE' }),
  });
  const del = await api(`/api/orders/${orderId}`, { method: 'DELETE', headers: auth });
  console.log('cleanup order', orderId, 'delete', del.status);
}

(async () => {
  const { token, orderId } = await seedDeliveryOrder();
  console.log('seeded DELIVERY order', orderId);

  const fs = require('fs');
  const http = require('http');
  const ROOT = path.join(__dirname, '..', 'build');
  const server = http.createServer((req, res) => {
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
  await page.setViewport({ width: 1280, height: 900 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  const user = JSON.stringify({ id: 1, name: 'Admin', role: 'admin' });
  await page.evaluateOnNewDocument((t, u) => {
    localStorage.setItem('token', t);
    localStorage.setItem('user', u);
  }, token, user);

  const selectType = async (value) => {
    await page.evaluate((v) => {
      const sels = [...document.querySelectorAll('select')];
      const target = sels.find((s) => [...s.options].some((o) => o.value === 'delivery'));
      if (target) { target.value = v; target.dispatchEvent(new Event('change', { bubbles: true })); }
    }, value);
    await new Promise((r) => setTimeout(r, 900));
  };
  const tableText = () => page.evaluate(() => [...document.querySelectorAll('table tbody tr')].map((r) => r.innerText).join('\n'));

  // ── GST Ledger ──
  await page.goto(`http://localhost:${PORT}/gst-ledger`, { waitUntil: 'networkidle2', timeout: 60000 }).catch((e) => pageErrors.push('goto gst: ' + e.message));
  await new Promise((r) => setTimeout(r, 3500));
  // orders table lives on the "GST Output (Sales)" tab, not the default overview
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.includes('GST Output'));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 1200));
  await selectType('delivery');
  const gstDeliveryRows = await tableText();
  const gstHasDeliveryPill = gstDeliveryRows.includes('Delivery');
  const gstDeliveryRowHasCustomer = gstDeliveryRows.includes(CUSTOMER);
  const gstDineInLeak = gstDeliveryRows.includes('Dine-In');
  await page.screenshot({ path: path.join(__dirname, '..', '.pw-shots', 'gst-delivery-filter.png') });
  await selectType('dine-in');
  const gstDineInRows = await tableText();
  const gstDeliveryLeakIntoDineIn = gstDineInRows.includes(CUSTOMER);

  // ── Service Charge Ledger ──
  await page.goto(`http://localhost:${PORT}/service-charge`, { waitUntil: 'networkidle2', timeout: 60000 }).catch((e) => pageErrors.push('goto sc: ' + e.message));
  await new Promise((r) => setTimeout(r, 3500));
  await selectType('delivery');
  const scDeliveryRows = await tableText();
  const scHasDeliveryPill = scDeliveryRows.includes('Delivery');
  const scDeliveryRowHasCustomer = scDeliveryRows.includes(CUSTOMER);
  await page.screenshot({ path: path.join(__dirname, '..', '.pw-shots', 'sc-delivery-filter.png') });
  await selectType('dine-in');
  const scDineInRows = await tableText();
  const scDeliveryLeakIntoDineIn = scDineInRows.includes(CUSTOMER);

  const result = {
    gst: {
      deliveryFilterShowsOrder: gstDeliveryRowHasCustomer,
      deliveryPillShown: gstHasDeliveryPill,
      deliveryRowNoLongerLabeledDineIn: !gstDineInLeak,
      deliveryExcludedFromDineIn: !gstDeliveryLeakIntoDineIn,
    },
    serviceCharge: {
      deliveryFilterShowsOrder: scDeliveryRowHasCustomer,
      deliveryPillShown: scHasDeliveryPill,
      deliveryExcludedFromDineIn: !scDeliveryLeakIntoDineIn,
    },
    pageErrors: pageErrors.slice(0, 5),
  };
  console.log(JSON.stringify(result, null, 2));

  await browser.close();
  server.close();
  await cleanup(orderId, token);

  const pass =
    result.gst.deliveryFilterShowsOrder && result.gst.deliveryPillShown &&
    result.gst.deliveryRowNoLongerLabeledDineIn && result.gst.deliveryExcludedFromDineIn &&
    result.serviceCharge.deliveryFilterShowsOrder && result.serviceCharge.deliveryPillShown &&
    result.serviceCharge.deliveryExcludedFromDineIn && pageErrors.length === 0;
  console.log(pass ? 'VERIFY PASS' : 'VERIFY FAIL');
  process.exit(pass ? 0 : 1);
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
