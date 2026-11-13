import React, { useEffect, useRef, useState } from 'react';

/**
 * MenuImage — the single image frame used by every menu surface.
 *
 * Problem it solves: an admin can upload ANY photo — a 9:16 phone shot, a
 * 1:1 Instagram crop, a 3:1 banner, a tiny 320px thumbnail. The old cards
 * forced every one of them into a fixed-pixel box with `object-fit:cover`,
 * which meant:
 *   - never distorted, but tall/wide photos had the dish chopped off;
 *   - the box height changed per breakpoint, so the SAME photo was cropped
 *     differently on a 320px phone and a 1440px desktop;
 *   - a broken URL left an empty (or invisible) card.
 *
 * Behaviour now:
 *   - one `aspect-ratio` frame at every screen width (no fixed heights);
 *   - near-frame ratios use `cover` (edge-to-edge, the normal pretty case);
 *   - extreme tall/wide ratios switch to `contain` so the WHOLE photo is
 *     visible, over a blurred copy of itself instead of empty bars;
 *   - missing/broken URLs fall back to a tinted emoji placeholder;
 *   - overlays (category chips, badges, gradients) are passed as children
 *     and always paint above the photo.
 *
 * Usage:
 *   <MenuImage src={item.image} alt={item.name} ratio="4 / 3"
 *              emoji="🍛" className="mi-zoom">
 *     <span className="my-badge">Biryani</span>
 *   </MenuImage>
 *
 * For a container with a deliberately fixed height (hero / spotlight), pass
 * `ratio={null}` + a `height` in `style`; the component measures the real
 * frame with ResizeObserver so the fit decision tracks the viewport.
 */
const parseRatio = (ratio) => {
  if (typeof ratio === 'number') return ratio > 0 ? ratio : 4 / 3;
  if (!ratio) return 4 / 3;
  const m = String(ratio).match(/^\s*([\d.]+)\s*\/\s*([\d.]+)\s*$/);
  if (m) {
    const r = Number(m[1]) / Number(m[2]);
    return Number.isFinite(r) && r > 0 ? r : 4 / 3;
  }
  const n = parseFloat(ratio);
  return Number.isFinite(n) && n > 0 ? n : 4 / 3;
};

// Photos inside this band fill the frame edge-to-edge. Outside it (very tall
// or very wide) we show the whole photo instead of cutting the subject off.
const FIT_TOLERANCE = 1.45;

export default function MenuImage({
  src,
  alt = '',
  ratio = '4 / 3',
  frameRatio: frameRatioOverride,
  fit = 'auto',
  className = '',
  style,
  children,
  emoji = '🍽️',
  placeholder = null,
  priority = false,
  tint,
  onError,
}) {
  // `src` is part of the state so a changed photo resets the fit decision
  // DURING RENDER, before the new <img> is committed. Resetting in a
  // useEffect would clobber a fast onLoad (data URLs / eager hero images
  // often load before effects run) and leave extreme photos stuck in cover.
  const [state, setState] = useState({ src, ratio: 0, broken: false });
  if (state.src !== src) {
    setState({ src, ratio: 0, broken: false });
  }
  const naturalRatio = state.ratio;
  const broken = state.broken;
  const imgRef = useRef(null);
  const frameRef = useRef(null);
  const [boxRatio, setBoxRatio] = useState(0);

  // Fixed-height frames (hero / spotlight) have a ratio that changes with
  // the viewport, so measure the REAL box instead of guessing a number.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const next = r.width / r.height;
      setBoxRatio(prev => (Math.abs(prev - next) > 0.01 ? next : prev));
    };
    measure();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      return () => ro.disconnect();
    }
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // Belt-and-braces: if the image was already complete before React attached
  // its load handler (cached or data-URL photos), read its dimensions here.
  useEffect(() => {
    const img = imgRef.current;
    if (!img || !img.complete || !img.naturalWidth || !img.naturalHeight) return;
    const r = img.naturalWidth / img.naturalHeight;
    setState(prev => (prev.src === src && prev.ratio !== r ? { ...prev, ratio: r } : prev));
  }, [src]);

  // Measured box wins; the optional `frameRatio` prop is only a fallback for
  // the very first paint (and for environments without ResizeObserver).
  const frameRatio = boxRatio || frameRatioOverride || parseRatio(ratio);
  let mode = 'cover';
  if (fit === 'contain') mode = 'contain';
  else if (fit === 'cover') mode = 'cover';
  else if (naturalRatio > 0 &&
           (naturalRatio > frameRatio * FIT_TOLERANCE ||
            naturalRatio < frameRatio / FIT_TOLERANCE)) {
    mode = 'contain';
  }

  const hasPhoto = Boolean(src) && !broken;
  const frameStyle = {
    ...(ratio ? { '--mi-ratio': String(ratio) } : { aspectRatio: 'auto' }),
    ...(tint ? { '--mi-bg': tint } : null),
    ...style,
  };

  return (
    <div ref={frameRef} className={`mi-frame ${className}`.trim()} style={frameStyle}>
      {hasPhoto && mode === 'contain' && (
        <img className="mi-backdrop" src={src} alt="" aria-hidden="true"
             loading={priority ? 'eager' : 'lazy'} decoding="async" />
      )}
      {hasPhoto ? (
        <img
          ref={imgRef}
          className={`mi-photo mi-${mode}`}
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w > 0 && h > 0) {
              const r = w / h;
              setState(prev => (prev.ratio !== r ? { ...prev, ratio: r } : prev));
            }
          }}
          onError={() => {
            setState(prev => ({ ...prev, broken: true }));
            if (onError) onError();
          }}
        />
      ) : (
        placeholder || <div className="mi-empty" aria-hidden="true">{emoji}</div>
      )}
      {children}
    </div>
  );
}
