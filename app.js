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
    },
    v8: {
      ncyl: 8,
      idleRpm: 750,
      redlineRpm: 6500,
      inertia: 0.97,
      noiseGain: 0.28
    },
    rotary: {
      ncyl: 2,
      idleRpm: 850,
      redlineRpm: 9000,
      inertia: 0.88,
      noiseGain: 0.38
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
    roadLoad: 0.0,
    realVehicleMode: false,
    accelThreshold: 0.5,
    accelMax: 5.0,
    cruiseThrottle: 0.15
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
  roadLoad: CONFIG.defaults.roadLoad,
  realVehicleMode: CONFIG.defaults.realVehicleMode,
  accelThreshold: CONFIG.defaults.accelThreshold,
  accelMax: CONFIG.defaults.accelMax,
  cruiseThrottle: CONFIG.defaults.cruiseThrottle
};

// Vehicle state for simple load and speed modeling
const vehicleState = {
  speed: 0, // m/s
  gear: 1,
  ...CONFIG.vehicle
};

// Real vehicle mode sensor state
const sensorState = {
  gpsSpeed: 0, // m/s from GPS (latest raw value)
  prevGpsSpeed: 0, // m/s from GPS at previous update (interpolation start point)
  gpsInterval: 1000, // estimated GPS update interval in ms (auto-detected)
  interpolatedSpeed: 0, // smoothly interpolated speed in m/s
  gpsAccuracy: null,
  acceleration: { x: 0, y: 0, z: 0 }, // m/s^2 from accelerometer
  lastGPSTime: 0,
  lastAccelTime: 0,
  watchId: null,
  hasGPS: false,
  hasAccelerometer: false
};

let lastUpdateTime = performance.now();

// UI Elements
const rpmDisplay = document.getElementById('rpm-value');
const rpmArc = document.getElementById('rpm-arc');
const rpmArcLength = rpmArc ? rpmArc.getTotalLength() : 0;
if (rpmArc && rpmArcLength) {
  rpmArc.style.strokeDasharray = `${rpmArcLength} ${rpmArcLength}`;
  rpmArc.style.strokeDashoffset = rpmArcLength;
}
const shiftLights = [
  document.getElementById('shift-light-1'),
  document.getElementById('shift-light-2'),
  document.getElementById('shift-light-3'),
  document.getElementById('shift-light-4'),
  document.getElementById('shift-light-5')
];
const throttleFill = document.getElementById('throttle-fill');
const loadFill = document.getElementById('load-fill');
const startButton = document.getElementById('start-btn');
const statusText = document.getElementById('status');
const speedDisplay = document.getElementById('speed-value');
const gearDisplay = document.getElementById('gear-value');
const accelTimeDisplay = document.getElementById('accel-time');
const topSpeedDisplay = document.getElementById('top-speed');

// Gear button elements
const gearButtons = document.querySelectorAll('.gear-btn');

// Performance tracking
const performanceStats = {
  isTimingAccel: false,
  accelStartTime: 0,
  accelTime: null,
  topSpeed: 0,
  hasReached100: false
};

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
const realVehicleModeInput = document.getElementById('real-vehicle-mode');
const realVehicleModeTopInput = document.getElementById('real-vehicle-mode-top');
const sensorStatusDisplay = document.getElementById('sensor-status');
const sensorStatusTopDisplay = document.getElementById('sensor-status-top');
const realVehicleSpeedDisplay = document.getElementById('real-vehicle-speed-display');
const gpsSpeedValueDisplay = document.getElementById('gps-speed-value');
const realVehicleParamsSection = document.getElementById('real-vehicle-params');
const accelThresholdInput = document.getElementById('accel-threshold');
const accelMaxInput = document.getElementById('accel-max');
const cruiseThrottleInput = document.getElementById('cruise-throttle');

// Screen Wake Lock support
let wakeLock = null;

async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) {
      console.warn('Wake lock request failed:', e);
    }
  }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release().catch((e) => { console.warn('Wake lock release failed:', e); });
    wakeLock = null;
  }
}

// Re-acquire wake lock if real vehicle mode is active and page becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && params.realVehicleMode && (!wakeLock || wakeLock.released)) {
    requestWakeLock();
  }
});

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

/**
 * Initialize GPS sensor for real vehicle mode
 */
