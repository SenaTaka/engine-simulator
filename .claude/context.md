# Engine Simulator - Claude Context File

## Project Overview

This is a real-time browser-based engine sound simulator that synthesizes realistic engine audio using the Web Audio API's AudioWorklet. The application simulates engine behavior, vehicle dynamics, and produces authentic engine sounds that respond to user input.

**Live Demo:** https://engine-sim-murex.vercel.app

## Architecture

The application follows a three-layer architecture:

```
┌─────────────────────────────────────────────────────────────┐
│ index.html (View Layer)                                     │
│ - RPM gauge, throttle/load meters, vehicle status displays  │
│ - Control inputs and parameter settings                      │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ app.js (Control & Physics Layer) - ~687 lines               │
│ - Global state management (params, vehicleState)            │
│ - Input handling (keyboard, touch, UI controls)             │
│ - Physics simulation (torque, RPM, speed, load)             │
│ - Audio parameter updates                                   │
│ - Settings persistence (localStorage)                       │
│ - Animation loop (requestAnimationFrame)                    │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ engine-processor.js (Audio Synthesis Layer) - ~343 lines    │
│ - AudioWorklet processor for low-latency audio synthesis    │
│ - Harmonic synthesis with anti-aliasing                     │
│ - Multi-band noise generation                               │
│ - Resonance modeling (exhaust, body)                        │
│ - Engine-specific modes (VTEC, Turbo, Boxer FA24)          │
│ - Distortion and effects                                    │
└─────────────────────────────────────────────────────────────┘
```

## File Structure

```
engine-simulator/
├── index.html           # UI with RPM gauge, controls, and displays
├── style.css            # Styling for the interface
├── app.js               # Main application logic, physics, and control
├── engine-processor.js  # AudioWorklet processor for sound synthesis
└── readme.md            # Project documentation (bilingual EN/JP)
```

## Key Components

### 1. app.js - Application Logic & Physics

**Global State:**
- `params` object (app.js:41-59): Engine parameters including RPM, throttle, cylinders, idle/redline RPM, inertia, noise level, audio effects, and load
- `vehicleState` object (app.js:62-73): Vehicle dynamics including speed, gear, gear ratios, mass, drag coefficient, and drive parameters

**Key Functions:**
- `update()` (app.js:342-429): Main animation loop that updates physics, RPM, vehicle speed, load calculation, and syncs parameters to AudioWorklet
- `startButton click handler` (app.js:214-267): Initializes Web Audio API, creates AudioWorklet, and sets up audio signal chain with compressor, EQ, reverb
- `applyPreset()` (app.js:144-158): Applies engine preset profiles (NA, Turbo, VTEC, FA24 Boxer)
- `applyPerspective()` (app.js:196-212): Applies EQ settings for different audio perspectives (Exterior/Interior/Engine Bay)
- `saveSettings()` / `loadSettings()` (app.js:599-686): Persists user settings to localStorage

**Engine Presets (app.js:106-135):**
- **NA (Natural Aspiration)**: Standard engine
- **Turbo**: Adds turbo whistle/whoosh effects
- **VTEC**: Simulates Honda VTEC cam crossover around 5600 RPM
- **FA24 Boxer**: Subaru boxer engine with paired pulse, rumble, and burble

**Audio Perspectives (app.js:196-212):**
- **Exterior**: Balanced frequency response
- **Interior**: Muffled high frequencies (cabin filtering)
- **Engine Bay**: Emphasized high frequencies (mechanical sounds)

**Physics Simulation (app.js:323-404):**
- Torque calculation based on RPM, throttle, and turbo boost
- Vehicle acceleration/deceleration with gear ratios
- Road load resistance (rolling, aerodynamic drag, incline)
- Engine load feedback affecting RPM response and sound characteristics

**Input Handling:**
- Keyboard: SPACE, ↑, W for throttle
- Touch: Gas pedal button with touch events
- Gear shifting: 1-6 keys
- Real-time parameter sliders for all engine characteristics

