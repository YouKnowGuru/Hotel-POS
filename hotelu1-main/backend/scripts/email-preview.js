// Renders every customer email template to HTML files so they can be
// checked in a real browser WITHOUT sending anything:
//   node scripts/email-preview.js
const fs = require('fs');
const path = require('path');

// Stub nodemailer BEFORE mailer.js loads, so "sends" are captured
// locally instead of going through SMTP.
const nodemailer = require('nodemailer');
const realCreateTransport = nodemailer.createTransport;
let captured = null;
nodemailer.createTransport = () => ({
  sendMail: async (mail) => { captured = mail; return { accepted: true }; },
});

require('dotenv').config();
const mailer = require('../utils/mailer');

const OUT = path.join(__dirname, '..', '..', 'frontend', '.pw-shots');
fs.mkdirSync(OUT, { recursive: true });

// Fake delivered delivery-order shaped like the Sequelize model + items.
const order = {
  id: 93,
  customer_name: 'Keshab Baral',
  customer_email: 'keshab@example.com',
  payment_method: 'cash',
  payment_status: 'paid',
  tax_amount: 21.9,
  service_charge: 20.79,
  total: 227.9,
  items: [
    { name: 'Chicken Momo (6 pcs)', price: 125, quantity: 1 },
    { name: 'Apple Juice', price: 80, quantity: 1 },
    { name: 'Ema Datshi with Red Rice', price: 159, quantity: 1 },
  ],
};

const prepaidPending = { ...order, payment_method: 'qr', payment_status: 'verification_pending' };
const codPending = { ...order, payment_status: 'cash_pending' };

const previews = [
  ['email-order-placed.html', () => mailer.sendOrderPlacedEmail(order)],
  ['email-payment-approved.html', () => mailer.sendPaymentApprovedEmail(codPending)],
  ['email-delivered-prepaid.html', () => mailer.sendDeliveredEmail(prepaidPending)],
  ['email-delivered-cod.html', () => mailer.sendDeliveredEmail(codPending)],
  ['email-delivered-bill.html', () => mailer.sendDeliveredEmail(order)],
  ['email-payment-received.html', () => mailer.sendPaymentReceivedEmail(order)],
  ['email-rejected.html', () => mailer.sendRejectionEmail(order, 'Screenshot was blurry')],
];

(async () => {
  for (const [file, fn] of previews) {
    captured = null;
    try { await fn(); } catch (e) { console.error(file, 'FAILED:', e.message); process.exitCode = 1; }
    if (!captured || !captured.html) { console.error(file, 'no html captured'); process.exitCode = 1; continue; }
    fs.writeFileSync(path.join(OUT, file), captured.html);
    console.log('wrote', file, captured.html.length, 'bytes');
  }
})();
