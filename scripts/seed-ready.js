const BASE = 'http://localhost:3001';
(async () => {
  const login = await fetch(`${BASE}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'admin', password: 'admin' }) });
  if (!login.ok) { console.error('login failed', login.status); process.exit(1); }
  const { token } = await login.json();
  const auth = (t) => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${t}` });

  const menuRes = await fetch(`${BASE}/api/menu`, { headers: auth(token) });
  const menu = await menuRes.json();
  const items = Array.isArray(menu) ? menu : (menu.items || menu.food_items || []);
  const pick = items.filter(i => i && (i.id || i.item_id || i.productId || i.menuItemId)).slice(0, 2).map((i, idx) => ({ menuItemId: i.id ?? i.productId ?? i.menuItemId, quantity: idx + 1, name: i.name }));
  if (pick.length === 0) { console.error('no menu items found; keys:', JSON.stringify(menu).slice(0, 300)); process.exit(1); }
  console.log('using items:', JSON.stringify(pick));

  const mk = async (body) => {
    const r = await fetch(`${BASE}/api/orders`, { method: 'POST', headers: auth(token), body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) console.error('create failed', r.status, JSON.stringify(d).slice(0, 200));
    return d.id;
  };
  const id1 = await mk({ table_name: 'T7', type: 'DINE_IN', items: pick });
  const id2 = await mk({
    table_name: 'Delivery-Home', type: 'DELIVERY',
    customer_name: 'Karma Wangchuk', customer_phone: '17171717',
    customer_email: 'karma@example.com', delivery_address: 'Changzamtog, Block 4, House 12, Thimphu',
    payment_method: 'cash', items: pick,
  });
  console.log('created orders:', id1, id2);
  for (const id of [id1, id2]) {
    const r = await fetch(`${BASE}/api/orders/${id}`, { method: 'PUT', headers: auth(token), body: JSON.stringify({ status: 'ready' }) });
    console.log('set ready', id, r.status);
  }
})();
