// Related-articles carousel: prev/next buttons scroll the track by
// one card width at a time. Native drag/touch/trackpad scrolling
// on .related-viewport works without any JS at all — this just
// wires up the arrow buttons.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.related').forEach((section) => {
    const viewport = section.querySelector('.related-viewport');
    const track = section.querySelector('.related-track');
    const prev = section.querySelector('.related-arrow.prev');
    const next = section.querySelector('.related-arrow.next');
    if (!viewport || !track) return;

    const cardStep = () => {
      const card = track.querySelector('.related-item');
      if (!card) return 0;
      const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '0');
      return card.getBoundingClientRect().width + gap;
    };

    if (prev) {
      prev.addEventListener('click', () => {
        viewport.scrollBy({ left: -cardStep(), behavior: 'smooth' });
      });
    }
    if (next) {
      next.addEventListener('click', () => {
        viewport.scrollBy({ left: cardStep(), behavior: 'smooth' });
      });
    }
  });

  // Data charts: series grow up from the baseline once the chart has
  // fully scrolled into view. Runs once per chart, then unobserves.
  const charts = document.querySelectorAll('.data-chart');
  if (charts.length && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.6 });
    charts.forEach((chart) => io.observe(chart));
  } else {
    charts.forEach((chart) => chart.classList.add('in-view'));
  }

  // Photo gallery lightbox: click any .gallery-grid image to expand it
  // full-screen; click the overlay, the close button, or press Escape
  // to dismiss. One shared lightbox element is reused across galleries.
  const galleryImages = document.querySelectorAll('.gallery-grid img');
  const lightbox = document.querySelector('.lightbox');
  if (galleryImages.length && lightbox) {
    const lightboxImg = lightbox.querySelector('.lightbox-img');
    const closeBtn = lightbox.querySelector('.lightbox-close');

    const open = (src, alt) => {
      lightboxImg.src = src;
      lightboxImg.alt = alt || '';
      lightbox.classList.add('is-open');
      lightbox.setAttribute('aria-hidden', 'false');
    };
    const close = () => {
      lightbox.classList.remove('is-open');
      lightbox.setAttribute('aria-hidden', 'true');
      lightboxImg.src = '';
    };

    galleryImages.forEach((img) => {
      img.addEventListener('click', () => open(img.currentSrc || img.src, img.alt));
    });
    if (closeBtn) closeBtn.addEventListener('click', close);
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') close();
    });
  }
});
