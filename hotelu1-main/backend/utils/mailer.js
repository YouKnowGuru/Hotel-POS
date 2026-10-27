// SMTP transactional mailer for the public delivery-ordering flow.
//
// Customers receive automatic emails at every milestone of a home-delivery
// order:
//   1. Order placed            → sendOrderPlacedEmail
//   2. Payment approved        → sendPaymentApprovedEmail  (QR or COD admin sign-off)
//   3. Food delivered          → sendDeliveredEmail  — now carries the FULL bill
//                                                 (items + subtotal + SC + GST
//                                                 + total), so the customer gets
//                                                 a receipt the moment the food
//                                                 arrives.
//   4. COD payment received    → sendPaymentReceivedEmail (after admin approval)
//
// Configuration comes straight from environment variables (see .env.example):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM,
//   BRAND_NAME, BRAND_ADDRESS (optional footer contact line)
// When they are missing the helpers are safe no-ops so the POS keeps
// working in demo/dev environments without an SMTP server. A failed send
// must NEVER block the business action (order stays created, payment stays
// approved) — callers don't await these, and every failure only logs.

const nodemailer = require('nodemailer');

let cachedTransport = null;

function getTransport() {
  if (cachedTransport !== null) return cachedTransport;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    cachedTransport = false; // memoize the "not configured" state
    return null;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  try {
    cachedTransport = nodemailer.createTransport({
      host,
      port,
      secure: process.env.SMTP_SECURE === 'true' || port === 465,
      auth: { user, pass },
    });
  } catch (err) {
    console.error('SMTP transport init failed:', err?.message || err);
    cachedTransport = false;
    return null;
  }
  return cachedTransport;
}

function isMailConfigured() {
  return getTransport() != null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 254 && EMAIL_RE.test(email.trim());
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function brandName() {
  return process.env.BRAND_NAME || 'Our Restaurant';
}

function brandAddress() {
  return (process.env.BRAND_ADDRESS || '').trim();
}

function formatMoney(value) {
  const n = Number(value);
  return `Nu. ${Number.isFinite(n) ? n.toFixed(2) : String(value)}`;
}

/* ───────────────────────── shared HTML shell ─────────────────────────
   Every row: { label, value, strong?, accent? }  — accent renders the
   value in the milestone colour; strong renders label+value bolder.
   Fully table-based + inline styles so Gmail / Outlook / phone clients
   all render it. Max-width 600px = comfortable on phones.
──────────────────────────────────────────────────────────────────────── */

function rowsToHtml(rows) {
  return (rows || [])
    .map((r) => {
      const valueColor = r.accent === true ? '#0f172a' : '#334155';
      const labelWeight = r.strong === true ? '700' : '400';
      const labelColor = r.strong === true ? '0f172a' : '64748b';
      const bg = r.strong === true ? 'background:#f8fafc;' : '';
      return `<tr style="${bg}">
        <td style="padding:9px 16px;border-bottom:1px solid #eef2f7;color:#${labelColor};font-size:14px;font-weight:${labelWeight};">${escapeHtml(r.label)}</td>
        <td style="padding:9px 16px;border-bottom:1px solid #eef2f7;color:${valueColor};font-size:14px;font-weight:${r.strong === true ? '800' : '600'};text-align:right;white-space:nowrap;">${escapeHtml(r.value)}</td>
      </tr>`;
    })
    .join('');
}

function buildEmailHtml({ heading, subheading, accent, rows, footerNote, preheader, bigTotal }) {
  const accentDark = '#312e81';
  const brand = escapeHtml(brandName());
  // Gmail clips hidden preheaders unless they have real height;
  // this keeps it invisible in every client.
  const pre = preheader
    ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}&#8195;&#847;&#8195;</div>`
    : '';

  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#eef1f7;-webkit-text-size-adjust:100%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f7;">
  <tr><td align="center" style="padding:28px 12px;">

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 40px rgba(15,23,42,0.12);">
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%);padding:30px 30px 24px;">
        <p style="margin:0 0 10px;color:rgba(255,255,255,0.85);font-size:11px;letter-spacing:0.2em;text-transform:uppercase;font-weight:700;">
          ${brand}
        </p>
        <h1 style="margin:0;color:#ffffff;font-size:25px;font-weight:800;line-height:1.25;">${escapeHtml(heading)}</h1>
        <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:13px;">${escapeHtml(new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }))}</p>
      </td></tr>

      <!-- Body -->
      <tr><td style="padding:24px 26px 6px;">
        <p style="margin:0 0 18px;color:#475569;font-size:15px;line-height:1.7;">${escapeHtml(subheading)}</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e8ecf3;border-radius:14px;overflow:hidden;background:#ffffff;">
          ${rowsToHtml(rows)}
        </table>
      </td></tr>

      <!-- Total banner -->
      ${
        bigTotal
          ? `<tr><td style="padding:14px 26px 6px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;border-radius:14px;">
          <tr><td style="padding:15px 20px;color:#94a3b8;font-size:12px;letter-spacing:0.12em;text-transform:uppercase;font-weight:700;">${escapeHtml(bigTotal.label || 'Total amount')}</td>
          <td style="padding:15px 20px;color:#ffffff;font-size:22px;font-weight:800;text-align:right;white-space:nowrap;">${escapeHtml(bigTotal.value)}</td></tr>
        </table>
      </td></tr>`
          : ''
      }

      <!-- Footer -->
      <tr><td style="padding:14px 26px 28px;">
        ${footerNote ? `<p style="margin:0 0 10px;color:#64748b;font-size:13px;line-height:1.65;">${escapeHtml(footerNote)}</p>` : ''}
        <div style="height:1px;background:#e8ecf3;margin:14px 0;"></div>
        ${brandAddress() ? `<p style="margin:0 0 6px;color:#94a3b8;font-size:12px;line-height:1.6;">${escapeHtml(brandAddress())}</p>` : ''}
        <p style="margin:0;color:#b6c1d2;font-size:11px;line-height:1.6;">This is an automatic message from the ${brand} ordering system. Please do not reply.</p>
      </td></tr>
    </table>

  </td></tr>
