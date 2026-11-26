(() => {
  /* ---------- the worlds ---------- */
  // mix = how loud each of the four synced 30 s loops sounds while you are in that world
  const WORLDS = [
    { id: "home",   file: "raum",   name: "home",   mix: { beat: 0, noize: 0, kids: 0,   pad: .25 } },
    { id: "naehe",  file: "naehe",  name: "nähe",   ton: true,   mix: { beat: 0, noize: 0, kids: .25, pad: .6 } },
    { id: "stille", file: "stille", name: "stille", heart: true, mix: { beat: 0, noize: 0, kids: .3,  pad: .9 } },
  ];
  const INFO_MIX = { beat: 0, noize: .15, kids: .15, pad: .4 };
  const STEMS = ["beat", "noize", "kids", "pad"];

  /* ---------- sound: four synced loops, mixed per world ---------- */
  const tonBtn = document.getElementById("ton");
  let ctx = null, master = null, gains = {}, loading = false, on = false;
  let worldMix = WORLDS[0].mix, duck = false, level = 1, t0 = 0;
  let sparkBus = null, noiseBuf = null, here = "home";

  const applyMix = () => {
    if (!ctx) return;
    const now = ctx.currentTime;
    STEMS.forEach(s => gains[s]?.gain.setTargetAtTime(worldMix[s] ?? 0, now, .6));   // loops may still be loading
    master.gain.setTargetAtTime(on && !duck ? level : 0, now, duck ? .15 : .5);
    sparkBus.gain.setTargetAtTime(on ? (duck ? .35 : 1) : 0, now, .3);
    if (scrub) scrub.out.gain.setTargetAtTime(on && here === "naehe" ? SCRUB_LEVEL * (duck ? .35 : 1) : 0, now, .3);
  };

  /* ---------- particles: small invented sounds that come and go ----------
     britzeln · rauschen · kratzen · blip · weich. generated live, never a file.
     tones taken from the psalterium pad: d, e, fis, g, a, h. */
  const HZ = { D3: 146.83, A3: 220, B3: 246.94, D4: 293.66, Fs4: 369.99, G4: 392, A4: 440, B4: 493.88,
               D6: 1174.66, Fs6: 1479.98, A6: 1760, B6: 1975.53 };
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const pan = node => { const p = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (!p) { node.connect(sparkBus); return; } p.pan.value = rnd(-.8, .8); node.connect(p); p.connect(sparkBus); };
  const noise = (when, dur) => { const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true; n.start(when, rnd(0, 1.5)); n.stop(when + dur + .05); return n; };
  const SPARK = {
    britzeln() {           // a handful of tiny cracks, scattered over a second
      const t = ctx.currentTime, k = Math.floor(rnd(5, 22)), hp = ctx.createBiquadFilter();
      hp.type = "highpass"; hp.frequency.value = rnd(1800, 4500); pan(hp);
      for (let i = 0; i < k; i++) {
        const w = t + rnd(0, rnd(.3, 1.3)), g = ctx.createGain(), n = noise(w, .006);
        g.gain.setValueAtTime(0, w); g.gain.linearRampToValueAtTime(rnd(.02, .09), w + .0008); g.gain.exponentialRampToValueAtTime(.0001, w + rnd(.002, .006));
        n.connect(g); g.connect(hp);
      }
    },
    rauschen() {           // a breath of noise rising and falling
      const t = ctx.currentTime, a = rnd(1.2, 3), r = rnd(2, 4), n = noise(t, a + r);
      const bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = "bandpass"; bp.Q.value = .6; bp.frequency.setValueAtTime(rnd(1500, 3500), t); bp.frequency.linearRampToValueAtTime(rnd(3500, 8000), t + a + r);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rnd(.012, .03), t + a); g.gain.linearRampToValueAtTime(0, t + a + r);
      n.connect(bp); bp.connect(g); pan(g);
    },
    kratzen() {            // a short scrape: noise through a fast sweeping filter, stuttering
      const t = ctx.currentTime, d = rnd(.25, .7), n = noise(t, d);
      const bp = ctx.createBiquadFilter(), g = ctx.createGain();
      bp.type = "bandpass"; bp.Q.value = 4; bp.frequency.setValueAtTime(rnd(500, 900), t); bp.frequency.exponentialRampToValueAtTime(rnd(1800, 3200), t + d);
      g.gain.setValueAtTime(0, t);
      for (let x = 0; x < d; x += rnd(.02, .05)) g.gain.setValueAtTime(Math.random() < .7 ? rnd(.02, .06) : 0, t + x);
      g.gain.setValueAtTime(0, t + d);
      n.connect(bp); bp.connect(g); pan(g);
    },
    blip() {               // one to three high electronic tones
      const t0b = ctx.currentTime, k = Math.floor(rnd(1, 4));
      for (let i = 0; i < k; i++) {
        const t = t0b + i * rnd(.09, .22), o = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
        o.frequency.value = pick([HZ.D6, HZ.Fs6, HZ.A6, HZ.B6]); m.frequency.value = o.frequency.value * rnd(.5, 2.01); mg.gain.value = rnd(0, 300);
        m.connect(mg); mg.connect(o.frequency);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rnd(.012, .03), t + .004); g.gain.exponentialRampToValueAtTime(.0001, t + rnd(.08, .25));
        o.connect(g); pan(g); o.start(t); m.start(t); o.stop(t + .3); m.stop(t + .3);
      }
    },
    weich() {              // a soft tone that drifts in and out
      const t = ctx.currentTime, a = rnd(2.5, 5), r = rnd(3, 6), f = pick([HZ.D3, HZ.A3, HZ.B3, HZ.D4, HZ.Fs4, HZ.A4]);
      const lp = ctx.createBiquadFilter(), g = ctx.createGain();
      lp.type = "lowpass"; lp.frequency.value = rnd(600, 1400);
      [1, 1.003, 2.002].forEach((m, i) => {
        const o = ctx.createOscillator(); o.type = i === 2 ? "sine" : "triangle"; o.frequency.value = f * m;
        const og = ctx.createGain(); og.gain.value = i === 2 ? .25 : .5; o.connect(og); og.connect(lp); o.start(t); o.stop(t + a + r + .1);
      });
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rnd(.015, .035), t + a); g.gain.linearRampToValueAtTime(0, t + a + r);
      lp.connect(g); pan(g);
    },
  };
  const spark = type => { if (ctx && on && SPARK[type]) SPARK[type](); };
  // which particles drift through which world, and how often (seconds between)
  const WEATHER = {
    home:   { kinds: ["britzeln", "rauschen", "weich"], every: [18, 40] },
    naehe:  { kinds: ["weich", "rauschen"],             every: [14, 30] },
    stille: { kinds: ["weich"],                         every: [18, 36] },
    info:   { kinds: ["blip", "britzeln"],              every: [20, 40] },
  };
  const weather = () => {
    const w = WEATHER[here];
    if (w && on && !duck) spark(pick(w.kinds));
    const e = (w || WEATHER.home).every;
    setTimeout(weather, rnd(e[0], e[1]) * 1000);
  };
  setTimeout(weather, 6000);


  /* ---------- nähe: scrolling opens a filtered noise; arriving at "du" lets it go into a hall loop ----------
     the world sends { scrub: { p, v } }: p = 0…1 through the portal, v = speed in p per second.
     the filter never opens above 1.2 khz. */
  const SCRUB_MAX_HZ = 1200, SCRUB_MIN_HZ = 160, SCRUB_LEVEL = .11;
  let scrub = null;
  const makeScrub = () => {
    const out = ctx.createGain(); out.gain.value = 0; out.connect(ctx.destination);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    // two lowpass stages = a soft but steep slope, so nothing harsh gets through above the cutoff
    const lp1 = ctx.createBiquadFilter(), lp2 = ctx.createBiquadFilter();
    [lp1, lp2].forEach(f => { f.type = "lowpass"; f.Q.value = .7; f.frequency.value = SCRUB_MIN_HZ; });
    const dry = ctx.createGain(); dry.gain.value = 0;
    const send = ctx.createGain(); send.gain.value = 0;
    src.connect(lp1); lp1.connect(lp2); lp2.connect(dry); lp2.connect(send); dry.connect(out);
    // the hall loop: an echo that feeds back through its own lowpass, into a long generated hall
    const dl = ctx.createDelay(2); dl.delayTime.value = .43;
    const fb = ctx.createGain(); fb.gain.value = .58;
    const loopLp = ctx.createBiquadFilter(); loopLp.type = "lowpass"; loopLp.frequency.value = SCRUB_MAX_HZ; loopLp.Q.value = .5;
    send.connect(dl); dl.connect(loopLp); loopLp.connect(fb); fb.connect(dl);
    const hall = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 5.5), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    hall.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = .55;
    send.connect(hall); loopLp.connect(hall); hall.connect(wet); wet.connect(out);
    src.start();
    return { out, lp: [lp1, lp2], dry, send, loopLp, gone: false, last: 0 };
  };
  const hold = (param, now) => { if (param.cancelAndHoldAtTime) param.cancelAndHoldAtTime(now); else { param.cancelScheduledValues(now); param.setValueAtTime(param.value, now); } };
  const onScrub = ({ p = 0, v = 0 }) => {
    if (!ctx || !noiseBuf) return;
    if (!scrub) scrub = makeScrub();
    const s = scrub, now = ctx.currentTime;
    p = Math.max(0, Math.min(1, +p)); v = Math.abs(+v) || 0;
    if (p < .85) s.gone = false;                     // back up the portal: the next pass can open again
    const hz = SCRUB_MIN_HZ * Math.pow(SCRUB_MAX_HZ / SCRUB_MIN_HZ, Math.pow(Math.min(1, p / .92), 1.3)); // fully open (1.2 khz) exactly on arrival
    if (!s.gone && p > .92) {
      // arrived at "du": the noise stops, what was sounding stays in the loop and sinks away
      s.gone = true;
      hold(s.dry.gain, now); s.dry.gain.setTargetAtTime(0, now, .08);
      hold(s.send.gain, now); s.send.gain.setValueAtTime(.7, now); s.send.gain.setTargetAtTime(0, now + .22, .06);
      hold(s.loopLp.frequency, now); s.loopLp.frequency.setValueAtTime(Math.min(hz, SCRUB_MAX_HZ), now);
      s.loopLp.frequency.exponentialRampToValueAtTime(260, now + 7);
      return;
    }
    if (s.gone) return;
    const act = v > 0 ? .3 + .7 * Math.min(1, v / .6) : 0;  // slow scrolling is quiet, a fast swipe rushes
    const g = act * (.18 + .82 * Math.pow(p, 1.4));           // and it grows louder the closer you come
    s.lp.forEach(f => { hold(f.frequency, now); f.frequency.setTargetAtTime(hz, now, .05); });
    hold(s.loopLp.frequency, now); s.loopLp.frequency.setTargetAtTime(Math.min(hz * 1.2, SCRUB_MAX_HZ), now, .1);
    hold(s.dry.gain, now); s.dry.gain.setTargetAtTime(g, now, .05); s.dry.gain.setTargetAtTime(0, now + .14, .35);
    hold(s.send.gain, now); s.send.gain.setTargetAtTime(g * .3, now, .05); s.send.gain.setTargetAtTime(0, now + .14, .35);
  };

  /* ---------- stille: a slow heartbeat (one beat every 2.5 s) ----------
     its own small audio context, independent of the background loops (those stay off in stille).
     fades in over 5 s when you arrive, out over 4.5 s when you leave the page. */
  const HEART_LEVEL = .75, HEART_IN = 5, HEART_OUT = 4.5;
  let heart = null, heartWant = 0;
  const heartCtx = () => {
    if (heart) return heart;
    const c = new (window.AudioContext || window.webkitAudioContext)();
    // the heartbeat steps back (duck) while dorothea's voice reads a letter
    const d = c.createGain(); d.connect(c.destination);
    const g = c.createGain(); g.gain.value = 0; g.connect(d);
    heart = { c, g, d, src: null };
    fetch("audio/herz.m4a").then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).then(buf => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true; s.connect(g); s.start(); heart.src = s;
    }).catch(() => {});
    return heart;
  };
  let heartPage = false;          // what the stille page itself asks for (opening in view or not)
  const setHeart = v => {
    if (v === heartWant) return;
    heartWant = v;
    if (!v && !heart) return;
    const h = heartCtx(), now = h.c.currentTime;
    if (v) h.c.resume();
    // a soft s-shaped fade (slow start, slow end) instead of a straight line
    const from = h.g.gain.value, to = v ? HEART_LEVEL : 0, dur = v ? HEART_IN : HEART_OUT;
    const curve = new Float32Array(64).map((_, i) => from + (to - from) * (1 - Math.cos(Math.PI * i / 63)) / 2);
    h.g.gain.cancelScheduledValues(now);
    try { h.g.gain.setValueCurveAtTime(curve, now + .01, dur); }
    catch { h.g.gain.setValueAtTime(from, now); h.g.gain.linearRampToValueAtTime(to, now + dur); }
  };

  /* ---------- stille: dorothea reads the letters ----------
     the page sends { voice: "stille-3" } when a letter starts to appear, { voice: null } when it leaves the screen.
     one voice at a time; it plays in the heartbeat's context (already awake on this page, also on phones). */
  const VOICE_LEVEL = 1, VOICE_OUT = 2.5, HEART_DUCK = .7;
  const voiceBufs = {};
  let voice = null;
  const duckHeart = on => { if (heart) { const now = heart.c.currentTime; hold(heart.d.gain, now); heart.d.gain.setTargetAtTime(on ? HEART_DUCK : 1, now, on ? .4 : 1.2); } };
  const stopVoice = (out = VOICE_OUT) => {
    const v = voice; if (!v) return;
    voice = null; duckHeart(false);
    if (!v.g) return;                                 // was still loading: it simply never starts
    const now = heart.c.currentTime;
    hold(v.g.gain, now); v.g.gain.setTargetAtTime(0, now, out / 4);
    setTimeout(() => { try { v.src.stop(); } catch {} }, out * 1000 + 300);
  };
  const playVoice = async id => {
    if (voice?.id === id) return;
    stopVoice(1.8);
    const h = heartCtx(); h.c.resume();
    zeileBuf ||= fetch("audio/zeile.m4a?v=20261126b").then(r => r.arrayBuffer()).then(b => h.c.decodeAudioData(b)).catch(() => null);
    tippBuf ||= fetch("audio/tipp.m4a?v=20261126b").then(r => r.arrayBuffer()).then(b => h.c.decodeAudioData(b)).catch(() => null);
    const me = { id }; voice = me;
    let buf;
    try { buf = await (voiceBufs[id] ||= fetch(`audio/${id}.m4a?v=20261127d`).then(r => r.arrayBuffer()).then(b => h.c.decodeAudioData(b))); }
    catch { if (voice === me) voice = null; return; }
    if (voice !== me) return;
    const s = h.c.createBufferSource(); s.buffer = buf;
    const g = h.c.createGain(); g.gain.value = 0; s.connect(g); g.connect(h.c.destination);
    const now = h.c.currentTime;
    g.gain.setValueAtTime(0, now); g.gain.linearRampToValueAtTime(VOICE_LEVEL, now + .08);
    s.start(now); me.src = s; me.g = g;
    frame.contentWindow?.postMessage({ kosmos: 1, voiceStart: id }, "*");
    s.onended = () => { if (voice === me) { voice = null; duckHeart(false); } };
    duckHeart(true);
  };

  /* typewriter: each letter typed on the stille page strikes one key (splice typewriter keystrokes, cut into
     20 single strikes, one every 0.15 s in tipp.m4a). quiet, slightly varied, never twice the same in a row.
     at the end of a line the carriage return sounds (zeile.m4a) */
  const TIPP_LEVEL = .16, TIPP_N = 20, TIPP_SLOT = .15, ZEILE_LEVEL = .2;
  let tippBuf = null, tippLast = -1, zeileBuf = null;
  const zeile = () => {
    if (!heart || heartWant !== 1 && !voice) return;
    const c = heart.c;
    (zeileBuf ||= fetch("audio/zeile.m4a?v=20261126b").then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).catch(() => null)).then(buf => {
      if (!buf) return;
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buf; g.gain.value = ZEILE_LEVEL; s.connect(g); g.connect(c.destination); s.start();
    });
  };
  const tipp = () => {
    if (!heart || heartWant !== 1 && !voice) return;
    const c = heart.c;
    if (!tippBuf) { tippBuf = fetch("audio/tipp.m4a?v=20261126b").then(r => r.arrayBuffer()).then(b => c.decodeAudioData(b)).catch(() => null); return; }
    tippBuf.then(buf => {
      if (!buf) return;
      let i; do i = Math.floor(Math.random() * TIPP_N); while (i === tippLast); tippLast = i;
      const s = c.createBufferSource(), g = c.createGain();
      s.buffer = buf; s.playbackRate.value = .95 + Math.random() * .1;
      g.gain.value = TIPP_LEVEL * (.6 + Math.random() * .4);
      s.connect(g); g.connect(c.destination);
      s.start(c.currentTime, i * TIPP_SLOT, .12);
    });
  };

  // want = what the visitor (or the page) asked for; the context may still be loading or waiting for a tap
  let want = false;
  const startTon = async () => {
    want = true;
    if (loading) return;
    if (!ctx) {
      loading = true; tonBtn.textContent = "ton: lädt …";
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      sparkBus = ctx.createGain(); sparkBus.gain.value = 0; sparkBus.connect(ctx.destination);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      const bufs = await Promise.all(STEMS.map(s =>
        fetch(`audio/loop-${s}.m4a`).then(r => r.arrayBuffer()).then(b => ctx.decodeAudioData(b))));
      t0 = ctx.currentTime + .1;
      STEMS.forEach((s, i) => {
        const g = ctx.createGain(); g.gain.value = 0; g.connect(master); gains[s] = g;
        const src = ctx.createBufferSource(); src.buffer = bufs[i]; src.loop = true;
        src.connect(g); src.start(t0);
      });
      loading = false;
    }
    await ctx.resume();
    if (!want) { renderTon(); return; }
    on = true; applyMix(); renderTon(); tellWorld();
  };
  const stopTon = () => { want = false; on = false; applyMix(); renderTon(); tellWorld(); };
  const renderTon = () => { tonBtn.textContent = on ? "ton: an" : "ton: aus"; tonBtn.setAttribute("aria-pressed", on); };
  tonBtn.addEventListener("click", () => on ? stopTon() : startTon());

  // meters: each stem's real loudness at the current loop position × its fader
  const meters = [...document.querySelectorAll(".meters i")];
  let peaks = null;
  fetch("peaks.json").then(r => r.json()).then(p => peaks = p).catch(() => {});
  const meter = () => {
    meters.forEach((m, i) => {
      const s = STEMS[i];
      let v = 0;
      if (s && ctx && on && !duck && peaks && peaks[`loop-${s}`]) {
        const pk = peaks[`loop-${s}`].p;
        const pos = ((ctx.currentTime - t0) % 30 + 30) % 30;
        v = (pk[Math.floor(pos * 20)] || 0) * (gains[s].gain.value) * level;
      }
      m.style.height = Math.max(1, Math.round(v * 14)) + "px";
    });
    requestAnimationFrame(meter);
  };
  requestAnimationFrame(meter);

  /* ---------- worlds talk to the shell ---------- */
  const frame = document.getElementById("world");
  const tellWorld = () => frame.contentWindow?.postMessage({ kosmos: 1, ton: on }, "*");
  addEventListener("message", e => {
    const d = e.data; if (!d || !d.kosmos || e.source !== frame.contentWindow) return;
    if (d.mix) worldMix = { ...worldMix, ...d.mix };
    if ("duck" in d) duck = !!d.duck;
    if ("level" in d) level = Math.max(0, Math.min(1, +d.level));
    if (d.startTon && !on) startTon();
    if (d.hello) tellWorld();
    if (d.spark) spark(d.spark);
    if (d.scrub && on && here === "naehe") onScrub(d.scrub);
    if ("heart" in d && current?.heart) { heartPage = !!d.heart; if (panel.hidden) setHeart(heartPage ? 1 : 0); }
    if (d.tipp && current?.heart && panel.hidden) tipp();
    if (d.zeile && current?.heart && panel.hidden) zeile();
    if ("voice" in d && current?.heart) { if (/^stille-\d$/.test(d.voice) && panel.hidden) playVoice(d.voice); else stopVoice(); }
    applyMix();
  });

  /* ---------- hub ---------- */
  const panel = document.getElementById("panel");
  const tabs = document.querySelector(".tabs");
  const SECTIONS = ["stueck", "ensemble", "presse", "kontakt", "impressum", "journal"];
  // the three top links each open their own group of the sheet
  const GROUP = { ueber: "ueber", stueck: "ueber", ensemble: "ueber", presse: "ueber", journal: "journal", kontakt: "kontakt", impressum: "kontakt" };
  WORLDS.forEach(w => {
    const t = document.createElement("a");
    t.href = `#${w.id}`; t.className = "tab"; t.dataset.id = w.id; t.textContent = w.name;
    // nähe always has its sound: start it right in the click, so phones allow it
    if (w.ton) t.addEventListener("click", () => { if (!on) startTon(); });
    if (w.heart) t.addEventListener("click", () => heartCtx().c.resume());
    // the tab you are already on: no hash change happens, so start the page again ourselves
    t.addEventListener("click", () => { if ((location.hash.slice(1) || "home") === w.id && panel.hidden) open(w, true); });
    tabs.appendChild(t);
  });

  // press text to clipboard
  document.querySelectorAll(".copy").forEach(b => b.addEventListener("click", async () => {
    const el = document.getElementById(b.dataset.target);
    try { await navigator.clipboard.writeText(el.textContent); b.textContent = "kopiert"; }
    catch { const r = document.createRange(); r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); b.textContent = "markiert — jetzt kopieren"; }
    setTimeout(() => b.textContent = "pressetext kopieren", 2500);
  }));

  /* ---------- routing: #home #naehe #stille load a page; #stueck … open the info sheet ---------- */
  let current = null, parked = false;     // parked: the page was put away while über / journal / kontakt is open
  // every visit to a tab starts its page fresh, with its own sound rules — whatever was open before
  const open = (w, force) => {
    if (current === w && !force && !parked) return;
    current = w; parked = false; here = w.id; worldMix = w.mix; duck = false; level = 1;
    frame.style.transition = "none"; frame.style.opacity = 0;
    frame.src = `welten/${w.file}.html?v=20261127i`;
    tabs.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", t.dataset.id === w.id));
    document.title = w.id === "home" ? "letters — eine ahnung von dir" : `letters — ${w.name}`;
    spark("kratzen");
    // sound is on by itself only in nähe; every other page starts silent
    if (w.ton) startTon(); else if (on || want) stopTon();
    // the heartbeat belongs to stille only: arriving starts its slow fade-in, leaving fades it out
    if (w.heart) { heartPage = true; setHeart(1); } else { setHeart(0); stopVoice(); }
  };
  // arriving straight on nähe: browsers only allow sound after a first tap or key, so start it then
  const firstTouch = () => {
    if (current?.ton && want && !on) startTon();
    if (heartWant && heart && heart.c.state !== "running") heart.c.resume();
  };
  ["pointerdown", "keydown", "touchend"].forEach(e => addEventListener(e, firstTouch, { passive: true }));
  document.getElementById("close").addEventListener("click", e => {
    e.preventDefault(); location.hash = current ? current.id : "home";
  });
  const route = () => {
    const id = location.hash.slice(1);
    const group = GROUP[id];
    // the open link turns gold, like the open tab
    document.querySelectorAll(".row1 .top").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + group));
    document.querySelectorAll(".sheetnav a").forEach(a => a.classList.toggle("on", a.getAttribute("href") === "#" + id));
    // only one thing is ever gold: an open top link switches the page tab off, closing it switches it back on
    const showTab = () => tabs.querySelectorAll(".tab").forEach(t => t.classList.toggle("on", !group && t.dataset.id === (current && current.id)));
    if (group) {
      if (!current) current = WORLDS[0];
      panel.hidden = false; here = "info"; worldMix = INFO_MIX;
      panel.dataset.group = group;
      // über / journal / kontakt are quiet: the page underneath is put away (its films, voices and music stop),
      // the background sound, heartbeat and voice fade out. going back starts that page fresh
      setHeart(0); stopVoice(); if (on || want) stopTon();
      if (!parked) { parked = true; frame.src = "about:blank"; }
      panel.querySelectorAll(".sheet").forEach(s => s.hidden = s.dataset.group !== group);
      requestAnimationFrame(() => {
        if (id === group) panel.scrollTop = 0;
        else document.getElementById(id).scrollIntoView({ block: "start" });
      });
    } else {
      panel.hidden = true;
      const w = WORLDS.find(x => x.id === id) || WORLDS[0];
      open(w);
    }
    showTab();
    applyMix();
  };
  frame.addEventListener("load", () => {
    tellWorld();
    // wait one frame so the page has painted, then let it fade in
    requestAnimationFrame(() => requestAnimationFrame(() => { frame.style.transition = ""; frame.style.opacity = 1; }));
  });
  addEventListener("hashchange", route);
  route();
  // for checking: what the cosmos is doing right now (sound, heartbeat, which page)
  window.kosmosState = () => ({ page: current?.id, panel: !panel.hidden, ton: on, heart: heartWant, voice: voice?.id || null, frame: frame.getAttribute("src") });
})();
