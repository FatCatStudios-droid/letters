// Connects a world to the cosmos around it (kosmos/index.html).
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
  const send = msg => { if (inside) window.parent.postMessage({ kosmos: 1, ...msg }, "*"); };
  send({ hello: true });
  return {
    inside,
    send,
    get ton() { return ton; },
    onTon(fn) { listeners.push(fn); fn(ton); },
  };
})();
