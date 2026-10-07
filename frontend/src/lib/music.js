// Procedural royalty-free background loops (Web Audio API). No audio files, no licenses.
const TRACKS = {
  alegre: {
    bpm: 108, beatsPerBar: 4, root: 261.63, wave: "triangle", gain: 0.1,
    chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]],
    melody: [
      [12, 1], [16, 0.5], [19, 0.5], [16, 1], [12, 1],
      [17, 1], [21, 0.5], [24, 0.5], [21, 1], [17, 1],
      [9, 1], [12, 0.5], [16, 0.5], [12, 1], [9, 1],
      [19, 1], [23, 0.5], [26, 0.5], [19, 1], [null, 1],
    ],
    perc: { type: "shaker", beats: [0, 1, 2, 3], gain: 0.05 },
  },
  aventura: {
    bpm: 124, beatsPerBar: 4, root: 293.66, wave: "square", gain: 0.055,
    chords: [[0, 3, 7], [3, 7, 10], [5, 8, 12], [-2, 2, 5]],
    melody: [
      [12, 0.5], [15, 0.5], [19, 1], [17, 1], [15, 1],
      [15, 0.5], [19, 0.5], [22, 1], [19, 1], [17, 1],
      [17, 0.5], [20, 0.5], [24, 1], [22, 1], [19, 1],
      [19, 1], [17, 1], [12, 2],
    ],
    perc: { type: "shaker", beats: [0, 1.5, 2, 3.5], gain: 0.07 },
  },
  tierno: {
    bpm: 92, beatsPerBar: 3, root: 349.23, wave: "triangle", gain: 0.09,
    chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]],
    melody: [
      [12, 1], [16, 1], [19, 1],
      [17, 1.5], [16, 1.5],
      [9, 1], [12, 1], [16, 1],
      [14, 1.5], [12, 1.5],
    ],
    perc: null,
  },
  cueca: {
    bpm: 150, beatsPerBar: 6, root: 196.0, wave: "triangle", gain: 0.085,
    chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
    melody: [
      [19, 1], [19, 0.5], [16, 0.5], [12, 1], [16, 1], [19, 1], [null, 1],
      [21, 1], [21, 0.5], [17, 0.5], [12, 1], [17, 1], [21, 1], [null, 1],
      [23, 1], [19, 0.5], [23, 0.5], [26, 1], [23, 1], [19, 1], [null, 1],
      [19, 1.5], [16, 0.5], [12, 1], [16, 1], [19, 2],
    ],
    perc: { type: "shaker", beats: [0, 1, 2, 3, 4, 5], gain: 0.06 },
  },
  navidad: {
    bpm: 100, beatsPerBar: 4, root: 261.63, wave: "sine", gain: 0.11,
    chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]],
    melody: [
      [12, 0.5], [19, 0.5], [16, 1], [12, 0.5], [14, 0.5], [16, 1],
      [9, 0.5], [16, 0.5], [12, 1], [9, 0.5], [11, 0.5], [12, 1],
      [17, 0.5], [21, 0.5], [24, 1], [21, 0.5], [19, 0.5], [17, 1],
      [19, 0.5], [23, 0.5], [26, 1], [19, 1], [12, 1],
    ],
    perc: { type: "bell", beats: [0, 2], gain: 0.045 },
  },
};

const THEME_TRACK = {
  mi_ano: "alegre",
  mis_aventuras: "aventura",
  un_dia: "tierno",
  dieciochero: "cueca",
  navidad: "navidad",
};

export const trackForTheme = (theme) => TRACKS[THEME_TRACK[theme] || "alegre"];

export const createMusicPlayer = (theme) => {
  const cfg = trackForTheme(theme);
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  const master = ctx.createGain();
  master.gain.value = 0;
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 4200;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.28;
  const fb = ctx.createGain();
  fb.gain.value = 0.22;
  const wet = ctx.createGain();
  wet.gain.value = 0.3;
  lp.connect(master);
  lp.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(master);
  master.connect(ctx.destination);

  const spb = 60 / cfg.bpm;
  const loopBeats = cfg.chords.length * cfg.beatsPerBar;
  const loopDur = loopBeats * spb;
  let timer = null;
  let nextLoop = 0;
  let stopped = false;

  const hz = (semi) => cfg.root * Math.pow(2, semi / 12);

  const tone = (freq, at, dur, wave, g) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(g, at + 0.02);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env);
    env.connect(lp);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  const noise = (at, dur, g) => {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = "highpass";
    hpf.frequency.value = 5500;
    const env = ctx.createGain();
    env.gain.value = g;
    src.connect(hpf);
    hpf.connect(env);
    env.connect(master);
    src.start(at);
  };

  const scheduleLoop = (start) => {
    // pads
    cfg.chords.forEach((chord, bar) => {
      const at = start + bar * cfg.beatsPerBar * spb;
      const dur = cfg.beatsPerBar * spb * 0.95;
      chord.forEach((s) => tone(hz(s - 12), at, dur, "sine", cfg.gain * 0.55));
    });
    // melody
    let beat = 0;
    cfg.melody.forEach(([semi, len]) => {
      if (semi !== null) {
        tone(hz(semi), start + beat * spb, len * spb * 0.85, cfg.wave, cfg.gain);
      }
      beat += len;
    });
    // percussion
    if (cfg.perc) {
      for (let bar = 0; bar < cfg.chords.length; bar++) {
        cfg.perc.beats.forEach((b) => {
          const at = start + (bar * cfg.beatsPerBar + b) * spb;
          if (cfg.perc.type === "bell") tone(hz(31), at, 0.5, "sine", cfg.perc.gain);
          else noise(at, 0.08, cfg.perc.gain);
        });
      }
    }
  };

  const tick = () => {
    if (stopped) return;
    while (nextLoop < ctx.currentTime + 1.2) {
      scheduleLoop(nextLoop);
      nextLoop += loopDur;
    }
  };

  return {
    async start(volume = 1) {
      try { await ctx.resume(); } catch (e) { /* needs gesture */ }
      if (nextLoop === 0) nextLoop = ctx.currentTime + 0.12;
      tick();
      if (!timer) timer = setInterval(tick, 400);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
      master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.2);
      return ctx.state === "running";
    },
    async resume() {
      try { await ctx.resume(); } catch (e) { /* ignore */ }
      return ctx.state === "running";
    },
    get running() {
      return ctx.state === "running";
    },
    stop() {
      stopped = true;
      if (timer) clearInterval(timer);
      timer = null;
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      } catch (e) { /* ignore */ }
      setTimeout(() => ctx.close().catch(() => {}), 500);
    },
  };
};
