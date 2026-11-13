/* ------------------------------------------------------------------ */
/*  Alarm-bell sound utility for the Kitchen Display and customer      */
/*  mobile order tracker.                                              */
/*                                                                     */
/*  - Synthesises a loud "service bell" via the Web Audio API by       */
/*    stacking multiple oscillators at the fundamental + harmonics so  */
/*    the resulting tone is rich and clearly audible (much louder      */
/*    than a single sine wave).                                        */
/*  - Plays the chime 3-4 times in a row so kitchen staff / customers  */
/*    actually notice.                                                 */
/*  - Respects browser autoplay rules: bells queued before any user    */
/*    gesture are flushed on the first click / tap / keypress.         */
/*  - Persists on/off preference in localStorage.                      */
/* ------------------------------------------------------------------ */

const SETTING_KEY = 'notificationSoundSettings_v1';

const DEFAULTS = {
  enabled: true,
  // Volume is intentionally high — a kitchen-display alarm is meant to
  // cut through ambient noise. Users can mute via the toggle.
  volume: 1.0,
};

const loadSettings = () => {
  try {
    const raw = localStorage.getItem(SETTING_KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
};

export const getSoundSettings = () => loadSettings();

export const setSoundEnabled = (enabled) => {
  const next = { ...loadSettings(), enabled: !!enabled };
  try {
    localStorage.setItem(SETTING_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
};

export const setSoundVolume = (volume) => {
  const v = Math.max(0, Math.min(1, Number(volume) || 0));
  const next = { ...loadSettings(), volume: v };
  try {
    localStorage.setItem(SETTING_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
  return next;
};

/* ------------------------------------------------------------------ */
/*  Audio context — created lazily on first user interaction          */
/* ------------------------------------------------------------------ */

let audioCtx = null;
let unlocked = false;
// Entries are { fn, at, label }. Orders that arrive before the first user gesture
// are queued. On unlock we replay all fresh ones (staggered) instead of just
// the newest — every order deserves a bell, not just the last one.
let pendingPlays = [];
const PENDING_TTL_MS = 20000;
const PENDING_MAX = 8;
// How often we retry queued bells without waiting for a user gesture.
// Browsers will sometimes let resume() succeed after a socket event if the
// tab was recently active, so this periodic retry catches that case.
const RETRY_MS = 3000;
let retryTimer = null;

/** Browsers suspend the AudioContext when a tab is backgrounded. Resume it
 *  before every play so an order that arrives after 20 minutes is still
 *  audible, not silently dropped.
 *
 *  CRITICAL: resume() is ASYNC. Callers MUST `await` it and only schedule
 *  once the context is actually "running". If we schedule against a suspended
 *  (frozen) ctx.currentTime, every gain envelope is already in the past by the
 *  time the clock advances, so the bell plays silently. That race is exactly
 *  what made the order/waiter sounds work "sometimes". */
const ensureRunning = async (ctx) => {
  if (ctx && ctx.state === 'suspended') {
    try { await ctx.resume(); } catch { /* noop */ }
  }
  return ctx;
};

const isRunning = (ctx) => !!(ctx && ctx.state === 'running');

export const getAudioState = () => ({
  unlocked,
  supported: !!(typeof window !== 'undefined' &&
    (window.AudioContext || window.webkitAudioContext)),
  state: audioCtx ? audioCtx.state : 'not-created',
});

const getAudioCtx = () => {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) {
        console.warn('[notificationSound] Web Audio API not available');
        return null;
      }
      audioCtx = new Ctx();
    } catch (e) {
      console.warn('[notificationSound] Failed to create AudioContext', e);
      return null;
    }
  }
  return audioCtx;
};

const unlockAudio = async () => {
  if (unlocked) {
    // Already unlocked but there may be bells queued from a suspended-context
    // fallback. Flush them now if the context is running.
    flushPending();
    return;
  }
  unlocked = true;
  // A gesture reached this handler, so resume() is allowed to succeed. Await it
  // so the replayed bell is scheduled against a live clock (not a frozen one).
  const ctx = await ensureRunning(getAudioCtx());
  if (!ctx) return;
  flushPending();
};

/**
 * Replay all fresh queued bells, staggered by 400ms so they don't overlap
 * into an indistinguishable noise burst. Stale entries (older than TTL) are
 * silently dropped. If the context still isn't running, the newest entry is
 * kept for the next attempt.
 */
const flushPending = () => {
  if (pendingPlays.length === 0) return;
  const ctx = getAudioCtx();
  if (!ctx || !isRunning(ctx)) return;
  const queued = pendingPlays.splice(0);
  const fresh = queued.filter((p) => Date.now() - p.at < PENDING_TTL_MS);
  if (fresh.length === 0) return;
  // Replay all fresh bells, staggered so each is audible.
  fresh.forEach((p, i) => {
    setTimeout(() => {
      try {
        const c = getAudioCtx();
        if (c && isRunning(c)) p.fn();
      } catch { /* noop */ }
    }, i * 400);
  });
};

/**
 * Periodically retry queued bells. Browsers sometimes allow resume() to
 * succeed from a timer (not just a user gesture) if the tab was recently
 * active. This catches the case where a staff member is watching the
 * dashboard but hasn't clicked in a while.
 */
const startRetryTimer = () => {
  if (retryTimer) return;
  retryTimer = setInterval(async () => {
    if (pendingPlays.length === 0) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    // Try to resume — may succeed even without a user gesture in some browsers.
    if (!isRunning(ctx)) {
      try { await ctx.resume(); } catch { /* noop */ }
    }
    if (isRunning(ctx)) {
      // Context is running. If we're already unlocked, flush immediately.
      // If not unlocked, this resume might have worked — try flushing anyway
      // since the browser allowed it.
      flushPending();
    }
  }, RETRY_MS);
};

if (typeof window !== 'undefined') {
  const handler = () => unlockAudio();
  window.addEventListener('click', handler, { passive: true });
  window.addEventListener('touchstart', handler, { passive: true });
  window.addEventListener('keydown', handler, { passive: true });
  window.addEventListener('pointerdown', handler, { passive: true });

  // When the tab becomes visible again, try to resume the AudioContext and
  // flush any bells that were queued while it was backgrounded. Browsers
  // suspend AudioContext for backgrounded tabs, so bells arriving during
  // that time are silently queued. This ensures they replay on refocus.
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // visibilitychange is NOT a user gesture, but resume() often succeeds
      // here because the tab was previously interacted with.
      const ctx = getAudioCtx();
      if (ctx) {
        ensureRunning(ctx).then(() => {
          flushPending();
          // If resume worked, mark as unlocked so future bells play immediately.
          if (!unlocked && isRunning(ctx)) {
            unlocked = true;
          }
        });
      }
    }
  });

  startRetryTimer();
}

