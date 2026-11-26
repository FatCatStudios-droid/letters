/* review notes, right on the page: right click (laptop) or a long press (phone) anywhere — on a symbol, an image, a line —
   opens a small note. it is saved together with where exactly it was left (tab, element, position), so the change can be
   found again without describing it. only active on the local preview server (tools/serve.py keeps the notes);
   on the public site /__notes does not exist and nothing of this appears. */
(() => {
  const API = "/__notes";
  const NAMES = { home: "home", naehe: "nähe", stille: "stille", stueck: "über · das stück", ensemble: "über · ensemble",
                  presse: "über · presse", journal: "journal", kontakt: "kontakt", impressum: "kontakt · impressum" };
  let notes = [], frame = null, pop = null;

  fetch(API, { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(list => {
    if (Array.isArray(list)) { notes = list; start(); }
  }).catch(() => {});

  const tab = () => location.hash.slice(1) || "home";
  const isWorld = () => document.getElementById("panel")?.hidden !== false;
  const file = u => (u || "").split("?")[0].split("/").pop();
  const clean = s => (s || "").replace(/\s+/g, " ").trim();

  // a few words that name what was touched: the symbol's name, the picture, its caption, the nearest bit of text
  const describe = el => {
    const out = [];
    // a name only counts when it belongs to the thing itself (a symbol), not to a whole page region
    let named = null;
    for (let e = el, i = 0; e && i < 3; e = e.parentElement, i++) if (e.hasAttribute?.("aria-label")) { named = e; break; }
    const region = named && /^(SECTION|MAIN|ARTICLE|HEADER|FOOTER|NAV|ASIDE)$/.test(named.tagName);
    if (named) out.push(named.getAttribute("aria-label"));
    if (region) named = null;
    const media = el.closest("img, video") || (el.querySelector && el.querySelector(":scope > img, :scope > video"));
    if (media) out.push((media.tagName === "IMG" ? "bild " : "video ") + file(media.currentSrc || media.src));
    const cap = el.closest("figure")?.querySelector("figcaption");
    if (cap) out.push("„" + clean(cap.textContent) + "“");
    if (!named && !media) {
      let t = "";
      for (let e = el, i = 0; e && i < 4 && !t; e = e.parentElement, i++) {
        const s = clean(e.innerText || e.textContent);
        if (s && s.length < 240) t = s;
      }
      if (t) out.push("„" + (t.length > 90 ? t.slice(0, 88) + "…" : t) + "“");
    }
    const sec = el.closest("section[id], [id]");
    if (sec && sec.id && sec.id !== "world") out.push("#" + sec.id);
    const cls = [...el.classList].slice(0, 3).join(".");
    return { label: out.join(" · ") || el.tagName.toLowerCase(), el: el.tagName.toLowerCase() + (cls ? "." + cls : "") };
  };

  /* ---------- the note window ---------- */
  const css = `
    .nz-pop{position:fixed;z-index:9999;left:50%;top:max(14px,env(safe-area-inset-top));transform:translateX(-50%);width:min(440px,calc(100vw - 24px));
      background:#0b0b0b;color:#efebe6;border:1px solid #c8a564;border-radius:6px;padding:12px;display:grid;gap:8px;
      font:400 14px/1.35 "Inter Tight","Helvetica Neue",Arial,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.6)}
    .nz-pop .nz-where{font-size:12px;color:#c8a564;overflow-wrap:anywhere}
    .nz-pop textarea{width:100%;min-height:96px;resize:vertical;font:inherit;font-size:16px;color:#efebe6;background:#161513;
      border:1px solid rgba(239,235,230,.2);border-radius:4px;padding:9px;box-sizing:border-box}
    .nz-pop .nz-row{display:flex;gap:8px;justify-content:flex-end;align-items:center}
    .nz-pop .nz-row span{margin-right:auto;font-size:12px;color:rgba(239,235,230,.55)}
    .nz-pop button{font:inherit;border-radius:999px;padding:6px 16px;cursor:pointer;border:1px solid rgba(239,235,230,.3);background:none;color:#efebe6}
    .nz-pop button.nz-save{background:#c8a564;border-color:#c8a564;color:#0b0b0b;font-weight:500}
    .nz-pop .nz-old{font-size:13px;white-space:pre-wrap;border-left:2px solid #c8a564;padding-left:8px}
    .nz-mark{position:fixed;z-index:9998;width:14px;height:14px;margin:-7px 0 0 -7px;border-radius:50%;background:#c8a564;
      box-shadow:0 0 0 3px rgba(11,11,11,.7);cursor:pointer;padding:0;border:0}
    .nz-count{position:fixed;z-index:9998;right:max(10px,env(safe-area-inset-right));top:calc(env(safe-area-inset-top) + 56px);
      font:500 12px "Inter Tight",Arial,sans-serif;color:#0b0b0b;background:#c8a564;border-radius:999px;padding:3px 9px;pointer-events:none}`;
  const style = document.createElement("style"); style.textContent = css;

  const close = () => { pop?.remove(); pop = null; };
  const open = ({ x, y, target, scroll, vw, vh }) => {
    close();
    const where = describe(target);
    const t = tab();
    pop = document.createElement("div"); pop.className = "nz-pop";
    pop.innerHTML = `<div class="nz-where"></div><textarea placeholder="was soll hier anders sein?"></textarea>
      <div class="nz-row"><span></span><button type="button" class="nz-no">abbrechen</button><button type="button" class="nz-save">speichern</button></div>`;
    pop.querySelector(".nz-where").textContent = (NAMES[t] || t) + " · " + where.label;
    const ta = pop.querySelector("textarea"), info = pop.querySelector(".nz-row span");
    pop.querySelector(".nz-no").onclick = close;
    pop.querySelector(".nz-save").onclick = async () => {
      const text = ta.value.trim(); if (!text) { ta.focus(); return; }
      info.textContent = "wird gespeichert …";
      try {
        const r = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
          text, tab: t, where, x: Math.round(x), y: Math.round(y), scroll: Math.round(scroll), vw, vh,
          device: matchMedia("(hover: none)").matches ? "handy" : "laptop" }) });
        if (!r.ok) throw 0;
        notes.push(await r.json()); close(); marks();
      } catch { info.textContent = "nicht gespeichert – läuft der mac noch?"; }
    };
    ta.addEventListener("keydown", e => { if (e.key === "Escape") close(); if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) pop.querySelector(".nz-save").click(); });
    document.body.append(pop);
    setTimeout(() => ta.focus(), 30);
  };

  /* ---------- gold dots where notes were left (open ones, this tab) ---------- */
  let layer = null;
  const marks = () => {
    layer?.remove(); layer = document.createElement("div");
    const t = tab(), mine = notes.filter(n => n.tab === t && n.status !== "erledigt");
    const scroll = isWorld() ? (frame?.contentWindow?.scrollY || 0) : (document.getElementById("panel")?.scrollTop || 0);
    for (const n of mine) {
      const top = n.y + (n.scroll || 0) - scroll;               // follows the page when it scrolls
      if (top < -10 || top > innerHeight + 10) continue;
      const b = document.createElement("button"); b.className = "nz-mark"; b.type = "button"; b.setAttribute("aria-label", "notiz ansehen");
      b.style.left = Math.min(innerWidth - 8, n.x * (innerWidth / (n.vw || innerWidth))) + "px"; b.style.top = top + "px";
      b.onclick = e => { e.stopPropagation(); show(n); };
      layer.append(b);
    }
    if (mine.length) { const c = document.createElement("div"); c.className = "nz-count"; c.textContent = mine.length + (mine.length === 1 ? " notiz" : " notizen"); layer.append(c); }
    document.body.append(layer);
  };
  const show = n => {
    close();
    pop = document.createElement("div"); pop.className = "nz-pop";
    pop.innerHTML = `<div class="nz-where"></div><div class="nz-old"></div>
      <div class="nz-row"><span></span><button type="button" class="nz-del">löschen</button><button type="button" class="nz-save">ok</button></div>`;
    pop.querySelector(".nz-where").textContent = (NAMES[n.tab] || n.tab) + " · " + (n.where?.label || "");
    pop.querySelector(".nz-old").textContent = n.text;
    pop.querySelector(".nz-row span").textContent = (n.created || "").replace("T", " ").slice(0, 16);
    pop.querySelector(".nz-save").onclick = close;
    const del = pop.querySelector(".nz-del");
    del.onclick = async () => {
      if (del.dataset.sure !== "1") { del.dataset.sure = "1"; del.textContent = "wirklich löschen?"; return; }
      try { await fetch(API + "/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: n.id }) });
        notes = notes.filter(x => x.id !== n.id); close(); marks(); } catch {}
    };
    document.body.append(pop);
  };

  /* ---------- right click and long press, in the frame and around it ---------- */
  const hook = (doc, offset, scrollOf) => {
    doc.addEventListener("contextmenu", e => {
      if (e.target.closest?.(".nz-pop")) return;
      e.preventDefault();
      const o = offset();
      open({ x: e.clientX + o.x, y: e.clientY + o.y, target: e.target, scroll: scrollOf(), vw: innerWidth, vh: innerHeight });
    });
    let timer = null, sx = 0, sy = 0;
    doc.addEventListener("touchstart", e => {
      if (e.touches.length !== 1 || e.target.closest?.(".nz-pop, .nz-mark")) return;
      const p = e.touches[0]; sx = p.clientX; sy = p.clientY;
      clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null; const o = offset();
        navigator.vibrate?.(12);
        open({ x: sx + o.x, y: sy + o.y, target: e.target, scroll: scrollOf(), vw: innerWidth, vh: innerHeight });
      }, 650);
    }, { passive: true });
    doc.addEventListener("touchmove", e => { const p = e.touches[0]; if (timer && Math.hypot(p.clientX - sx, p.clientY - sy) > 10) { clearTimeout(timer); timer = null; } }, { passive: true });
    doc.addEventListener("touchend", () => { clearTimeout(timer); timer = null; }, { passive: true });
    doc.addEventListener("scroll", () => requestAnimationFrame(marks), { passive: true, capture: true });
    // no system menu, no picture callout, no word selection while pressing long
    const s = doc.createElement("style");
    s.textContent = "html{-webkit-touch-callout:none} @media (hover:none){body{-webkit-user-select:none;user-select:none}}";
    doc.head.append(s);
  };

  function start() {
    document.head.append(style);
    frame = document.getElementById("world");
    hook(document, () => ({ x: 0, y: 0 }), () => document.getElementById("panel")?.scrollTop || 0);
    const attach = () => {
      const d = frame.contentDocument; if (!d || d.__nz) return; d.__nz = 1;
      hook(d, () => { const r = frame.getBoundingClientRect(); return { x: r.left, y: r.top }; }, () => frame.contentWindow.scrollY || 0);
      marks();
    };
    frame.addEventListener("load", attach); attach();
    addEventListener("hashchange", () => { close(); setTimeout(marks, 400); });
    addEventListener("resize", marks);
    marks();
  }
})();
