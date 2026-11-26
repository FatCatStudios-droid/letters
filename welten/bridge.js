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

/* a quiet sign that the page goes on: a thin gold line at the bottom with a small point gliding down it.
   it appears only after a few seconds without scrolling, only while there is more below, and leaves as soon
   as you scroll. a page can hold it back while something is still happening (kosmos.scrollReady). */
(() => {
  const css = document.createElement("style");
  css.textContent = `
    .weiter { position: fixed; left: 50%; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 4; transform: translateX(-50%);
      display: flex; align-items: center; gap: 9px; padding: 6px 13px 6px 14px; border-radius: 999px;
      background: rgba(11,11,11,.55); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px);
      color: #efebe6; font: 400 11px/1 "Inter Tight", "Helvetica Neue", Arial, sans-serif; letter-spacing: .04em;
      pointer-events: none; opacity: 0; transition: opacity 1.2s ease; }
    .weiter.on { opacity: 1; }
    .weiter i { position: relative; width: 1px; height: 16px; background: rgba(200,165,100,.5); }
    .weiter i::after { content: ""; position: absolute; left: -2px; top: 0; width: 5px; height: 5px; border-radius: 50%;
      background: #c8a564; animation: weiter 2.4s cubic-bezier(.45,0,.35,1) infinite; }
    @keyframes weiter { 0% { transform: translateY(-2px); opacity: 0; } 20%, 75% { opacity: 1; } 100% { transform: translateY(13px); opacity: 0; } }
    @media (prefers-reduced-motion: reduce) { .weiter i::after { animation: none; top: auto; bottom: 0; } }`;
  const el = document.createElement("div");
  el.className = "weiter"; el.setAttribute("aria-hidden", "true"); el.innerHTML = "weiter <i></i>";
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
