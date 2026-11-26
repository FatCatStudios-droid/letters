(() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const touch = matchMedia("(hover: none)").matches;

  /* ---------- I. scrolling = coming closer: zoom into the "o" of "von" ---------- */
  const portal = document.querySelector(".portal");
  const whisper = portal.querySelector(".whisper");
  const o = whisper.querySelector(".o");
  const hint = portal.querySelector(".hint");
  const setOrigin = () => {
    whisper.style.transform = "none";
    const w = whisper.getBoundingClientRect(), r = o.getBoundingClientRect();
    // aim at the left stroke of the "o", so the screen fills with its colour
    whisper.style.transformOrigin = `${r.left - w.left + r.width * .1}px ${r.top - w.top + r.height * .6}px`;
  };
  /* the portal does not depend on page scrolling (which behaves differently in every browser and inside the frame).
     two directions: moving on (wheel / swipe up, arrow down, space) brings you closer, moving back takes you back,
     all the way to the start if you like. sideways does nothing. the shown zoom eases toward it, so it always glides.
     at the end the page is released and slides on to "du"; scrolling back up to the very top picks the portal up again. */
  const html = document.documentElement;
  html.classList.add("locked");
  let target = 0, shown = 0, released = false;
  const STEP = () => innerHeight * 3;             // how much movement it takes to come all the way close
  const push = px => { if (!released) target = clamp(target + px / STEP()); };
  const relock = () => { released = false; html.classList.add("locked"); window.scrollTo(0, 0); };
  addEventListener("wheel", e => {
    if (e.ctrlKey) return;
    const d = Math.max(-200, Math.min(200, e.deltaY));
    if (released) { if (scrollY <= 1 && d < 0) relock(); else return; }
    e.preventDefault();
    push(d);
  }, { passive: false });
  let ty = null;
  addEventListener("touchstart", e => { ty = e.touches[0].clientY; }, { passive: true });
  addEventListener("touchmove", e => {
    if (ty === null) return;
    const y = e.touches[0].clientY, d = (ty - y) * 2.2;   // finger up = on, finger down = back
    if (released) {
      if (scrollY <= 1 && d < 0) relock();
      else {
        // a forward swipe while still on the gold: carry on to "du" even if the frame does not scroll by itself
        if (scrollY < duTop() - 5 && d > 0) { e.preventDefault(); scrollBy(0, Math.min(d, duTop() - scrollY)); }
        ty = y; return;
      }
    }
    e.preventDefault();
    push(d);
    ty = y;
  }, { passive: false });
  addEventListener("touchend", () => { ty = null; }, { passive: true });
  addEventListener("keydown", e => {
    const on = ["ArrowDown", " ", "PageDown"].includes(e.key), back = ["ArrowUp", "PageUp"].includes(e.key);
    if (!on && !back) return;
    if (released) { if (back && scrollY <= 1) relock(); else return; }
    e.preventDefault();
    push((on ? 1 : -1) * innerHeight * .25);
  });
  portal.addEventListener("click", () => push(innerHeight * .2));

  const duTop = () => portal.offsetTop + portal.offsetHeight;
  const glideToDu = () => window.scrollTo({ top: duTop(), behavior: "smooth" });
  const release = () => {
    released = true;
    html.classList.remove("locked");
    // on a laptop the page simply continues with the next scroll. on phones (where scrolling inside the frame is
    // unreliable) it glides on to "du" by itself
    if (touch) setTimeout(() => { if (released && scrollY < 5) glideToDu(); }, 350);
  };

  const zoom = () => {
    shown += (target - shown) * .12;              // ease toward where you are
    if (Math.abs(target - shown) < .0005) shown = target;
    const p = shown;
    // the same zoom factor for every step of the way (no acceleration at the end), so nothing jumps
    const s = Math.pow(900, p);
    whisper.style.transform = `scale(${s})`;
    hint.style.opacity = Math.max(0, .7 * (1 - p * 6));
    portal.classList.toggle("through", p > .92);
    // the gold veil: starts quietly while the stroke of the "o" grows, is complete just before the end
    const v = clamp((p - .7) / .27);
    portal.querySelector(".sticky").style.setProperty("--veil", (v * v * (3 - 2 * v)).toFixed(3));
    scrub(p);
    if (!released && target >= .999 && p > .985) release();
  };
  // tell the cosmos how far and how fast you move through the portal: it turns that into sound
  let lastP = -1, lastT = 0;
  const scrub = p => {
    const t = performance.now();
    if (Math.abs(p - lastP) < .0005) return;
    const v = lastP < 0 ? 0 : (p - lastP) / Math.max(.016, (t - lastT) / 1000);
    // the first frame (arriving on the page) stays silent
    if (lastP >= 0 && (p < 1 || lastP < 1)) window.kosmos?.send({ scrub: { p, v: Math.abs(v) } });
    lastP = p; lastT = t;
  };

  /* ---------- III. lines are only legible when you are near ---------- */
  const lines = [...document.querySelectorAll(".ln")];
  let mx = -9999, my = -9999;
  addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; }, { passive: true });
  const near = () => {
    const R = touch ? innerHeight * .28 : 260;
    // on touch screens the "you" is the middle of the screen
    const px = touch ? innerWidth / 2 : mx, py = touch ? innerHeight / 2 : my;
    for (const el of lines) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -50 || r.top > innerHeight + 50) continue;
      const tr = el.firstChild ? rangeRect(el) : r;
      const dx = touch ? 0 : Math.max(tr.left - px, 0, px - tr.right);
      const dy = Math.max(tr.top - py, 0, py - tr.bottom);
      const d = Math.hypot(dx, dy);
      el.style.setProperty("--near", (.1 + .9 * Math.pow(clamp(1 - d / R), 1.6)).toFixed(3));
    }
  };
  const range = document.createRange();
  const rangeRect = el => { range.selectNodeContents(el); return range.getBoundingClientRect(); };

  /* ---------- V. faces come to the cursor ---------- */
  const follow = document.querySelector(".follow");
  // a face shows only while the pointer is really over a name; scrolling, leaving the list or the page hides it
  let px = -1, py = -1;
  const place = () => {
    const li = px < 0 ? null : document.elementFromPoint(px, py)?.closest(".names li");
    if (li && li.dataset.img) {
      if (follow.getAttribute("src") !== li.dataset.img) follow.src = li.dataset.img;
      follow.classList.add("show");
      follow.style.transform = `translate(${px + 24}px, ${py - follow.offsetHeight / 2}px)`;
    } else follow.classList.remove("show");
  };
  addEventListener("pointermove", e => { if (e.pointerType !== "mouse") return; px = e.clientX; py = e.clientY; place(); }, { passive: true });
  addEventListener("scroll", place, { passive: true });
  document.addEventListener("pointerleave", () => { px = -1; place(); });
  addEventListener("blur", () => { px = -1; place(); });

  // the sound of this page is on by default; if the browser waited for a first touch, this is it
  const wake = () => { if (window.kosmos && !kosmos.ton) kosmos.send({ startTon: true }); };
  ["pointerdown", "keydown", "touchend"].forEach(e => addEventListener(e, wake, { once: true, passive: true }));

  const frame = () => { zoom(); near(); requestAnimationFrame(frame); };
  document.fonts.ready.then(() => { setOrigin(); requestAnimationFrame(frame); });
  addEventListener("resize", setOrigin);
})();
