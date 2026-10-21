// Upbeat, motivational royalty-free background loops (Web Audio API).
// Fully procedural: punchy kick, driving bass, backbeat clap, hi-hats and
// bright plucky leads. No audio files, no licenses.
const TRACKS = {
  // mi_ano — feel-good uplifting pop
  alegre: {
    bpm: 122, beatsPerBar: 4, root: 261.63, wave: "sawtooth", gain: 0.085,
    chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [-5, -1, 2]],
    bass: [0, null, 0, null, 7, null, 0, null],
    melody: [
      [12, 0.5], [16, 0.5], [19, 0.5], [16, 0.5], [12, 1], [19, 1],
      [9, 0.5], [12, 0.5], [16, 0.5], [12, 0.5], [16, 1], [12, 1],
      [17, 0.5], [21, 0.5], [24, 0.5], [21, 0.5], [17, 1], [12, 1],
      [19, 0.5], [16, 0.5], [12, 0.5], [16, 0.5], [19, 2],
    ],
    drums: { kick: "four", clap: true, hat: true, energy: 1 },
  },
  // mis_aventuras — driving, energetic, adventurous
  aventura: {
    bpm: 130, beatsPerBar: 4, root: 220.0, wave: "sawtooth", gain: 0.075,
    chords: [[0, 3, 7], [5, 8, 12], [-2, 2, 5], [3, 7, 10]],
    bass: [0, 0, null, 0, 7, null, 5, null],
    melody: [
      [12, 0.5], [15, 0.5], [19, 0.5], [22, 0.5], [19, 1], [15, 1],
      [17, 0.5], [20, 0.5], [24, 0.5], [20, 0.5], [17, 1], [12, 1],
      [10, 0.5], [14, 0.5], [17, 0.5], [14, 0.5], [10, 1], [17, 1],
      [19, 0.5], [22, 0.5], [24, 1], [19, 1], [12, 1],
    ],
    drums: { kick: "four", clap: true, hat: true, energy: 1.15 },
  },
  // un_dia — warm but still grooving, mid-tempo
  tierno: {
    bpm: 112, beatsPerBar: 4, root: 293.66, wave: "triangle", gain: 0.09,
    chords: [[0, 4, 7], [5, 9, 12], [-3, 0, 4], [7, 11, 14]],
    bass: [0, null, null, 0, 5, null, 7, null],
    melody: [
      [12, 0.5], [16, 0.5], [19, 1], [16, 0.5], [12, 0.5], [14, 1],
      [17, 0.5], [21, 0.5], [19, 1], [16, 0.5], [12, 0.5], [16, 1],
      [9, 0.5], [12, 0.5], [16, 1], [14, 0.5], [12, 0.5], [9, 1],
      [19, 0.5], [16, 0.5], [12, 1], [16, 0.5], [19, 0.5], [12, 1],
    ],
    drums: { kick: "two", clap: true, hat: true, energy: 0.8 },
  },
  // dieciochero — festive cueca groove, claps and plucky guitar feel
  cueca: {
    bpm: 168, beatsPerBar: 6, root: 196.0, wave: "sawtooth", gain: 0.08,
    chords: [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]],
    bass: [0, null, 7, 0, null, 7],
    melody: [
      [19, 0.5], [16, 0.5], [12, 0.5], [16, 0.5], [19, 1], [null, 1],
      [21, 0.5], [17, 0.5], [12, 0.5], [17, 0.5], [21, 1], [null, 1],
      [23, 0.5], [19, 0.5], [23, 0.5], [26, 0.5], [23, 1], [19, 1],
      [19, 0.5], [16, 0.5], [12, 0.5], [16, 0.5], [19, 2],
    ],
    drums: { kick: "cueca", clap: true, hat: true, energy: 1.1 },
  },
  // halloween — playful-spooky minor groove with a chromatic slide
  halloween: {
    bpm: 120, beatsPerBar: 4, root: 220.0, wave: "square", gain: 0.06,
    chords: [[0, 3, 7], [5, 8, 12], [-4, 0, 3], [7, 11, 14]],
    bass: [0, null, 0, null, 5, null, 7, null],
    melody: [
      [12, 0.5], [15, 0.5], [19, 0.5], [15, 0.5], [12, 1], [null, 1],
      [11, 0.5], [14, 0.5], [19, 0.5], [14, 0.5], [11, 1], [null, 1],
      [12, 0.5], [15, 0.5], [20, 0.5], [19, 0.5], [15, 0.5], [12, 0.5], [15, 1],
      [19, 0.5], [18, 0.5], [17, 0.5], [16, 0.5], [15, 1], [12, 1],
    ],
    drums: { kick: "two", clap: true, hat: true, energy: 0.9 },
  },
  // navidad — bright, joyful, bells + beat
  navidad: {
    bpm: 118, beatsPerBar: 4, root: 261.63, wave: "triangle", gain: 0.085,
    chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]],
    bass: [0, null, 0, null, 5, null, 7, null],
    melody: [
      [12, 0.5], [19, 0.5], [16, 0.5], [12, 0.5], [14, 0.5], [16, 1], [null, 0.5],
      [9, 0.5], [16, 0.5], [12, 0.5], [9, 0.5], [11, 0.5], [12, 1], [null, 0.5],
      [17, 0.5], [21, 0.5], [24, 0.5], [21, 0.5], [19, 0.5], [17, 1], [null, 0.5],
      [19, 0.5], [23, 0.5], [26, 1], [19, 0.5], [12, 1.5],
    ],
    drums: { kick: "four", clap: false, bell: true, hat: true, energy: 0.9 },
  },
};

