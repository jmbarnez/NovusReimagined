import {
  getAudio,
  spatialAtten,
  now,
  connectToMaster,
  _disconnectOnEnd,
  makeNoiseBuffer
} from "./core.js";

export function sfxShieldImpact(intensity = 1) {
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = 0.55;
  const vol = Math.min(1, intensity) * 0.55;

  const bloom = ctx.createOscillator();
  bloom.type = "sine";
  bloom.frequency.setValueAtTime(320, t0);
  bloom.frequency.exponentialRampToValueAtTime(90, t0 + dur);

  const bloomGain = ctx.createGain();
  bloomGain.gain.setValueAtTime(0, t0);
  bloomGain.gain.linearRampToValueAtTime(vol * 0.7, t0 + 0.04);
  bloomGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  const shimmer = ctx.createOscillator();
  shimmer.type = "triangle";
  shimmer.frequency.setValueAtTime(640, t0);
  shimmer.frequency.exponentialRampToValueAtTime(180, t0 + dur * 0.7);

  const shimmerGain = ctx.createGain();
  shimmerGain.gain.setValueAtTime(0, t0);
  shimmerGain.gain.linearRampToValueAtTime(vol * 0.35, t0 + 0.03);
  shimmerGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.8);

  const noiseBuf = makeNoiseBuffer(ctx, dur);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.setValueAtTime(900, t0);
  noiseFilter.frequency.exponentialRampToValueAtTime(200, t0 + dur);
  noiseFilter.Q.value = 2.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, t0);
  noiseGain.gain.linearRampToValueAtTime(vol * 0.25, t0 + 0.02);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  bloom.connect(bloomGain).connect(master);
  shimmer.connect(shimmerGain).connect(master);
  noise.connect(noiseFilter).connect(noiseGain).connect(master);

  bloom.start(t0); bloom.stop(t0 + dur);
  shimmer.start(t0); shimmer.stop(t0 + dur * 0.8);
  noise.start(t0); noise.stop(t0 + dur);

  _disconnectOnEnd(bloom, bloomGain);
  _disconnectOnEnd(shimmer, shimmerGain);
  _disconnectOnEnd(noise, noiseFilter, noiseGain);
}

export function sfxHullImpact(intensity = 1) {
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = 0.18;
  const vol = Math.min(1, intensity) * 0.5;

  const noiseBuf = makeNoiseBuffer(ctx, dur);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(600, t0);
  filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  const panner = connectToMaster(g, master, 0);
  noise.connect(filter).connect(g);
  noise.start(t0); noise.stop(t0 + dur);

  const crunch = ctx.createOscillator();
  crunch.type = "sawtooth";
  crunch.frequency.setValueAtTime(180, t0);
  crunch.frequency.exponentialRampToValueAtTime(30, t0 + 0.12);
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(vol * 0.3, t0);
  cg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
  cg.connect(master);
  crunch.connect(cg);
  crunch.start(t0); crunch.stop(t0 + 0.14);

  _disconnectOnEnd(noise, filter, g, panner!);
  _disconnectOnEnd(crunch, cg);
}

export function sfxShipExplosion(x: number, y: number, size = 1) {
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const { atten, pan } = spatialAtten(x, y, 3500);
  if (atten <= 0.001) return;
  const t0 = now();
  const dur = 0.7 + size * 0.35;
  const vol = Math.min(1, size) * 0.55 * atten;

  const rumble = ctx.createOscillator();
  rumble.type = "sine";
  rumble.frequency.setValueAtTime(80, t0);
  rumble.frequency.exponentialRampToValueAtTime(22, t0 + dur);

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(vol * 0.8, t0);
  rumbleGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  const pn1 = connectToMaster(rumbleGain, master, pan);
  rumble.connect(rumbleGain);
  rumble.start(t0); rumble.stop(t0 + dur);

  const noiseBuf = makeNoiseBuffer(ctx, dur);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.setValueAtTime(200, t0);
  noiseFilter.frequency.exponentialRampToValueAtTime(40, t0 + dur);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(vol * 0.4, t0);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  const pn2 = connectToMaster(noiseGain, master, pan);
  noise.connect(noiseFilter).connect(noiseGain);
  noise.start(t0); noise.stop(t0 + dur);

  const crack = ctx.createOscillator();
  crack.type = "sawtooth";
  crack.frequency.setValueAtTime(300, t0);
  crack.frequency.exponentialRampToValueAtTime(60, t0 + 0.12);

  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(vol * 0.35, t0);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);

  const pn3 = connectToMaster(crackGain, master, pan);
  crack.connect(crackGain);
  crack.start(t0); crack.stop(t0 + 0.14);

  _disconnectOnEnd(rumble, rumbleGain, pn1!);
  _disconnectOnEnd(noise, noiseFilter, noiseGain, pn2!);
  _disconnectOnEnd(crack, crackGain, pn3!);
}