### 2. engine-processor.js - Audio Synthesis

**AudioWorklet Processor:**
- Runs in a separate audio thread for low-latency synthesis
- Processes audio at sample rate (typically 44.1kHz or 48kHz)
- Receives parameters from main thread via `setValueAtTime()`

**Audio Parameters (engine-processor.js:53-66):**
- rpm, throttle, ncyl (number of cylinders)
- noiseGain, turboMode, boxerMode, vtecMode, fa24Mode
- redlineRpm, load

**Sound Synthesis Components:**

1. **Harmonic Synthesis (lines 115-223):**
   - Generates engine firing frequency harmonics
   - Implements cylinder-to-cylinder variation for organic sound
   - Applies RPM jitter and drift for realism
   - Calculates harmonic amplitudes with anti-aliasing (Nyquist limiting)
   - Special modes:
     - **VTEC**: Blends between low-cam (α=1.35-0.85*throttle) and high-cam (α=1.00-0.55*throttle) around 5600 RPM
     - **Boxer/FA24**: Emphasizes low-mid harmonics (k≤3), reduces high harmonics (k≥6)

2. **Noise Generation (lines 230-287):**
   - **Intake noise**: Low-pass filtered white noise, throttle-dependent
   - **Mechanical noise**: High-pass filtered for valvetrain/bearing sounds
   - **Combustion noise**: Band-pass filtered roughness
   - **Ambient noise**: Exponential decay for background hum
   - **Backfire effects**: Deceleration pops and crackles

3. **Resonance Modeling (lines 291-312):**
   - **Exhaust resonance**: Three formant-like bandpass filters at 120Hz, 290Hz, 580Hz
   - **Body resonance**: Emphasizes ~100Hz for cabin rumble (Boxer mode)

4. **Effects:**
   - **Distortion** (lines 317-325): Soft clipping for turbo/high-load saturation
   - **Rev limiter** (lines 103-113): Spark cut simulation when approaching redline

**Engine-Specific Modes:**

- **Turbo Mode** (lines 247-252, 319): Adds high-frequency whistle (10-13kHz) and whoosh noise with distortion
- **VTEC Mode** (lines 134-146, 176-184, 220-222): Simulates cam profile crossover with intake edge enhancement
- **Boxer/FA24 Mode** (lines 150-153, 176-179, 201-227, 262-267):
  - Paired pulse modulation at firing frequency
  - Loping rumble at ~10Hz
  - Enhanced low-mid harmonics, suppressed high harmonics
  - Distinctive burble on deceleration
  - Growl layer for boxer character

### 3. index.html - User Interface

**Display Elements:**
- RPM gauge with current value and redline indicator
- Throttle position bar (vertical)
- Engine load bar (vertical)
- Vehicle speed display (km/h)
- Current gear display
- Engine status (Running/Stopped)

**Controls:**
- Start/Stop engine button
- Gas pedal button (touch-enabled)
- Engine preset selector (NA/Turbo/VTEC/FA24 Boxer)
- Real-time parameter sliders:
  - Cylinders (1-12)
  - Idle RPM (500-2000)
  - Redline RPM (3000-12000)
  - Inertia (0.8-0.99, controls engine response)
  - Noise level (0-1)
  - Road load (0-1, simulates incline/drag)
- Audio perspective selector (Exterior/Interior/Engine Bay)
- Compressor effect toggle and amount
- Reverb effect toggle and amount
- Gear selector (1-6)

## Technical Implementation Details

### Web Audio API Usage

**Audio Graph Structure:**
```
EngineProcessor (AudioWorklet)
    ↓
[Dry Signal] → DryGain → MasterGain → Destination
    ↓
EQLowShelf → EQMid → EQHighShelf → [Wet Signal]
    ↓
Compressor (optional)
    ↓
Convolver (reverb, optional) → WetGain → MasterGain
```

### Physics Model

