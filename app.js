/**
 * Engine Simulator - Real-time engine sound synthesis application
 * Uses Web Audio API's AudioWorklet for realistic engine sound generation
 */

/**
 * Configuration constants for the engine simulator
 */
const CONFIG = {
  // Physics constants
  physics: {
    AIR_DENSITY: 1.225, // kg/m³
    GRAVITY: 9.81 // m/s²
  },

  // Vehicle default configuration
  vehicle: {
    gearRatios: [3.62, 2.19, 1.62, 1.27, 1.03, 0.82], // 6-speed transmission (typical sports car ratios)
    finalDrive: 3.42, // Differential ratio
    wheelRadius: 0.33, // meters (typical 255/40R18 tire)
    mass: 1350, // kg (lighter, more realistic for sports car)
    dragCoef: 0.30, // Improved aerodynamics
    frontalArea: 2.1, // m² (slightly reduced for sports car)
    rollingResistance: 0.012, // Coefficient (sport tires have lower rolling resistance)
    drivelineEfficiency: 0.92 // Improved efficiency (90-95% is typical for modern transmissions)
  },

  // Engine parameter constraints
  constraints: {
    ncyl: { min: 1, max: 12, default: 4 },
    idleRpm: { min: 500, max: 2000, default: 900 },
    redlineRpm: { min: 3000, max: 12000, default: 7000 },
    inertia: { min: 0.8, max: 0.99, default: 0.95 },
    noiseGain: { min: 0, max: 1, default: 0.2 }
  },

  // Engine presets
  presets: {
    na: {
      ncyl: 4,
      idleRpm: 850,
      redlineRpm: 7800,
      inertia: 0.92,
      noiseGain: 0.16
    },
    turbo: {
      ncyl: 4,
      idleRpm: 1000,
      redlineRpm: 6800,
      inertia: 0.97,
      noiseGain: 0.34
    },
    vtec: {
      ncyl: 4,
      idleRpm: 900,
      redlineRpm: 8600,
      inertia: 0.9,
      noiseGain: 0.22
    },
    fa24: {
      ncyl: 4,
      idleRpm: 780,
      redlineRpm: 7400,
      inertia: 0.96,
      noiseGain: 0.42
    }
  },

  // Audio perspective EQ profiles
  perspectives: {
    exterior: {
      lowShelf: { freq: 120, gain: 4 },
      mid: { freq: 800, gain: -2, Q: 1.0 },
      highShelf: { freq: 3000, gain: -6 }
    },
    interior: {
      lowShelf: { freq: 100, gain: 6 },
      mid: { freq: 500, gain: 3, Q: 0.8 },
      highShelf: { freq: 2500, gain: -10 }
    },
    enginebay: {
      lowShelf: { freq: 150, gain: -2 },
      mid: { freq: 1200, gain: 4, Q: 1.2 },
      highShelf: { freq: 4000, gain: 8 }
    }
  },

  // Reverb settings
  reverb: {
    duration: 2.0,
    decay: 2.0,
    sampleRate: 44100
  },

  // Default parameter values
  defaults: {
    currentRpm: 1000,
    currentThrottle: 0.0,
    targetThrottle: 0.0,
    throttleResponse: 0.1,
    audioPerspective: 'exterior',
    compressorEnabled: false,
    compressorAmount: 0.5,
    reverbEnabled: false,
    reverbAmount: 0.3,
    load: 0.0,
    roadLoad: 0.0
  }
};

// Audio context and nodes
let audioCtx;
let engineNode = null;
let isPlaying = false;

// Audio effect nodes
let compressorNode = null;
let convolverNode = null;
let eqLowShelfNode = null;
let eqMidNode = null;
let eqHighShelfNode = null;
let dryGainNode = null;
let wetGainNode = null;
let masterGainNode = null;

// Parameters
/**
 * Engine simulation parameters
 * @typedef {Object} EngineParams
 * @property {number} currentRpm - Current engine RPM
 * @property {number} currentThrottle - Current throttle position (0-1)
 * @property {number} targetThrottle - Target throttle position (0-1)
 * @property {number} ncyl - Number of cylinders
 * @property {number} noiseGain - Noise level (0-1)
 * @property {number} idleRpm - Idle RPM value
 * @property {string} enginePreset - Selected engine preset name
 * @property {number} redlineRpm - Redline RPM value
 * @property {number} inertia - Engine inertia factor (0-1, higher = slower response)
 * @property {number} throttleResponse - Throttle response speed
 * @property {string} audioPerspective - Audio perspective (exterior/interior/enginebay)
 * @property {boolean} compressorEnabled - Compressor effect enabled
 * @property {number} compressorAmount - Compressor effect amount (0-1)
 * @property {boolean} reverbEnabled - Reverb effect enabled
 * @property {number} reverbAmount - Reverb effect amount (0-1)
 */
