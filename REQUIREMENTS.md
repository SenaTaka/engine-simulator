# Engine Simulator - Requirements Definition Document

## Document Information

**Project Name:** Engine Simulator
**Version:** 1.0
**Last Updated:** 2026-02-20
**Document Type:** Requirements Definition
**Status:** Active Development

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [Functional Requirements](#functional-requirements)
4. [Non-Functional Requirements](#non-functional-requirements)
5. [Technical Requirements](#technical-requirements)
6. [User Interface Requirements](#user-interface-requirements)
7. [Audio Requirements](#audio-requirements)
8. [Physics Engine Requirements](#physics-engine-requirements)
9. [Data Requirements](#data-requirements)
10. [External Interface Requirements](#external-interface-requirements)
11. [Constraints and Assumptions](#constraints-and-assumptions)
12. [Future Enhancements](#future-enhancements)

---

## Executive Summary

### Purpose
The Engine Simulator is a real-time, browser-based application that synthesizes realistic engine sounds using procedural audio generation. It provides users with an interactive experience to explore various engine configurations and behaviors without requiring audio samples.

### Scope
- **In Scope:** Real-time engine sound synthesis, RPM physics simulation, vehicle dynamics modeling, user controls, parameter customization, audio effects, settings persistence
- **Out of Scope:** Recording/playback functionality, multiplayer features, external device integration, sample-based audio playback

### Target Audience
- Automotive enthusiasts
- Sound designers and audio engineers
- Game developers researching engine sounds
- Educational users learning about engines and audio synthesis
- Mobile and desktop users

### Key Objectives
1. Generate realistic engine sounds procedurally in real-time
2. Provide intuitive controls for engine parameters
3. Simulate accurate vehicle dynamics and engine physics
4. Support multiple engine types (NA, Turbo, VTEC, Boxer)
5. Maintain high performance across devices
6. Enable mobile and desktop usage

---

## System Overview

### System Context
The Engine Simulator operates entirely within a web browser environment, utilizing:
- **Web Audio API** for audio synthesis and processing
- **AudioWorklet** for low-latency, real-time audio generation
- **HTML5 Canvas/SVG** for visual displays
- **JavaScript** for application logic and physics simulation
- **CSS3** for user interface styling
- **LocalStorage API** for settings persistence

### System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     User Interface                       │
│  (HTML5 + CSS3 - Presentation Layer)                    │
│  - RPM Gauge (SVG)                                       │
│  - Control Inputs (buttons, sliders, selectors)         │
│  - Status Displays (speed, gear, load, throttle)        │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│               Application Logic Layer                    │
│  (app.js - ~889 lines)                                  │
│  - Event Handling (keyboard, touch, mouse)              │
│  - Physics Engine (RPM, torque, vehicle dynamics)       │
│  - State Management (params, vehicleState)              │
│  - Audio Parameter Control                              │
│  - Settings Persistence (localStorage)                  │
│  - Animation Loop (requestAnimationFrame)               │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│               Audio Processing Layer                     │
│  (Web Audio API - Main Thread)                          │
│  - Audio Context Management                             │
│  - Effect Chain (EQ, Compressor, Reverb)               │
│  - Gain Staging                                         │
│  - Dry/Wet Mixing                                       │
└─────────────────────────────────────────────────────────┘
                          ↓ ↑
┌─────────────────────────────────────────────────────────┐
│             Audio Synthesis Layer                        │
│  (engine-processor.js - AudioWorklet Thread)            │
│  - Harmonic Synthesis (24 harmonics)                    │
│  - Noise Generation (intake, mechanical, combustion)    │
│  - Resonance Modeling (exhaust, body)                   │
│  - Engine-Specific Modes (VTEC, Turbo, Boxer)          │
│  - Distortion and Limiting                              │
└─────────────────────────────────────────────────────────┘
```

### Key Components

1. **index.html** - User interface structure
2. **style.css** - Visual styling and responsive design
3. **app.js** - Application logic, physics simulation, control
4. **engine-processor.js** - AudioWorklet processor for sound synthesis

---

## Functional Requirements

### FR-001: Engine Start/Stop Control
**Priority:** Critical
**Description:** User must be able to start and stop the engine audio playback.

**Requirements:**
- FR-001.1: Provide a "Start Engine" button that initializes audio context
- FR-001.2: Button text changes to "Stop Engine" when running
- FR-001.3: Clicking when running suspends audio context and stops simulation
- FR-001.4: Display engine status ("Ready", "Running", "Engine Stopped")
- FR-001.5: Handle browser autoplay policies (require user interaction)
- FR-001.6: Handle AudioWorklet loading errors gracefully

**Acceptance Criteria:**
- Audio plays only after user clicks start button
- Button state accurately reflects engine state
- No audio plays in stopped state
- Works on all supported browsers

---

### FR-002: Throttle Control
**Priority:** Critical
**Description:** User must be able to control engine throttle position.

**Requirements:**
- FR-002.1: Keyboard control via SPACE, ↑ (Arrow Up), or W key
- FR-002.2: Touch control via gas pedal button (press and hold)
- FR-002.3: Mouse control via gas pedal button (press and hold)
- FR-002.4: Throttle smoothly interpolates from current to target position
- FR-002.5: Throttle ranges from 0.0 (closed) to 1.0 (full open)
- FR-002.6: Visual throttle indicator updates in real-time
- FR-002.7: Throttle response configurable via inertia parameter

**Acceptance Criteria:**
- All input methods produce same throttle behavior
- Smooth acceleration and deceleration
- Visual feedback matches input state
- No lag or unresponsive controls

---

### FR-003: RPM Display
**Priority:** Critical
**Description:** Display current engine RPM in real-time.

**Requirements:**
- FR-003.1: Circular gauge visualization with animated arc
- FR-003.2: Numeric RPM value displayed in gauge center
- FR-003.3: Arc color gradient (green → yellow → red)
- FR-003.4: Update at minimum 30 FPS (preferably 60 FPS)
- FR-003.5: Shift lights illuminate near redline (5 indicators)
- FR-003.6: Shift light thresholds: 85%, 88%, 91%, 94%, 97% of redline
- FR-003.7: RPM value rounded to nearest integer for display

**Acceptance Criteria:**
- Gauge visually accurate and smooth
- Shift lights activate at correct RPM
- Readable on all screen sizes
- No flickering or jitter

---

### FR-004: Engine Parameter Configuration
**Priority:** High
**Description:** User must be able to configure engine characteristics.

**Requirements:**
- FR-004.1: **Number of Cylinders:** 1-12, default 4
- FR-004.2: **Idle RPM:** 500-2000, default 900
- FR-004.3: **Redline RPM:** 3000-12000, default 7000
- FR-004.4: **Inertia:** 0.8-0.99, default 0.95 (controls RPM response speed)
- FR-004.5: **Noise Level:** 0-1, default 0.2 (intake/mechanical noise gain)
- FR-004.6: All parameters adjustable while engine running
- FR-004.7: Parameter changes take effect immediately
- FR-004.8: Parameters constrained to valid ranges
- FR-004.9: Redline must be greater than idle RPM

**Acceptance Criteria:**
- All parameters function as specified
- No invalid values accepted
- Real-time updates without audio glitches
- Parameters persist across sessions

---

### FR-005: Engine Presets
**Priority:** High
**Description:** Provide predefined engine configurations.

**Requirements:**
- FR-005.1: **NA (Naturally Aspirated):** 4-cyl, 850 idle, 7800 redline, 0.92 inertia
- FR-005.2: **Turbo:** 4-cyl, 1000 idle, 6800 redline, 0.97 inertia, turbo sound effects
- FR-005.3: **VTEC:** 4-cyl, 900 idle, 8600 redline, 0.9 inertia, cam crossover at ~5600 RPM
- FR-005.4: **FA24 Boxer:** 4-cyl, 780 idle, 7400 redline, 0.96 inertia, boxer rumble and burble
- FR-005.5: Preset selector in UI
- FR-005.6: Applying preset updates all engine parameters
- FR-005.7: User can modify preset parameters (becomes "Custom")
- FR-005.8: Preset selection persists across sessions

**Acceptance Criteria:**
- Each preset produces distinct, characteristic sound
- Preset switching is smooth and immediate
- Custom modifications don't corrupt presets
- Presets match real-world engine characteristics

---

### FR-006: Vehicle Dynamics
**Priority:** High
**Description:** Simulate vehicle speed, gearing, and load.

**Requirements:**
- FR-006.1: **Gear Selection:** Neutral, 1st through 6th gear
- FR-006.2: **Gear Ratios:** [3.62, 2.19, 1.62, 1.27, 1.03, 0.82]
- FR-006.3: **Final Drive Ratio:** 3.42
- FR-006.4: **Vehicle Speed:** Calculated from RPM and gear ratio
- FR-006.5: Display speed in km/h
- FR-006.6: Display current gear (N for neutral, 1-6 for gears)
- FR-006.7: Gear shifting via keyboard (1-6 keys for gears, N for neutral)
- FR-006.8: Gear shifting via UI buttons
- FR-006.9: Gear shifting via dropdown selector
- FR-006.10: RPM adjusts when shifting to maintain speed
- FR-006.11: **Road Load Slider:** 0-1, simulates incline/drag
- FR-006.12: Load affects acceleration and RPM response

**Acceptance Criteria:**
- Vehicle speed accurately reflects RPM and gear
- Gear shifts feel realistic (RPM drop on upshift, rise on downshift)
- Road load creates noticeable resistance
- All control methods produce identical results

---

### FR-007: Engine Load Calculation
**Priority:** High
**Description:** Calculate engine load based on vehicle dynamics.

**Requirements:**
- FR-007.1: Load calculated from resistance forces vs. available torque
- FR-007.2: **Resistance Components:**
  - Aerodynamic drag: 0.5 × ρ × Cd × A × v²
  - Rolling resistance: m × g × Crr
  - Grade force: m × g × roadLoad × 0.25
- FR-007.3: **Vehicle Parameters:**
  - Mass: 1350 kg
  - Drag coefficient: 0.30
  - Frontal area: 2.1 m²
  - Rolling resistance coefficient: 0.012
  - Drivetrain efficiency: 0.92
- FR-007.4: Load affects RPM inertia (higher load = slower RPM rise)
- FR-007.5: Load affects audio characteristics (load-dependent harmonics)
- FR-007.6: Load displayed as visual bar (0-100%)
- FR-007.7: Load in neutral = 0.05 (minimal)

**Acceptance Criteria:**
- Load calculation produces realistic acceleration
- Higher gears at low RPM create high load
- Load bar reflects actual engine load
- Audio changes appropriately with load

---

### FR-008: Audio Effects
**Priority:** Medium
**Description:** Provide audio effects to enhance realism.

**Requirements:**
- FR-008.1: **Compressor Effect:**
  - Toggle on/off
  - Amount control (0-1)
  - Dynamic range compression for consistent volume
  - Threshold, knee, ratio based on amount
- FR-008.2: **Reverb Effect:**
  - Toggle on/off
  - Amount control (0-1)
  - Convolution-based reverb (2-second impulse)
  - Dry/wet mixing
- FR-008.3: Effects processable in real-time without glitches
- FR-008.4: Effect parameters adjustable while running
- FR-008.5: Effect states persist across sessions

**Acceptance Criteria:**
- Compressor produces audible effect at high amounts
- Reverb adds spatial character without muddiness
- Effects don't introduce latency or distortion
- Performance impact is acceptable

---

### FR-009: Audio Perspectives
**Priority:** Medium
**Description:** Simulate different listening positions via EQ.

**Requirements:**
- FR-009.1: **Exterior (Muffler):**
  - Low shelf: +4dB at 120Hz
  - Mid: -2dB at 800Hz
  - High shelf: -6dB at 3000Hz
- FR-009.2: **Interior (Cabin):**
  - Low shelf: +6dB at 100Hz
  - Mid: +3dB at 500Hz
  - High shelf: -10dB at 2500Hz
- FR-009.3: **Engine Bay:**
  - Low shelf: -2dB at 150Hz
  - Mid: +4dB at 1200Hz
  - High shelf: +8dB at 4000Hz
- FR-009.4: Perspective selector in UI
- FR-009.5: Smooth transitions between perspectives
- FR-009.6: Perspective persists across sessions

**Acceptance Criteria:**
- Each perspective sounds distinctly different
- Exterior: balanced, full sound
- Interior: muffled highs, pronounced lows
- Engine Bay: mechanical, high-frequency emphasis

---

### FR-010: Performance Metrics
**Priority:** Low
**Description:** Track and display vehicle performance statistics.

**Requirements:**
- FR-010.1: **0-100 km/h Time:**
  - Start timing when speed < 5 km/h and throttle > 50%
  - Stop timing when speed ≥ 100 km/h
  - Display time in seconds (2 decimal places)
  - Show "Timing..." during measurement
  - Show final time after completion
- FR-010.2: **Top Speed:**
  - Track maximum speed achieved
  - Display in km/h
  - Update continuously
- FR-010.3: Reset metrics when engine stops

**Acceptance Criteria:**
- 0-100 timing is accurate and repeatable
- Top speed reflects actual maximum achieved
- Metrics reset appropriately
- Display updates in real-time

---

### FR-011: Settings Persistence
**Priority:** High
**Description:** Save and restore user settings across sessions.

**Requirements:**
- FR-011.1: Save to localStorage on parameter change
- FR-011.2: Load from localStorage on page load
- FR-011.3: **Persisted Settings:**
  - Engine parameters (cylinders, idle, redline, inertia, noise)
  - Engine preset selection
  - Gear selection
  - Road load
  - Audio perspective
  - Compressor state and amount
  - Reverb state and amount
- FR-011.4: Handle localStorage unavailable gracefully
- FR-011.5: Validate loaded settings (use defaults if invalid)

**Acceptance Criteria:**
- Settings restored exactly as left
- Invalid saved data doesn't crash app
- localStorage errors logged but don't break functionality
- New parameters get sensible defaults

---

### FR-012: Keyboard Controls
**Priority:** High
**Description:** Provide comprehensive keyboard control scheme.

**Requirements:**
- FR-012.1: **Throttle:** SPACE, ↑, W (press to accelerate, release to decelerate)
- FR-012.2: **Gear Up:** 1, 2, 3, 4, 5, 6 keys (direct gear selection)
- FR-012.3: **Neutral:** N key
- FR-012.4: Prevent default browser actions (space scrolling)
- FR-012.5: Work regardless of input focus
- FR-012.6: Display keyboard shortcuts in UI

**Acceptance Criteria:**
- All keyboard shortcuts work as documented
- No conflict with browser shortcuts
- Responsive with no lag
- Instructions visible to user

---

## Non-Functional Requirements

### NFR-001: Performance
**Priority:** Critical

**Requirements:**
- NFR-001.1: **Frame Rate:** Maintain ≥30 FPS on mobile, ≥60 FPS on desktop
- NFR-001.2: **Audio Latency:** <50ms from input to sound output
- NFR-001.3: **Load Time:** <3 seconds on broadband connection
- NFR-001.4: **Memory Usage:** <200MB total memory footprint
- NFR-001.5: **CPU Usage:** <50% of single core average on desktop, <30% on mobile
- NFR-001.6: **Battery Drain:** <5% per 10 minutes of use on mobile
- NFR-001.7: No audio dropouts or glitches during normal operation

---

### NFR-002: Compatibility
**Priority:** Critical

**Requirements:**
- NFR-002.1: **Desktop Browsers:**
  - Chrome 66+ (AudioWorklet support)
  - Firefox 76+ (AudioWorklet support)
  - Safari 14.1+ (AudioWorklet support)
  - Edge 79+ (Chromium-based)
- NFR-002.2: **Mobile Browsers:**
  - Chrome Android 66+
  - Safari iOS 14.1+
  - Firefox Android 79+
- NFR-002.3: **Screen Sizes:** 320px to 4K (3840px wide)
- NFR-002.4: **Orientations:** Portrait and landscape
- NFR-002.5: Works without internet after initial load (when cached)

---

### NFR-003: Usability
**Priority:** High

**Requirements:**
- NFR-003.1: **Learning Curve:** New users understand controls within 2 minutes
- NFR-003.2: **Accessibility:** ARIA labels on all interactive elements
- NFR-003.3: **Visual Feedback:** All interactions provide immediate visual feedback
- NFR-003.4: **Error Messages:** Clear, actionable error messages for failures
- NFR-003.5: **Touch Targets:** Minimum 44x44pt on iOS, 48x48dp on Android
- NFR-003.6: **Readability:** Minimum 12px font size, sufficient contrast (WCAG AA)

---

### NFR-004: Reliability
**Priority:** High

**Requirements:**
- NFR-004.1: **Uptime:** 99.9% availability (for hosted version)
- NFR-004.2: **Error Handling:** Graceful degradation on unsupported browsers
- NFR-004.3: **Data Loss:** No settings loss unless localStorage cleared
- NFR-004.4: **Crash Recovery:** App restarts cleanly after tab recovery
- NFR-004.5: **Audio Recovery:** Handles audio context suspend/resume

---

### NFR-005: Maintainability
**Priority:** Medium

**Requirements:**
- NFR-005.1: **Code Structure:** Modular, well-commented code
- NFR-005.2: **Documentation:** Comprehensive inline comments and README
- NFR-005.3: **Configuration:** Tunable parameters in CONFIG objects
- NFR-005.4: **Version Control:** Git-based with clear commit history
- NFR-005.5: **Testing:** Manual test procedures documented

---

### NFR-006: Security
**Priority:** Medium

**Requirements:**
- NFR-006.1: No server-side code (client-only application)
- NFR-006.2: No external API calls or data transmission
- NFR-006.3: No user authentication required
- NFR-006.4: HTTPS required for AudioWorklet and PWA features
- NFR-006.5: No third-party scripts or analytics
- NFR-006.6: Content Security Policy compatible

---

### NFR-007: Scalability
**Priority:** Low

**Requirements:**
- NFR-007.1: Static files only (infinitely scalable via CDN)
- NFR-007.2: No backend infrastructure required
- NFR-007.3: No database requirements
- NFR-007.4: Works offline after initial load

---

## Technical Requirements

### TR-001: Audio Synthesis Architecture
**Priority:** Critical

**Requirements:**
- TR-001.1: Use Web Audio API AudioWorklet for synthesis
- TR-001.2: Separate audio thread for low-latency processing
- TR-001.3: Sample rate: 44100 Hz or 48000 Hz (browser default)
- TR-001.4: Buffer size: 128 samples (2.9ms at 44.1kHz)
- TR-001.5: **Harmonic Synthesis:**
  - Generate 24 harmonics of firing frequency
  - Firing frequency = (RPM / 60) × (cylinders / 2)
  - Power-law amplitude decay: A(k) = 1 / k^α
  - Anti-aliasing: suppress harmonics above Nyquist frequency
- TR-001.6: **Noise Generation:**
  - Intake noise: low-pass filtered white noise
  - Mechanical noise: high-pass filtered white noise
  - Combustion noise: band-pass filtered noise
- TR-001.7: **Resonance Modeling:**
  - Exhaust resonance: bandpass filters at 120Hz, 290Hz, 580Hz
  - Body resonance: ~100Hz emphasis for boxer engines

---

### TR-002: Physics Simulation
**Priority:** Critical

**Requirements:**
- TR-002.1: **RPM Calculation:**
  - Exponential smoothing with inertia parameter
  - Load-dependent inertia scaling
  - Clamp to idle-redline range with 5% overshoot allowed
- TR-002.2: **Torque Modeling:**
  - Parabolic torque curve peaked at 60% RPM range
  - Base torque: 280 Nm (typical 4-cylinder)
  - Throttle modulation: 15% minimum, 100% at full throttle
- TR-002.3: **Vehicle Dynamics:**
  - Speed from RPM via gear ratios
  - Force-based acceleration: F = ma
  - Aerodynamic drag: quadratic with speed
  - Rolling resistance: linear with mass
- TR-002.4: **Update Rate:** 60 Hz (requestAnimationFrame)

---

### TR-003: State Management
**Priority:** High

**Requirements:**
- TR-003.1: Global `params` object for engine parameters
- TR-003.2: Global `vehicleState` object for vehicle dynamics
- TR-003.3: Global `CONFIG` object for constants
- TR-003.4: In-place mutation (no immutability framework)
- TR-003.5: localStorage for persistence (JSON serialization)

---

### TR-004: Code Organization
**Priority:** High

**Requirements:**
- TR-004.1: **File Structure:**
  - `index.html`: UI structure (190 lines)
  - `style.css`: Styling (400+ lines)
  - `app.js`: Logic and physics (889 lines)
  - `engine-processor.js`: Audio synthesis (343 lines)
  - `readme.md`: Documentation
- TR-004.2: No build process or transpilation
- TR-004.3: No external dependencies or libraries
- TR-004.4: ES6+ JavaScript (const, arrow functions, async/await)
- TR-004.5: JSDoc comments on major functions

---

### TR-005: Browser APIs Used
**Priority:** Critical

**Requirements:**
- TR-005.1: Web Audio API (AudioContext, AudioWorklet, nodes)
- TR-005.2: localStorage API (settings persistence)
- TR-005.3: RequestAnimationFrame API (animation loop)
- TR-005.4: Touch Events API (mobile support)
- TR-005.5: Keyboard Events API (controls)
- TR-005.6: Performance API (timing)

---

## User Interface Requirements

### UIR-001: Visual Design
**Priority:** High

**Requirements:**
- UIR-001.1: **Color Scheme:**
  - Background: Dark gradient (#0a0a0a to #1a1a2e)
  - Primary accent: Cyan-green (#00ff88)
  - Secondary accent: Cyan (#00ccff)
  - Warning: Red (#ff0055)
  - Text: Light gray (#f0f0f0)
- UIR-001.2: **Typography:**
  - System fonts (San Francisco, Segoe UI, Roboto)
  - Monospace for numeric displays (Courier New)
  - Minimum 12px font size
- UIR-001.3: **Layout:**
  - Centered container (max 600px wide)
  - Vertical stack for mobile
  - Rounded corners, subtle shadows
  - Glassmorphism effects (translucent backgrounds)

---

### UIR-002: RPM Gauge
**Priority:** Critical

**Requirements:**
- UIR-002.1: SVG circular gauge (200x200 viewBox)
- UIR-002.2: Arc progress indicator (180° sweep)
- UIR-002.3: Color gradient from green to red
- UIR-002.4: 5 shift lights at top (light up approaching redline)
- UIR-002.5: Center numeric display (large font)
- UIR-002.6: "RPM" label below numeric value
- UIR-002.7: Smooth animation (CSS transitions)

---

### UIR-003: Control Panel
**Priority:** High

**Requirements:**
- UIR-003.1: Start/Stop button (large, prominent)
- UIR-003.2: Gas pedal button (emoji icon, touch-enabled)
- UIR-003.3: Preset selector (dropdown)
- UIR-003.4: Parameter inputs (number and range inputs)
- UIR-003.5: Gear selector (dropdown + button grid)
- UIR-003.6: Perspective selector (dropdown)
- UIR-003.7: Effect toggles (checkboxes + amount sliders)
- UIR-003.8: Keyboard shortcut instructions

---

### UIR-004: Status Displays
**Priority:** High

**Requirements:**
- UIR-004.1: Speed display (large numeric, km/h label)
- UIR-004.2: Gear display (large letter/number)
- UIR-004.3: Throttle bar (vertical, green fill)
- UIR-004.4: Load bar (vertical, gradient fill)
- UIR-004.5: Status text ("Ready", "Running", "Error")
- UIR-004.6: Performance metrics (0-100 time, top speed)

---

### UIR-005: Responsive Design
**Priority:** High

**Requirements:**
- UIR-005.1: Mobile-first approach
- UIR-005.2: Breakpoints:
  - Mobile: <480px
  - Tablet: 480-768px
  - Desktop: >768px
- UIR-005.3: Touch-friendly controls on mobile
- UIR-005.4: Collapsible settings on small screens
- UIR-005.5: Landscape orientation support

---

## Audio Requirements

### AR-001: Engine Sound Characteristics
**Priority:** Critical

**Requirements:**
- AR-001.1: **NA Engine:**
  - Clean harmonic structure
  - Smooth power delivery
  - Balanced frequency response
- AR-001.2: **Turbo Engine:**
  - Turbo whistle (10-13kHz) increasing with throttle
  - Whoosh on throttle close
  - Slight distortion at high boost
- AR-001.3: **VTEC Engine:**
  - Low-cam: deeper, α=1.35-0.85×throttle
  - High-cam: aggressive, α=1.00-0.55×throttle
  - Crossover at 5600 RPM with 900 RPM blend width
  - Intake edge enhancement in high-cam
- AR-001.4: **FA24 Boxer Engine:**
  - Paired pulse modulation (lump)
  - Low-frequency rumble (~10Hz loping)
  - Emphasized low-mid harmonics (k≤3)
  - Suppressed high harmonics (k≥6)
  - Burble on deceleration (3200 RPM ± 1300)

---

### AR-002: Audio Quality
**Priority:** High

**Requirements:**
- AR-002.1: No aliasing artifacts (anti-aliasing above Nyquist)
- AR-002.2: No clipping or distortion (except intentional)
- AR-002.3: Smooth parameter transitions (no pops or clicks)
- AR-002.4: Dynamic range: -60dB to 0dB
- AR-002.5: Frequency response: 40Hz to 15kHz
- AR-002.6: THD: <5% (except intentional distortion modes)

---

### AR-003: Audio Latency
**Priority:** Critical

**Requirements:**
- AR-003.1: Input-to-output latency <50ms total
- AR-003.2: AudioWorklet processing <5ms
- AR-003.3: Parameter updates within one buffer (2.9ms)
- AR-003.4: No perceivable lag on throttle input

---

## Physics Engine Requirements

### PER-001: Accuracy
**Priority:** High

**Requirements:**
- PER-001.1: RPM behavior matches real engine inertia
- PER-001.2: Gear ratios produce realistic speeds
- PER-001.3: Acceleration rates plausible for sports car (1350kg, 280Nm)
- PER-001.4: Load calculation reflects actual resistance forces
- PER-001.5: 0-100 km/h time realistic (7-12 seconds depending on shifting)

---

### PER-002: Realism vs. Performance
**Priority:** Medium

**Requirements:**
- PER-002.1: Simplified physics for real-time performance
- PER-002.2: No tire slip modeling (always perfect traction)
- PER-002.3: No clutch simulation (instant engagement)
- PER-002.4: No transmission losses beyond efficiency factor
- PER-002.5: Simplified aerodynamics (no downforce, fixed Cd)

---

## Data Requirements

### DR-001: Configuration Data
**Priority:** High

**Requirements:**
- DR-001.1: All tunable parameters in CONFIG object (app.js)
- DR-001.2: All synthesis constants in SynthConstants object (engine-processor.js)
- DR-001.3: JSON-serializable for persistence
- DR-001.4: Documented with units and valid ranges

---

### DR-002: User Data
**Priority:** Medium

**Requirements:**
- DR-002.1: Settings stored in localStorage
- DR-002.2: No server-side storage
- DR-002.3: No user accounts or authentication
- DR-002.4: No analytics or tracking
- DR-002.5: Data stays on user's device

---

## External Interface Requirements

### EIR-001: No External Dependencies
**Priority:** High

**Requirements:**
- EIR-001.1: No npm packages
- EIR-001.2: No CDN-hosted libraries
- EIR-001.3: No external API calls
- EIR-001.4: No analytics services
- EIR-001.5: Fully self-contained

---

### EIR-002: Hosting Requirements
**Priority:** High

**Requirements:**
- EIR-002.1: Static file hosting (no server-side processing)
- EIR-002.2: HTTPS required for AudioWorklet
- EIR-002.3: Correct MIME types:
  - .js: application/javascript
  - .html: text/html
  - .css: text/css
- EIR-002.4: No special server configuration needed

---

## Constraints and Assumptions

### Constraints

1. **Technology Constraints:**
   - Must use Web Audio API (no other audio frameworks)
   - Must run in browser (no native code)
   - Must use AudioWorklet (no legacy ScriptProcessor)
   - No server-side processing

2. **Performance Constraints:**
   - Audio processing must complete within buffer time (~3ms)
   - Main thread must maintain 30+ FPS
   - Total memory <200MB
   - No blocking operations on audio thread

3. **Compatibility Constraints:**
   - AudioWorklet support required (Chrome 66+, Firefox 76+, Safari 14.1+)
   - Older browsers unsupported
   - No IE11 support

4. **Resource Constraints:**
   - No budget for paid services
   - Volunteer development
   - No dedicated testing infrastructure

### Assumptions

1. **User Assumptions:**
   - Users have basic understanding of engines/cars
   - Users have audio output capability (speakers/headphones)
   - Users understand keyboard/touch input
   - Users access via supported browser

2. **Technical Assumptions:**
   - Browser AudioWorklet implementation is stable
   - localStorage is available and persistent
   - JavaScript performance is sufficient
   - Audio latency is acceptable across devices

3. **Operational Assumptions:**
   - Hosted on reliable static hosting (Vercel, GitHub Pages)
   - HTTPS available
   - No ongoing server costs
   - Updates deployed via git push

---

## Future Enhancements

### Future Features (Out of Current Scope)

1. **Additional Engine Types:**
   - Rotary engine (Mazda RX-7/8 style)
   - Diesel engine (lower RPM, different combustion)
   - Electric motor simulation
   - Two-stroke engines

2. **Advanced Physics:**
   - Tire grip and traction loss modeling
   - Wheel spin and burnout effects
   - Clutch slip simulation
   - Transmission synchronization

3. **Recording and Playback:**
   - Record audio to WAV/MP3
   - Save RPM/throttle curves
   - Replay saved sessions
   - Export for use in games/videos

4. **Visual Enhancements:**
   - Real-time spectrum analyzer
   - Waveform display
   - 3D engine visualization
   - Animated tachometer needle

5. **User Features:**
   - Custom preset saving
   - Preset sharing (URL encoding)
   - Social features (leaderboards)
   - User accounts (cloud settings)

6. **Mobile App:**
   - Native iOS app
   - Native Android app
   - Progressive Web App (PWA)
   - App store distribution

7. **Advanced Audio:**
   - Backfire and pops (exhaust flames)
   - Turbo blow-off valve sounds
   - Supercharger whine
   - Transmission whine

8. **Multiplayer/Social:**
   - Compare 0-100 times
   - Drag race mode
   - Share custom engines
   - Community presets

### Technical Debt

1. **Code Quality:**
   - Large monolithic functions (need refactoring)
   - Global state pollution
   - Limited error handling
   - No automated tests

2. **Documentation:**
   - Need API documentation
   - Need architecture diagrams
   - Need contribution guidelines
   - Need troubleshooting guide

3. **Testing:**
   - No unit tests
   - No integration tests
   - Manual testing only
   - No CI/CD pipeline

---

## Acceptance Criteria

The system is considered complete when:

1. ✅ All Critical priority requirements are implemented
2. ✅ All High priority requirements are implemented
3. ✅ System passes manual testing on Chrome, Firefox, Safari
4. ✅ System works on iOS and Android mobile browsers
5. ✅ No critical bugs or crashes
6. ✅ Performance meets NFR-001 targets
7. ✅ Documentation is complete and accurate
8. ✅ Code is well-commented and maintainable
9. ✅ Settings persist correctly across sessions
10. ✅ All four engine presets produce distinctive sounds

---

## Revision History

| Version | Date       | Author      | Changes                          |
|---------|------------|-------------|----------------------------------|
| 1.0     | 2026-02-20 | Claude AI   | Initial requirements document    |

---

## Appendix A: Glossary

- **AudioWorklet:** Web Audio API feature for low-latency audio processing in a separate thread
- **RPM:** Revolutions Per Minute, engine rotational speed
- **Throttle:** Engine air/fuel control position (0-100%)
- **Redline:** Maximum safe engine RPM
- **Inertia:** Resistance to RPM change (higher = slower response)
- **Load:** Engine load, ratio of current torque to maximum torque
- **Firing Frequency:** Frequency at which cylinders fire (RPM/60 × cylinders/2)
- **Harmonic:** Integer multiple of fundamental frequency
- **Anti-aliasing:** Suppressing frequencies above Nyquist to prevent artifacts
- **Nyquist Frequency:** Half of sample rate, above which aliasing occurs

## Appendix B: Technical Formulas

**Firing Frequency:**
```
f_fire = (RPM / 60) × (cylinders / 2)
```

**Vehicle Speed:**
```
speed = (RPM × 2π × wheelRadius) / (gearRatio × finalDrive × 60)
```

**Aerodynamic Drag:**
```
F_drag = 0.5 × ρ × Cd × A × v²
```

**Rolling Resistance:**
```
F_roll = m × g × Crr
```

**Harmonic Amplitude:**
```
A(k) = 1 / k^α
where k = harmonic number, α = decay rate
```

**First-Order Low-Pass Filter:**
```
state += α × (input - state)
output = state
where α = cutoff frequency coefficient
```

---

**End of Requirements Definition Document**
