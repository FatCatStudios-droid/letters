// Connects a world to the cosmos around it (index.html).
// Opened on its own, every call here simply does nothing.
window.kosmos = (() => {
  const inside = window.parent !== window;
  const listeners = [];
  let ton = false;
  addEventListener("message", e => {
    const d = e.data;
    if (!d || !d.kosmos || e.source !== window.parent) return;
    if ("ton" in d) { ton = !!d.ton; listeners.forEach(fn => fn(ton)); }
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
  };
})();

/* a quiet sign that the page goes on: a thin arrow in the lower right corner, away from pictures and performance, gently sinking.
   it appears only after a few seconds without scrolling, only while there is more below, and leaves as soon
   as you scroll. a page can hold it back while something is still happening (kosmos.scrollReady). */
(() => {
  const css = document.createElement("style");
  css.textContent = `
    .weiter { position: fixed; right: clamp(14px, 2vw, 28px); bottom: calc(14px + env(safe-area-inset-bottom)); z-index: 4;
      width: 14px; height: 22px; color: #efebe6; pointer-events: none; opacity: 0; transition: opacity 1.4s ease;
      mix-blend-mode: difference; }   /* light on dark pages, dark on light and gold ones */
    .weiter.on { opacity: .6; }
    .weiter svg { display: block; width: 100%; height: 100%; animation: weiter 2.8s ease-in-out infinite; }
    @keyframes weiter { 0%, 100% { transform: translateY(-2px); } 50% { transform: translateY(3px); } }
    @media (prefers-reduced-motion: reduce) { .weiter svg { animation: none; } }`;
  const el = document.createElement("div");
  el.className = "weiter"; el.setAttribute("aria-hidden", "true"); el.innerHTML = '<svg viewBox="0 0 14 22" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 1v19M1.5 14.5 7 20l5.5-5.5"/></svg>';
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
