/* ------------------------------------------------------------------ */
/*  Site branding (admin-controlled)                                   */
/*                                                                     */
/*  The admin can customise the site name, tagline, logo and browser   */
/*  metadata from Settings → Branding. Values are persisted to the     */
/*  server-side settings table (key `siteBranding`) and mirrored into  */
/*  localStorage so every surface renders instantly on cold load —     */
/*  including the public QR-menu and login screens, which read         */
/*  localStorage before any auth exists.                               */
/*                                                                     */
/*  Defaults fall back to the classic Hotel POS identity.              */
/* ------------------------------------------------------------------ */

import { getAPI_URL } from './api';

const STORAGE_KEY = 'siteBranding';
const SERVER_KEY = 'siteBranding';
export const BRANDING_UPDATED_EVENT = 'branding-updated';

export const DEFAULT_BRANDING = {
  siteName: 'Hotel POS',
  tagline: 'Management Suite',
  logo: '', // data-URL image; empty = default flame icon
  logoShape: 'rounded', // 'rounded' | 'circle' | 'square'
  favicon: '', // data-URL image; empty = default favicon.ico
  showTagline: true,
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));

const sanitise = (raw) => {
  const b = { ...clone(DEFAULT_BRANDING), ...(raw || {}) };
  b.siteName = String(b.siteName || '').trim().slice(0, 40) || DEFAULT_BRANDING.siteName;
  b.tagline = String(b.tagline || '').trim().slice(0, 60);
  b.logoShape = ['rounded', 'circle', 'square'].includes(b.logoShape)
    ? b.logoShape
    : 'rounded';
  b.logo = typeof b.logo === 'string' && b.logo.startsWith('data:image/') ? b.logo : '';
  b.favicon =
    typeof b.favicon === 'string' && b.favicon.startsWith('data:image/') ? b.favicon : '';
  b.showTagline = !!b.showTagline;
  return b;
};

const writeLocal = (branding) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(branding));
  } catch {
    /* storage full or unavailable — branding simply won't persist locally */
  }
};

/**
 * Derive sensible branding from the General settings
 * (Settings → General → Restaurant Name) so the real business name
 * shows everywhere even before the admin opens the Branding tab.
 * Accepts an optional server-provided name (customer devices have no
 * access to the admin's localStorage).
 */
const deriveFromGeneral = (serverName) => {
  let name = String(serverName || '').trim();
  if (!name) {
    try {
      const raw = localStorage.getItem('systemSettingsExtended_v1');
      const general = raw ? JSON.parse(raw) : {};
      name = String(general.restaurantName || '').trim();
    } catch {
      /* ignore */
    }
  }
  if (!name) return null;
  return { ...clone(DEFAULT_BRANDING), siteName: name.slice(0, 40), tagline: '' };
};

/** True when branding is still byte-identical to the shipped defaults. */
const isUntouched = (b) =>
  b &&
  b.siteName === DEFAULT_BRANDING.siteName &&
  b.tagline === DEFAULT_BRANDING.tagline &&
  !b.logo &&
  !b.favicon &&
  b.logoShape === DEFAULT_BRANDING.logoShape &&
  b.showTagline === DEFAULT_BRANDING.showTagline;

/** Read the locally-cached branding (sync, safe during first render). */
export const loadBranding = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? sanitise(JSON.parse(raw)) : clone(DEFAULT_BRANDING);
    // Branding never customized → inherit the real restaurant name.
    if (isUntouched(parsed)) {
      return sanitise(deriveFromGeneral() || parsed);
    }
    return parsed;
  } catch {
    return sanitise(deriveFromGeneral() || DEFAULT_BRANDING);
  }
};

/**
 * Persist branding to localStorage AND the server settings table.
 * Fires BRANDING_UPDATED_EVENT so live components re-render without
 * a page reload. Returns the sanitised branding that was saved.
 */
export const saveBranding = async (branding) => {
  const clean = sanitise(branding);
  writeLocal(clean);
  try {
    window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT, { detail: clean }));
  } catch {
    /* noop */
  }

  // Best-effort server persistence so other browsers/devices pick it up.
  try {
    const token = localStorage.getItem('token');
    if (token) {
      await fetch(`${getAPI_URL()}/api/settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: SERVER_KEY,
          value: clean,
          description: 'Admin branding: site name, tagline, logo, favicon',
        }),
      });
    }
  } catch {
    /* offline / non-admin — local copy still applies */
  }
  return clean;
};

/**
 * Pull the server copy into localStorage. Call once at app boot (and
 * after login) so every device converges on the admin's branding.
 * Returns the effective branding, or null when no server copy exists.
 */
export const fetchBrandingFromServer = async () => {
  try {
    const res = await fetch(
      `${getAPI_URL()}/api/settings?key=${encodeURIComponent(SERVER_KEY)}`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.value && typeof data.value === 'object') {
      let clean = sanitise(data.value);
      // Server branding still at defaults → overlay the restaurant name
      // saved by the General settings (admin persists it server-side).
      if (isUntouched(clean)) {
        let serverName = '';
        try {
          const r2 = await fetch(
            `${getAPI_URL()}/api/settings?key=restaurantName`
          );
          if (r2.ok) {
            const d2 = await r2.json();
            serverName = typeof d2?.value === 'string' ? d2.value : '';
          }
        } catch {
          /* ignore */
        }
        clean = sanitise(deriveFromGeneral(serverName) || clean);
      }
      writeLocal(clean);
      try {
        window.dispatchEvent(new CustomEvent(BRANDING_UPDATED_EVENT, { detail: clean }));
      } catch {
        /* noop */
      }
      return clean;
    }
    return null;
  } catch {
    return null;
  }
};

/** Reset to defaults (clears local + server). */
export const resetBranding = async () => {
  return saveBranding(clone(DEFAULT_BRANDING));
};

/* ------------------------------------------------------------------ */
/*  DOM side-effects                                                   */
/* ------------------------------------------------------------------ */

const svgToFavicon = (dataUrl) => dataUrl; // data-URLs work directly as favicons

/** Apply branding to the browser tab (title + favicon). */
export const applyDocumentBranding = (branding) => {
  const b = sanitise(branding);
  try {
    document.title = b.siteName || 'Restaurant POS System';

    const head = document.head;
    let link = head.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      head.appendChild(link);
    }
    if (b.favicon) {
      link.href = svgToFavicon(b.favicon);
      link.type = b.favicon.includes('image/svg') ? 'image/svg+xml' : 'image/png';
    } else {
      link.href = '/favicon.ico';
    }
  } catch {
    /* noop */
  }
};

/** Shared class/style helpers for rendering the brand mark consistently. */
export const brandMarkStyle = (branding) => {
  const b = sanitise(branding);
  const radius =
    b.logoShape === 'circle' ? '9999px' : b.logoShape === 'square' ? '4px' : '12px';
  return { borderRadius: radius };
};
