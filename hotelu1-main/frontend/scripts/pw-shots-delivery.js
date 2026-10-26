const path = require('path'); const fs = require('fs'); const http = require('http');
const puppeteer = require('puppeteer-core');
const ROOT = path.join(__dirname, '..', 'build'); const PORT = 5091; const API = 3001;
const srv = http.createServer((req, res) => { let f = path.join(ROOT, req.url.split('?')[0]); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) f = path.join(ROOT, 'index.html'); res.writeHead(200); fs.createReadStream(f).pipe(res); });
(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const browser = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const login = await fetch(`http://localhost:${API}/api/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'waiter', password: 'pass' }) });
  if (!login.ok) { console.error('waiter login failed', login.status, await login.text()); process.exit(1); }
  const { token } = await login.json();
  // desktop
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(`http://localhost:${PORT}/delivery`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => console.error('goto', e.message));
  await page.evaluate((t) => { localStorage.setItem('token', t); localStorage.setItem('user', JSON.stringify({ id: 2, name: 'Waiter User', role: 'waiter' })); }, token);
  await page.reload({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
  await new Promise(r => setTimeout(r, 2500));
  await page.screenshot({ path: '.pw-shots/delivery-desktop.png', fullPage: false });
  // expand first ticket
  await page.click('button[aria-expanded]');
  await new Promise(r => setTimeout(r, 700));
  await page.screenshot({ path: '.pw-shots/delivery-expanded.png' });
  // mobile expanded + scrolled to cards
  await page.setViewport({ width: 375, height: 812, isMobile: true, hasTouch: true });
  await new Promise(r => setTimeout(r, 1200));
  await page.screenshot({ path: '.pw-shots/delivery-mobile-top.png' });
  await page.evaluate(() => { document.querySelectorAll('button[aria-expanded]')[0].scrollIntoView({ block: 'start' }); });
  await new Promise(r => setTimeout(r, 500));
  await page.screenshot({ path: '.pw-shots/delivery-mobile-card.png' });
  await browser.close(); srv.close();
  console.log('shots saved');
})();
