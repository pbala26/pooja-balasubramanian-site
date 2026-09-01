// Homepage hero diagram: scatters the concept-word boxes across the
// hero, floating on top of the (large, left-aligned) hero text, with a
// fresh random layout on every page load (a reload reshuffles the
// whole thing). Draws the connecting web as SVG arcs glued to each
// word's live (bobbing) centre, and gives each box its own continuous,
// slow wander.
//
// The wander is driven by summing two sine waves per axis at an
// incommensurate frequency ratio (golden ratio) rather than by CSS
// @keyframes. A multi-stop @keyframes animation eases to zero velocity
// at every stop, which reads as a stutter/pause-and-go — sine curves
// have no such stops, so the motion never pauses or changes direction
// sharply; it's continuously smooth. Recomputed every animation frame
// alongside the line-endpoint sync below, since both need to run in
// step anyway.
//
// MOBILE (2026-08-30): the diagram used to be `display:none` below
// 900px ("dense diagram doesn't fit a stacked mobile hero"). It now
// runs on phones too, but thinned out: home.css hides three nodes via
// `.hero-node[data-mobile="hide"]` under the same 900px breakpoint,
// and everything below adapts to whatever is actually visible rather
// than assuming all nine. CSS stays the single source of truth for
// WHICH nodes show — this file just reads computed display and works
// with what's left, so changing the mobile subset is a CSS-only edit.
document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('.hero-diagram');
  if (!root) return;

  const allNodes = Array.from(root.querySelectorAll('.hero-node'));
  const svg = root.querySelector('.hero-diagram-lines');
  if (!allNodes.length || !svg) return;

  // Indices refer to the node order in index.html (updated 2026-09-01
  // for the consultancy-portfolio rebuild — was a 9-word set of loose
  // concept words, now the 8 consultancy tags):
  // 0 Debt, 1 Finance, 2 Development, 3 Care Economy, 4 Social Policy,
  // 5 Data, 6 Impact evaluation, 7 Systematic Review
  // Edges naming a node that's hidden at the current breakpoint are
  // dropped in build() below (and the rest renumbered), so this list
  // always describes the FULL desktop web — don't prune it by hand.
  // A 3-regular graph (every node has exactly 3 edges) — the 6 nodes
  // that stay visible on mobile (0-5) already form their own connected
  // sub-web on their own, so hiding nodes 6/7 there doesn't strand
  // anything.
  const EDGES_ALL = [
    [0, 1], [0, 4], [0, 6],
    [1, 2], [1, 5],
    [2, 3], [2, 7],
    [3, 4], [3, 5],
    [4, 7],
    [5, 6],
    [6, 7],
  ];

  const svgNS = 'http://www.w3.org/2000/svg';
  const GOLDEN = 1.61803398875;
  const NARROW = 700; // below this, lay out in 2 columns instead of 3
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // All of these are rebuilt from scratch by build(), which re-runs on
  // a width change (breakpoint crossing / device rotation) — the
  // visible node set and therefore the whole web can change there.
  let nodes = [];
  let innerEls = [];
  let edges = [];
  let lineEls = [];
  let curvature = [];
  let motion = [];
  let lastWidth = null;

  // .hero-node-inner is the element that actually carries the visible
  // box (background, padding, text) AND the translate(-50%,-50%) that
  // centres it on its outer .hero-node's anchor point. Read/write
  // position and transform on THIS element, not the outer div — the
  // outer div's own getBoundingClientRect() reflects its pre-transform
  // flow box, which sits offset from where the box is actually
  // painted. (Using the outer rect for the line sync was an earlier
  // bug: lines landed near a box's corner instead of the word centre.)
  function build() {
    // Drop the previous web — paths are recreated per active edge.
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    // Which nodes are actually on at this breakpoint? Read computed
    // display rather than re-testing the media query here, so the CSS
    // stays the only place the mobile subset is defined.
    const origToActive = new Map();
    nodes = [];
    innerEls = [];
    allNodes.forEach((node, origIdx) => {
      if (getComputedStyle(node).display === 'none') return;
      origToActive.set(origIdx, nodes.length);
      nodes.push(node);
      innerEls.push(node.querySelector('.hero-node-inner'));
    });
    if (!nodes.length) return;

    edges = EDGES_ALL
      .filter(([a, b]) => origToActive.has(a) && origToActive.has(b))
      .map(([a, b]) => [origToActive.get(a), origToActive.get(b)]);

    // --- randomised layout ---------------------------------------------
    // A fresh scatter every load (Math.random() reseeds itself each page
    // visit — no explicit seed needed), but STRATIFIED rather than pure
    // rejection sampling: the usable area is split into a grid of one
    // cell per word and which word lands in which cell is shuffled.
    // Pure random sampling of so few points is small enough to easily
    // read as "bunched in a corner" by chance (or leave large empty
    // patches) even when it's not biased — splitting the area into
    // cells up front guarantees every region of the hero gets a word,
    // while the randomised jitter within each cell (plus shuffled cell
    // assignment) keeps it from looking like a rigid grid.
    const rootRect = root.getBoundingClientRect();
    const W = rootRect.width || 1;
    const H = rootRect.height || 1;
    const narrow = W < NARROW;

    // Keep-out from the section's own edge — deliberately more generous
    // than the site's standard --margin so boxes never crowd the edge of
    // the page the way ordinary content is allowed to. Tightened on
    // narrow screens, where 64px of padding either side would leave the
    // boxes almost no width to scatter across.
    //
    // Vertical keep-out is much smaller than horizontal (2026-09-01):
    // the hero row is taller than the h1 text block it centres, on
    // purpose, so the tags have room to extend above/below the text —
    // a tight vertical EDGE_PADDING (matching the horizontal one) ate
    // most of that slack, leaving the tags reliably boxed in around
    // the text instead of overflowing it top/bottom the way this is
    // meant to look.
    const siteMargin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--margin')) || 40;
    const EDGE_PADDING_X = siteMargin + (narrow ? 8 : 24); // 64px desktop, 28px mobile
    const EDGE_PADDING_Y = narrow ? EDGE_PADDING_X : 16;
    const GUTTER = narrow ? 6 : 12; // breathing room between adjacent cells

    const usableLeft = EDGE_PADDING_X;
    const usableTop = EDGE_PADDING_Y;
    const usableW = Math.max(1, W - EDGE_PADDING_X * 2);
    const usableH = Math.max(1, H - EDGE_PADDING_Y * 2);
    // 3 columns of word-boxes don't fit side by side on a phone, so a
    // narrow hero goes 2-up and grows taller instead. Rows follow from
    // however many nodes are actually visible (9 -> 3x3 desktop,
    // 6 -> 2x3 mobile), so the grid always has a cell per word.
    const COLS = narrow ? 2 : 3;
    const ROWS = Math.ceil(nodes.length / COLS);
    const cellW = usableW / COLS;
    const cellH = usableH / ROWS;

    const cells = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) cells.push({ c, r });
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }

    nodes.forEach((node, i) => {
      const inner = innerEls[i];
      const w = inner.offsetWidth || 80;
      const h = inner.offsetHeight || 40;
      const cell = cells[i % cells.length];
      const cx0 = usableLeft + cell.c * cellW;
      const cy0 = usableTop + cell.r * cellH;

      // Jitter the box's centre freely within its cell (minus its own
      // half-size + a small gutter, so it can't spill past the cell into
      // a neighbour); if a box is wider/taller than its cell allows
      // (long words like "self determination"), it just centres in the
      // cell rather than being forced.
      const rangeX = Math.max(0, cellW - w - GUTTER * 2);
      const rangeY = Math.max(0, cellH - h - GUTTER * 2);
      const px = cx0 + w / 2 + GUTTER + Math.random() * rangeX;
      const py = cy0 + h / 2 + GUTTER + Math.random() * rangeY;

      node.style.left = `${((px / W) * 100).toFixed(2)}%`;
      node.style.top = `${((py / H) * 100).toFixed(2)}%`;
      node.style.visibility = 'visible';
    });

    // --- connecting lines ------------------------------------------------
    // Each connection is a soft arc (quadratic Bézier <path>), not a
    // straight <line>. The curvature amount + direction (which side it
    // bows toward) is fixed per edge at build time rather than recomputed
    // from the two boxes' current positions — if it were derived from
    // their live positions it would flip which way the arc bows as the
    // boxes wander past each other, reading as a glitch. A fixed
    // per-edge curvature just means the endpoints (and the arc's
    // midpoint with them) move smoothly with the boxes, same as before.
    lineEls = edges.map(() => {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
      return path;
    });
    curvature = edges.map(() => (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.1));

    // Per-box wander parameters: a slow primary sine per axis plus a
    // smaller secondary sine at the golden-ratio multiple of the primary
    // frequency, so the combined path is quasi-periodic (never quite
    // repeats) instead of a simple ellipse, while staying perfectly
    // smooth. Period ~20–34s per box — slow and gentle, never a sharp
    // swing. Amplitude is scaled down on narrow screens: the same
    // ~7–13px drift that reads as a gentle float on a wide hero eats a
    // much larger share of a phone's column width and starts to read as
    // boxes colliding.
    const ampScale = narrow ? 0.55 : 1;
    motion = nodes.map(() => {
      const periodX = 20 + Math.random() * 14;
      const periodY = 20 + Math.random() * 14;
      return {
        ampX: (7 + Math.random() * 6) * ampScale,
        ampY: (7 + Math.random() * 6) * ampScale,
        wX: (Math.PI * 2) / periodX,
        wY: (Math.PI * 2) / periodY,
        w2X: ((Math.PI * 2) / periodX) * GOLDEN,
        w2Y: ((Math.PI * 2) / periodY) * GOLDEN,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
        phase2X: Math.random() * Math.PI * 2,
        phase2Y: Math.random() * Math.PI * 2,
      };
    });
  }

  function applyMotion(t) {
    innerEls.forEach((inner, i) => {
      const m = motion[i];
      const dx = m.ampX * Math.sin(t * m.wX + m.phaseX) + m.ampX * 0.4 * Math.sin(t * m.w2X + m.phase2X);
      const dy = m.ampY * Math.sin(t * m.wY + m.phaseY) + m.ampY * 0.4 * Math.sin(t * m.w2Y + m.phase2Y);
      inner.style.transform = `translate(calc(-50% + ${dx.toFixed(2)}px), calc(-50% + ${dy.toFixed(2)}px))`;
    });
  }

  // Keep line endpoints glued to each word's actual visual centre —
  // read from the transformed inner element, not the outer box (see
  // note above) — every frame, since the wander moves it continuously.
  function updateLines() {
    const r = root.getBoundingClientRect();
    edges.forEach(([a, b], i) => {
      const ra = innerEls[a].getBoundingClientRect();
      const rb = innerEls[b].getBoundingClientRect();
      const x1 = ra.left + ra.width / 2 - r.left;
      const y1 = ra.top + ra.height / 2 - r.top;
      const x2 = rb.left + rb.width / 2 - r.left;
      const y2 = rb.top + rb.height / 2 - r.top;

      // Control point: the segment's midpoint, nudged perpendicular to
      // the line by a fraction of its own length (this edge's fixed
      // curvature) — a quadratic curve through that point reads as a
      // gentle, even bow rather than a kink.
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      const dx = x2 - x1;
      const dy = y2 - y1;
      const cx = mx - dy * curvature[i];
      const cy = my + dx * curvature[i];

      lineEls[i].setAttribute('d', `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`);
    });
  }

  build();
  lastWidth = window.innerWidth;
  updateLines();

  // Re-layout on a WIDTH change only. Two reasons it has to re-run at
  // all: crossing the 900px breakpoint changes which nodes exist, and
  // rotating a phone changes the grid the cells are cut from. But it
  // must NOT re-run on a height-only resize — mobile browsers fire
  // `resize` every time the URL bar hides or shows during a scroll, and
  // rebuilding there would reshuffle the whole layout under the reader
  // mid-scroll. Height-only changes just re-sync the arcs.
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (window.innerWidth === lastWidth) {
        updateLines();
        return;
      }
      lastWidth = window.innerWidth;
      build();
      updateLines();
    }, 200);
  });

  if (reduceMotion) return;

  function frame(now) {
    applyMotion(now / 1000);
    updateLines();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