**RPM Calculation (app.js:360-393):**
```javascript
// Torque calculation with turbo boost
torque = baseTorque * (1 + turboBoost * params.currentThrottle)

// Acceleration with load-dependent inertia scaling
rpmAccel = torque * loadInertiaScale / effectiveInertia

// Engine load from vehicle dynamics
load = (roadLoadForce + aeroForce + rollForce) / maxForce
```

**Vehicle Dynamics (app.js:323-340):**
```javascript
// Wheel speed from engine RPM
wheelSpeed = (rpm * 2π) / (60 * gearRatio * finalDrive)

// Forces: aerodynamic drag, rolling resistance, road load
aeroForce = 0.5 * airDensity * dragCoef * frontalArea * speed²
rollForce = mass * g * rollingResistance

// Acceleration
acceleration = (wheelForce - totalResistance) / mass
```

### Audio Synthesis Mathematics

**Harmonic Generation:**
```javascript
// Firing frequency (4-stroke engine)
f_fire = (RPM / 60) * (cylinders / 2)

// Harmonic amplitude with power-law decay
amplitude = 1 / k^α  // where k is harmonic number, α is decay rate

// Anti-aliasing: suppress harmonics above Nyquist
if (harmonicFreq > sampleRate / 2) amplitude = 0
```

**Filter Implementations:**
```javascript
// First-order low-pass filter (exponential smoothing)
state += α * (input - state)
output = state

// Used for: intake noise, mechanical noise, parameter smoothing
```

## Common Patterns & Conventions

### Code Conventions
- **Naming**: camelCase for variables and functions, CONST_CASE for mathematical constants
- **Comments**: JSDoc-style for main functions, inline comments for complex logic
- **State Management**: Global objects (params, vehicleState) modified in-place
- **No Module System**: All code runs in global scope

### Audio Patterns
1. **Exponential Decay**: `amplitude * exp(-time * decay)` for transients
2. **First-Order Filtering**: `state += α * (input - state)` for smoothing
3. **Phase Accumulation**: `phase += 2π * freq / sampleRate` with wrapping
4. **Parameter Interpolation**: AudioParam `setValueAtTime()` for smooth parameter changes

### Physics Patterns
1. **Interpolation**: Exponential smoothing for throttle response
2. **Clamping**: `Math.max(min, Math.min(max, value))` for parameter bounds
3. **Force-based dynamics**: F = ma for vehicle acceleration

## Development Workflow

### Running Locally
```bash
# Start HTTP server (required for AudioWorklet)
python3 -m http.server 8000

# Open in browser
http://localhost:8000
```

**Note:** AudioWorklet requires HTTP/HTTPS protocol, not file:// protocol

### Testing
- Manual testing via browser
- Check console for AudioWorklet errors
- Verify audio output at different RPM ranges and throttle positions
- Test all engine presets and perspectives

### Browser Compatibility
- **Required**: AudioWorklet support (Chrome 66+, Firefox 76+, Safari 14.1+)
- **Mobile**: Requires user gesture to start audio (autoplay policy)
- **Performance**: Varies by device; CPU usage scales with harmonic count

## Known Issues & Future Improvements

### Current Limitations
- No automated tests
- Large monolithic functions (especially engine-processor.js:process() at 272 lines)
- Global state pollution in app.js
- Magic numbers scattered throughout synthesis code
- No TypeScript/type checking

### Planned Improvements (from readme.md:134-136)
- Tire grip/traction loss modeling
- Better modularization and code organization
- Extract configuration constants
- Add unit tests for physics and synthesis

## Memory & Performance

**Memory Usage:**
- Minimal: ~1-2MB total (no large audio samples)
- All audio is synthesized in real-time, no sample playback

**CPU Usage:**
- AudioWorklet runs at audio rate (44.1-48kHz)
- Main thread runs at ~60 FPS for UI updates
- Complexity: O(harmonics * samples) per audio buffer
- Typical: 24 harmonics * 128 samples = ~3000 operations per buffer

## Key State Variables