/* ------------------------------------------------------------------ */
/*  Synthesis primitives                                               */
/* ------------------------------------------------------------------ */

/**
 * Play one "ding" — a rich bell-like tone made of a fundamental
 * frequency plus three inharmonic partials. Stacking voices is what
 * gives a real bell its body; a single sine wave just sounds like a
 * faint beep.
 */
const playBellTone = (ctx, masterGain, freq, startOffset, duration) => {
  // Harmonic partials of a struck bell — not pure integer multiples
  // (that's why bells sound metallic, not flute-like).
  const partials = [
    { mult: 1.0, gain: 1.0 },
    { mult: 2.01, gain: 0.55 },
    { mult: 3.02, gain: 0.35 },
    { mult: 4.85, gain: 0.22 },
  ];

  const t0 = ctx.currentTime + startOffset;

  partials.forEach(({ mult, gain }) => {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    osc.connect(g);
    g.connect(masterGain);

    // Sharp attack, long exponential decay — characteristic bell envelope.
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  });

  // A tiny square-wave "click" at the very start gives the strike its
  // initial transient — makes the bell sound less synthetic.
  const click = ctx.createOscillator();
  const clickGain = ctx.createGain();
  click.type = 'square';
  click.frequency.value = freq * 6;
  click.connect(clickGain);
  clickGain.connect(masterGain);
  clickGain.gain.setValueAtTime(0.0001, t0);
  clickGain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.002);
  clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.04);
  click.start(t0);
  click.stop(t0 + 0.08);
};

/* ------------------------------------------------------------------ */
/*  Public bell patterns                                               */
/* ------------------------------------------------------------------ */

/**
 * Service-bell pattern used for new orders on the KDS.
 *   ding! ... ding! ... ding!
 * Repeated 3 times at 320 ms intervals — alarm-loud, impossible to miss.
 */
const playNewOrderPattern = (settings) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = Math.max(0.05, settings.volume);
  master.connect(ctx.destination);

  const interval = 0.32;
  const duration = 0.6;
  const baseFreq = 1320;
  for (let i = 0; i < 3; i++) {
    playBellTone(ctx, master, baseFreq, i * interval, duration);
  }
};

