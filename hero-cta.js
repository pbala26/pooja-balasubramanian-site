// Homepage hero "read an article" CTA: points at a random page from
// the site's article catalogue (the same data/articles.json build.js
// draws each page's "related articles" from) instead of a fixed link.
// Picked fresh on every load, same spirit as the hero diagram's
// layout. The markup's own href (writing.html) is left in place as a
// sane fallback if this fetch fails or JS doesn't run.
document.addEventListener('DOMContentLoaded', () => {
  const cta = document.getElementById('hero-cta');
  if (!cta) return;

  fetch('data/articles.json')
    .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
    .then((articles) => {
      if (!Array.isArray(articles) || !articles.length) return;
      const pick = articles[Math.floor(Math.random() * articles.length)];
      if (pick && pick.href) cta.href = pick.href;
    })
    .catch(() => {
      // Fetch/parse failed (e.g. opened as a local file:// page, where
      // fetch of a relative JSON file can be blocked) — leave the
      // fallback href from the markup as-is.
    });
});