function startGPSSensor() {
  if (!navigator.geolocation) {
    console.warn('Geolocation is not supported');
    return false;
  }

  const options = {
    enableHighAccuracy: true,
    timeout: 5000,
    maximumAge: 0
  };

  sensorState.watchId = navigator.geolocation.watchPosition(
    (position) => {
      const now = Date.now();
      const newSpeed = position.coords.speed || 0; // speed in m/s

      // Auto-detect GPS update interval using exponential moving average
      if (sensorState.lastGPSTime > 0) {
        const elapsed = now - sensorState.lastGPSTime;
        if (elapsed > 100 && elapsed < 5000) {
          // EMA weight: 0.7 for history, 0.3 for new sample
          const emaHistoryWeight = 0.7;
          sensorState.gpsInterval = sensorState.gpsInterval * emaHistoryWeight + elapsed * (1 - emaHistoryWeight);
        }
      }

      // Capture the current smoothed speed as the start of the next interpolation segment
      sensorState.prevGpsSpeed = sensorState.interpolatedSpeed;
      sensorState.gpsSpeed = newSpeed;
      sensorState.gpsAccuracy = position.coords.accuracy;
      sensorState.lastGPSTime = now;
      sensorState.hasGPS = true;
      updateSensorStatus();
    },
    (error) => {
      console.warn('GPS error:', error.message);
      sensorState.hasGPS = false;
      updateSensorStatus();
    },
    options
  );

  return true;
}

/**
 * Initialize accelerometer for real vehicle mode
 */
function startAccelerometer() {
  if (!window.DeviceMotionEvent) {
    console.warn('DeviceMotion is not supported');
    return false;
  }

  // Request permission for iOS 13+ devices
  if (typeof DeviceMotionEvent.requestPermission === 'function') {
    DeviceMotionEvent.requestPermission()
      .then(permissionState => {
        if (permissionState === 'granted') {
          attachAccelerometerListener();
        } else {
          console.warn('DeviceMotion permission denied');
          sensorState.hasAccelerometer = false;
          updateSensorStatus();
        }
      })
      .catch(console.error);
  } else {
    attachAccelerometerListener();
  }

  return true;
}

/**
 * Attach accelerometer event listener
 */
function attachAccelerometerListener() {
  window.addEventListener('devicemotion', (event) => {
    if (event.acceleration) {
      sensorState.acceleration.x = event.acceleration.x || 0;
      sensorState.acceleration.y = event.acceleration.y || 0;
      sensorState.acceleration.z = event.acceleration.z || 0;
      sensorState.lastAccelTime = Date.now();
      sensorState.hasAccelerometer = true;
      updateSensorStatus();
    }
  });
}

/**
 * Stop GPS sensor
 */
function stopGPSSensor() {
  if (sensorState.watchId !== null) {
    navigator.geolocation.clearWatch(sensorState.watchId);
    sensorState.watchId = null;
  }
  sensorState.hasGPS = false;
  sensorState.gpsSpeed = 0;
  sensorState.prevGpsSpeed = 0;
  sensorState.interpolatedSpeed = 0;
  sensorState.lastGPSTime = 0;
  updateSensorStatus();
}

/**
 * Update sensor status display
 */
function updateSensorStatus() {
  if (!sensorStatusDisplay) return;

  if (params.realVehicleMode) {
    const gpsStatus = sensorState.hasGPS ? '📍GPS' : '❌GPS';
    const accelStatus = sensorState.hasAccelerometer ? '📊Accel' : '❌Accel';
    const statusText = `${gpsStatus} ${accelStatus}`;
    const statusColor = (sensorState.hasGPS && sensorState.hasAccelerometer) ? '#4CAF50' : '#ff9800';
    sensorStatusDisplay.textContent = statusText;
    sensorStatusDisplay.style.color = statusColor;
    if (sensorStatusTopDisplay) {
      sensorStatusTopDisplay.textContent = statusText;
      sensorStatusTopDisplay.style.color = statusColor;
    }
  } else {
    sensorStatusDisplay.textContent = 'Off';
    sensorStatusDisplay.style.color = '#666';
    if (sensorStatusTopDisplay) {
      sensorStatusTopDisplay.textContent = 'Off';
      sensorStatusTopDisplay.style.color = '#666';
    }
  }
}