const params = {
  currentRpm: CONFIG.defaults.currentRpm,
  currentThrottle: CONFIG.defaults.currentThrottle,
  targetThrottle: CONFIG.defaults.targetThrottle,
  ncyl: CONFIG.constraints.ncyl.default,
  noiseGain: CONFIG.constraints.noiseGain.default,
  idleRpm: CONFIG.constraints.idleRpm.default,
  enginePreset: 'custom',
  redlineRpm: CONFIG.constraints.redlineRpm.default,
  inertia: CONFIG.constraints.inertia.default,
  throttleResponse: CONFIG.defaults.throttleResponse,
  audioPerspective: CONFIG.defaults.audioPerspective,
  compressorEnabled: CONFIG.defaults.compressorEnabled,
  compressorAmount: CONFIG.defaults.compressorAmount,
  reverbEnabled: CONFIG.defaults.reverbEnabled,
  reverbAmount: CONFIG.defaults.reverbAmount,
  load: CONFIG.defaults.load,
  roadLoad: CONFIG.defaults.roadLoad
};

// Vehicle state for simple load and speed modeling
const vehicleState = {
  speed: 0, // m/s
  gear: 1,
  ...CONFIG.vehicle
};

let lastUpdateTime = performance.now();

// UI Elements
const rpmDisplay = document.getElementById('rpm-value');
const throttleFill = document.getElementById('throttle-fill');
const loadFill = document.getElementById('load-fill');
const startButton = document.getElementById('start-btn');
const statusText = document.getElementById('status');
const speedDisplay = document.getElementById('speed-value');
const gearDisplay = document.getElementById('gear-value');

// Controls
const ncylInput = document.getElementById('ncyl');
const idleRpmInput = document.getElementById('idle-rpm');
const redlineRpmInput = document.getElementById('redline-rpm');
const inertiaInput = document.getElementById('inertia');
const noiseInput = document.getElementById('noise-gain');
const presetInput = document.getElementById('engine-preset');
const perspectiveInput = document.getElementById('audio-perspective');
const compressorEnabledInput = document.getElementById('compressor-enabled');
const compressorAmountInput = document.getElementById('compressor-amount');
const reverbEnabledInput = document.getElementById('reverb-enabled');
const reverbAmountInput = document.getElementById('reverb-amount');
const gearInput = document.getElementById('gear');
const roadLoadInput = document.getElementById('load');

/**
 * Apply a predefined engine preset
 * @param {string} presetName - Name of the preset to apply
 */
function applyPreset(presetName) {
  const preset = CONFIG.presets[presetName];
  if (!preset) return;

  ncylInput.value = preset.ncyl;
  idleRpmInput.value = preset.idleRpm;
  redlineRpmInput.value = preset.redlineRpm;
  inertiaInput.value = preset.inertia;
  noiseInput.value = preset.noiseGain;

  params.enginePreset = presetName;
  updateParamsFromUI();
}

/**
 * Update engine parameters from UI input values
 */
function updateParamsFromUI() {
  // Validate and constrain input values using CONFIG constraints
  const c = CONFIG.constraints;
  params.ncyl = Math.max(c.ncyl.min, Math.min(c.ncyl.max, parseInt(ncylInput.value) || c.ncyl.default));
  params.idleRpm = Math.max(c.idleRpm.min, Math.min(c.idleRpm.max, parseInt(idleRpmInput.value) || c.idleRpm.default));
  params.redlineRpm = Math.max(c.redlineRpm.min, Math.min(c.redlineRpm.max, parseInt(redlineRpmInput.value) || c.redlineRpm.default));
  params.inertia = Math.max(c.inertia.min, Math.min(c.inertia.max, parseFloat(inertiaInput.value) || c.inertia.default));
  params.noiseGain = Math.max(c.noiseGain.min, Math.min(c.noiseGain.max, parseFloat(noiseInput.value) || c.noiseGain.default));

  // Ensure redline is higher than idle
  if (params.redlineRpm <= params.idleRpm) {
    params.redlineRpm = params.idleRpm + 1000;
    redlineRpmInput.value = params.redlineRpm;
  }
}

