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

  // --- Sub-bass drone: two detuned sines for cavernous depth ---
  const drone1 = ctx.createOscillator();
  drone1.type = "sine";
  drone1.frequency.setValueAtTime(42, t0);
  drone1.frequency.exponentialRampToValueAtTime(55, t0 + dur * 0.6);

  const drone2 = ctx.createOscillator();
  drone2.type = "sine";
  drone2.frequency.setValueAtTime(43.5, t0);
  drone2.frequency.exponentialRampToValueAtTime(56.5, t0 + dur * 0.6);

  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0.001, t0);
  droneGain.gain.linearRampToValueAtTime(0.18, t0 + dur * 0.5);
  droneGain.gain.linearRampToValueAtTime(0.001, t0 + dur);

  drone1.connect(droneGain).connect(master);
  drone2.connect(droneGain).connect(master);
  drone1.start(t0); drone1.stop(t0 + dur);
  drone2.start(t0); drone2.stop(t0 + dur);
  _disconnectOnEnd(drone1, drone2, droneGain);

  // --- Harmonic overtones: sawtooth swept through resonant filter ---
  const saw = ctx.createOscillator();
  saw.type = "sawtooth";
  saw.frequency.setValueAtTime(55, t0);
  saw.frequency.exponentialRampToValueAtTime(180, t0 + dur);

  const sawFilter = ctx.createBiquadFilter();
  sawFilter.type = "lowpass";
  sawFilter.frequency.setValueAtTime(120, t0);
  sawFilter.frequency.exponentialRampToValueAtTime(2800, t0 + dur);
  sawFilter.Q.value = 4.0;

  const sawGain = ctx.createGain();
  sawGain.gain.setValueAtTime(0.001, t0);
  sawGain.gain.linearRampToValueAtTime(0.10, t0 + dur * 0.6);
  sawGain.gain.linearRampToValueAtTime(0.001, t0 + dur);

  saw.connect(sawFilter).connect(sawGain).connect(master);
  saw.start(t0); saw.stop(t0 + dur);
  _disconnectOnEnd(saw, sawFilter, sawGain);

  // --- Brown noise rumble for physical menace ---
  const brownBuf = makeBrownNoiseBuffer(ctx, dur);
  const rumble = ctx.createBufferSource();
  rumble.buffer = brownBuf;

  const rumbleFilter = ctx.createBiquadFilter();
  rumbleFilter.type = "lowpass";
  rumbleFilter.frequency.setValueAtTime(80, t0);
  rumbleFilter.frequency.exponentialRampToValueAtTime(400, t0 + dur);

  const rumbleGain = ctx.createGain();
  rumbleGain.gain.setValueAtTime(0.001, t0);
  rumbleGain.gain.linearRampToValueAtTime(0.14, t0 + dur * 0.5);
  rumbleGain.gain.linearRampToValueAtTime(0.001, t0 + dur);

  rumble.connect(rumbleFilter).connect(rumbleGain).connect(master);
  rumble.start(t0); rumble.stop(t0 + dur);
  _disconnectOnEnd(rumble, rumbleFilter, rumbleGain);

  // --- Resonant ping: metallic sci-fi sheen ---
  const ping = ctx.createOscillator();
  ping.type = "square";
  ping.frequency.setValueAtTime(110, t0);
  ping.frequency.exponentialRampToValueAtTime(880, t0 + dur);

  const pingFilter = ctx.createBiquadFilter();
  pingFilter.type = "bandpass";
  pingFilter.frequency.setValueAtTime(220, t0);
  pingFilter.frequency.exponentialRampToValueAtTime(1200, t0 + dur);
  pingFilter.Q.value = 8.0;

  const pingGain = ctx.createGain();
  pingGain.gain.setValueAtTime(0.001, t0);
  pingGain.gain.linearRampToValueAtTime(0.04, t0 + dur * 0.4);
  pingGain.gain.linearRampToValueAtTime(0.001, t0 + dur);

  ping.connect(pingFilter).connect(pingGain).connect(master);
  ping.start(t0); ping.stop(t0 + dur);
  _disconnectOnEnd(ping, pingFilter, pingGain);
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

  const baseVol = isThrusting ? 0.35 : 0;
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