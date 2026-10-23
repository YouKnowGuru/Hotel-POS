// SMTP transactional mailer for the public delivery-ordering flow.
//
// Customers receive automatic emails at every milestone of a home-delivery
// order:
//   1. Order placed           → sendOrderPlacedEmail
//   2. Payment approved       → sendPaymentApprovedEmail  (QR or COD admin sign-off)
//   3. Food delivered         → sendDeliveredEmail
//   4. COD payment received    → sendPaymentReceivedEmail (after admin approval)
//
// Configuration comes straight from environment variables (see .env.example):
//   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SECURE, MAIL_FROM
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

function formatMoney(value) {
  const n = Number(value);
  return `Nu. ${Number.isFinite(n) ? n.toFixed(2) : String(value)}`;
}

/** Shared branded HTML shell. */
function buildEmailHtml({ heading, subheading, accent, rows, footerNote }) {
  const rowHtml = (rows || [])
    .map(
      (r) => `<tr>
        <td style="padding:8px 14px;border-bottom:1px solid #eef2f7;color:#475569;font-size:14px;">${escapeHtml(r.label)}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #eef2f7;color:#0f172a;font-size:14px;font-weight:700;text-align:right;">${escapeHtml(r.value)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f1f5f9;font-family:Inter,Segoe UI,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(15,23,42,0.08);">
        <tr><td style="background:linear-gradient(135deg,${accent},#4338ca);padding:28px 28px 22px;">
          <p style="margin:0;color:#fbbf24;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;font-weight:700;">${escapeHtml(brandName())}</p>
          <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:800;line-height:1.25;">${escapeHtml(heading)}</h1>
        </td></tr>
        <tr><td style="padding:22px 28px 4px;">
          <p style="margin:0 0 16px;color:#475569;font-size:14px;line-height:1.7;">${escapeHtml(subheading)}</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eef2f7;border-radius:12px;overflow:hidden;background:#fafbff;">
            ${rowHtml || ''}
          </table>
        </td></tr>
        <tr><td style="padding:12px 28px 26px;">
          ${footerNote ? `<p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">${escapeHtml(footerNote)}</p>` : ''}
          <p style="margin:14px 0 0;color:#cbd5e1;font-size:11px;">This is an automatic message from the ${escapeHtml(brandName())} ordering system. Please do not reply.</p>
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
async function sendMail({ to, subject, heading, accent = '#7c3aed', subheading = '', rows = [], textLines = [], footerNote }) {
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
      html: buildEmailHtml({ heading, subheading, accent, rows, footerNote }),
    });
    console.log(`mailer: sent "${subject}" to ${to}`);
  } catch (err) {
    console.error(`mailer: failed to send "${subject}" to ${to}:`, err?.message || err);
  }
}

/* ── Milestone templates ─────────────────────────────────────────── */

function orderRows(order) {
  const items = order.items || [];
  const gst = Number(order.tax_amount);
  const sc = Number(order.service_charge);
  const rows = [{ label: 'Order #', value: `#${order.id}` }];
  const maxListed = 12;
  items.slice(0, maxListed).forEach((i) =>
    rows.push({
      label: `${i.quantity || i.qty || 1} × ${i.name}`,
      value: formatMoney((Number(i.price) || 0) * (Number(i.quantity != null ? i.quantity : i.qty) || 1)),
    })
  );
  if (items.length > maxListed) rows.push({ label: `+${items.length - maxListed} more items`, value: '' });
  rows.push({ label: 'Service charge', value: formatMoney(sc) });
  rows.push({ label: 'GST', value: formatMoney(gst) });
  rows.push({ label: 'Total', value: formatMoney(order.total) });
  if (order.payment_method === 'cash') {
    rows.push({ label: 'Payment', value: 'Cash on delivery' });
  } else if (order.payment_status === 'verification_pending') {
    rows.push({ label: 'Payment', value: 'QR payment — pending admin approval' });
  } else {
    rows.push({ label: 'Payment', value: String(order.payment_status || 'pending') });
  }
  return rows;
}

function sendOrderPlacedEmail(order) {
  const to = order.customer_email;
  const first = (order.customer_name || '').split(' ')[0];
  return sendMail({
    to,
    subject: `Order #${order.id} confirmed — ${brandName()}`,
    heading: `Thanks${first ? `, ${first}` : ''} — your order is confirmed!`,
    accent: '#7c3aed',
    subheading:
      'We received your order. Our kitchen will start preparing it as soon as an admin reviews your payment.',
    rows: orderRows(order),
    textLines: [
      `Order #${order.id} has been received.`,
      `Total: ${formatMoney(order.total)}`,
      `Payment: ${order.payment_method === 'cash' ? 'Cash on delivery' : order.payment_status === 'verification_pending' ? 'QR payment, pending admin approval' : 'NA'}`,
    ],
    footerNote: 'You will get an email when your payment is approved and again when your food is delivered.',
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
      { label: 'Status', value: 'Approved & being prepared' },
    ],
    textLines: [
      `${isCod ? 'Order' : 'Payment for order'} #${order.id} has been approved.`,
      `Amount: ${formatMoney(order.total)}`,
    ],
  });
}

function sendDeliveredEmail(order) {
  const isCash = order.payment_method === 'cash';
  return sendMail({
    to: order.customer_email,
    subject: `Order #${order.id} delivered — ${brandName()}`,
    heading: isCash ? 'Delivered! Hand over the cash please 🍜' : 'Order delivered — enjoy your meal!',
    accent: '#0ea5e9',
    subheading: isCash
      ? 'Your order has just been delivered. Please hand over the exact cash amount to our staff and our team will confirm your payment.'
      : 'Your order has just been delivered. We hope you love it! Thank you for ordering with us.',
    rows: [
      { label: 'Order #', value: `#${order.id}` },
      { label: 'Total', value: formatMoney(order.total) },
      { label: 'Payment', value: isCash ? `Cash on delivery — staff collected` : 'Already paid ✓' },
    ],
    textLines: [
      `Order #${order.id} was delivered.`,
      `Total: ${formatMoney(order.total)}`,
    ],
    footerNote: isCash
      ? 'Once our staff hands over the cash and the admin signs it off, your payment record (incl. GST & service charge) is completed.'
      : undefined,
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
    rows: [
      { label: 'Order #', value: `#${order.id}` },
      { label: 'Amount paid', value: formatMoney(order.total) },
      { label: 'Method', value: 'Cash on delivery' },
      { label: 'Status', value: 'Completed ✓' },
    ],
    textLines: [
      `We received the cash payment for order #${order.id}.`,
      `Amount: ${formatMoney(order.total)}`,
    ],
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
};
