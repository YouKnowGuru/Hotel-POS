import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X, QrCode, ShieldCheck, CheckCircle, Check, AlertCircle, Loader2,
  Upload, RefreshCw, Copy, ZoomIn, Trash2,
} from 'lucide-react';
import { resetViewScroll } from '../hooks/useViewScrollReset';

/**
 * Public home-delivery QR payment sheet.
 *
 * Why this is a portal to document.body instead of a child of the page:
 *  - PublicShell wraps pages in `.pw-root`, whose dark-mode rules rewrite any
 *    inline light background (e.g. `rgb(255, 248, 241)` -> near-black). That
 *    made the old payment card render with a black header in dark mode.
 *  - The old overlay had NO backdrop at all, so the sticky site header and the
 *    footer of the (long) tracking page showed straight through — it looked
 *    like the "QR page opened at the footer".
 *  - Being outside the shell also keeps it clear of any stacking context.
 *
 * Everything here is styled with the `dmq-` prefix and explicit light/dark
 * colours, so it cannot be clobbered by the shell's `pw-*` tokens.
 */

const CSS = `
.dmq-overlay{
  position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;justify-content:center;
  background:rgba(20,12,6,.66);backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
  overscroll-behavior:contain;animation:dmqFade .2s ease both;
}
@media(min-width:640px){ .dmq-overlay{align-items:center;padding:24px;} }
@keyframes dmqFade{from{opacity:0}to{opacity:1}}

.dmq-sheet{
  position:relative;width:100%;max-width:468px;max-height:100vh;max-height:100dvh;
  display:flex;flex-direction:column;overflow:hidden;
  background:#FFF8F1;color:#221207;
  border:1px solid rgba(63,32,4,.1);border-bottom:0;border-radius:24px 24px 0 0;
  box-shadow:0 -24px 60px -20px rgba(0,0,0,.45);
  font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,sans-serif;
  -webkit-font-smoothing:antialiased;
  animation:dmqRise .3s cubic-bezier(.22,1,.36,1) both;
}
@media(min-width:640px){
  .dmq-sheet{max-height:90vh;max-height:min(90dvh,780px);border-radius:24px;border-bottom:1px solid rgba(63,32,4,.1);box-shadow:0 40px 90px -30px rgba(0,0,0,.55);}
}
@keyframes dmqRise{from{opacity:0;transform:translateY(28px) scale(.985)}to{opacity:1;transform:none}}

.dmq-head{
  display:flex;align-items:flex-start;gap:12px;flex-shrink:0;
  padding:16px 16px 14px;border-bottom:1px solid rgba(63,32,4,.1);
  background:linear-gradient(135deg,rgba(245,158,11,.16),rgba(234,88,12,.06));
}
.dmq-head-icon{
  width:40px;height:40px;border-radius:13px;flex:0 0 40px;
  display:flex;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#F59E0B,#EA580C);color:#1B0F02;
  box-shadow:0 10px 22px -12px rgba(245,158,11,1);
}
.dmq-head-text{min-width:0;flex:1;padding-top:1px;}
.dmq-title{margin:0;font-size:16px;line-height:1.3;font-weight:800;letter-spacing:-.01em;overflow-wrap:anywhere;}
.dmq-sub{margin:3px 0 0;font-size:12px;line-height:1.45;color:#7A6553;overflow-wrap:anywhere;}
.dmq-close{
  flex:0 0 34px;width:34px;height:34px;border-radius:11px;
  border:1px solid rgba(63,32,4,.14);background:rgba(255,255,255,.7);color:#5C4B3A;
  display:flex;align-items:center;justify-content:center;cursor:pointer;
  transition:background .18s ease,transform .18s ease;
}
.dmq-close:hover{background:#fff;transform:rotate(90deg);}
.dmq-close:disabled{opacity:.5;cursor:not-allowed;transform:none;}

.dmq-body{
  flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;
  -webkit-overflow-scrolling:touch;padding:16px;
  display:flex;flex-direction:column;gap:14px;
}
.dmq-foot{
  flex-shrink:0;padding:12px 16px calc(14px + env(safe-area-inset-bottom,0px));
  border-top:1px solid rgba(63,32,4,.1);background:rgba(255,255,255,.6);
}

/* Amount */
.dmq-amount{
  display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;
  padding:12px 14px;border-radius:16px;
  background:rgba(245,158,11,.11);border:1px solid rgba(245,158,11,.3);
}
.dmq-amount-left{min-width:0;}
.dmq-amount-label{display:block;font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#92400E;}
.dmq-amount-value{display:block;margin-top:2px;font-size:23px;line-height:1.15;font-weight:900;letter-spacing:-.02em;color:#7C2D12;}
.dmq-copy{
  display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 11px;
  border-radius:10px;border:1px solid rgba(124,45,18,.25);background:rgba(255,255,255,.75);
  color:#7C2D12;font-size:11.5px;font-weight:800;cursor:pointer;white-space:nowrap;
  transition:background .18s ease;
}
.dmq-copy:hover{background:#fff;}

/* Steps */
.dmq-steps{display:flex;align-items:center;gap:6px;list-style:none;margin:0;padding:0;}
.dmq-step{display:flex;align-items:center;gap:6px;min-width:0;flex:1;font-size:10.5px;font-weight:700;color:#A3846A;}
.dmq-step-num{
  width:20px;height:20px;border-radius:50%;flex:0 0 20px;
  display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;
  background:rgba(63,32,4,.08);color:#7A6553;
}
.dmq-step.is-done .dmq-step-num{background:#10B981;color:#fff;}
.dmq-step.is-active .dmq-step-num{background:linear-gradient(135deg,#F59E0B,#EA580C);color:#1B0F02;}
.dmq-step.is-active{color:#7C2D12;}
.dmq-step-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}

/* QR */
.dmq-qr{
  display:flex;flex-direction:column;align-items:center;gap:10px;
  padding:14px;border-radius:16px;background:#fff;
  border:1px solid rgba(63,32,4,.12);
}
.dmq-qr-img-btn{
  position:relative;display:block;padding:0;border:0;background:transparent;cursor:zoom-in;border-radius:12px;
}
.dmq-qr-img{display:block;width:min(216px,60vw);height:auto;aspect-ratio:1/1;object-fit:contain;background:#fff;border-radius:12px;}
.dmq-qr-zoom-hint{
  position:absolute;right:6px;bottom:6px;display:flex;align-items:center;gap:4px;
  padding:4px 7px;border-radius:8px;background:rgba(27,15,2,.78);color:#fff;font-size:10px;font-weight:700;
}
.dmq-qr-state{
  width:min(216px,60vw);min-height:150px;display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:9px;text-align:center;padding:16px;color:#7A6553;font-size:12.5px;line-height:1.5;
}
.dmq-qr-state p{margin:0;overflow-wrap:anywhere;}
.dmq-retry{
  display:inline-flex;align-items:center;gap:6px;min-height:34px;padding:0 12px;border-radius:10px;
  border:1px solid rgba(63,32,4,.2);background:#FFF8F1;color:#7C2D12;font-size:12px;font-weight:800;cursor:pointer;
}
.dmq-qr-hint{margin:0;text-align:center;font-size:11.5px;line-height:1.55;color:#7A6553;overflow-wrap:anywhere;}

/* Upload */
.dmq-section-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
.dmq-label{font-size:13px;font-weight:800;color:#221207;}
.dmq-req{
  margin-left:6px;padding:2px 7px;border-radius:6px;font-size:9.5px;font-weight:900;
  letter-spacing:.08em;text-transform:uppercase;background:rgba(245,158,11,.16);color:#C2410C;
}
.dmq-hint{margin:0;font-size:11.5px;color:#7A6553;line-height:1.5;overflow-wrap:anywhere;}
.dmq-file-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;}
.dmq-drop{
  width:100%;min-height:90px;padding:14px;border-radius:16px;cursor:pointer;
  border:1.5px dashed rgba(63,32,4,.24);background:rgba(63,32,4,.03);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;
  transition:border-color .18s ease,background .18s ease;
}
.dmq-drop:hover{border-color:rgba(234,88,12,.55);background:rgba(245,158,11,.07);}
.dmq-drop-icon{
  width:34px;height:34px;border-radius:11px;display:flex;align-items:center;justify-content:center;
  background:rgba(245,158,11,.15);color:#C2410C;margin-bottom:3px;
}
.dmq-drop-title{font-size:13px;font-weight:800;color:#221207;}
.dmq-drop-sub{font-size:11px;color:#7A6553;}
.dmq-preview{display:flex;align-items:center;gap:11px;padding:10px;border-radius:14px;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.3);}
.dmq-preview img{width:54px;height:54px;flex:0 0 54px;object-fit:cover;border-radius:10px;background:#fff;}
.dmq-preview-meta{min-width:0;flex:1;}
.dmq-preview-name{margin:0;font-size:12.5px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.dmq-preview-ok{margin:3px 0 0;display:flex;align-items:center;gap:5px;font-size:11.5px;font-weight:700;color:#047857;}
.dmq-remove{
  flex:0 0 32px;width:32px;height:32px;border-radius:10px;border:1px solid rgba(63,32,4,.14);
  background:rgba(255,255,255,.8);color:#B91C1C;display:flex;align-items:center;justify-content:center;cursor:pointer;
}

/* Error + submit + note */
.dmq-error{
  display:flex;align-items:flex-start;gap:8px;padding:10px 12px;border-radius:12px;
  font-size:12.5px;font-weight:600;line-height:1.55;overflow-wrap:anywhere;
  background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.35);color:#B91C1C;
}
.dmq-error svg{flex:0 0 auto;margin-top:1px;}
.dmq-submit{
  width:100%;min-height:50px;padding:10px 14px;border:0;border-radius:14px;
  display:inline-flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;
  background:linear-gradient(135deg,#F59E0B,#EA580C);color:#1B0F02;
  font-weight:800;font-size:14px;line-height:1.35;text-align:center;cursor:pointer;
  box-shadow:0 16px 34px -16px rgba(245,158,11,.95);
  transition:transform .2s ease,filter .2s ease;
}
.dmq-submit:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.06);}
.dmq-submit:disabled{opacity:.5;cursor:not-allowed;transform:none;}
.dmq-foot-note{
  margin:9px 0 0;display:flex;align-items:flex-start;justify-content:center;gap:6px;
  font-size:10.5px;line-height:1.5;color:#7A6553;text-align:center;overflow-wrap:anywhere;
}
.dmq-foot-note svg{flex:0 0 auto;margin-top:1px;}
.dmq-spin{animation:dmqSpin 1s linear infinite;}
@keyframes dmqSpin{to{transform:rotate(360deg)}}

/* Success */
.dmq-success{display:flex;flex-direction:column;align-items:center;text-align:center;gap:10px;padding:14px 4px 6px;}
.dmq-success-icon{
  width:70px;height:70px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:rgba(16,185,129,.13);border:2px solid rgba(16,185,129,.45);color:#059669;
}
.dmq-success-title{margin:4px 0 0;font-size:20px;font-weight:900;letter-spacing:-.02em;}
.dmq-success-text{margin:0;font-size:12.5px;line-height:1.65;color:#7A6553;max-width:34ch;overflow-wrap:anywhere;}
.dmq-success-box{
  width:100%;margin-top:6px;padding:13px 14px;border-radius:14px;text-align:left;
  background:rgba(63,32,4,.04);border:1px solid rgba(63,32,4,.1);
}
.dmq-success-row{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:12px;padding:3px 0;}
.dmq-success-row span{color:#7A6553;}
.dmq-success-row strong{font-weight:800;overflow-wrap:anywhere;text-align:right;}
.dmq-success .dmq-submit{margin-top:8px;}

/* Full-screen QR */
.dmq-zoom{
  position:fixed;inset:0;z-index:1100;background:#fff;color:#221207;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px;
}
.dmq-zoom img{max-width:min(88vw,520px);max-height:70vh;object-fit:contain;}
.dmq-zoom p{margin:0;font-size:13px;font-weight:700;text-align:center;}
.dmq-zoom-close{
  min-height:44px;padding:0 20px;border-radius:12px;border:1px solid rgba(63,32,4,.2);
  background:#FFF8F1;color:#221207;font-size:13px;font-weight:800;cursor:pointer;
}

/* Dark theme — explicit, never inherited from pw-root */
html.dark .dmq-overlay{background:rgba(0,0,0,.76);}
html.dark .dmq-sheet{background:#171310;color:#F6EBDD;border-color:rgba(255,255,255,.09);}
html.dark .dmq-head{background:linear-gradient(135deg,rgba(245,158,11,.15),rgba(234,88,12,.05));border-bottom-color:rgba(255,255,255,.09);}
html.dark .dmq-foot{background:rgba(255,255,255,.03);border-top-color:rgba(255,255,255,.09);}
html.dark .dmq-title,html.dark .dmq-label,html.dark .dmq-drop-title{color:#F6EBDD;}
html.dark .dmq-sub,html.dark .dmq-hint,html.dark .dmq-foot-note,
html.dark .dmq-drop-sub,html.dark .dmq-step,html.dark .dmq-success-text,html.dark .dmq-success-row span{color:#B7A692;}
html.dark .dmq-close{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14);color:#E8DCCB;}
html.dark .dmq-amount{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.28);}
html.dark .dmq-amount-label{color:#FBBF24;}
html.dark .dmq-amount-value{color:#FCD34D;}
html.dark .dmq-copy{background:rgba(255,255,255,.07);border-color:rgba(245,158,11,.35);color:#FBBF24;}
html.dark .dmq-step-num{background:rgba(255,255,255,.09);color:#B7A692;}
html.dark .dmq-step.is-active{color:#FBBF24;}
/* The QR panel stays WHITE in both themes so the code is always scannable.
   Anything inside it must therefore keep dark ink + light controls even in
   dark mode — otherwise captions/errors/retry become invisible on white. */
html.dark .dmq-qr{background:#fff;border-color:rgba(255,255,255,.14);}
html.dark .dmq-qr .dmq-qr-state,html.dark .dmq-qr .dmq-qr-hint{color:#5C4B3A;}
html.dark .dmq-qr .dmq-retry{background:#FFF8F1;border-color:rgba(63,32,4,.2);color:#7C2D12;}
html.dark .dmq-qr .dmq-retry:hover{background:#fff;}
html.dark .dmq-drop{border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.03);}
html.dark .dmq-remove{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.14);color:#FCA5A5;}
html.dark .dmq-preview{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.3);}
html.dark .dmq-success-box{background:rgba(255,255,255,.04);border-color:rgba(255,255,255,.1);}
html.dark .dmq-req{background:rgba(245,158,11,.18);color:#FBBF24;}
html.dark .dmq-preview-ok{color:#34D399;}
html.dark .dmq-error{background:rgba(239,68,68,.14);border-color:rgba(239,68,68,.35);color:#FCA5A5;}
html.dark .dmq-zoom{background:#fff;color:#221207;}

@media(prefers-reduced-motion:reduce){
  .dmq-overlay,.dmq-sheet{animation:none !important;}
  .dmq-spin{animation:none !important;}
  .dmq-submit,.dmq-close,.dmq-drop{transition:none !important;}
}
`;