/**
 * Estimate throttle position from sensor data
 * Uses GPS speed and accelerometer data to estimate driver input
 * @returns {number} Estimated throttle (0-1)
 */
function estimateThrottleFromSensors() {
  // If no sensor data available, return 0
  if (!sensorState.hasGPS && !sensorState.hasAccelerometer) {
    return 0;
  }

  // Calculate forward acceleration (assuming device is in portrait mode)
  // Positive acceleration.y typically means forward acceleration
  const forwardAccel = sensorState.acceleration.y || 0;

  // Use GPS speed to determine if vehicle is accelerating or decelerating
  const speed = sensorState.gpsSpeed || 0; // m/s

  // Estimate throttle based on acceleration
  // Positive acceleration suggests throttle application
  // Typical vehicle acceleration: 0-5 m/s² for normal driving, up to 8-10 m/s² for performance cars
  let estimatedThrottle = 0;

  if (forwardAccel > params.accelThreshold) {
    // Accelerating - map acceleration to throttle
    estimatedThrottle = Math.min(1.0, Math.max(0, (forwardAccel - params.accelThreshold) / (params.accelMax - params.accelThreshold)));
  } else if (forwardAccel < -params.accelThreshold && speed > 1) {
    // Decelerating while moving - completely off throttle
    estimatedThrottle = 0;
  } else if (speed < 1 && Math.abs(forwardAccel) < params.accelThreshold) {
    // Vehicle stopped or very slow - idle
    estimatedThrottle = 0;
  } else {
    // Cruising - maintain slight throttle
    estimatedThrottle = params.cruiseThrottle;
  }

  return estimatedThrottle;
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

realVehicleModeInput.addEventListener('change', () => {
  params.realVehicleMode = realVehicleModeInput.checked;
  if (realVehicleModeTopInput) realVehicleModeTopInput.checked = realVehicleModeInput.checked;
  applyRealVehicleMode(params.realVehicleMode);
});

if (realVehicleModeTopInput) {
  realVehicleModeTopInput.addEventListener('change', () => {
    params.realVehicleMode = realVehicleModeTopInput.checked;
    realVehicleModeInput.checked = realVehicleModeTopInput.checked;
    applyRealVehicleMode(params.realVehicleMode);
  });
}

function applyRealVehicleMode(enabled) {
  if (enabled) {
    // Start sensors
    startGPSSensor();
    startAccelerometer();
    // Fix gear to 1st
    vehicleState.gear = 1;
    if (gearInput) { gearInput.value = 1; gearInput.disabled = true; }
    gearButtons.forEach(btn => { btn.disabled = true; });
    updateGearButtons();
    // Disable manual throttle controls
    if (pedal) {
      pedal.disabled = true;
      pedal.style.opacity = '0.5';
    }
    // Show real vehicle speed display and params
    if (realVehicleSpeedDisplay) realVehicleSpeedDisplay.style.display = '';
    if (realVehicleParamsSection) realVehicleParamsSection.style.display = '';
    // Request wake lock to prevent screen from sleeping
    requestWakeLock();
  } else {
    // Stop sensors
    stopGPSSensor();
    // Re-enable gear controls
    if (gearInput) gearInput.disabled = false;
    gearButtons.forEach(btn => { btn.disabled = false; });
    // Re-enable manual throttle controls
    if (pedal) {
      pedal.disabled = false;
      pedal.style.opacity = '1';
    }
    // Reset throttle
    params.targetThrottle = 0;
    // Hide real vehicle speed display and params
    if (realVehicleSpeedDisplay) realVehicleSpeedDisplay.style.display = 'none';
    if (realVehicleParamsSection) realVehicleParamsSection.style.display = 'none';
    // Release wake lock
    releaseWakeLock();
  }

  updateSensorStatus();
}

accelThresholdInput.addEventListener('input', () => {
  params.accelThreshold = Math.max(0, parseFloat(accelThresholdInput.value) || CONFIG.defaults.accelThreshold);
  // Ensure accelMax remains greater than accelThreshold
  if (params.accelMax <= params.accelThreshold + 0.1) {
    params.accelMax = params.accelThreshold + 0.1;
    accelMaxInput.value = params.accelMax.toFixed(1);
  }
});

accelMaxInput.addEventListener('input', () => {
  params.accelMax = Math.max(params.accelThreshold + 0.1, parseFloat(accelMaxInput.value) || CONFIG.defaults.accelMax);
  accelMaxInput.value = params.accelMax;
});

cruiseThrottleInput.addEventListener('input', () => {
  params.cruiseThrottle = Math.max(0, Math.min(0.5, parseFloat(cruiseThrottleInput.value) || CONFIG.defaults.cruiseThrottle));
});

roadLoadInput.addEventListener('input', () => {
  params.roadLoad = Math.max(0, Math.min(1, parseFloat(roadLoadInput.value) || 0));
});

gearInput.addEventListener('change', () => {
  vehicleState.gear = parseInt(gearInput.value, 10) || 0;
  adjustRpmForGearChange();
  updateGearButtons();
});

// Gear button click handlers
gearButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const gear = parseInt(btn.dataset.gear, 10);
    vehicleState.gear = gear;
    gearInput.value = gear;
    adjustRpmForGearChange();
    updateGearButtons();
  });
});