</table>
</body></html>`;
}

function buildText({ heading, lines }) {
  return [brandName(), '==============', heading, '', ...(lines || [])].join('\n');
}

/** Low-level sender. Fire-and-forget safe: never throws. */
async function sendMail({ to, subject, heading, accent = '#7c3aed', subheading = '', rows = [], textLines = [], footerNote, preheader, bigTotal }) {
  if (!isValidEmail(to)) {
    console.warn('mailer: skipped invalid email address');
    return;
  }
  const transport = getTransport();
  if (!transport) {
    console.log(`mailer: SMTP not configured — would email ${to}: ${subject}`);
    return;
  }
  try {
    await transport.sendMail({
      from: process.env.MAIL_FROM || `${brandName()} <${process.env.SMTP_USER}>`,
      to: to.trim(),
      subject,
      text: buildText({ heading, lines: textLines }),
      html: buildEmailHtml({ heading, subheading, accent, rows, footerNote, preheader, bigTotal }),
    });
    console.log(`mailer: sent "${subject}" to ${to}`);
  } catch (err) {
    console.error(`mailer: failed to send "${subject}" to ${to}:`, err?.message || err);
  }
}

/* ── Milestone templates ─────────────────────────────────────────── */

function paymentRow(order) {
  if (order.payment_method === 'cash') {
    return { label: 'Payment', value: 'Cash on delivery' };
  }
  if (order.payment_status === 'paid') return { label: 'Payment', value: 'Paid ✓', strong: true };
  if (order.payment_status === 'verification_pending') {
    return { label: 'Payment', value: 'QR payment — pending admin approval' };
  }
  return { label: 'Payment', value: String(order.payment_status || 'pending') };
}

/** Full itemized bill: every ordered item + subtotal + service charge + GST + total. */
function billRows(order) {
  const items = order.items || [];
  const gst = Number(order.tax_amount);
  const sc = Number(order.service_charge);
  let subtotal = 0;
  const rows = [];
  const maxListed = 14;

  items.slice(0, maxListed).forEach((i) => {
    const qty = Number(i.quantity != null ? i.quantity : i.qty) || 1;
    const price = Number(i.price) || 0;
    subtotal += price * qty;
    rows.push({ label: `${qty} × ${i.name}`, value: formatMoney(price * qty) });
  });
  if (items.length > maxListed) {
    rows.push({ label: `+${items.length - maxListed} more items`, value: '' });
  }
  if (items.length > 0) {
    rows.push({ label: 'Subtotal', value: formatMoney(subtotal) });
  }
  if (sc > 0) rows.push({ label: 'Service charge', value: formatMoney(sc) });
  if (gst > 0) rows.push({ label: 'GST', value: formatMoney(gst) });
  rows.push({ label: 'Order #', value: `#${order.id}` });
  rows.push(paymentRow(order));
  return rows;
}

function sendOrderPlacedEmail(order) {
  const first = (order.customer_name || '').split(' ')[0];
  return sendMail({
    to: order.customer_email,
    subject: `Order #${order.id} confirmed — ${brandName()}`,
    heading: `Thanks${first ? `, ${first}` : ''} — your order is confirmed!`,
    accent: '#7c3aed',
    subheading:
      'We received your order. Your food will be prepared as soon as an admin reviews your payment.',
    rows: billRows(order),
    bigTotal: { label: 'Order total', value: formatMoney(order.total) },
    textLines: [
      `Order #${order.id} has been received.`,
      `Total: ${formatMoney(order.total)}`,
      `Payment: ${order.payment_method === 'cash' ? 'Cash on delivery' : order.payment_status === 'verification_pending' ? 'QR payment, pending admin approval' : 'NA'}`,
    ],
    footerNote: 'You will get an email when your payment is approved and again when your food is delivered.',
    preheader: `Order #${order.id} confirmed — total ${formatMoney(order.total)}`,
  });
}

