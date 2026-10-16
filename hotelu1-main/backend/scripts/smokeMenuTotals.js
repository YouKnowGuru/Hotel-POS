/**
 * Smoke test: place a QR-payment-first order with known items and verify the
 * server's stored total EXACTLY matches the frontend cart formula:
 *   subtotal - discount% -> +10% service charge -> GST on that sum.
 * Deletes the created order afterwards (admin login), leaving no residue.
 * Usage: node scripts/smokeMenuTotals.js  [baseUrl=http://localhost:3001]
 */
const BASE = process.argv[2] || 'http://localhost:3001';

const round2 = (v) => Math.round(v * 100) / 100;
const cartFormula = (subtotal, taxPercent, discountPercent) => {
  const ad = subtotal * (1 - discountPercent / 100);
  const sc = ad * 0.10;
  const asc = ad + sc;
  const gst = asc * (taxPercent / 100);
  return round2(asc + gst);
};

(async () => {
  const settings = await (await fetch(`${BASE}/api/settings`)).json();
  const taxPercent = Number(settings.taxPercent) || 0;
  const discountPercent = Number(settings.discountPercent) || 0;

  const menu = await (await fetch(`${BASE}/api/menu`)).json();
  const it = menu.find((m) => m.isAvailable !== false && Number(m.price) > 0);
  if (!it) { console.error('FAIL: no available menu item'); process.exit(1); }

  const subtotal = round2(it.price * 3);
  const expectTotal = cartFormula(subtotal, taxPercent, discountPercent);
  const scAmount = round2(subtotal * (1 - discountPercent / 100) * 0.10);
  console.log(`item=${it.id} price=${it.price} x3  subtotal=${subtotal} tax=${taxPercent}% disc=${discountPercent}%`);
  console.log(`EXPECT (cart formula incl. ${scAmount} SC): total=${expectTotal}`);

  const res = await fetch(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      table_name: 'SMOKE_T1',
      type: 'TAKEAWAY',
      payment_first: true,
      payment_method: 'qr',
      items: [{ menuItemId: it.id, name: 'SMOKE_TEST_DELETE_ME', quantity: 3, price: it.price }],
    }),
  });
  const order = await res.json();
  if (!res.ok || !order || !order.id) {
    console.error('FAIL: order not created:', res.status, order?.message);
    process.exit(1);
  }
  console.log(`SERVER order.total=${order.total} subtotal=${order.subtotal} sc=${order.serviceCharge} gst=${order.taxAmount}`);

  // Payment session must charge the same number the guest saw in the cart.
  const sess = await (await fetch(`${BASE}/api/orders/${order.id}/payment-session?tableId=SMOKE_T1`)).json();
  const matchesCart = (sess.total ?? order.total) === expectTotal;
  const fieldsIssued = order.serviceChargePercent === 10 && order.serviceCharge > 0;
  console.log(`payment-session.total=${sess.total} -> ${matchesCart ? 'MATCH' : 'MISMATCH'}`);

  // Cleanup: delete the smoke-test order as admin.
  const login = await fetch(`${BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin' }),
  }).then((r) => r.json());
  if (login?.token) {
    await fetch(`${BASE}/api/orders/${order.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${login.token}` },
    });
    console.log('cleanup: smoke order deleted');
  }

  if (matchesCart && fieldsIssued) {
    console.log('RESULT: PASS — server total now matches cart/service-charge formula');
    process.exit(0);
  }
  console.log('RESULT: FAIL');
  process.exit(1);
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