[ncylInput, idleRpmInput, redlineRpmInput, inertiaInput, noiseInput].forEach(el => {
  el.addEventListener('input', () => {
    params.enginePreset = 'custom';
    presetInput.value = 'custom';
    updateParamsFromUI();
  });
});

presetInput.addEventListener('change', () => {
  const selectedPreset = presetInput.value;
  if (selectedPreset === 'custom') {
    params.enginePreset = 'custom';
    updateParamsFromUI();
    return;
  }

  applyPreset(selectedPreset);
});

/**
 * Apply EQ settings based on audio perspective
 * @param {string} perspective - Audio perspective (exterior/interior/enginebay)
 */
function applyEQPerspective(perspective) {
  if (!eqLowShelfNode || !eqMidNode || !eqHighShelfNode) return;

  const profile = CONFIG.perspectives[perspective];
  if (!profile) return;

  eqLowShelfNode.frequency.value = profile.lowShelf.freq;
  eqLowShelfNode.gain.value = profile.lowShelf.gain;

  eqMidNode.frequency.value = profile.mid.freq;
  eqMidNode.gain.value = profile.mid.gain;
  eqMidNode.Q.value = profile.mid.Q;

  eqHighShelfNode.frequency.value = profile.highShelf.freq;
  eqHighShelfNode.gain.value = profile.highShelf.gain;
}

/**
 * Update compressor effect settings
 */
function updateCompressor() {
  if (!compressorNode) return;

  if (params.compressorEnabled) {
    const amount = params.compressorAmount;
    compressorNode.threshold.value = -24 * amount;
    compressorNode.knee.value = 30 * amount;
    compressorNode.ratio.value = 2 + 10 * amount;
    compressorNode.attack.value = 0.003;
    compressorNode.release.value = 0.25;
  }
}

/**
 * Update reverb effect settings (dry/wet mix)
 */
function updateReverb() {
  if (!wetGainNode || !dryGainNode) return;

  if (params.reverbEnabled) {
    wetGainNode.gain.value = params.reverbAmount * 0.6;
    dryGainNode.gain.value = 1.0 - params.reverbAmount * 0.4;
  } else {
    wetGainNode.gain.value = 0;
    dryGainNode.gain.value = 1.0;
  }
}

/**
 * Create a reverb impulse response buffer
 * @param {AudioContext} audioContext - The audio context
 * @param {number} duration - Duration in seconds (defaults to CONFIG value)
 * @param {number} decay - Decay rate (defaults to CONFIG value)
 * @returns {Promise<AudioBuffer>} The created impulse response buffer
 */
async function createReverbImpulse(audioContext, duration = CONFIG.reverb.duration, decay = CONFIG.reverb.decay) {
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * duration;
  const impulse = audioContext.createBuffer(2, length, sampleRate);
  const left = impulse.getChannelData(0);
  const right = impulse.getChannelData(1);

  for (let i = 0; i < length; i++) {
    const t = i / sampleRate;
    const envelope = Math.exp(-t * decay);
    left[i] = (Math.random() * 2 - 1) * envelope;
    right[i] = (Math.random() * 2 - 1) * envelope;
  }

  return impulse;
}

perspectiveInput.addEventListener('change', () => {
  params.audioPerspective = perspectiveInput.value;
  applyEQPerspective(params.audioPerspective);
});

compressorEnabledInput.addEventListener('change', () => {
  params.compressorEnabled = compressorEnabledInput.checked;
  updateCompressor();
});

compressorAmountInput.addEventListener('input', () => {
  params.compressorAmount = parseFloat(compressorAmountInput.value);
  updateCompressor();
});

reverbEnabledInput.addEventListener('change', () => {
  params.reverbEnabled = reverbEnabledInput.checked;
  updateReverb();
});

reverbAmountInput.addEventListener('input', () => {
  params.reverbAmount = parseFloat(reverbAmountInput.value);
  updateReverb();
});

roadLoadInput.addEventListener('input', () => {
  params.roadLoad = Math.max(0, Math.min(1, parseFloat(roadLoadInput.value) || 0));
});