/**
 * "Your order is ready" pattern used on the customer mobile tracker.
 *   ding-dong-ding-dong (two alternating bells, 4 hits)
 */
const playOrderReadyPattern = (settings) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = Math.max(0.05, settings.volume);
  master.connect(ctx.destination);

  const high = 1568; // G6
  const low = 1175; // D6
  const interval = 0.28;
  const duration = 0.55;
  const sequence = [high, low, high, low];
  sequence.forEach((freq, i) => {
    playBellTone(ctx, master, freq, i * interval, duration);
  });
};

/**
 * "Waiter, please come to my table" chime used when a guest taps
 * "Call waiter" on the QR menu. Deliberately DIFFERENT from the order alarm
 * (3 high dings) and the ready chime (G6/D6) so staff instantly know a guest
 * needs attention rather than another order arriving:
 *   dong-ding-dong-ding (C6 then G6, twice) — the classic concierge bell.
 */
const playWaiterPattern = (settings) => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const master = ctx.createGain();
  master.gain.value = Math.max(0.05, settings.volume);
  master.connect(ctx.destination);

  const low = 1046; // C6
  const high = 1568; // G6
  const interval = 0.3;
  const duration = 0.6;
  const sequence = [low, high, low, high];
  sequence.forEach((freq, i) => {
    playBellTone(ctx, master, freq, i * interval, duration);
  });
};

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

const schedule = async (label, fn) => {
  if (!unlocked) {
    console.warn(
      `[notificationSound] "${label}" queued — waiting for user interaction or retry`
    );
    pendingPlays.push({ fn, at: Date.now(), label });
    if (pendingPlays.length > PENDING_MAX) pendingPlays.shift();
    return;
  }
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    // Wait for the context to actually be running before scheduling. Without
    // this await the bell is placed on a frozen clock and plays silently.
    if (!isRunning(ctx)) await ensureRunning(ctx);
    if (!isRunning(ctx)) {
      // Browser refused to start audio (no recent user gesture in THIS tab, e.g.
      // it has been backgrounded). Queue it so it replays on the next gesture
      // or retry timer instead of being silently dropped.
      pendingPlays.push({ fn, at: Date.now(), label });
      if (pendingPlays.length > PENDING_MAX) pendingPlays.shift();
      return;
    }
    fn();
  } catch (e) {
    console.warn(`[notificationSound] Failed to play "${label}"`, e);
  }
};

/** Ring the "new order arrived" alarm bell (used by KDS). */
export const playNewOrderBell = () => {
  const settings = loadSettings();
  if (!settings.enabled) return;
  schedule('new order', () => playNewOrderPattern(settings));
};

/** Ring the "your order is ready" chime (used by customer tracker). */
export const playOrderReadyBell = () => {
  const settings = loadSettings();
  if (!settings.enabled) return;
  schedule('order ready', () => playOrderReadyPattern(settings));
};

/** Ring the "waiter called" concierge chime (used by staff alert). */
export const playWaiterBell = () => {
  const settings = loadSettings();
  if (!settings.enabled) return;
  schedule('waiter', () => playWaiterPattern(settings));
};

/**
 * Warm up / resume the AudioContext WITHOUT requiring a user gesture.
 * Called on provider mount and from socket events.
 *
 * Browsers will often allow resume() to succeed here if the tab was recently
 * active (even without a fresh click). When it does succeed, we flip `unlocked`
 * so the bell in schedule() plays immediately instead of being queued.
 * If resume() fails (truly no prior gesture), `unlocked` stays false and the
 * bell is queued for the retry timer or next user interaction.
 */
export const primeAudio = async () => {
  const ctx = getAudioCtx();
  if (!ctx) return;
  await ensureRunning(ctx);
  if (isRunning(ctx) && !unlocked) {
    unlocked = true;
    flushPending();
  }
};

/**
 * Manual test — same sound as a new order but always plays, even if
 * the user has muted via setSoundEnabled. Used by the "Test bell"
 * button so kitchen staff can verify their browser/speakers before service.
 * The click that triggered this IS a user gesture, so we force-unlock and
 * await resume to guarantee the test is audible.
 */
export const playTestBell = async () => {
  unlocked = true;
  await ensureRunning(getAudioCtx());
  const settings = { ...loadSettings(), enabled: true, volume: 1.0 };
  schedule('test', () => playNewOrderPattern(settings));
};