function sendPaymentApprovedEmail(order) {
  // For cash-on-delivery orders the admin approval means "start
  // preparing" — no money has changed hands yet, so the copy must not
  // claim the payment was approved.
  const isCod = order.payment_method === 'cash';
  return sendMail({
    to: order.customer_email,
    subject: `${isCod ? 'Order' : 'Payment'} approved for order #${order.id} — ${brandName()}`,
    heading: isCod ? 'Order approved — your food is on the way!' : 'Payment approved — your food is on the way!',
    accent: '#059669',
    subheading: isCod
      ? 'An admin has approved your order. Our kitchen is preparing it and it will be handed to our delivery staff. Please keep the cash amount ready — you will pay the rider at your door.'
      : 'An admin has approved your order. It is being prepared and handed to our delivery staff. You will receive one more email when your food is delivered.',
    rows: [
      { label: 'Order #', value: `#${order.id}` },
      { label: 'Amount', value: formatMoney(order.total) },
      { label: 'Method', value: isCod ? 'Cash on delivery' : String(order.payment_method || 'QR payment') },
      { label: 'Status', value: 'Approved & being prepared', strong: true },
    ],
    bigTotal: { label: isCod ? 'Please have ready' : 'Paid amount', value: formatMoney(order.total) },
    textLines: [
      `${isCod ? 'Order' : 'Payment for order'} #${order.id} has been approved.`,
      `Amount: ${formatMoney(order.total)}`,
    ],
    footerNote: isCod ? 'Keep the exact cash amount ready for the rider.' : undefined,
    preheader: `${isCod ? 'Order' : 'Payment'} approved for #${order.id} — ${formatMoney(order.total)}`,
  });
}

function sendDeliveredDeliveredRows(order) {
  return billRows(order);
}

function sendDeliveredEmail(order) {
  const isCash = order.payment_method === 'cash';
  const isPaid = order.payment_status === 'paid';
  return sendMail({
    to: order.customer_email,
    subject: `Order #${order.id} delivered — your bill — ${brandName()}`,
    heading: isPaid ? 'Delivered! Enjoy your meal 🍜' : 'Delivered! Please hand over the cash 🍜',
    accent: '#0ea5e9',
    subheading: isCash
      ? 'Your order has just been delivered and your bill is below. Please pay our staff the exact cash amount and our team will confirm the payment.'
      : 'Your order has just been delivered and your final bill is below. We hope you love it — thank you for ordering with us!',
    rows: sendDeliveredDeliveredRows(order),
    bigTotal: { label: isPaid ? 'Paid amount' : 'Amount due', value: formatMoney(order.total) },
    textLines: [
      `Order #${order.id} was delivered.`,
      `Total: ${formatMoney(order.total)}`,
    ],
    footerNote: isCash
      ? 'Once our staff hands over the cash and the admin signs it off, you will receive a payment confirmation email.'
      : 'No further action needed — your payment has already been recorded.',
    preheader: isPaid
      ? `Order #${order.id} delivered — bill total ${formatMoney(order.total)} (paid ✓)`
      : `Order #${order.id} delivered — please pay ${formatMoney(order.total)} in cash`,
  });
}

function sendPaymentReceivedEmail(order) {
  return sendMail({
    to: order.customer_email,
    subject: `Payment received for order #${order.id} — thank you!`,
    heading: 'Payment received — you are all set!',
    accent: '#059669',
    subheading:
      'The cash payment for your order has been confirmed by our team. GST and service charge have been recorded. Thank you for ordering with us!',
    rows: billRows(order),
    bigTotal: { label: 'Amount paid', value: formatMoney(order.total) },
    textLines: [
      `We received the cash payment for order #${order.id}.`,
      `Amount: ${formatMoney(order.total)}`,
    ],
    footerNote: 'This email is your payment receipt. Thank you for ordering with ' + brandName() + '.',
    preheader: `Payment received for order #${order.id} — ${formatMoney(order.total)}`,
  });
}

function sendRejectionEmail(order, reason) {
  return sendMail({
    to: order.customer_email,
    subject: `Payment for order #${order.id} needs another attempt`,
    heading: 'Payment could not be approved',
    accent: '#e11d48',
    subheading:
      'Our admin reviewed your payment proof and could not approve it. Please make the payment again and upload a clear screenshot. Reason:',
    rows: [
      { label: 'Order #', value: `#${order.id}` },
      { label: 'Amount', value: formatMoney(order.total) },
      { label: 'Reason', value: reason || 'Proof was unclear or amount did not match' },
    ],
    textLines: [
      `Payment for order #${order.id} was rejected.`,
      `Reason: ${reason || 'not specified'}`,
    ],
    footerNote: 'If you already re-ordered, ignore this email.',
    preheader: `Payment issue for order #${order.id} — please retry`,
  });
}

module.exports = {
  isMailConfigured,
  isValidEmail,
  sendMail,
  sendOrderPlacedEmail,
  sendPaymentApprovedEmail,
  sendDeliveredEmail,
  sendPaymentReceivedEmail,
  sendRejectionEmail,
  billRows,
  // exposed for template previews/tests
  buildEmailHtml,
  buildText,
};
