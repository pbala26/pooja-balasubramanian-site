// Quick-nav: smooth-scrolls to a section when a .quick-nav-link pill
// is clicked, instead of the browser's instant anchor jump. Offset is
// handled by each target's own scroll-margin-top in home.css, so this
// script only needs to trigger the scroll and update the URL hash.
document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('.quick-nav-link').forEach((link) => {
    link.addEventListener('click', (e) => {
      const id = link.getAttribute('href');
      if (!id || id.charAt(0) !== '#') return;
      const target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      history.pushState(null, '', id);
    });
  });
});