// Update active gear button
function updateGearButtons() {
  gearButtons.forEach(btn => {
    const gear = parseInt(btn.dataset.gear, 10);
    if (gear === vehicleState.gear) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });
}

// Update RPM gauge arc
function updateRPMGauge(rpm, redline) {
  if (!rpmArc || rpmArcLength === 0) return;

  const rpmRatio = Math.min(1, Math.max(0, rpm / redline));
  rpmArc.style.strokeDasharray = `${rpmArcLength} ${rpmArcLength}`;
  rpmArc.style.strokeDashoffset = rpmArcLength * (1 - rpmRatio);
}

// Update shift lights
function updateShiftLights(rpm, redline) {
  const rpmRatio = rpm / redline;
  const threshold = 0.85;

  shiftLights.forEach((light, index) => {
    const lightThreshold = threshold + (index * 0.03);
    if (rpmRatio >= lightThreshold) {
      light.classList.add('active');
    } else {
      light.classList.remove('active');
    }
  });
}

// Track performance metrics
function updatePerformanceMetrics(speed) {
  const speedKmh = speed * 3.6;

  // Track top speed
  if (speedKmh > performanceStats.topSpeed) {
    performanceStats.topSpeed = speedKmh;
    if (topSpeedDisplay) {
      topSpeedDisplay.textContent = Math.round(performanceStats.topSpeed) + ' km/h';
    }
  }

  // Track 0-100 km/h time
  if (!performanceStats.hasReached100 && speedKmh < 5 && params.currentThrottle > 0.5) {
    // Start timing
    if (!performanceStats.isTimingAccel) {
      performanceStats.isTimingAccel = true;
      performanceStats.accelStartTime = performance.now();
      if (accelTimeDisplay) {
        accelTimeDisplay.textContent = 'Timing...';
      }
    }
  }

  if (performanceStats.isTimingAccel && speedKmh >= 100) {
    const accelTime = (performance.now() - performanceStats.accelStartTime) / 1000;
    performanceStats.accelTime = accelTime;
    performanceStats.isTimingAccel = false;
    performanceStats.hasReached100 = true;
    if (accelTimeDisplay) {
      accelTimeDisplay.textContent = accelTime.toFixed(2) + 's';
    }
  }
}

function getOverallRatio() {
  if (vehicleState.gear <= 0) return 0;
  const gear = vehicleState.gearRatios[vehicleState.gear - 1] || 0;
  return gear * vehicleState.finalDrive;
}

/**
 * Adjust RPM when gear changes to maintain current vehicle speed
 * This ensures that upshift drops RPM and downshift raises RPM
 */
