/**
 * Engine Simulator - Real-time engine sound synthesis application
 * Uses Web Audio API's AudioWorklet for realistic engine sound generation
 */

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
  currentRpm: 1000,
  currentThrottle: 0.0,
  targetThrottle: 0.0,
  ncyl: 4,
  noiseGain: 0.2,
  idleRpm: 900,
  enginePreset: 'custom',
  redlineRpm: 7000,
  inertia: 0.95, // Higher is slower response (0-1)
  throttleResponse: 0.1, // How fast throttle moves to target
  audioPerspective: 'exterior',
  compressorEnabled: false,
  compressorAmount: 0.5,
  reverbEnabled: false,
  reverbAmount: 0.3
};

// UI Elements
const rpmDisplay = document.getElementById('rpm-value');
const throttleFill = document.getElementById('throttle-fill');
const startButton = document.getElementById('start-btn');
const statusText = document.getElementById('status');

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

/**
 * Engine preset profiles with predefined parameters
 * @type {Object.<string, {ncyl: number, idleRpm: number, redlineRpm: number, inertia: number, noiseGain: number}>}
 */
const presetProfiles = {
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
};

/**
 * Apply a predefined engine preset
 * @param {string} presetName - Name of the preset to apply
 */
function applyPreset(presetName) {
  const preset = presetProfiles[presetName];
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
  // Validate and constrain input values
  params.ncyl = Math.max(1, Math.min(12, parseInt(ncylInput.value) || 4));
  params.idleRpm = Math.max(500, Math.min(2000, parseInt(idleRpmInput.value) || 900));
  params.redlineRpm = Math.max(3000, Math.min(12000, parseInt(redlineRpmInput.value) || 7000));
  params.inertia = Math.max(0.8, Math.min(0.99, parseFloat(inertiaInput.value) || 0.95));
  params.noiseGain = Math.max(0, Math.min(1, parseFloat(noiseInput.value) || 0.2));

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
 * EQ perspective profiles for different audio listening positions
 * @type {Object.<string, {lowShelf: Object, mid: Object, highShelf: Object}>}
 */
const perspectiveProfiles = {
  exterior: {
    lowShelf: { freq: 120, gain: 4 },
    mid: { freq: 800, gain: -2, Q: 1.0 },
    highShelf: { freq: 3000, gain: -6 }
  },
  interior: {
    lowShelf: { freq: 80, gain: -3 },
    mid: { freq: 2500, gain: 3, Q: 0.7 },
    highShelf: { freq: 6000, gain: -8 }
  },
  enginebay: {
    lowShelf: { freq: 150, gain: 2 },
    mid: { freq: 1200, gain: 5, Q: 1.5 },
    highShelf: { freq: 4000, gain: 0 }
  }
};

/**
 * Apply EQ settings based on audio perspective
 * @param {string} perspective - Audio perspective (exterior/interior/enginebay)
 */
function applyEQPerspective(perspective) {
  if (!eqLowShelfNode || !eqMidNode || !eqHighShelfNode) return;

  const profile = perspectiveProfiles[perspective];
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
 * @param {number} duration - Duration in seconds
 * @param {number} decay - Decay rate
 * @returns {Promise<AudioBuffer>} The created impulse response buffer
 */
async function createReverbImpulse(audioContext, duration = 2.0, decay = 2.0) {
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

/**
 * Main animation loop - updates throttle, RPM, and UI
 */
function update() {
  if (!isPlaying) return;

  // Physics: Update Throttle
  // Smoothly interpolate current throttle to target throttle
  // Simple easing
  const throttleDiff = params.targetThrottle - params.currentThrottle;
  params.currentThrottle += throttleDiff * params.throttleResponse;
  
  // Physics: Update RPM
  // Engine wants to go to:
  // Idle RPM + (Redline - Idle) * Throttle
  // But with inertia
  // If throttle is high, target is high RPM. If low, target is idle.
  // Actually, engine RPM depends on load/gear, but here we assume neutral/clutch down, so it revs freely based on throttle.
  // But also needs to return to idle when throttle is 0.
  
  const targetRpm = params.idleRpm + (params.redlineRpm - params.idleRpm) * params.currentThrottle;
  
  // RPM inertia logic:
  // Current RPM moves towards Target RPM.
  // Speed of change depends on inertia.
  // Using simple low-pass filter logic:
  // new_rpm = current_rpm * inertia + target_rpm * (1 - inertia)
  // But 'inertia' user input is 0-1, where 1 is infinite inertia.
  
  const inertiaFactor = params.inertia; 
  params.currentRpm = params.currentRpm * inertiaFactor + targetRpm * (1.0 - inertiaFactor);

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
  }

  // Update UI
  rpmDisplay.textContent = Math.round(params.currentRpm);
  throttleFill.style.width = `${params.currentThrottle * 100}%`;

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
      reverbAmount: params.reverbAmount
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

    // Update params from loaded inputs
    params.enginePreset = settings.enginePreset || 'custom';
    params.audioPerspective = settings.audioPerspective || 'exterior';
    params.compressorEnabled = settings.compressorEnabled || false;
    params.compressorAmount = settings.compressorAmount || 0.5;
    params.reverbEnabled = settings.reverbEnabled || false;
    params.reverbAmount = settings.reverbAmount || 0.3;
    updateParamsFromUI();
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
