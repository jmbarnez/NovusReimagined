import {
  getAudio,
  spatialAtten,
  now,
  connectToMaster,
  _disconnectOnEnd,
  makeNoiseBuffer
} from "./core.js";
import { sfxBlip } from "./ui.js";

export function sfxWeaponFire(delivery: string, typeId = "default", vol = 1, x = 0, y = 0) {
  if (delivery === "beam") return sfxWeaponBeam(typeId, vol, x, y);
  if (delivery === "missile") return sfxWeaponMissile(typeId, vol, x, y);
  return sfxWeaponProjectile(typeId, vol, x, y);
}

export function sfxWeaponProjectile(typeId = "default", vol = 1, x = 0, y = 0) {
  const { atten, pan } = spatialAtten(x, y, 2500);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const isGauss = typeId === "tu-gauss";
  const isNeutron = typeId === "tu-neutron";
  const isCannon = typeId === "tu-cannon";
  const dur = isGauss ? 0.14 : isNeutron ? 0.06 : isCannon ? 0.12 : 0.08;
  const baseVol = Math.min(1, vol) * atten;

  const noiseBuf = makeNoiseBuffer(ctx, dur);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const filter = ctx.createBiquadFilter();
  if (isGauss) {
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(300, t0);
    filter.frequency.exponentialRampToValueAtTime(90, t0 + dur);
    filter.Q.value = 1.2;
  } else if (isCannon) {
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(800, t0);
    filter.frequency.exponentialRampToValueAtTime(100, t0 + dur);
  } else if (isNeutron) {
    filter.type = "highpass";
    filter.frequency.value = 2000;
  } else {
    filter.type = "highpass";
    filter.frequency.value = 1400;
  }

  const g = ctx.createGain();
  g.gain.setValueAtTime(baseVol * (isGauss ? 0.28 : isCannon ? 0.25 : 0.18), t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const pn1 = connectToMaster(g, master, pan);
  noise.connect(filter).connect(g);
  noise.start(t0); noise.stop(t0 + dur);

  const click = ctx.createOscillator();
  click.type = isGauss ? "sawtooth" : "square";
  click.frequency.setValueAtTime(isGauss ? 800 : isCannon ? 500 : isNeutron ? 3500 : 2200, t0);
  if (isCannon) click.frequency.exponentialRampToValueAtTime(80, t0 + 0.05);
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(baseVol * (isGauss ? 0.14 : isCannon ? 0.18 : isNeutron ? 0.09 : 0.06), t0);
  cg.gain.exponentialRampToValueAtTime(0.001, t0 + (isGauss ? 0.04 : isCannon ? 0.05 : 0.02));
  const pn2 = connectToMaster(cg, master, pan);
  click.connect(cg);
  click.start(t0); click.stop(t0 + (isGauss ? 0.04 : isCannon ? 0.05 : 0.02));

  const sub = ctx.createOscillator();
  sub.type = isGauss ? "sawtooth" : isCannon ? "sine" : "sine";
  sub.frequency.setValueAtTime(isGauss ? 120 : isCannon ? 150 : 100, t0);
  sub.frequency.exponentialRampToValueAtTime(isGauss ? 30 : isCannon ? 40 : 50, t0 + dur * 0.6);
  const sg = ctx.createGain();
  sg.gain.setValueAtTime(baseVol * (isGauss ? 0.18 : isCannon ? 0.22 : 0.08), t0);
  sg.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.7);
  const subFilter = ctx.createBiquadFilter();
  subFilter.type = "lowpass";
  subFilter.frequency.value = 220;
  const pn3 = connectToMaster(sg, master, pan);
  sub.connect(subFilter).connect(sg);
  sub.start(t0); sub.stop(t0 + dur * 0.7);

  _disconnectOnEnd(noise, filter, g, pn1!);
  _disconnectOnEnd(click, cg, pn2!);
  _disconnectOnEnd(sub, subFilter, sg, pn3!);
}

export function sfxWeaponBeam(typeId = "default", vol = 1, x = 0, y = 0) {
  const { atten, pan } = spatialAtten(x, y, 2500);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const isIon = typeId === "tu-ion";
  const dur = isIon ? 0.16 : 0.12;
  const baseVol = Math.min(1, vol) * atten;

  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(isIon ? 600 : 900, t0);
  osc.frequency.exponentialRampToValueAtTime(isIon ? 150 : 220, t0 + dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = isIon ? 1100 : 1500;
  filter.Q.value = isIon ? 2.5 : 3.5;

  const g = ctx.createGain();
  g.gain.setValueAtTime(baseVol * 0.14, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const pn1 = connectToMaster(g, master, pan);
  osc.connect(filter).connect(g);
  osc.start(t0); osc.stop(t0 + dur);

  const harm = ctx.createOscillator();
  harm.type = "triangle";
  harm.frequency.setValueAtTime(isIon ? 1200 : 1800, t0);
  harm.frequency.exponentialRampToValueAtTime(isIon ? 300 : 400, t0 + dur * 0.7);
  const hg = ctx.createGain();
  hg.gain.setValueAtTime(baseVol * 0.06, t0);
  hg.gain.exponentialRampToValueAtTime(0.001, t0 + dur * 0.7);
  const pn2 = connectToMaster(hg, master, pan);
  harm.connect(hg);
  harm.start(t0); harm.stop(t0 + dur * 0.7);

  _disconnectOnEnd(osc, filter, g, pn1!);
  _disconnectOnEnd(harm, hg, pn2!);
}

export function sfxWeaponMissile(typeId = "default", vol = 1, x = 0, y = 0) {
  const { atten, pan } = spatialAtten(x, y, 2500);
  if (atten <= 0.001) return;
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = 0.22;
  const baseVol = Math.min(1, vol) * atten;

  const noiseBuf = makeNoiseBuffer(ctx, dur);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(700, t0);
  filter.frequency.exponentialRampToValueAtTime(90, t0 + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(baseVol * 0.22, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const pn1 = connectToMaster(g, master, pan);
  noise.connect(filter).connect(g);
  noise.start(t0); noise.stop(t0 + dur);

  const pop = ctx.createOscillator();
  pop.type = "sine";
  pop.frequency.setValueAtTime(320, t0);
  pop.frequency.exponentialRampToValueAtTime(55, t0 + 0.07);
  const pg = ctx.createGain();
  pg.gain.setValueAtTime(baseVol * 0.14, t0);
  pg.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);
  const pn2 = connectToMaster(pg, master, pan);
  pop.connect(pg);
  pop.start(t0); pop.stop(t0 + 0.09);

  const whistle = ctx.createOscillator();
  whistle.type = "sine";
  whistle.frequency.setValueAtTime(450, t0 + 0.03);
  whistle.frequency.linearRampToValueAtTime(180, t0 + dur);
  const wg = ctx.createGain();
  wg.gain.setValueAtTime(0, t0);
  wg.gain.linearRampToValueAtTime(baseVol * 0.08, t0 + 0.04);
  wg.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  const pn3 = connectToMaster(wg, master, pan);
  whistle.connect(wg);
  whistle.start(t0 + 0.03); whistle.stop(t0 + dur);

  _disconnectOnEnd(noise, filter, g, pn1!);
  _disconnectOnEnd(pop, pg, pn2!);
  _disconnectOnEnd(whistle, wg, pn3!);
}

