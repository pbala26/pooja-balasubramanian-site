// Homepage hero diagram: scatters the 9 concept-word boxes across the
// hero, floating on top of the (large, left-aligned) hero text, with a
// fresh random layout on every page load (a reload reshuffles the
// whole thing). Draws the connecting web as SVG <line>s glued to each
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
document.addEventListener('DOMContentLoaded', () => {
  const root = document.querySelector('.hero-diagram');
  if (!root) return;

  const nodes = Array.from(root.querySelectorAll('.hero-node'));
  // .hero-node-inner is the element that actually carries the visible
  // box (background, padding, text) AND the translate(-50%,-50%) that
  // centres it on its outer .hero-node's anchor point. Read/write
  // position and transform on THIS element, not the outer div — the
  // outer div's own getBoundingClientRect() reflects its pre-transform
  // flow box, which sits offset from where the box is actually
  // painted. (Using the outer rect for the line sync was an earlier
  // bug: lines landed near a box's corner instead of the word centre.)
  const innerEls = nodes.map((n) => n.querySelector('.hero-node-inner'));
  const svg = root.querySelector('.hero-diagram-lines');
  if (!nodes.length || !svg) return;

  // Indices refer to the node order in index.html:
  // 0 economics, 1 debt, 2 abolition, 3 anti-caste, 4 ecologies,
  // 5 self determination, 6 sovereignty, 7 care, 8 work
  const edges = [
    [0, 1], [0, 8], [0, 6],
    [1, 2], [1, 6],
    [2, 3], [2, 7], [2, 5],
    [3, 4], [3, 5],
    [4, 7], [4, 6],
    [5, 6], [5, 8],
    [7, 8],
  ];

  // --- randomised layout ---------------------------------------------
  // A fresh scatter every load (Math.random() reseeds itself each page
  // visit — no explicit seed needed), but STRATIFIED rather than pure
  // rejection sampling: the usable area is split into a 3x3 grid (one
  // cell per word) and which word lands in which cell is shuffled.
  // Pure random sampling of only 9 points is small enough to easily
  // read as "bunched in a corner" by chance (or leave large empty
  // patches) even when it's not biased — splitting the area into 9
  // cells up front guarantees every region of the hero gets exactly
  // one word, while the randomised jitter within each cell (plus
  // shuffled cell assignment) keeps it from looking like a rigid grid.
  const rootRect = root.getBoundingClientRect();
  const W = rootRect.width || 1;
  const H = rootRect.height || 1;
  // Keep-out from the section's own edge — deliberately more generous
  // than the site's standard --margin (40px) so boxes never crowd the
  // edge of the page the way ordinary content is allowed to.
  const siteMargin = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--margin')) || 40;
  const EDGE_PADDING = siteMargin + 24; // 64px at desktop
  const GUTTER = 12; // small breathing room between adjacent cells

  const usableLeft = EDGE_PADDING;
  const usableTop = EDGE_PADDING;
  const usableW = Math.max(1, W - EDGE_PADDING * 2);
  const usableH = Math.max(1, H - EDGE_PADDING * 2);
  const COLS = 3, ROWS = 3;
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
  // bows toward) is fixed per edge at load time rather than recomputed
  // from the two boxes' current positions — if it were derived from
  // their live positions it would flip which way the arc bows as the
  // boxes wander past each other, reading as a glitch. A fixed
  // per-edge curvature just means the endpoints (and the arc's
  // midpoint with them) move smoothly with the boxes, same as before.
  const svgNS = 'http://www.w3.org/2000/svg';
  const lineEls = edges.map(() => {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('fill', 'none');
    svg.appendChild(path);
    return path;
  });
  const curvature = edges.map(() => (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.1));

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GOLDEN = 1.61803398875;

  // Per-box wander parameters: a slow primary sine per axis plus a
  // smaller secondary sine at the golden-ratio multiple of the primary
  // frequency, so the combined path is quasi-periodic (never quite
  // repeats) instead of a simple ellipse, while staying perfectly
  // smooth. Period ~20–34s per box, amplitude ~7–13px — slow and
  // gentle, never a sharp swing.
  const motion = nodes.map(() => {
    const periodX = 20 + Math.random() * 14;
    const periodY = 20 + Math.random() * 14;
    return {
      ampX: 7 + Math.random() * 6,
      ampY: 7 + Math.random() * 6,
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

  if (reduceMotion) {
    updateLines();
    window.addEventListener('resize', updateLines);
    return;
  }

  function frame(now) {
    applyMotion(now / 1000);
    updateLines();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
});