function adjustRpmForGearChange() {
  // Only adjust if engine is running and vehicle is moving
  if (!isPlaying || vehicleState.speed < 0.1) return;

  const newOverallRatio = getOverallRatio();

  // If in neutral, let RPM drop to idle naturally
  if (newOverallRatio === 0) return;

  // Calculate what RPM should be to maintain current speed with new gear
  // Derived from: speed = (rpm * 2 * PI * wheelRadius) / (overallRatio * 60)
  const newRpm = (vehicleState.speed * newOverallRatio * 60) / (2 * Math.PI * vehicleState.wheelRadius);

  // Clamp to valid RPM range
  params.currentRpm = Math.max(params.idleRpm * 0.75, Math.min(newRpm, params.redlineRpm * 1.05));
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
  lastUpdateTime = nowTime;

  // In real vehicle mode: fix to 1st gear and estimate throttle from sensors
  if (params.realVehicleMode) {
    vehicleState.gear = 1;
    const sensorThrottle = estimateThrottleFromSensors();
    params.targetThrottle = sensorThrottle;
  }

  // Physics: Update Throttle
  const throttleDiff = params.targetThrottle - params.currentThrottle;
  params.currentThrottle += throttleDiff * params.throttleResponse;

  const overallRatio = getOverallRatio();
  const isCoupled = overallRatio > 0;

  const engineTorque = calcEngineTorque(params.currentRpm, params.currentThrottle);
  const wheelTorque = isCoupled ? engineTorque * overallRatio * vehicleState.drivelineEfficiency : 0;
  const tractiveForce = isCoupled ? wheelTorque / vehicleState.wheelRadius : 0;

  const aeroDrag = 0.5 * CONFIG.physics.AIR_DENSITY * vehicleState.dragCoef * vehicleState.frontalArea * vehicleState.speed * vehicleState.speed;
  const rollingResistance = vehicleState.mass * CONFIG.physics.GRAVITY * vehicleState.rollingResistance;
  const gradeForce = vehicleState.mass * CONFIG.physics.GRAVITY * params.roadLoad * 0.25;
  const resistiveForce = aeroDrag + rollingResistance + gradeForce;

  const netForce = isCoupled ? tractiveForce - resistiveForce : -resistiveForce;
  const accel = netForce / vehicleState.mass;

  // Calculate internal resistance proportional to RPM^1.5
  // This models pumping losses and friction that increase non-linearly with RPM
  const rpmNormalized = params.currentRpm / params.redlineRpm;
  const internalResistance = Math.pow(rpmNormalized, 1.5);
  const resistanceFactor = 0.15 * internalResistance; // Scale factor for resistance effect

  const freeTargetRpm = params.idleRpm + (params.redlineRpm - params.idleRpm) * params.currentThrottle;
  // Apply internal resistance to reduce target RPM, effect is stronger at higher RPM
  const resistedTargetRpm = freeTargetRpm * (1.0 - resistanceFactor * (1.0 - params.currentThrottle));

  const targetRpm = Math.max(params.idleRpm, resistedTargetRpm);

  const maxTorqueAtCurrentRpm = calcEngineTorque(params.currentRpm, 1.0);

  const requiredTorque = isCoupled
    ? (resistiveForce * vehicleState.wheelRadius) / (overallRatio * vehicleState.drivelineEfficiency)
    : 0;

  const resistanceLoad = maxTorqueAtCurrentRpm > 0
    ? Math.min(1.0, requiredTorque / maxTorqueAtCurrentRpm)
    : 0;

  const inertialLoad = isCoupled && accel > 0
    ? Math.min(0.35, (vehicleState.mass * Math.abs(accel) * vehicleState.wheelRadius) / (maxTorqueAtCurrentRpm * overallRatio * vehicleState.drivelineEfficiency))
    : 0;

  if (!isCoupled) {
    params.load = 0.05;
  } else {
    params.load = Math.max(0, Math.min(1, resistanceLoad + inertialLoad));
  }

  let effectiveInertia = params.inertia;

  if (targetRpm > params.currentRpm) {
    const loadResistance = Math.min(0.9, params.load * 0.7);
    effectiveInertia = params.inertia + (1.0 - params.inertia) * loadResistance;
  } else {
    const engineBraking = isCoupled ? params.load * 0.3 : 0;
    // Add extra inertia when RPM is falling to simulate flywheel keeping RPM up longer
    effectiveInertia = params.inertia + (1.0 - params.inertia) * (1.0 - engineBraking) * 0.5;
  }

  params.currentRpm = params.currentRpm * effectiveInertia + targetRpm * (1.0 - effectiveInertia);
  params.currentRpm = Math.max(params.idleRpm * 0.75, Math.min(params.currentRpm, params.redlineRpm * 1.05));

  // In real vehicle mode: override RPM from GPS speed with smooth interpolation
  if (params.realVehicleMode && vehicleState.gearRatios && vehicleState.gearRatios[0]) {
    const overallRatio1st = vehicleState.gearRatios[0] * vehicleState.finalDrive;

    // Linear interpolation between the previous and current GPS speed values,
    // spread evenly over the estimated GPS update interval so that speed
    // changes gradually rather than jumping at each GPS fix.
    const now = Date.now();
    const timeSinceUpdate = now - sensorState.lastGPSTime;
    const minGpsIntervalMs = 100; // guard against zero-division and unrealistic update rates
    const interval = Math.max(minGpsIntervalMs, sensorState.gpsInterval);
    const t = sensorState.lastGPSTime > 0 ? Math.min(1.0, timeSinceUpdate / interval) : 1.0;
    const targetSpeed = sensorState.prevGpsSpeed + (sensorState.gpsSpeed - sensorState.prevGpsSpeed) * t;

    // Apply additional exponential smoothing for final-frame smoothness.
    // smoothFactor = 0.12 gives approximately a 90 ms time constant at 60 fps
    // (τ ≈ 1 / (-ln(1 - smoothFactor) * 60) ≈ 0.09 s).
    const smoothFactor = 0.12;
    sensorState.interpolatedSpeed += (targetSpeed - sensorState.interpolatedSpeed) * smoothFactor;
    sensorState.interpolatedSpeed = Math.max(0, sensorState.interpolatedSpeed);

    const rpmFromSpeed = (sensorState.interpolatedSpeed * overallRatio1st * 60) / (2 * Math.PI * vehicleState.wheelRadius);
    params.currentRpm = Math.max(params.idleRpm, Math.min(rpmFromSpeed, params.redlineRpm * 1.05));
  }

  // Speed is directly determined by RPM and gear ratio
  vehicleState.speed = isCoupled
    ? (params.currentRpm * 2 * Math.PI * vehicleState.wheelRadius) / (overallRatio * 60)
    : 0;

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
    const v8ModeParam = engineNode.parameters.get('v8Mode');
    const rotaryModeParam = engineNode.parameters.get('rotaryMode');

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
    if (v8ModeParam) v8ModeParam.setValueAtTime(params.enginePreset === 'v8' ? 1 : 0, now);
    if (rotaryModeParam) rotaryModeParam.setValueAtTime(params.enginePreset === 'rotary' ? 1 : 0, now);
  }

  // Update UI
  rpmDisplay.textContent = Math.round(params.currentRpm);
  updateRPMGauge(params.currentRpm, params.redlineRpm);
  updateShiftLights(params.currentRpm, params.redlineRpm);
  throttleFill.style.width = `${params.currentThrottle * 100}%`;
  loadFill.style.width = `${params.load * 100}%`;

  if (speedDisplay) {
    speedDisplay.textContent = Math.round(vehicleState.speed * 3.6);
  }
  if (gearDisplay) {
    gearDisplay.textContent = vehicleState.gear <= 0 ? 'N' : vehicleState.gear;
  }

  // Update real vehicle GPS speed display (use interpolated speed for smooth display)
  if (params.realVehicleMode && gpsSpeedValueDisplay) {
    gpsSpeedValueDisplay.textContent = Math.round(sensorState.interpolatedSpeed * 3.6);
  }

  // Update performance metrics
  updatePerformanceMetrics(vehicleState.speed);

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
  // Disable manual throttle control in real vehicle mode
  if (params.realVehicleMode) return;

  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    setThrottle(1.0);
  }
  // Gear shifting with number keys
  if (e.code >= 'Digit1' && e.code <= 'Digit6') {
    const gear = parseInt(e.code.charAt(5), 10);
    vehicleState.gear = gear;
    gearInput.value = gear;
    adjustRpmForGearChange();
    updateGearButtons();
  }
  // Neutral with N key
  if (e.code === 'KeyN') {
    vehicleState.gear = 0;
    gearInput.value = 0;
    adjustRpmForGearChange();
    updateGearButtons();
  }
});

