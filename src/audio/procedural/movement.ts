import {
  getAudio,
  now,
  connectToMaster,
  _disconnectOnEnd,
  makeNoiseBuffer,
  makeBrownNoiseBuffer,
  _ctx
} from "./core.js";

export function sfxWarpCharge() {
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = 2.4;

  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(80, t0);
  osc.frequency.exponentialRampToValueAtTime(800, t0 + dur);

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(200, t0);
  filter.frequency.exponentialRampToValueAtTime(3000, t0 + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.08, t0);
  g.gain.linearRampToValueAtTime(0.22, t0 + dur * 0.7);
  g.gain.linearRampToValueAtTime(0.001, t0 + dur);

  osc.connect(filter).connect(g).connect(master);
  osc.start(t0); osc.stop(t0 + dur);
  _disconnectOnEnd(osc, filter, g);
}

export function sfxWarpJump() {
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();

  const noiseBuf = makeNoiseBuffer(ctx, 0.5);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(300, t0);
  filter.frequency.exponentialRampToValueAtTime(1200, t0 + 0.2);
  filter.frequency.exponentialRampToValueAtTime(100, t0 + 0.5);
  filter.Q.value = 1.5;

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.001, t0);
  g.gain.linearRampToValueAtTime(0.3, t0 + 0.15);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);

  noise.connect(filter).connect(g).connect(master);
  noise.start(t0); noise.stop(t0 + 0.5);
  _disconnectOnEnd(noise, filter, g);
}

interface EngineNodes {
  ctx: AudioContext;
  noiseSrc: AudioBufferSourceNode;
  noiseFilter: BiquadFilterNode;
  noiseGain: GainNode;
  rumble: OscillatorNode;
  rumbleGain: GainNode;
  active: boolean;
}

export let _engineNodes: EngineNodes | null = null;

export function startEngineNodes() {
  const a = getAudio();
  if (!a || _engineNodes) return;
  const { ctx, master } = a;
  const t0 = ctx.currentTime;

  const brown = makeBrownNoiseBuffer(ctx, 2.0);
  const noiseSrc = ctx.createBufferSource();
  noiseSrc.buffer = brown;
  noiseSrc.loop = true;

  const noiseFilter = ctx.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 180;
  noiseFilter.Q.value = 0.5;

  const noiseGain = ctx.createGain();
  noiseGain.gain.value = 0;

  const rumble = ctx.createOscillator();
  rumble.type = "sine";
  rumble.frequency.value = 45;

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.value = 0;

  noiseSrc.connect(noiseFilter).connect(noiseGain).connect(master);
  rumble.connect(rumbleGain).connect(master);

  noiseSrc.start(t0);
  rumble.start(t0);

  _engineNodes = {
    ctx,
    noiseSrc,
    noiseFilter,
    noiseGain,
    rumble,
    rumbleGain,
    active: false,
  };
}

export function stopEngineNodes() {
  if (!_engineNodes) return;
  const { ctx, noiseSrc, noiseFilter, noiseGain, rumble, rumbleGain } = _engineNodes;
  const t0 = ctx.currentTime;
  try {
    noiseGain.gain.cancelScheduledValues(t0);
    rumbleGain.gain.cancelScheduledValues(t0);
    noiseGain.gain.setTargetAtTime(0, t0, 0.08);
    rumbleGain.gain.setTargetAtTime(0, t0, 0.08);
  } catch {}
  setTimeout(() => {
    try { noiseSrc.stop(); } catch {}
    try { rumble.stop(); } catch {}
    try { noiseSrc.disconnect(); } catch {}
    try { noiseFilter.disconnect(); } catch {}
    try { noiseGain.disconnect(); } catch {}
    try { rumble.disconnect(); } catch {}
    try { rumbleGain.disconnect(); } catch {}
    _engineNodes = null;
  }, 200);
}

export function updateEngineSound(isThrusting: boolean, speedRatio = 0, afterburner = false) {
  const a = getAudio();
  if (!a) return;
  const { ctx } = a;

  if (_ctx && _ctx.state === "suspended") {
    _ctx.resume();
    if (_engineNodes) {
      stopEngineNodes();
    }
    return;
  }

  if (!_engineNodes && isThrusting) {
    startEngineNodes();
  }
  if (!_engineNodes) return;

  const t0 = ctx.currentTime;
  const n = _engineNodes;
  const wasActive = n.active;
  n.active = isThrusting;

  const baseVol = isThrusting ? 0.14 : 0;
  const targetNoiseVol = baseVol * (afterburner ? 1.35 : 1.0);
  const targetRumbleVol = baseVol * 0.45 * (afterburner ? 1.5 : 1.0);

  const ramp = wasActive === isThrusting ? 0.15 : 0.08;

  n.noiseGain.gain.setTargetAtTime(targetNoiseVol, t0, ramp);
  n.rumbleGain.gain.setTargetAtTime(targetRumbleVol, t0, ramp);

  const filterFreq = 180 + speedRatio * 380;
  n.noiseFilter.frequency.setTargetAtTime(filterFreq, t0, 0.12);
  n.rumble.frequency.setTargetAtTime(40 + speedRatio * 25, t0, 0.12);

  if (!isThrusting && speedRatio < 0.02) {
    stopEngineNodes();
  }
}

export function sfxEngineThrust() {
  const a = getAudio();
  if (!a) return;
  const { ctx, master } = a;
  const t0 = now();
  const dur = 0.15;

  const noiseBuf = makeNoiseBuffer(ctx, dur);
  const noise = ctx.createBufferSource();
  noise.buffer = noiseBuf;

  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(500, t0);
  filter.frequency.exponentialRampToValueAtTime(150, t0 + dur);

  const g = ctx.createGain();
  g.gain.setValueAtTime(0.06, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

  noise.connect(filter).connect(g).connect(master);
  noise.start(t0); noise.stop(t0 + dur);
  _disconnectOnEnd(noise, filter, g);
}