let audioCtx;
let engineNode = null;
let isPlaying = false;

// Parameters
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
  throttleResponse: 0.1 // How fast throttle moves to target
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

function updateParamsFromUI() {
  params.ncyl = parseInt(ncylInput.value);
  params.idleRpm = parseInt(idleRpmInput.value);
  params.redlineRpm = parseInt(redlineRpmInput.value);
  params.inertia = parseFloat(inertiaInput.value);
  params.noiseGain = parseFloat(noiseInput.value);
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

// Animation Loop
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
    const vtecModeParam = engineNode.parameters.get('vtecMode');
    const fa24ModeParam = engineNode.parameters.get('fa24Mode');

    const now = audioCtx.currentTime;
    rpmParam.setValueAtTime(params.currentRpm, now);
    throttleParam.setValueAtTime(params.currentThrottle, now);
    ncylParam.setValueAtTime(params.ncyl, now);
    noiseGainParam.setValueAtTime(params.noiseGain, now);
    turboModeParam.setValueAtTime(params.enginePreset === 'turbo' ? 1 : 0, now);
    vtecModeParam.setValueAtTime(params.enginePreset === 'vtec' ? 1 : 0, now);
    fa24ModeParam.setValueAtTime(params.enginePreset === 'fa24' ? 1 : 0, now);
  }

  // Update UI
  rpmDisplay.textContent = Math.round(params.currentRpm);
  throttleFill.style.width = `${params.currentThrottle * 100}%`;

  requestAnimationFrame(update);
}

// Input Handling
const setThrottle = (val) => {
  params.targetThrottle = val;
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

  try {
    if (!engineNode) {
      await audioCtx.audioWorklet.addModule('engine-processor.js');
      engineNode = new AudioWorkletNode(audioCtx, 'engine-processor');
      engineNode.connect(audioCtx.destination);
    }
    
    isPlaying = true;
    startButton.textContent = 'Stop Engine';
    statusText.textContent = 'Running';
    update();
  } catch (e) {
    console.error(e);
    statusText.textContent = 'Error: ' + e.message;
  }
});

// Initialize inputs
updateParamsFromUI();
