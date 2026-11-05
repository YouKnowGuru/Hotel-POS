import { useEffect } from 'react';

/**
 * Reset an element's scroll instantly, bypassing the global
 * `html { scroll-behavior: smooth }` (index.css) so the user sees a jump,
 * not a slow animated crawl up from the bottom of the previous view.
 */
function resetEl(el) {
  if (!el || !(el instanceof HTMLElement)) return;
  if (el.scrollTop === 0 && el.scrollLeft === 0) return;
  const saved = el.style.scrollBehavior;
  el.style.scrollBehavior = 'auto';
  el.scrollTop = 0;
  el.scrollLeft = 0;
  el.style.scrollBehavior = saved;
}

function isScrollable(el) {
  const style = window.getComputedStyle(el);
  return /(auto|scroll|overlay)/.test(`${style.overflowY} ${style.overflowX}`);
}

/**
 * Reset the scroll of whichever container actually scrolls.
 *
 * Two different scroll domains exist in this app:
 *  - Public pages (wrapped in PublicShell) scroll on `window`.
 *  - Admin pages (App.jsx MenuLayout / DashboardLayout) render a fixed
 *    `100dvh; overflow:hidden` wrapper and do ALL scrolling on an inner
 *    `<main style="overflowY:auto">`. `window.scrollTo(0,0)` is a no-op
 *    there, which is why a generic fix has to handle both.
 *
 * Pass `container` (an element) to scope the reset to a modal/drawer with
 * its own scrollable body — in that case the page behind it is left alone.
 */
export function resetViewScroll(container) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;

  if (container) {
    resetEl(container);
    container.querySelectorAll('*').forEach((el) => {
      if (isScrollable(el)) resetEl(el);
    });
    return;
  }

  // 1) Public pages — document/window scroll.
  const html = document.documentElement;
  const savedHtml = html.style.scrollBehavior;
  html.style.scrollBehavior = 'auto';
  try { window.scrollTo(0, 0); } catch (_) { /* non-browser env */ }
  html.style.scrollBehavior = savedHtml;

  // 2) Admin pages — the scrollable inner <main>.
  document.querySelectorAll('main').forEach((el) => {
    if (isScrollable(el)) resetEl(el);
  });
}

/**
 * Reset scroll when an in-component view state (step / tab / view) changes.
 *
 * These are NOT route changes, so neither the browser's scroll restoration
 * nor PublicShell's pathname-keyed reset will fire. Without this, switching
 * from a long view to a shorter one leaves the viewport parked at the old
 * (bottom) offset — the new screen appears "opened at the footer".
 *
 * Usage:
 *   useViewScrollReset(activeTab);
 *   useViewScrollReset(tab, modalBodyRef);   // scoped to a modal
 */
export function useViewScrollReset(dep, containerRef) {
  useEffect(() => {
    const run = () => {
      // A scoped reset must never fall back to scrolling the whole page.
      if (containerRef && !containerRef.current) return;
      resetViewScroll(containerRef?.current);
    };
    run();
    // Late-arriving layout (tables, images, lazy data) can shift it again.
    const id = requestAnimationFrame(run);
    return () => cancelAnimationFrame(id);
  }, [dep, containerRef]);
}

export default useViewScrollReset;