### Engine State (app.js:41-59)
- `currentRpm`: Current engine speed
- `currentThrottle`: Interpolated throttle position (0-1)
- `targetThrottle`: User input throttle (0-1)
- `load`: Computed engine load (0-1), affects RPM response and sound

### Vehicle State (app.js:62-73)
- `speed`: Vehicle speed in m/s
- `gear`: Current gear (1-6)
- `gearRatios`: Array of gear ratios [3.62, 2.19, 1.62, 1.27, 1.03, 0.82]
- `finalDrive`: Final drive ratio (3.42)

### Audio Nodes (app.js:7-19)
- `audioCtx`: Web Audio API AudioContext
- `engineNode`: AudioWorkletNode running EngineProcessor
- `compressorNode`, `convolverNode`: Effect processors
- `eqLowShelfNode`, `eqMidNode`, `eqHighShelfNode`: 3-band EQ
- `dryGainNode`, `wetGainNode`, `masterGainNode`: Gain staging

## Important Constants

### Vehicle Parameters (app.js:62-73)
```javascript
gearRatios: [3.62, 2.19, 1.62, 1.27, 1.03, 0.82]  // 6-speed transmission
finalDrive: 3.42                                   // Differential ratio
wheelRadius: 0.33                                  // meters
mass: 1450                                         // kg
dragCoef: 0.32                                     // Cd
frontalArea: 2.2                                   // m²
rollingResistance: 0.015                           // Coefficient
drivelineEfficiency: 0.9                           // Power transmission efficiency
```

### Synthesis Constants (engine-processor.js)
```javascript
n_harm: 24                          // Number of harmonics generated
vtecCrossover: 5600 RPM             // VTEC engagement point
vtecWidth: 900 RPM                  // Crossover blending range
intakeLpfAlpha: 0.05 + 0.18*throttle  // Intake noise filter cutoff
```

## Debugging Tips

### Audio Issues
1. Check browser console for AudioWorklet registration errors
2. Verify AudioContext is running (not suspended by autoplay policy)
3. Check parameter ranges are valid (especially RPM, throttle)
4. Use Chrome DevTools > Media tab to inspect audio nodes

### Physics Issues
1. Log params.load to verify load calculation
2. Check vehicleState.speed for vehicle dynamics
3. Verify gear ratios produce reasonable wheel speeds
4. Test with different inertia settings (0.8 = responsive, 0.99 = sluggish)

### Performance Issues
1. Reduce harmonic count in engine-processor.js:86 (currently 24)
2. Check CPU usage in browser task manager
3. Test on different sample rates (44.1kHz vs 48kHz)
4. Disable reverb effect if convolution is too expensive

## Extending the Simulator

### Adding a New Engine Preset

1. Add preset profile in app.js:106-135:
```javascript
'newPreset': {
  ncyl: 8,
  idleRpm: 800,
  redlineRpm: 8500,
  inertia: 0.93,
  // ... other params
}
```

2. Update HTML select in index.html with new option

3. Add engine-specific mode flag if needed (see turboMode, vtecMode pattern)

### Adding a New Audio Effect

1. Create audio node in app.js startButton handler (around line 214-267)
2. Connect to audio graph
3. Add UI controls in index.html
4. Add event listeners in app.js to update effect parameters
5. Add persistence in saveSettings/loadSettings

### Modifying Sound Characteristics

**To change harmonic balance:**
- Adjust alpha values in engine-processor.js:140-147
- Modify harmonic amplitude calculation in engine-processor.js:163-190

**To change noise character:**
- Adjust filter alphas in engine-processor.js:236-287
- Modify gain levels for intake/mechanical/combustion noise

**To add new resonances:**
- Add bandpass filter states to constructor
- Implement filter in process() method around line 291-312

## Related Documentation

- [Web Audio API - AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet)
- [Web Audio API - AudioContext](https://developer.mozilla.org/en-US/docs/Web/API/AudioContext)
- [AudioWorkletProcessor](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor)

## License & Attribution

This is an open-source project. Check the repository for license information.

Repository: https://github.com/SenaTaka/engine-simulator
