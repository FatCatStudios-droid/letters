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
  let sendClock = 0, merged = false, tickDt = 1 / 60;

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
  const letters = [...document.querySelectorAll("article.letter")];
  let blockClock = 0;

  /* dorothea's voice: stille-0 is the opening ("und mein herz …"), stille-1 … 7 the seven letters.
     the shell plays them (one at a time); here we only say which, and when it should go */
  // when dorothea begins and ends each line (seconds into the recording, measured in the recordings themselves):
  // each line is typed, like on a typewriter, while she speaks it
  const LINE_AT = [
    [[0.18, 2.35], [4.36, 7.41], [9.31, 13.92], [14.43, 17.3]],   // eröffnung
    [[0.18, 3.03], [3.03, 5.34], [7.62, 11.23]],   // 01
    [[0.18, 3.95], [4.05, 10.16]],   // 02
    [[0.18, 3.09], [5.13, 8.5]],   // 03
    [[0.18, 3.27], [4.09, 6.22], [7.98, 11.21]],   // 04
    [[0.18, 2.9], [3.39, 7.3], [9.31, 11.65], [13.46, 18.27]],   // 05
    [[0.18, 2.72], [4.38, 6.68]],   // 06
    [[0.18, 4.6], [6.22, 9.44]],   // 07
  ];
  // word by word, when dorothea speaks it: [letters typed once the word is done, from second, to second].
  // made from the recordings themselves: the exact speaking stretches (loudness, 10 ms steps) and the order of her words
  // (speech recognition, whisper), each word as long as its syllables. pauses always fall between words.
  // eröffnung: "und" · pause · "eine ahnung von dir" and brief 04: "dich" · pause · "tief" are set by ear
  const WORDS = [
    [[[4,0.18,0.54],[9,0.54,0.9],[16,1.02,1.35],[20,1.35,1.69],[27,1.69,2.35]],[[4,4.36,4.61],[11,4.61,4.87],[14,4.87,5.12],[20,5.12,5.38],[24,5.38,5.63],[30,5.63,6.14],[41,6.14,6.65],[44,6.65,6.9],[51,6.9,7.41]],[[7,9.31,9.74],[12,9.74,10.17],[23,10.96,11.69],[28,12.56,12.9],[40,12.9,13.92]],[[4,14.43,15.0],[9,15.94,16.39],[16,16.39,16.85],[20,16.85,17.07],[24,17.07,17.3]]],   // eröffnung
    [[[4,0.18,0.42],[9,0.42,0.66],[16,0.66,0.9],[20,0.9,1.14],[24,1.62,1.82],[29,1.82,2.23],[35,2.23,2.63],[42,2.63,3.03]],[[6,3.03,3.44],[10,3.44,3.64],[13,3.64,3.84],[19,3.84,4.24],[33,4.24,4.85],[39,4.98,5.34]],[[5,7.62,7.99],[9,8.21,8.39],[18,8.39,8.94],[21,8.94,9.12],[32,9.12,9.48],[36,9.48,9.66],[45,10.41,10.96],[49,10.96,11.23]]],   // 01
    [[[4,0.18,0.38],[18,0.38,0.99],[31,1.65,2.18],[34,2.18,2.36],[40,2.36,2.71],[52,2.71,3.42],[61,3.42,3.95]],[[5,4.05,4.39],[17,4.39,5.43],[22,6.66,7.03],[27,7.03,7.4],[32,9.21,9.53],[39,9.53,10.16]]],   // 02
    [[[3,0.18,0.39],[8,0.39,0.6],[14,0.72,1.37],[25,2.4,3.09]],[[4,5.13,5.36],[9,5.36,5.81],[15,5.81,6.27],[22,6.27,6.72],[26,7.35,7.54],[31,7.54,7.74],[39,7.88,8.5]]],   // 03
    [[[5,0.18,0.36],[10,0.36,0.54],[14,0.54,0.73],[19,0.73,0.91],[24,1.02,1.25],[27,1.25,1.48],[33,2.17,2.61],[39,2.61,3.05],[43,3.05,3.27]],[[4,4.09,4.36],[8,4.36,4.62],[14,4.62,5.16],[19,5.16,5.42],[22,5.42,5.69],[28,5.69,6.22]],[[4,7.98,8.23],[11,8.23,8.72],[16,8.72,8.96],[19,8.96,9.21],[23,10.38,10.59],[26,10.59,10.79],[33,10.79,11.21]]],   // 04
    [[[6,0.18,0.92],[10,0.92,1.29],[16,2.37,2.9]],[[3,3.39,3.63],[8,3.63,3.87],[13,5.42,5.69],[17,5.69,5.96],[22,5.96,6.23],[27,6.23,6.5],[34,6.6,7.07],[39,7.07,7.3]],[[5,9.31,9.68],[11,9.68,10.05],[14,10.05,10.42],[21,10.73,11.17],[25,11.31,11.65]],[[5,13.46,13.72],[16,13.72,14.25],[25,16.22,16.89],[29,17.67,17.87],[36,17.87,18.27]]],   // 05
    [[[4,0.18,0.37],[9,0.37,0.57],[14,0.57,0.76],[23,0.97,1.47],[27,1.47,1.72],[31,1.72,1.97],[40,1.97,2.47],[48,2.47,2.72]],[[3,4.38,4.71],[10,4.71,5.03],[14,5.03,5.36],[21,6.15,6.68]]],   // 06
    [[[5,0.18,0.43],[10,0.43,0.68],[14,1.8,2.06],[21,2.06,2.58],[27,3.07,3.65],[36,3.75,4.17],[43,4.17,4.46],[47,4.46,4.6]],[[4,6.22,6.49],[8,6.49,6.76],[13,6.76,7.03],[19,7.03,7.56],[24,7.56,7.83],[27,7.83,8.1],[34,8.1,8.64],[40,8.64,9.17],[45,9.17,9.44]]],   // 07
  ];
  // how far a line is typed at time t (0 … 1)
  const spokenShare = (l, words, t) => {
    const len = (l._full ?? l.textContent).length;
    let k = 0, from = 0;
    for (const [to, s, e] of words) {
      if (t >= e) k = to; else if (t > s) { k = from + (to - from) * (t - s) / (e - s); break; } else break;
      from = to;
    }
    return len ? k / len : 1;
  };
  // typewriter: the typed part shows, the rest keeps its place invisibly (so nothing jumps while it types)
  const typeTo = (l, f) => {
    if (l._full == null) {
      l._full = l.textContent; l.textContent = "";
      l._a = document.createElement("span"); l._b = document.createElement("span"); l._b.className = "rest";
      l._b.textContent = l._full; l.append(l._a, l._b);
    }
    const k = Math.round(l._full.length * clamp(f));
    if (l._k === k) return;
    const prevK = l._k || 0;
    // one key strike per new letter, also when a slow frame typed several at once (spread over that frame);
    // not for spaces, not when a whole line appears at once
    if (k > prevK && k - prevK <= 10) {
      const n = [...l._full.slice(prevK, k)].filter(ch => ch.trim()).length;
      if (n) kosmos.send({ tipp: n, span: Math.min(.1, tickDt) });
    }
    l._k = k; l._a.textContent = l._full.slice(0, k); l._b.textContent = l._full.slice(k);
    l.classList.add("on", "typed");
    l.classList.toggle("typing", k > 0 && k < l._full.length);
    // line finished: the carriage returns (only when another line follows)
    if (k === l._full.length && !l._ret && l.nextElementSibling?.classList.contains("s")) { l._ret = 1; if (f < 1.5 && prevK > 0) kosmos.send({ zeile: 1 }); }
  };
  let speaking = null;           // { id, el, lines, at, t0 }
  const speak = (n, el, lines) => {
    speaking?.lines.forEach(l => { l._ret = 1; typeTo(l, 1); });   // an interrupted letter keeps its whole text, silently
    // the text waits for the voice to really sound (the shell tells us); without sound it begins on its own after a moment
    speaking = { id: "stille-" + n, el, lines, at: LINE_AT[n], words: WORDS[n], t0: performance.now() + (kosmos.inside ? 6000 : 250), heard: false };
    kosmos.send({ voice: speaking.id });
  };
  // the shell says when the sound really starts (after loading): the text follows that moment
  addEventListener("message", e => {
    const d = e.data;
    // the moment the sound leaves the speakers: now, plus what the audio device still holds back
    if (d && d.kosmos && d.voiceStart && speaking && d.voiceStart === speaking.id) { speaking.t0 = performance.now() + 1000 * (+d.lat || 0); speaking.heard = true; }
  });
  const follow = now => {
    if (!speaking) return;
    const t = (now - speaking.t0) / 1000;
    speaking.lines.forEach((l, i) => {
      const [a, b] = speaking.at[i] || [0, 1], segs = speaking.words?.[i];
      if (t >= a) typeTo(l, segs ? spokenShare(l, segs, t) : (t - a) / (b - a));
    });
    const r = speaking.el.getBoundingClientRect();
    if (r.bottom < innerHeight * .1 || r.top > innerHeight * .9) {
      // the letter has left the screen: the voice fades, its words stay
      kosmos.send({ voice: null });
      speaking.lines.forEach(l => { l._ret = 1; typeTo(l, 1); });
      speaking = null;
    } else if (t > speaking.at.at(-1)[1] + 4) speaking = null;
  };
  const inView = el => {
    const r = el.getBoundingClientRect();
    return r.top < innerHeight * .8 && r.bottom > innerHeight * .15;
  };

  // the sign to scroll on waits until the opening is complete and no letter is being read
  kosmos.scrollReady = () => name.classList.contains("on") && !speaking && hint.style.opacity === "0";

  const sec = document.querySelector(".sec");
  const fmt = s => {
    s = Math.floor(s);
    const m = Math.floor(s / 60), r = s % 60;
    const ss = `${r} ${r === 1 ? "sekunde" : "sekunden"}`;
    return m ? `${m} ${m === 1 ? "minute" : "minuten"} ${ss}` : ss;
  };

  /* ---------- the heartbeat sound: on the whole time you are in stille (it only fades out when you leave) ---------- */
  const opening = document.querySelector(".beat");
  let heartOn = null;
  const heartCheck = () => {
    const v = true;                                   // the heartbeat stays as long as you are in stille
    if (v !== heartOn) { heartOn = v; kosmos.send({ heart: v }); }
  };
  addEventListener("scroll", heartCheck, { passive: true });
  heartCheck();
  ["pointerdown", "keydown", "touchend"].forEach(e => addEventListener(e, () => kosmos.send({ heart: heartOn }), { once: true, passive: true }));

  const frame = now => {
    const dt = Math.min(.1, (now - last) / 1000); last = now; tickDt = dt;
    const still = idle() > .6;
    stillness = clamp(stillness + (still ? dt / 4 : -dt / 2.5));
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
    const eo = x => { x = clamp(x); return 1 - (1 - x) * (1 - x) * (1 - x); };   // starts moving at once, settles softly
    let mB = T < 4 ? .5 * eo(T / 4) : T < 16 ? .5 : .5 + .5 * ss((T - 16) / 7);
    // it is always "ich" who steps away
    let mA = T < 4 ? .5 * eo(T / 4)
           : T < 7 ? .5                                   // innehalten
           : T < 11 ? .5 - .35 * ss((T - 7) / 4)         // ich geht langsam ein stück zurück
           : T < 13 ? .15                                 // innehalten
           : T < 16 ? .15 + .35 * ss((T - 13) / 3)       // und kommt wieder heran
           : .5 + .5 * ss((T - 16) / 7);                  // dann kommen sie zusammen
    meet = Math.min(mA, mB);
    if (T >= 23 && !foundAt) foundAt = now;
    if (T < 9) foundAt = 0;
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
    hint.style.opacity = stillness > .97 || name.classList.contains("on") || scrollY > innerHeight * .25 ? 0 : 1;

    // while the two are still finding each other, dorothea begins: the first lines are typed with her voice
    if (meetT >= 3 && stillness > .5 && shown === 0 && speaking?.el !== opening) {
      lineClock += dt;
      if (lineClock > .2) { speak(0, opening, firstLines); lineClock = 0; }
    }
    follow(now);
    shown = firstLines.filter(l => l._full != null && l._k === l._full.length).length;   // lines fully typed
    if (shown === firstLines.length) {
      lineClock += dt;
      if (lineClock > 2.2) name.classList.add("on");
    }

    // letters: a letter begins once its top has crossed the middle of the screen (into the upper half).
    // only the letter that crossed last can begin, so two letters never start at the same time; the next one
    // takes over only when it, in turn, crosses the middle. it starts as soon as the scrolling comes to rest
    let due = null;
    for (const b of letters) {
      const r = b.getBoundingClientRect();
      if (r.top < innerHeight * .62 && r.bottom > 0) due = b;      // the lowest letter above the middle wins
    }
    if (due && speaking?.el !== due && due.querySelector(".s:not(.on)") && idle() > .3)
      speak(letters.indexOf(due) + 1, due, [...due.querySelectorAll(".s")]);
    // pictures between the letters simply appear when you pause
    if (still) {
      blockClock += dt;
      if (blockClock > 1) {
        blockClock = 0;
        for (const b of blocks) {
          if (letters.includes(b) || !inView(b)) continue;
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
