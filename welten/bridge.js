// Connects a world to the cosmos around it (index.html).
// Opened on its own, every call here simply does nothing.
window.kosmos = (() => {
  const inside = window.parent !== window;
  const listeners = [], leaving = [];
  let ton = false;
  addEventListener("message", e => {
    const d = e.data;
    if (!d || !d.kosmos || e.source !== window.parent) return;
    if ("ton" in d) { ton = !!d.ton; listeners.forEach(fn => fn(ton)); }
    if (d.leave) leaving.forEach(fn => fn(+d.leave));     // the page is being left: its own sound fades out over d.leave ms
  });
  // every message names its page, so the shell can ignore a page that is just being left
  const page = location.pathname.split("/").pop().replace(/\.html$/, "");
  const send = msg => { if (inside) window.parent.postMessage({ kosmos: 1, page, ...msg }, "*"); };
  send({ hello: true });
  return {
    inside,
    send,
    get ton() { return ton; },
    onTon(fn) { listeners.push(fn); fn(ton); },
    onLeave(fn) { leaving.push(fn); },
  };
})();

/* a quiet sign that the page goes on: a thin arrow in the lower left corner, away from pictures and performance, gently sinking.
   it appears only after a few seconds without scrolling, only while there is more below, and leaves as soon
   as you scroll. a page can hold it back while something is still happening (kosmos.scrollReady). */
(() => {
  const css = document.createElement("style");
  css.textContent = `
    .weiter { position: fixed; left: clamp(14px, 2vw, 28px); bottom: calc(16px + env(safe-area-inset-bottom)); z-index: 4;
      width: 22px; height: 70px; color: #efebe6; pointer-events: none; opacity: 0; transition: opacity 1.4s ease;
      mix-blend-mode: difference; }   /* light on dark pages, dark on light and gold ones */
    .weiter.on { opacity: 1; }
    .weiter svg { display: block; width: 100%; height: 100%; animation: weiter 3.2s ease-in-out infinite; }
    /* it breathes: fades in while sinking a little, fades out again */
    @keyframes weiter { 0% { transform: translateY(-4px); opacity: 0; } 45% { opacity: .75; } 70% { transform: translateY(4px); opacity: .75; } 100% { transform: translateY(6px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .weiter svg { animation: none; opacity: .6; } }`;
  const el = document.createElement("div");
  el.className = "weiter"; el.setAttribute("aria-hidden", "true"); el.innerHTML = '<svg viewBox="0 0 22 70" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M11 1v67M2 59l9 9 9-9"/></svg>';
  let last = performance.now();
  const moved = () => { last = performance.now(); el.classList.remove("on"); };
  ["scroll", "wheel", "touchmove", "keydown"].forEach(ev => addEventListener(ev, moved, { passive: true }));
  addEventListener("DOMContentLoaded", () => { document.head.append(css); document.body.append(el); });
  setInterval(() => {
    const se = document.scrollingElement || document.documentElement;
    // (nähe holds its first screen while you zoom in; there its own words already say "scroll weiter")
    const more = se.scrollHeight - (scrollY + innerHeight) > 120;
    const ready = !window.kosmos.scrollReady || window.kosmos.scrollReady();
    el.classList.toggle("on", more && ready && performance.now() - last > 3500);
  }, 400);
})();