gearInput.addEventListener('change', () => {
  vehicleState.gear = parseInt(gearInput.value, 10) || 0;
});

function getOverallRatio() {
  if (vehicleState.gear <= 0) return 0;
  const gear = vehicleState.gearRatios[vehicleState.gear - 1] || 0;
  return gear * vehicleState.finalDrive;
}

function calcEngineTorque(rpm, throttle) {
  const rpmSpan = Math.max(1, params.redlineRpm - params.idleRpm);
  const norm = Math.min(1, Math.max(0, (rpm - params.idleRpm) / rpmSpan));
  // More realistic torque curve: peak around 60% of RPM range (4200-4800 RPM for typical engine)
  const mid = 0.60;
  const width = 0.40;
  const shape = Math.max(0, 1 - Math.pow((norm - mid) / width, 2));
  // Realistic torque values: 250-300 Nm for typical 4-cylinder NA engine
  const baseTorque = 280;
  // At closed throttle, still produce minimal torque (pumping losses, friction)
  // At full throttle, produce full torque according to curve
  return baseTorque * shape * (0.15 + 0.85 * throttle);
}

/**
 * Main animation loop - updates throttle, RPM, and UI
 */
function update() {
  if (!isPlaying) return;

  const nowTime = performance.now();
  const dt = Math.min(0.05, (nowTime - lastUpdateTime) / 1000);
  lastUpdateTime = nowTime;

  // Physics: Update Throttle
  // Smoothly interpolate current throttle to target throttle
  // Simple easing
  const throttleDiff = params.targetThrottle - params.currentThrottle;
  params.currentThrottle += throttleDiff * params.throttleResponse;

  const overallRatio = getOverallRatio();
  const isCoupled = overallRatio > 0;
  const wheelRpm = vehicleState.speed > 0 ? (vehicleState.speed / (2 * Math.PI * vehicleState.wheelRadius)) * 60 : 0;
  const drivelineRpm = isCoupled ? wheelRpm * overallRatio : 0;

  const engineTorque = calcEngineTorque(params.currentRpm, params.currentThrottle);
  const wheelTorque = isCoupled ? engineTorque * overallRatio * vehicleState.drivelineEfficiency : 0;
  const tractiveForce = isCoupled ? wheelTorque / vehicleState.wheelRadius : 0;

  const aeroDrag = 0.5 * CONFIG.physics.AIR_DENSITY * vehicleState.dragCoef * vehicleState.frontalArea * vehicleState.speed * vehicleState.speed;
  const rollingResistance = vehicleState.mass * CONFIG.physics.GRAVITY * vehicleState.rollingResistance;
  // Grade force: roadLoad slider represents grade (0 = flat, 1 = steep hill ~25%)
  // sin(θ) ≈ θ for small angles, so roadLoad of 0.5 = ~12-13% grade
  const gradeForce = vehicleState.mass * CONFIG.physics.GRAVITY * params.roadLoad * 0.25;
  const resistiveForce = aeroDrag + rollingResistance + gradeForce;

  const netForce = isCoupled ? tractiveForce - resistiveForce : -resistiveForce;
  const accel = netForce / vehicleState.mass;
  vehicleState.speed = Math.max(0, vehicleState.speed + accel * dt);

  // Determine target RPM blending free-rev and driveline-coupled RPM
  const freeTargetRpm = params.idleRpm + (params.redlineRpm - params.idleRpm) * params.currentThrottle;
  const speedCoupling = Math.min(0.4, vehicleState.speed * 0.02);
  const coupling = isCoupled ? Math.min(0.85, 0.25 + 0.35 * params.currentThrottle + speedCoupling) : 0;
  const targetRpm = isCoupled ? Math.max(params.idleRpm, drivelineRpm * coupling + freeTargetRpm * (1.0 - coupling)) : freeTargetRpm;

  // Calculate engine load more realistically:
  // Load = (actual torque demand) / (maximum available torque at current RPM)
  const rpmSpan = Math.max(1, params.redlineRpm - params.idleRpm);
  const maxTorqueAtCurrentRpm = calcEngineTorque(params.currentRpm, 1.0);

  // Calculate required torque to overcome resistance
  const requiredTorque = isCoupled
    ? (resistiveForce * vehicleState.wheelRadius) / (overallRatio * vehicleState.drivelineEfficiency)
    : 0;

  // Base load from resistance forces
  const resistanceLoad = maxTorqueAtCurrentRpm > 0
    ? Math.min(1.0, requiredTorque / maxTorqueAtCurrentRpm)
    : 0;

  // Additional load when accelerating (inertial load)
  const inertialLoad = isCoupled && accel > 0
    ? Math.min(0.35, (vehicleState.mass * Math.abs(accel) * vehicleState.wheelRadius) / (maxTorqueAtCurrentRpm * overallRatio * vehicleState.drivelineEfficiency))
    : 0;

  // RPM mismatch indicates clutch slip or gear mismatch - creates load
  const slipLoad = isCoupled && drivelineRpm > 0
    ? Math.min(0.25, Math.abs(params.currentRpm - drivelineRpm) / Math.max(1, drivelineRpm * 0.5))
    : 0;

  // Final load calculation - no artificial base, purely physics-based
  // When freewheeling (not coupled), load is minimal (just internal friction)
  if (!isCoupled) {
    params.load = 0.05; // Minimal internal friction load
  } else {
    params.load = Math.max(0, Math.min(1, resistanceLoad + inertialLoad + slipLoad));
  }

  // RPM inertia logic:
  // Current RPM moves towards Target RPM.
  // Speed of change depends on inertia and load.
  let effectiveInertia = params.inertia;

  // When under load and accelerating, RPM changes more slowly (harder to rev up)
  if (targetRpm > params.currentRpm) {
    // Higher load = harder to accelerate
    // Load directly reduces available power for acceleration
    const loadResistance = Math.min(0.9, params.load * 0.7);
    effectiveInertia = params.inertia + (1.0 - params.inertia) * loadResistance;
  } else {
    // Decelerating: load causes engine braking (faster deceleration)
    // But inertia still matters
    const engineBraking = isCoupled ? params.load * 0.3 : 0;
    effectiveInertia = params.inertia * (1.0 - engineBraking);
  }

  params.currentRpm = params.currentRpm * effectiveInertia + targetRpm * (1.0 - effectiveInertia);
  params.currentRpm = Math.max(params.idleRpm * 0.75, Math.min(params.currentRpm, params.redlineRpm * 1.05));

  // Send to AudioWorklet
  if (engineNode) {
    const rpmParam = engineNode.parameters.get('rpm');
    const throttleParam = engineNode.parameters.get('throttle');
    const ncylParam = engineNode.parameters.get('ncyl');
    const noiseGainParam = engineNode.parameters.get('noiseGain');
    const turboModeParam = engineNode.parameters.get('turboMode');
    const boxerModeParam = engineNode.parameters.get('boxerMode');
    const vtecModeParam = engineNode.parameters.get('vtecMode');
    const fa24ModeParam = engineNode.parameters.get('fa24Mode');
    const redlineRpmParam = engineNode.parameters.get('redlineRpm');
    const loadParam = engineNode.parameters.get('load');

    const now = audioCtx.currentTime;
    rpmParam.setValueAtTime(params.currentRpm, now);
    throttleParam.setValueAtTime(params.currentThrottle, now);
    ncylParam.setValueAtTime(params.ncyl, now);
    noiseGainParam.setValueAtTime(params.noiseGain, now);
    turboModeParam.setValueAtTime(params.enginePreset === 'turbo' ? 1 : 0, now);
    boxerModeParam.setValueAtTime(params.enginePreset === 'fa24' ? 1 : 0, now);
    vtecModeParam.setValueAtTime(params.enginePreset === 'vtec' ? 1 : 0, now);
    fa24ModeParam.setValueAtTime(params.enginePreset === 'fa24' ? 1 : 0, now);
    redlineRpmParam.setValueAtTime(params.redlineRpm, now);
    loadParam.setValueAtTime(params.load, now);
  }

  // Update UI
  rpmDisplay.textContent = Math.round(params.currentRpm);
  throttleFill.style.width = `${params.currentThrottle * 100}%`;
  loadFill.style.width = `${params.load * 100}%`;
  if (speedDisplay) {
    speedDisplay.textContent = Math.round(vehicleState.speed * 3.6);
  }
  if (gearDisplay) {
    gearDisplay.textContent = vehicleState.gear <= 0 ? 'N' : vehicleState.gear;
  }

  // Update RPM gauge color based on proximity to redline
  const rpmGaugeElement = rpmDisplay.parentElement;
  const rpmRatio = params.currentRpm / params.redlineRpm;

  rpmGaugeElement.classList.remove('warning', 'danger');
  if (rpmRatio >= 0.95) {
    rpmGaugeElement.classList.add('danger');
  } else if (rpmRatio >= 0.85) {
    rpmGaugeElement.classList.add('warning');
  }

  // Update throttle meter aria-valuenow for accessibility
  const throttleBar = document.querySelector('.throttle-bar');
  if (throttleBar) {
    throttleBar.setAttribute('aria-valuenow', Math.round(params.currentThrottle * 100));
  }

  // Update load meter aria-valuenow for accessibility
  const loadBar = document.querySelector('.load-bar');
  if (loadBar) {
    loadBar.setAttribute('aria-valuenow', Math.round(params.load * 100));
  }

  requestAnimationFrame(update);
}

