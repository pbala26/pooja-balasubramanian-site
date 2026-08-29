// Related-articles carousel: loops infinitely in both directions, via
// any scroll method (arrow buttons, trackpad, touch), not just the
// buttons. Technique: duplicate the item set twice more (3 copies back
// to back), start scrolled into the middle copy, then silently snap
// scrollLeft back into that middle copy whenever a scroll strays into
// copy 1 or copy 3 — the illusion of infinite content in both directions.
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

    const originalItems = Array.from(track.children);
    const canLoop = originalItems.length > 1;
    if (canLoop) {
      for (let copy = 0; copy < 2; copy++) {
        originalItems.forEach((item) => track.appendChild(item.cloneNode(true)));
      }
    }

    // One "set" = the width of the original, un-cloned item list.
    const setWidth = () => track.scrollWidth / 3;

    // Move scrollLeft without the smooth-scroll animation being visible
    // (a plain assignment would otherwise animate across the whole jump).
    const jumpTo = (left) => {
      viewport.style.scrollBehavior = 'auto';
      viewport.scrollLeft = left;
      viewport.style.scrollBehavior = '';
    };

    if (canLoop) {
      jumpTo(setWidth());

      let ticking = false;
      viewport.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          const len = setWidth();
          if (viewport.scrollLeft < len * 0.5) {
            jumpTo(viewport.scrollLeft + len);
          } else if (viewport.scrollLeft > len * 1.5) {
            jumpTo(viewport.scrollLeft - len);
          }
          ticking = false;
        });
      });
    }

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

  // Photo credit bubble: click the "i" button on a hero image to open
  // a small popover with the photo credit, instead of a permanent
  // caption line under the image. Closes on outside click or Escape.
  document.querySelectorAll('.photo-credit').forEach((wrap) => {
    const btn = wrap.querySelector('.photo-credit-btn');
    const popover = wrap.querySelector('.photo-credit-popover');
    if (!btn || !popover) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = popover.classList.toggle('is-open');
      btn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) {
        popover.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        popover.classList.remove('is-open');
        btn.setAttribute('aria-expanded', 'false');
      }
    });
  });

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