const THEME_TRACK = {
  mi_ano: "alegre",
  mis_aventuras: "aventura",
  un_dia: "tierno",
  dieciochero: "cueca",
  halloween: "halloween",
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
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18;
  comp.ratio.value = 4;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  master.connect(comp);
  comp.connect(ctx.destination);

  // tonal bus with gentle reverb/delay for the lead & pads
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6000;
  const delay = ctx.createDelay(1);
  delay.delayTime.value = 0.26;
  const fb = ctx.createGain();
  fb.gain.value = 0.18;
  const wet = ctx.createGain();
  wet.gain.value = 0.22;
  lp.connect(master);
  lp.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(master);

  const spb = 60 / cfg.bpm;
  const loopBeats = cfg.chords.length * cfg.beatsPerBar;
  const loopDur = loopBeats * spb;
  let timer = null;
  let nextLoop = 0;
  let stopped = false;
  const E = cfg.drums?.energy ?? 1;

  const hz = (semi) => cfg.root * Math.pow(2, semi / 12);

  // generic synth tone with attack/decay envelope
  const tone = (freq, at, dur, wave, g, dest = lp) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = wave;
    osc.frequency.value = freq;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(g, at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(env);
    env.connect(dest);
    osc.start(at);
    osc.stop(at + dur + 0.05);
  };

  // punchy kick: pitch-dropping sine
  const kick = (at, g = 0.9) => {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, at);
    osc.frequency.exponentialRampToValueAtTime(48, at + 0.12);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(g, at + 0.005);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.22);
    osc.connect(env);
    env.connect(master);
    osc.start(at);
    osc.stop(at + 0.28);
  };

  // filtered noise burst (clap / snare / hat)
  const noise = (at, dur, g, hpf = 5500, dest = master) => {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = "highpass";
    filt.frequency.value = hpf;
    const env = ctx.createGain();
    env.gain.value = g;
    src.connect(filt);
    filt.connect(env);
    env.connect(dest);
    src.start(at);
  };

  const clap = (at, g = 0.3) => {
    noise(at, 0.09, g, 1800);
    noise(at + 0.012, 0.06, g * 0.7, 1800);
  };

  const scheduleLoop = (start) => {
    // chord pads (soft, sustained)
    cfg.chords.forEach((chord, bar) => {
      const at = start + bar * cfg.beatsPerBar * spb;
      const dur = cfg.beatsPerBar * spb * 0.9;
      chord.forEach((s) => tone(hz(s - 12), at, dur, "sine", cfg.gain * 0.4));
    });

    // bassline — follows the chord roots, gives drive
    const bassPat = cfg.bass || [];
    cfg.chords.forEach((chord, bar) => {
      const barRoot = chord[0];
      bassPat.forEach((slot, i) => {
        if (slot === null || slot === undefined) return;
        const at = start + (bar * cfg.beatsPerBar + i) * spb;
        tone(hz(barRoot + slot - 24), at, spb * 0.9, "sawtooth", cfg.gain * 0.9);
      });
    });

    // bright plucky lead
    let beat = 0;
    cfg.melody.forEach(([semi, len]) => {
      if (semi !== null) {
        tone(hz(semi), start + beat * spb, len * spb * 0.8, cfg.wave, cfg.gain * 0.95);
        tone(hz(semi + 12), start + beat * spb, len * spb * 0.4, "triangle", cfg.gain * 0.3);
      }
      beat += len;
    });

    // drums
    const dr = cfg.drums;
    if (dr) {
      for (let bar = 0; bar < cfg.chords.length; bar++) {
        const barAt = start + bar * cfg.beatsPerBar * spb;
        // kick pattern
        if (dr.kick === "four") {
          for (let b = 0; b < cfg.beatsPerBar; b++) kick(barAt + b * spb, 0.85 * E);
        } else if (dr.kick === "two") {
          kick(barAt, 0.85 * E);
          kick(barAt + 2 * spb, 0.8 * E);
        } else if (dr.kick === "cueca") {
          kick(barAt, 0.8 * E);
          kick(barAt + 2 * spb, 0.7 * E);
          kick(barAt + 4 * spb, 0.7 * E);
        }
        // backbeat clap/snare on beats 2 & 4 (4/4) or 2 & 5 (6/8)
        if (dr.clap) {
          if (cfg.beatsPerBar === 6) {
            clap(barAt + 1.5 * spb, 0.28 * E);
            clap(barAt + 4.5 * spb, 0.28 * E);
          } else {
            clap(barAt + 1 * spb, 0.3 * E);
            clap(barAt + 3 * spb, 0.3 * E);
          }
        }
        // hi-hats on every half beat (offbeats a touch louder)
        if (dr.hat) {
          for (let h = 0; h < cfg.beatsPerBar * 2; h++) {
            const off = h % 2 === 1;
            noise(barAt + h * 0.5 * spb, 0.03, (off ? 0.09 : 0.055) * E, 8000);
          }
        }
        // festive bells (navidad)
        if (dr.bell) {
          tone(hz(31), barAt, 0.5, "sine", 0.04 * E);
          tone(hz(36), barAt + 2 * spb, 0.5, "sine", 0.035 * E);
        }
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
      master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.0);
      return ctx.state === "running";
    },
    async resume() {
      try { await ctx.resume(); } catch (e) { /* ignore */ }
      return ctx.state === "running";
    },
    get running() {
      return ctx.state === "running";
    },
    setVolume(v) {
      try {
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
        master.gain.linearRampToValueAtTime(Math.max(0.0001, v), ctx.currentTime + 0.3);
      } catch (e) { /* ignore */ }
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