window.addEventListener('keyup', (e) => {
  // Disable manual throttle control in real vehicle mode
  if (params.realVehicleMode) return;

  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    e.preventDefault();
    setThrottle(0.0);
  }
});

// Mobile / Touch support
const pedal = document.getElementById('pedal-btn');
if(pedal) {
    pedal.addEventListener('mousedown', () => {
      if (!params.realVehicleMode) setThrottle(1.0);
    });
    pedal.addEventListener('mouseup', () => {
      if (!params.realVehicleMode) setThrottle(0.0);
    });
    pedal.addEventListener('touchstart', (e) => {
      if (!params.realVehicleMode) {
        e.preventDefault();
        setThrottle(1.0);
      }
    });
    pedal.addEventListener('touchend', (e) => {
      if (!params.realVehicleMode) {
        e.preventDefault();
        setThrottle(0.0);
      }
    });
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
updateGearButtons();

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
      gear: vehicleState.gear,
      realVehicleMode: params.realVehicleMode
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

    if (settings.realVehicleMode !== undefined) {
      params.realVehicleMode = settings.realVehicleMode;
      realVehicleModeInput.checked = settings.realVehicleMode;
      if (realVehicleModeTopInput) realVehicleModeTopInput.checked = settings.realVehicleMode;
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
realVehicleModeInput.addEventListener('change', saveSettings);

// ─── Spectrum Analyzer ──────────────────────────────────────────────────────

const spectrumCanvas = document.getElementById('spectrum-canvas');
let analyserNode = null;
let spectrumAnimId = null;

/**
 * Initialize and start the spectrum analyzer visualization
 */
function startSpectrumAnalyzer() {
  if (!audioCtx || !masterGainNode || !spectrumCanvas) return;

  if (!analyserNode) {
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 1024;
    analyserNode.smoothingTimeConstant = 0.8;
    masterGainNode.connect(analyserNode);
  }

  const ctx2d = spectrumCanvas.getContext('2d');
  const bufLen = analyserNode.frequencyBinCount;
  const dataArray = new Uint8Array(bufLen);

  function drawSpectrum() {
    spectrumAnimId = requestAnimationFrame(drawSpectrum);
    analyserNode.getByteFrequencyData(dataArray);

    const w = spectrumCanvas.clientWidth;
    const h = spectrumCanvas.clientHeight;
    if (spectrumCanvas.width !== w) spectrumCanvas.width = w;
    if (spectrumCanvas.height !== h) spectrumCanvas.height = h;

    ctx2d.clearRect(0, 0, w, h);

    // Draw frequency bars
    const barCount = Math.min(bufLen, 128);
    const barW = w / barCount;
    // Green (0) → Yellow (0.6) → Red (1.0) gradient thresholds
    const YELLOW_THRESHOLD = 0.6;
    const RED_SCALE = 255 / YELLOW_THRESHOLD;      // maps 0–0.6 to 0–255 for red channel
    const GREEN_DECAY = 1 / (1 - YELLOW_THRESHOLD); // maps 0.6–1.0 to 255–0 for green channel
    for (let i = 0; i < barCount; i++) {
      const val = dataArray[i] / 255;
      const barH = val * h;
      const r = Math.round(val > YELLOW_THRESHOLD ? 255 : val * RED_SCALE);
      const g = Math.round(val < YELLOW_THRESHOLD ? 255 : 255 * (1 - val) * GREEN_DECAY);
      ctx2d.fillStyle = `rgb(${r},${g},20)`;
      ctx2d.fillRect(i * barW, h - barH, Math.max(1, barW - 1), barH);
    }
  }

  if (spectrumAnimId) cancelAnimationFrame(spectrumAnimId);
  drawSpectrum();
}

function stopSpectrumAnalyzer() {
  if (spectrumAnimId) {
    cancelAnimationFrame(spectrumAnimId);
    spectrumAnimId = null;
  }
  if (spectrumCanvas) {
    const ctx2d = spectrumCanvas.getContext('2d');
    ctx2d.clearRect(0, 0, spectrumCanvas.width, spectrumCanvas.height);
  }
}

// ─── Audio Recording ────────────────────────────────────────────────────────

let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
const recordBtn = document.getElementById('record-btn');

/**
 * Start or stop recording engine audio
 */
function toggleRecording() {
  if (!isRecording) {
    if (!audioCtx || !masterGainNode) {
      alert('Please start the engine before recording.');
      return;
    }
    // Create a MediaStreamDestination to capture the audio graph output
    const dest = audioCtx.createMediaStreamDestination();
    masterGainNode.connect(dest);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    recordedChunks = [];
    mediaRecorder = new MediaRecorder(dest.stream, { mimeType });
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) recordedChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      masterGainNode.disconnect(dest);
      const blob = new Blob(recordedChunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = mimeType.includes('webm') ? 'webm' : 'wav';
      a.download = `engine-sound-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
    };

    mediaRecorder.start();
    isRecording = true;
    if (recordBtn) {
      recordBtn.textContent = '⏹ Stop';
      recordBtn.classList.add('recording');
    }
  } else {
    if (mediaRecorder?.state !== 'inactive') {
      mediaRecorder.stop();
    }
    isRecording = false;
    if (recordBtn) {
      recordBtn.textContent = '⏺ Record';
      recordBtn.classList.remove('recording');
    }
  }
}

if (recordBtn) {
  recordBtn.addEventListener('click', toggleRecording);
}

// ─── URL Preset Sharing ──────────────────────────────────────────────────────

const shareBtn = document.getElementById('share-btn');

/**
 * Encode current engine settings into a URL hash and copy/share it
 */
function shareSettings() {
  const data = {
    ncyl: params.ncyl,
    idle: params.idleRpm,
    red: params.redlineRpm,
    iner: params.inertia,
    noise: params.noiseGain,
    preset: params.enginePreset,
    persp: params.audioPerspective,
    load: params.roadLoad
  };
  const encoded = btoa(JSON.stringify(data));
  const url = `${location.origin}${location.pathname}#s=${encoded}`;

  if (navigator.share) {
    navigator.share({ title: 'Engine Simulator Settings', url })
      .catch(() => fallbackCopyShare(url));
  } else {
    fallbackCopyShare(url);
  }
}

function fallbackCopyShare(url) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      const orig = shareBtn.textContent;
      shareBtn.textContent = '✅ Copied!';
      setTimeout(() => { shareBtn.textContent = orig; }, 2000);
    }).catch(() => prompt('Copy this URL to share your settings:', url));
  } else {
    prompt('Copy this URL to share your settings:', url);
  }
}

