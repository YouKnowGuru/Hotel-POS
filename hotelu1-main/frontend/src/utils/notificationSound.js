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
let pendingPlays = [];

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

const unlockAudio = () => {
  if (unlocked) return;
  unlocked = true;
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  const queued = pendingPlays.splice(0);
  queued.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
};

if (typeof window !== 'undefined') {
  const handler = () => unlockAudio();
  window.addEventListener('click', handler, { passive: true });
  window.addEventListener('touchstart', handler, { passive: true });
  window.addEventListener('keydown', handler, { passive: true });
  window.addEventListener('pointerdown', handler, { passive: true });
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

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

const schedule = (label, fn) => {
  if (!unlocked) {
    console.warn(
      `[notificationSound] "${label}" queued — waiting for first user interaction`
    );
    pendingPlays.push(fn);
    return;
  }
  try {
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

/**
 * Explicit unlock. Call this from any visible UI button so the very
 * first audio play after page load isn't blocked by the browser's
 * autoplay policy.
 */
export const primeAudio = () => unlockAudio();

/**
 * Manual test — same sound as a new order but always plays, even if
 * the user has muted via setSoundEnabled. Used by the "Test bell"
 * button so kitchen staff can verify their browser/speakers before service.
 */
export const playTestBell = () => {
  unlockAudio();
  const settings = { ...loadSettings(), enabled: true, volume: 1.0 };
  schedule('test', () => playNewOrderPattern(settings));
};
