import React, { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import {
  loadBranding,
  BRANDING_UPDATED_EVENT,
} from '../utils/branding';

/**
 * Shared brand mark (logo + optional tagline) driven by the admin's
 * Branding settings. Listens for live updates so a save in Settings
 * re-renders every brand surface without a reload.
 *
 * Props:
 *  - size:        px of the mark (default 44)
 *  - iconSize:    px of the fallback flame (default 24)
 *  - nameClass:   classes for the site name text
 *  - taglineClass: classes for the tagline text
 *  - showTagline: override (defaults to branding.showTagline)
 *  - light:       render the light (white text) variant used on navy surfaces
 */
const BrandMark = ({
  size = 44,
  iconSize = 24,
  nameClass = 'text-base font-bold',
  taglineClass = 'text-[11px]',
  showTagline,
  light = false,
  style = {},
}) => {
  const [branding, setBranding] = useState(() => loadBranding());

  useEffect(() => {
    const reload = () => setBranding(loadBranding());
    window.addEventListener(BRANDING_UPDATED_EVENT, reload);
    window.addEventListener('storage', (e) => {
      if (e.key === 'siteBranding') reload();
    });
    return () => window.removeEventListener(BRANDING_UPDATED_EVENT, reload);
  }, []);

  const radius =
    branding.logoShape === 'circle'
      ? '9999px'
      : branding.logoShape === 'square'
        ? '4px'
        : '12px';

  const taglineVisible =
    typeof showTagline === 'boolean' ? showTagline : branding.showTagline;

  return (
    <div className="flex items-center gap-3" style={style}>
      <div
        className="flex items-center justify-center shrink-0 overflow-hidden"
        style={{
          width: size,
          height: size,
          borderRadius: radius,
          background: branding.logo
            ? 'rgba(255,255,255,0.95)'
            : 'linear-gradient(135deg, #D4A017 0%, #A16207 100%)',
          boxShadow: '0 4px 16px rgba(212, 160, 23, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)',
        }}
      >
        {branding.logo ? (
          <img
            src={branding.logo}
            alt={branding.siteName}
            className="w-full h-full object-contain p-1"
          />
        ) : (
          <Flame className="text-white" style={{ width: iconSize, height: iconSize }} />
        )}
      </div>
      <div className="min-w-0">
        <p
          className={`${nameClass} leading-tight truncate ${light ? 'text-white' : ''}`}
          style={{
            fontFamily: '"Playfair Display SC", Georgia, serif',
            color: light ? undefined : 'var(--text-primary)',
          }}
        >
          {branding.siteName}
        </p>
        {taglineVisible && branding.tagline ? (
          <p
            className={`${taglineClass} leading-tight tracking-widest uppercase truncate`}
            style={{ color: light ? '#D4A017' : 'var(--accent-gold, #A16207)' }}
          >
            {branding.tagline}
          </p>
        ) : null}
      </div>
    </div>
  );
};

export default BrandMark;