/**
 * Load engine settings encoded in the URL hash (from a shared link)
 */
function loadSettingsFromURL() {
  const hash = location.hash;
  const match = hash.match(/[#&]s=([^&]+)/);
  if (!match) return;
  try {
    const data = JSON.parse(atob(match[1]));
    if (data.ncyl !== undefined) ncylInput.value = data.ncyl;
    if (data.idle !== undefined) idleRpmInput.value = data.idle;
    if (data.red !== undefined) redlineRpmInput.value = data.red;
    if (data.iner !== undefined) inertiaInput.value = data.iner;
    if (data.noise !== undefined) noiseInput.value = data.noise;
    if (data.preset !== undefined) {
      presetInput.value = data.preset;
      params.enginePreset = data.preset;
    }
    if (data.persp !== undefined) {
      perspectiveInput.value = data.persp;
      params.audioPerspective = data.persp;
    }
    if (data.load !== undefined) {
      roadLoadInput.value = data.load;
      params.roadLoad = data.load;
    }
    updateParamsFromUI();
  } catch (e) {
    console.warn('Failed to load settings from URL:', e);
  }
}

if (shareBtn) {
  shareBtn.addEventListener('click', shareSettings);
}

// Load from URL hash on startup (overrides localStorage if present)
loadSettingsFromURL();

// ─── PWA Install Prompt ──────────────────────────────────────────────────────

let deferredInstallPrompt = null;
const installBar = document.getElementById('install-bar');
const installBtn = document.getElementById('install-btn');
const installDismiss = document.getElementById('install-dismiss');

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  if (installBar) installBar.style.display = 'flex';
});

if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    if (installBar) installBar.style.display = 'none';
  });
}

if (installDismiss) {
  installDismiss.addEventListener('click', () => {
    if (installBar) installBar.style.display = 'none';
  });
}

window.addEventListener('appinstalled', () => {
  if (installBar) installBar.style.display = 'none';
  deferredInstallPrompt = null;
});

// ─── Service Worker Registration ─────────────────────────────────────────────

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch((e) => {
    console.warn('Service worker registration failed:', e);
  });
}

// ─── Hook spectrum analyzer into engine start/stop ───────────────────────────

startButton.addEventListener('click', () => {
  // After start button click, check if engine started and hook analyzer
  setTimeout(() => {
    if (isPlaying) {
      startSpectrumAnalyzer();
    } else {
      stopSpectrumAnalyzer();
      if (isRecording) toggleRecording();
    }
  }, 200);
});