export function sfxProjectileImpact(x = 0, y = 0, kind = "projectile") {
  const { atten, pan } = spatialAtten(x, y, 2200);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();

  if (kind === "beam") {
    const dur = 0.08;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(1200, t0);
    osc.frequency.exponentialRampToValueAtTime(300, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1 * atten, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const pn = connectToMaster(g, master, pan);
    osc.connect(g);
    osc.start(t0); osc.stop(t0 + dur);
    _disconnectOnEnd(osc, g, pn!);
  } else if (kind === "missile") {
    const dur = 0.14;
    const noiseBuf = makeNoiseBuffer(ctx, dur);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(400, t0);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.18 * atten, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const pn = connectToMaster(g, master, pan);
    noise.connect(filter).connect(g);
    noise.start(t0); noise.stop(t0 + dur);
    _disconnectOnEnd(noise, filter, g, pn!);
  } else if (kind === "tu-cannon") {
    const dur = 0.18;
    const noiseBuf = makeNoiseBuffer(ctx, dur);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, t0);
    filter.frequency.exponentialRampToValueAtTime(80, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.25 * atten, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const pn1 = connectToMaster(g, master, pan);
    noise.connect(filter).connect(g);
    noise.start(t0); noise.stop(t0 + dur);

    const thump = ctx.createOscillator();
    thump.type = "sine";
    thump.frequency.setValueAtTime(150, t0);
    thump.frequency.exponentialRampToValueAtTime(40, t0 + 0.1);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.3 * atten, t0);
    tg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
    const pn2 = connectToMaster(tg, master, pan);
    thump.connect(tg);
    thump.start(t0); thump.stop(t0 + 0.12);

    _disconnectOnEnd(noise, filter, g, pn1!);
    _disconnectOnEnd(thump, tg, pn2!);
  } else {
    const dur = 0.06;
    const noiseBuf = makeNoiseBuffer(ctx, dur);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, t0);
    filter.frequency.exponentialRampToValueAtTime(600, t0 + dur);
    filter.Q.value = 1.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12 * atten, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    const pn = connectToMaster(g, master, pan);
    noise.connect(filter).connect(g);
    noise.start(t0); noise.stop(t0 + dur);
    _disconnectOnEnd(noise, filter, g, pn!);
  }
}

// Short impact tick when a beam (mining or salvage) deals a hit.
// type "mining" → rock crunch; "salvage" → metal clank.
export function sfxBeamImpact(type: "mining" | "salvage" = "mining", x = 0, y = 0) {
  const { atten, pan } = spatialAtten(x, y, 2000);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = type === "salvage" ? 0.14 : 0.10;
  const baseFreq = type === "salvage" ? 260 : 180;
  const endFreq  = type === "salvage" ? 120 : 90;
  const bpFreq   = type === "salvage" ? 600 : 400;

  const osc = ctx.createOscillator();
  osc.type = type === "salvage" ? "sawtooth" : "square";
  osc.frequency.setValueAtTime(baseFreq, t0);
  osc.frequency.linearRampToValueAtTime(endFreq, t0 + dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = bpFreq;
  filter.Q.value = 2;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08 * atten, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  const pn = connectToMaster(g, master, pan);
  osc.connect(filter).connect(g);
  osc.start(t0); osc.stop(t0 + dur);
  _disconnectOnEnd(osc, filter, g, pn!);
}

// Short crunch when a wreck piece is destroyed by salvager.
export function sfxWreckPieceDestroy(x = 0, y = 0) {
  const { atten, pan } = spatialAtten(x, y, 2000);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = 0.28;

  const noise = ctx.createBufferSource();
  noise.buffer = makeNoiseBuffer(ctx, dur);
  const nf = ctx.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = 300;
  nf.Q.value = 0.8;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.18 * atten, t0);
  ng.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const pn1 = connectToMaster(ng, master, pan);
  noise.connect(nf).connect(ng); noise.start(t0); noise.stop(t0 + dur);

  const osc = ctx.createOscillator();
  osc.type = "square";
  osc.frequency.setValueAtTime(110, t0);
  osc.frequency.exponentialRampToValueAtTime(40, t0 + dur);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.10 * atten, t0);
  og.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const pn2 = connectToMaster(og, master, pan);
  osc.connect(og); osc.start(t0); osc.stop(t0 + dur);

  _disconnectOnEnd(noise, nf, ng, pn1!);
  _disconnectOnEnd(osc, og, pn2!);
}