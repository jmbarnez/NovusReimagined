import {
  getAudio,
  spatialAtten,
  now,
  connectToMaster,
  _disconnectOnEnd
} from "./core.js";

export function sfxCreditPickup() {
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = 0.35;

  const osc1 = ctx.createOscillator();
  osc1.type = "sine";
  osc1.frequency.setValueAtTime(880, t0);
  osc1.frequency.exponentialRampToValueAtTime(1320, t0 + 0.05);

  const osc2 = ctx.createOscillator();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(1760, t0 + 0.02);
  osc2.frequency.exponentialRampToValueAtTime(2200, t0 + 0.08);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  osc1.connect(g).connect(master);
  osc2.connect(g).connect(master);

  osc1.start(t0); osc1.stop(t0 + dur);
  osc2.start(t0 + 0.02); osc2.stop(t0 + dur);

  _disconnectOnEnd(osc1, g);
  _disconnectOnEnd(osc2, g);
}

// Periodic industrial hum while a beam turret is active.
// type "mining" → deeper rumble; "salvage" → higher metallic hiss.
export function sfxIndustrialBeam(type: "mining" | "salvage" = "mining", x = 0, y = 0) {
  const { atten, pan } = spatialAtten(x, y, 1800);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = 0.55;
  const baseHz  = type === "mining" ? 52  : 80;
  const startHz = type === "mining" ? 68  : 100;
  const fizzHz  = type === "mining" ? 220 : 340;
  const bpHz    = type === "mining" ? 600 : 900;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(startHz, t0);
  osc.frequency.linearRampToValueAtTime(baseHz, t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.10 * atten, t0);
  g.gain.setValueAtTime(0.10 * atten, t0 + dur * 0.6);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const pn1 = connectToMaster(g, master, pan);
  osc.connect(g); osc.start(t0); osc.stop(t0 + dur);

  const osc2 = ctx.createOscillator();
  osc2.type = "sawtooth";
  osc2.frequency.setValueAtTime(fizzHz, t0);
  osc2.frequency.linearRampToValueAtTime(fizzHz * 0.8, t0 + dur);
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = bpHz;
  filter.Q.value = 3;
  const g2 = ctx.createGain();
  g2.gain.setValueAtTime(0.04 * atten, t0);
  g2.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const pn2 = connectToMaster(g2, master, pan);
  osc2.connect(filter).connect(g2); osc2.start(t0); osc2.stop(t0 + dur);

  _disconnectOnEnd(osc, g, pn1!);
  _disconnectOnEnd(osc2, filter, g2, pn2!);
}

// Pickup collection chime — tone varies by item kind.
// ore → warm thud-pop; loot → bright ping; module → metallic shimmer.
export function sfxItemPickup(kind: "ore" | "loot" | "module" = "loot", x = 0, y = 0) {
  const { atten, pan } = spatialAtten(x, y, 1600);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();

  if (kind === "ore") {
    // Low woody thud + short overtone
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, t0);
    osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.18);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.11 * atten, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
    const pn = connectToMaster(g, master, pan);
    osc.connect(g); osc.start(t0); osc.stop(t0 + 0.18);
    _disconnectOnEnd(osc, g, pn!);
  } else if (kind === "loot") {
    // Bright rising ping
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(520, t0);
    osc.frequency.exponentialRampToValueAtTime(880, t0 + 0.08);
    osc.frequency.exponentialRampToValueAtTime(440, t0 + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09 * atten, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
    const pn = connectToMaster(g, master, pan);
    osc.connect(g); osc.start(t0); osc.stop(t0 + 0.22);
    _disconnectOnEnd(osc, g, pn!);
  } else {
    // Metallic shimmer — two detuned sine waves
    for (const freq of [880, 1100]) {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.15, t0 + 0.1);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.85, t0 + 0.28);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.055 * atten, t0);
      g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);
      const pn = connectToMaster(g, master, pan);
      osc.connect(g); osc.start(t0); osc.stop(t0 + 0.28);
      _disconnectOnEnd(osc, g, pn!);
    }
  }
}