/**
 * Set the target throttle position
 * @param {number} val - Throttle value (0-1)
 */
const setThrottle = (val) => {
  // Validate and constrain throttle value
  params.targetThrottle = Math.max(0, Math.min(1, val));
};

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    setThrottle(1.0);
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    setThrottle(0.0);
  }
});

// Mobile / Touch support
const pedal = document.getElementById('pedal-btn');
if(pedal) {
    pedal.addEventListener('mousedown', () => setThrottle(1.0));
    pedal.addEventListener('mouseup', () => setThrottle(0.0));
    pedal.addEventListener('touchstart', (e) => { e.preventDefault(); setThrottle(1.0); });
    pedal.addEventListener('touchend', (e) => { e.preventDefault(); setThrottle(0.0); });
}

// Start Audio
startButton.addEventListener('click', async () => {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (isPlaying) {
      await audioCtx.suspend();
      isPlaying = false;
      startButton.textContent = 'Start Engine';
      statusText.textContent = 'Engine Stopped';
      return;
    }

    if (audioCtx.state === 'suspended') {
      await audioCtx.resume();
    }

    // Show loading status
    statusText.textContent = 'Loading...';
    startButton.disabled = true;
    if (!engineNode) {
      await audioCtx.audioWorklet.addModule('engine-processor.js');
      engineNode = new AudioWorkletNode(audioCtx, 'engine-processor');

      // Create effect chain
      // EQ nodes
      eqLowShelfNode = audioCtx.createBiquadFilter();
      eqLowShelfNode.type = 'lowshelf';

      eqMidNode = audioCtx.createBiquadFilter();
      eqMidNode.type = 'peaking';

      eqHighShelfNode = audioCtx.createBiquadFilter();
      eqHighShelfNode.type = 'highshelf';

      // Compressor
      compressorNode = audioCtx.createDynamicsCompressor();

      // Reverb (convolver)
      convolverNode = audioCtx.createConvolver();
      const impulse = await createReverbImpulse(audioCtx, 2.0, 2.0);
      convolverNode.buffer = impulse;

      // Dry/Wet mixing
      dryGainNode = audioCtx.createGain();
      wetGainNode = audioCtx.createGain();
      masterGainNode = audioCtx.createGain();

      dryGainNode.gain.value = 1.0;
      wetGainNode.gain.value = 0.0;
      masterGainNode.gain.value = 1.0;

      // Connect the chain:
      // engineNode -> EQ -> compressor -> dry/wet split
      // dry path: -> dryGain -> master -> destination
      // wet path: -> convolver -> wetGain -> master -> destination
      engineNode.connect(eqLowShelfNode);
      eqLowShelfNode.connect(eqMidNode);
      eqMidNode.connect(eqHighShelfNode);
      eqHighShelfNode.connect(compressorNode);

      // Dry path
      compressorNode.connect(dryGainNode);
      dryGainNode.connect(masterGainNode);

      // Wet path (reverb)
      compressorNode.connect(convolverNode);
      convolverNode.connect(wetGainNode);
      wetGainNode.connect(masterGainNode);

      // Master to destination
      masterGainNode.connect(audioCtx.destination);

      // Apply initial settings
      applyEQPerspective(params.audioPerspective);
      updateCompressor();
      updateReverb();
    }

    lastUpdateTime = performance.now();
    isPlaying = true;
    startButton.textContent = 'Stop Engine';
    statusText.textContent = 'Running';
    startButton.disabled = false;
    update();
  } catch (e) {
    console.error('Error starting engine:', e);
    statusText.textContent = 'Error: ' + e.message;
    startButton.disabled = false;
    isPlaying = false;
  }
});