export default function DeliveryPaymentModal({
  paymentOrder,
  paymentQr,
  qrError,
  onRetryQr,
  proofImage,
  proofFileName,
  paymentError,
  submittingProof,
  proofSubmitted,
  close,
  selectProof,
  removeProof,
  submit,
  currency = 'Nu. ',
}) {
  const [zoom, setZoom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [qrBroken, setQrBroken] = useState(false);

  const bodyRef = useRef(null);
  const fileRef = useRef(null);
  const closeBtnRef = useRef(null);
  const closeFn = useRef(close);
  const busyFn = useRef(submittingProof);
  const zoomFn = useRef(zoom);
  closeFn.current = close;
  busyFn.current = submittingProof;
  zoomFn.current = zoom;

  useEffect(() => { setQrBroken(false); }, [paymentQr]);

  /* Lock the page, reset its scroll (the tracker can be very tall), and
     make Escape / focus behave like a real dialog. */
  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;
    const gap = window.innerWidth - document.documentElement.clientWidth;
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
    document.body.style.overflow = 'hidden';
    resetViewScroll();

    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      if (zoomFn.current) { setZoom(false); return; }
      if (!busyFn.current) closeFn.current();
    };
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => closeBtnRef.current?.focus({ preventScroll: true }), 80);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      document.body.style.paddingRight = prevPad;
      try { previouslyFocused?.focus?.({ preventScroll: true }); } catch { /* detached node */ }
    };
  }, []);

  /* Start at the top of the sheet when the success state replaces the form. */
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [proofSubmitted]);

  const amountNumber = Number(paymentOrder?.total || 0).toFixed(2);
  const amount = `${currency}${amountNumber}`;
  const orderId = paymentOrder?.id ?? '—';
  // A missing/broken QR is a blocking *display* problem, not a reason to
  // refuse a proof: the restaurant may have shared the code another way
  // (WhatsApp, printed card). Keep the warning visible but let the guest
  // finish the flow instead of trapping them in the sheet.
  const blocked = submittingProof || !proofImage;

  const copyAmount = async () => {
    try {
      await navigator.clipboard.writeText(amountNumber);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard unavailable (insecure context) — silently ignore */ }
  };

  const onBackdrop = (e) => {
    if (e.target === e.currentTarget && !submittingProof) close();
  };

  const fileInput = (
    <input
      id="dm-proof" ref={fileRef} type="file"
      accept="image/png,image/jpeg,image/webp"
      className="dmq-file-input"
      aria-describedby="dm-proof-help"
      onChange={(e) => selectProof(e.target.files?.[0])}
    />
  );

  return createPortal(
    <>
      <style>{CSS}</style>
      <div className="dmq-overlay" onMouseDown={onBackdrop} role="presentation">
        <div className="dmq-sheet" role="dialog" aria-modal="true" aria-labelledby="dmq-title">
          <header className="dmq-head">
            <span className="dmq-head-icon" aria-hidden="true"><QrCode size={20} /></span>
            <div className="dmq-head-text">
              <h2 id="dmq-title" className="dmq-title">
                {proofSubmitted ? 'Payment submitted' : 'Complete your payment'}
              </h2>
              <p className="dmq-sub">Order #{orderId} · {amount}</p>
            </div>
            <button
              ref={closeBtnRef} type="button" className="dmq-close"
              onClick={close} disabled={submittingProof}
              aria-label="Close payment dialog"
            >
              <X size={18} />
            </button>
          </header>

          <div className="dmq-body" ref={bodyRef}>
            {proofSubmitted ? (
              <div className="dmq-success">
                <span className="dmq-success-icon"><CheckCircle size={34} aria-hidden="true" /></span>
                <h3 className="dmq-success-title">Thanks! We&apos;re checking it.</h3>
                <p className="dmq-success-text">
                  Your payment screenshot was sent to the restaurant. The status below updates
                  automatically as soon as an admin approves it — no need to pay again.
                </p>
                <div className="dmq-success-box">
                  <div className="dmq-success-row"><span>Order</span><strong>#{orderId}</strong></div>
                  <div className="dmq-success-row"><span>Amount</span><strong>{amount}</strong></div>
                  <div className="dmq-success-row"><span>Status</span><strong>Under review</strong></div>
                </div>
                <button type="button" className="dmq-submit" onClick={close}>
                  <CheckCircle size={17} aria-hidden="true" /> View order status
                </button>
              </div>
            ) : (
              <>
                <div className="dmq-amount">
                  <div className="dmq-amount-left">
                    <span className="dmq-amount-label">Amount to pay</span>
                    <strong className="dmq-amount-value">{amount}</strong>
                  </div>
                  {typeof navigator !== 'undefined' && navigator.clipboard && (
                    <button type="button" className="dmq-copy" onClick={copyAmount}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy amount'}
                    </button>
                  )}
                </div>

                <ol className="dmq-steps" aria-label="Payment steps">
                  <li className={`dmq-step ${paymentQr && !qrBroken ? 'is-done' : 'is-active'}`}>
                    <span className="dmq-step-num">1</span><span className="dmq-step-label">Scan &amp; pay</span>
                  </li>
                  <li className={`dmq-step ${proofImage ? 'is-done' : (paymentQr ? 'is-active' : '')}`}>
                    <span className="dmq-step-num">2</span><span className="dmq-step-label">Upload proof</span>
                  </li>
                  <li className={`dmq-step ${proofImage ? 'is-active' : ''}`}>
                    <span className="dmq-step-num">3</span><span className="dmq-step-label">We verify</span>
                  </li>
                </ol>

                <div className="dmq-qr">
                  {paymentQr && !qrBroken ? (
                    <button
                      type="button" className="dmq-qr-img-btn"
                      onClick={() => setZoom(true)}
                      aria-label="Tap to enlarge the QR code"
                    >
                      <img
                        src={paymentQr} alt="Restaurant payment QR code"
                        className="dmq-qr-img" onError={() => setQrBroken(true)}
                      />
                      <span className="dmq-qr-zoom-hint"><ZoomIn size={11} /> Enlarge</span>
                    </button>
                  ) : (qrError || qrBroken) ? (
                    <div className="dmq-qr-state" role="alert">
                      <AlertCircle size={26} aria-hidden="true" />
                      <p>{qrBroken ? 'The QR image could not be displayed.' : qrError}</p>
                      <button type="button" className="dmq-retry" onClick={onRetryQr}>
                        <RefreshCw size={13} aria-hidden="true" /> Try again
                      </button>
                    </div>
                  ) : (
                    <div className="dmq-qr-state" role="status">
                      <Loader2 size={26} className="dmq-spin" aria-hidden="true" />
                      <p>Loading payment QR…</p>
                    </div>
                  )}
                  <p className="dmq-qr-hint">
                    Open your banking app, scan this code and pay the exact amount above.
                  </p>
                </div>

                <div>
                  <div className="dmq-section-head">
                    <label htmlFor="dm-proof" className="dmq-label">
                      Payment screenshot <span className="dmq-req">Required</span>
                    </label>
                    <p className="dmq-hint" id="dm-proof-help">PNG, JPG or WebP · up to 3 MB</p>
                  </div>
                  {fileInput}
                  {proofImage ? (
                    <div className="dmq-preview">
                      <img src={proofImage} alt="Preview of your payment screenshot" />
                      <div className="dmq-preview-meta">
                        <p className="dmq-preview-name">{proofFileName || 'Screenshot attached'}</p>
                        <p className="dmq-preview-ok"><CheckCircle size={13} aria-hidden="true" /> Ready to submit</p>
                      </div>
                      <button type="button" className="dmq-remove" onClick={removeProof} aria-label="Remove screenshot">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="dmq-drop" onClick={() => fileRef.current?.click()}>
                      <span className="dmq-drop-icon"><Upload size={17} aria-hidden="true" /></span>
                      <span className="dmq-drop-title">Choose your screenshot</span>
                      <span className="dmq-drop-sub">Tap to pick from your photos or files</span>
                    </button>
                  )}
                </div>

                {paymentError && (
                  <p role="alert" className="dmq-error">
                    <AlertCircle size={15} aria-hidden="true" /> <span>{paymentError}</span>
                  </p>
                )}
              </>
            )}
          </div>

          {!proofSubmitted && (
            <footer className="dmq-foot">
              <button type="button" className="dmq-submit" onClick={submit} disabled={blocked}>
                {submittingProof
                  ? <><Loader2 size={17} className="dmq-spin" aria-hidden="true" /> Submitting proof…</>
                  : <><ShieldCheck size={17} aria-hidden="true" /> Submit payment for review</>}
              </button>
              <p className="dmq-foot-note">
                <ShieldCheck size={13} aria-hidden="true" />
                Your order reaches the kitchen only after an admin approves your payment.
              </p>
            </footer>
          )}
        </div>
      </div>

      {zoom && paymentQr && (
        <div className="dmq-zoom" role="dialog" aria-modal="true" aria-label="Enlarged QR code">
          <img src={paymentQr} alt="Restaurant payment QR code (enlarged)" />
          <p>Scan this code with your payment app</p>
          <button type="button" className="dmq-zoom-close" onClick={() => setZoom(false)}>Close</button>
        </div>
      )}
    </>,
    document.body
  );
}
