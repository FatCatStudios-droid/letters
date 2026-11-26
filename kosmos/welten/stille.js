(() => {
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- stillness: any movement breaks it ---------- */
  let lastMove = performance.now();
  const moved = () => { lastMove = performance.now(); };
  ["pointermove", "pointerdown", "wheel", "scroll", "touchmove", "keydown"]
    .forEach(ev => addEventListener(ev, moved, { passive: true }));
  const idle = () => (performance.now() - lastMove) / 1000;

  let stillness = 0;       // 0 = restless, 1 = fully still
  let stillTotal = 0;      // seconds the visitor has been still
  let last = performance.now();
  let sendClock = 0, merged = false;

  /* ---------- I. two heartbeats find each other ---------- */
  const pair = document.querySelector(".pair");
  const dotA = pair.querySelector(".a"), dotB = pair.querySelector(".b");
  const iA = dotA.querySelector("i"), iB = dotB.querySelector("i");
  const firstLines = [...document.querySelectorAll(".first .s")];
  const name = document.querySelector(".name");
  const hint = document.querySelector(".hint");
  let beatT = 0, lineClock = 0, shown = 0, meet = 0, meetT = 0, foundAt = 0;
  const sm = { ax: -60, ay: 0, bx: 60, by: 0 };      // shown positions, eased toward where they want to be

  // lub-dub: a strong beat and a softer echo shortly after
  const pulse = ph => {
    const f = ph - Math.floor(ph);
    return 1 + .55 * Math.exp(-f * 40) + .3 * Math.exp(-Math.abs(f - .12) * 70);  // lub, then dub ~0.3 s later
  };

  /* ---------- II. letters reveal line by line, only while still ---------- */
  const blocks = [...document.querySelectorAll(".letter")];
  let blockClock = 0;
  const inView = el => {
    const r = el.getBoundingClientRect();
    return r.top < innerHeight * .8 && r.bottom > innerHeight * .15;
  };

  const sec = document.querySelector(".sec");
  const fmt = s => {
    s = Math.floor(s);
    const m = Math.floor(s / 60), r = s % 60;
    const ss = `${r} ${r === 1 ? "sekunde" : "sekunden"}`;
    return m ? `${m} ${m === 1 ? "minute" : "minuten"} ${ss}` : ss;
  };

  /* ---------- the heartbeat sound: on while the opening is in view, fading out once you scroll on to the letters ---------- */
  const opening = document.querySelector(".beat");
  let heartOn = null;
  const heartCheck = () => {
    const r = opening.getBoundingClientRect();
    const v = r.bottom > innerHeight * .45;           // most of the opening still on screen
    if (v !== heartOn) { heartOn = v; kosmos.send({ heart: v }); }
  };
  addEventListener("scroll", heartCheck, { passive: true });
  heartCheck();
  ["pointerdown", "keydown", "touchend"].forEach(e => addEventListener(e, () => kosmos.send({ heart: heartOn }), { once: true, passive: true }));

  const frame = now => {
    const dt = Math.min(.1, (now - last) / 1000); last = now;
    const still = idle() > 1.2;
    stillness = clamp(stillness + (still ? dt / 7 : -dt / 2.5));
    // in the cosmos: the music is only audible in stillness
    sendClock += dt;
    if (sendClock > .12) { sendClock = 0; kosmos.send({ level: Math.pow(stillness, 1.4) }); }
    if (still) stillTotal += dt;

    // heartbeats: one every 2.5 s, like the sound; "du" lags by up to half a beat until you are still
    beatT += dt / 2.5;
    const lag = (1 - stillness) * (.45 + .08 * Math.sin(now / 2300));
    if (!reduced) {
      iA.style.transform = `scale(${pulse(beatT)})`;
      iB.style.transform = `scale(${pulse(beatT - lag)})`;
    }
    // ich and du search for each other: slowly, on wandering paths (not only sideways), coming closer the stiller you are.
    // they find each other and beat as one for a while, then almost lose each other — and find each other again. it goes on.
    // the first meeting has its own small story, measured in seconds of stillness:
    // they approach · pause · "ich" steps back a little · pause · then they come together
    meetT = still ? meetT + dt : Math.max(0, meetT - dt * .9);    // moving apart again happens slowly
    const ss = x => { x = clamp(x); return x * x * (3 - 2 * x); };
    const T = meetT;
    let mB = T < 7 ? .5 * ss(T / 7) : T < 19 ? .5 : .5 + .5 * ss((T - 19) / 7);
    // it is always "ich" who steps away
    let mA = T < 7 ? .5 * ss(T / 7)
           : T < 10 ? .5                                  // innehalten
           : T < 14 ? .5 - .35 * ss((T - 10) / 4)        // ich geht langsam ein stück zurück
           : T < 16 ? .15                                 // innehalten
           : T < 19 ? .15 + .35 * ss((T - 16) / 3)       // und kommt wieder heran
           : .5 + .5 * ss((T - 19) / 7);                  // dann kommen sie zusammen
    meet = Math.min(mA, mB);
    if (T >= 26 && !foundAt) foundAt = now;
    if (T < 12) foundAt = 0;
    // before the first meeting everything stays on one horizontal line. only once they have met do they
    // take the space a little, like two people: close · a pause · one withdraws · searching · forgiving · together
    let ax, ay, bx, by;
    if (!foundAt) {
      ax = -60 * Math.pow(1 - mA, 1.2); bx = 60 * Math.pow(1 - mB, 1.2); ay = by = 0;
    } else {
      const c = ((now - foundAt) / 1000) % 44;
      const between = (a, b) => ss((c - a) / (b - a));
      // distance between them over the cycle (px) and how freely they roam
      let d, roam;
      if (c < 7)       { d = 0; roam = .3; }                                   // nah, zusammen
      else if (c < 9)  { d = 0; roam = .1; }                                   // innehalten
      else if (c < 17) { d = 56 * between(9, 17); roam = .15; }                // rückzug, langsam
      else if (c < 20) { d = 56; roam = .12; }                                 // stille dazwischen
      else if (c < 27) { d = 56 - 16 * between(20, 27); roam = .8; }           // suchen
      else if (c < 30) { d = 40 - 22 * between(27, 30); roam = .35; }          // annähern
      else if (c < 32) { d = 18; roam = .05; }                                 // zögern
      else if (c < 35) { d = 18 - 18 * between(32, 35); roam = .2; }           // vergeben
      else             { d = 0; roam = .3; }                                   // zusammen
      const ang = .9 * Math.sin((now - foundAt) / 7300) * Math.min(1, (now - foundAt) / 9000);
      // a shared, slow drift of the pair through the space, growing in gently after the first meeting
      const grow = Math.min(1, (now - foundAt) / 6000);
      const cx = grow * 26 * Math.sin(now / 6100), cy = grow * 12 * Math.sin(now / 4700 + 1);
      const r = roam * 14;
      // only "ich" walks away: it carries almost the whole distance, "du" stays nearly where it is
      ax = cx - Math.cos(ang) * d * .88 + r * Math.sin(now / 1900 + .3);
      ay = cy - Math.sin(ang) * d * .88 + r * .6 * Math.sin(now / 2600 + 2.1);
      bx = cx + Math.cos(ang) * d * .12 + r * .5 * Math.sin(now / 2300 + 4.0);
      by = cy + Math.sin(ang) * d * .12 + r * .3 * Math.sin(now / 1700 + .9);
      if (d < .5) { ax = bx = (ax + bx) / 2; ay = by = (ay + by) / 2; }     // together: exactly one
    }
    const k = 1 - Math.exp(-dt * 1.6);
    sm.ax += (ax - sm.ax) * k; sm.ay += (ay - sm.ay) * k; sm.bx += (bx - sm.bx) * k; sm.by += (by - sm.by) * k;
    ({ ax, ay, bx, by } = sm);
    const sep = Math.hypot(bx - ax, by - ay);
    dotA.style.transform = `translate(calc(-50% + ${ax.toFixed(1)}px), ${ay.toFixed(1)}px)`;
    dotB.style.transform = `translate(calc(-50% + ${bx.toFixed(1)}px), ${by.toFixed(1)}px)`;
    pair.classList.toggle("one", sep < 8);
    if (stillness > .97 && !merged) { merged = true; kosmos.send({ spark: "weich" }); }
    if (stillness < .5) merged = false;
    // the hint has done its work once the name has appeared: it never comes back over it
    hint.style.opacity = stillness > .97 || name.classList.contains("on") ? 0 : 1;

    // once the two beat as one, the first lines arrive — one every ~1.8 s of stillness
    if (meetT >= 19 && stillness > .97 && shown < firstLines.length) {   // the words come as they finally move together
      lineClock += dt;
      if (lineClock > 1.8) { firstLines[shown++].classList.add("on"); lineClock = 0; }
    }
    if (shown === firstLines.length) {
      lineClock += dt;
      if (lineClock > 2.2) name.classList.add("on");
    }

    // letters: the block in view reveals its next line when you pause
    if (still) {
      blockClock += dt;
      if (blockClock > 1) {
        blockClock = 0;
        for (const b of blocks) {
          if (!inView(b)) continue;
          const next = b.querySelector(".s:not(.on)");
          if (next) { next.classList.add("on"); break; }
        }
      }
    } else blockClock = 0;

    sec.textContent = fmt(stillTotal);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
})();