// Initialize inputs
updateParamsFromUI();

/**
 * Save current settings to localStorage
 */
function saveSettings() {
  try {
    const settings = {
      ncyl: params.ncyl,
      idleRpm: params.idleRpm,
      redlineRpm: params.redlineRpm,
      inertia: params.inertia,
      noiseGain: params.noiseGain,
      enginePreset: params.enginePreset,
      audioPerspective: params.audioPerspective,
      compressorEnabled: params.compressorEnabled,
      compressorAmount: params.compressorAmount,
      reverbEnabled: params.reverbEnabled,
      reverbAmount: params.reverbAmount,
      roadLoad: params.roadLoad,
      load: params.roadLoad,
      gear: vehicleState.gear
    };
    localStorage.setItem('engineSimulatorSettings', JSON.stringify(settings));
  } catch (e) {
    console.warn('Failed to save settings:', e);
  }
}

/**
 * Load settings from localStorage
 */
function loadSettings() {
  try {
    const saved = localStorage.getItem('engineSimulatorSettings');
    if (!saved) return;

    const settings = JSON.parse(saved);

    // Apply saved settings to inputs
    if (settings.ncyl !== undefined) ncylInput.value = settings.ncyl;
    if (settings.idleRpm !== undefined) idleRpmInput.value = settings.idleRpm;
    if (settings.redlineRpm !== undefined) redlineRpmInput.value = settings.redlineRpm;
    if (settings.inertia !== undefined) inertiaInput.value = settings.inertia;
    if (settings.noiseGain !== undefined) noiseInput.value = settings.noiseGain;
    if (settings.enginePreset !== undefined) presetInput.value = settings.enginePreset;
    if (settings.audioPerspective !== undefined) perspectiveInput.value = settings.audioPerspective;
    if (settings.compressorEnabled !== undefined) compressorEnabledInput.checked = settings.compressorEnabled;
    if (settings.compressorAmount !== undefined) compressorAmountInput.value = settings.compressorAmount;
    if (settings.reverbEnabled !== undefined) reverbEnabledInput.checked = settings.reverbEnabled;
    if (settings.reverbAmount !== undefined) reverbAmountInput.value = settings.reverbAmount;
    if (settings.gear !== undefined) gearInput.value = settings.gear;

    const savedRoadLoad = settings.roadLoad !== undefined ? settings.roadLoad : settings.load;
    if (savedRoadLoad !== undefined) {
      params.roadLoad = Math.max(0, Math.min(1, savedRoadLoad));
      roadLoadInput.value = params.roadLoad;
    }

    // Update params from loaded inputs
    params.enginePreset = settings.enginePreset || 'custom';
    params.audioPerspective = settings.audioPerspective || 'exterior';
    params.compressorEnabled = settings.compressorEnabled || false;
    params.compressorAmount = settings.compressorAmount || 0.5;
    params.reverbEnabled = settings.reverbEnabled || false;
    params.reverbAmount = settings.reverbAmount || 0.3;
    params.load = 0.0;
    params.roadLoad = params.roadLoad || 0.0;
    vehicleState.gear = parseInt(gearInput.value, 10) || 0;
    updateParamsFromUI();
    if (gearDisplay) gearDisplay.textContent = vehicleState.gear <= 0 ? 'N' : vehicleState.gear;
    if (speedDisplay) speedDisplay.textContent = Math.round(vehicleState.speed * 3.6);
  } catch (e) {
    console.warn('Failed to load settings:', e);
  }
}

// Load settings on startup
loadSettings();

// Save settings whenever they change
[ncylInput, idleRpmInput, redlineRpmInput, inertiaInput, noiseInput].forEach(el => {
  el.addEventListener('change', saveSettings);
});

presetInput.addEventListener('change', saveSettings);
perspectiveInput.addEventListener('change', saveSettings);
compressorEnabledInput.addEventListener('change', saveSettings);
compressorAmountInput.addEventListener('change', saveSettings);
reverbEnabledInput.addEventListener('change', saveSettings);
reverbAmountInput.addEventListener('change', saveSettings);
roadLoadInput.addEventListener('change', saveSettings);
gearInput.addEventListener('change', saveSettings);
