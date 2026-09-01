/* Header menu (2026-09-01) — below the 900px breakpoint the nav
   collapses behind a hamburger button instead of stacking onto its own
   line under the wordmark. All the show/hide lives in CSS (header nav
   is display:none in the media query, .is-open flips it back); this
   only owns the open/closed state and the ARIA that goes with it, so
   the desktop layout is untouched by the script entirely. */
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!toggle || !nav) return;

  function setOpen(open) {
    nav.classList.toggle('is-open', open);
    toggle.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  }

  toggle.addEventListener('click', () => {
    setOpen(!nav.classList.contains('is-open'));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });

  /* Widening past the breakpoint mid-session would otherwise leave the
     desktop nav carrying a stale .is-open (harmless today, but it would
     bite the moment the open state grows any styling of its own). */
  const wide = window.matchMedia('(min-width: 901px)');
  wide.addEventListener('change', () => {
    if (wide.matches) setOpen(false);
  });
});
