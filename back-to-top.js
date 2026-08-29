// Floating back-to-top bubble: fades in once you've scrolled a bit past
// the hero, click smooth-scrolls back up to the top nav.
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const threshold = () => window.innerHeight * 0.6;

  const onScroll = () => {
    btn.classList.toggle('is-visible', window.scrollY > threshold());
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});
