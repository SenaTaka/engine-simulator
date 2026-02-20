/**
 * EngineProcessor - AudioWorklet processor for real-time engine sound synthesis
 *
 * This processor synthesizes realistic engine sounds using:
 * - Harmonic synthesis with anti-aliasing
 * - Cylinder-to-cylinder variation
 * - Multi-band noise generation (intake, mechanical, combustion)
 * - Exhaust resonance modeling
 * - Engine-specific characteristics (VTEC, Turbo, Boxer)
 * - Rev limiter simulation
 * - Deceleration backfire effects
 */

/**
 * Synthesis constants for engine sound generation
 */
const SynthConstants = {
  // Harmonic synthesis
  HARMONIC_COUNT: 24,
  HARMONIC_COLOR_MIN: 0.85,
  HARMONIC_COLOR_RANGE: 0.3,
  HARMONIC_ROLLOFF_FREQ: 4000,
  HARMONIC_ROLLOFF_RANGE: 10000,

  // Jitter and variation
  JITTER_BASE: 0.001,
  JITTER_RANGE: 0.003,
  RANDOM_WALK_RATE: 0.00015,
  RANDOM_WALK_DECAY: 0.9995,

  // Cylinder variation
  CYLINDER_PHASE_OFFSET_RANGE: 0.08,
  CYLINDER_AMP_MIN: 0.92,
  CYLINDER_AMP_RANGE: 0.16,
  CYLINDER_CONTRIBUTION: 0.15,

  // VTEC parameters
  VTEC_CROSSOVER_CENTER: 5600.0,
  VTEC_CROSSOVER_WIDTH: 900.0,
  VTEC_ALPHA_LOW_CAM_BASE: 1.35,
  VTEC_ALPHA_LOW_CAM_THROTTLE: 0.85,
  VTEC_ALPHA_HIGH_CAM_BASE: 1.00,
  VTEC_ALPHA_HIGH_CAM_THROTTLE: 0.55,
  VTEC_DAMPING_LOW_CAM_MIN: 0.45,
  VTEC_DAMPING_LOW_CAM_SCALE: 0.5,
  VTEC_DAMPING_HIGH_CAM_MIN: 0.35,
  VTEC_DAMPING_HIGH_CAM_BASE: 1.08,
  VTEC_DAMPING_HIGH_CAM_SCALE: 0.38,
  VTEC_HIGH_HARMONIC_BOOST: 0.55,
  VTEC_HIGH_HARMONIC_THRESHOLD: 7,
  VTEC_CAM_LOBE_BASE: 0.12,
  VTEC_CAM_LOBE_THROTTLE: 0.18,
  VTEC_INTAKE_EDGE_BASE: 0.08,
  VTEC_INTAKE_EDGE_THROTTLE: 0.22,

  // Boxer/FA24 parameters
  BOXER_LUMP_BASE: 0.55,
  BOXER_LUMP_THROTTLE: 0.45,
  BOXER_WOBBLE_BASE: 0.01,
  BOXER_WOBBLE_THROTTLE: 0.02,
  BOXER_LOW_BOOST_BASE: 0.95,
  BOXER_HIGH_REDUCTION: 0.085,
  BOXER_PULSE_FILTER: 0.84,
  BOXER_RUMBLE_FILTER: 0.028,
  BOXER_MODE_BLEND: 0.22,
  BOXER_RUMBLE_BLEND: 0.72,
  BOXER_SUB_BASE: 0.22,
  BOXER_SUB_THROTTLE: 0.28,
  BOXER_MID_BASE: 0.14,
  BOXER_MID_THROTTLE: 0.22,
  BOXER_NOISE_BASE: 0.15,
  BOXER_NOISE_RANGE: 0.85,
  BOXER_BURBLE_CENTER_RPM: 3200.0,
  BOXER_BURBLE_WIDTH: 2600.0,
  BOXER_BURBLE_BASE: 0.16,
  BOXER_BURBLE_RANGE: 0.22,
  FA24_RUMBLE_BASE: 0.28,
  FA24_RUMBLE_THROTTLE: 0.48,

  // Intake noise
  INTAKE_LPF_ALPHA_BASE: 0.05,
  INTAKE_LPF_ALPHA_THROTTLE: 0.18,
  INTAKE_GAIN_BASE: 0.35,
  INTAKE_GAIN_THROTTLE: 1.35,
  INTAKE_LOAD_FACTOR: 0.4,

  // Mechanical noise
  MECH_HPF_ALPHA: 0.055,
  MECH_GAIN_BASE: 0.18,
  MECH_GAIN_RPM: 0.75,
  MECH_LOAD_FACTOR: 0.5,
  MECH_RPM_NORM: 8000.0,

  // Turbo
  TURBO_SPOOL_BASE: 10000.0,
  TURBO_SPOOL_RANGE: 3000.0,
  TURBO_WHISTLE_GAIN: 0.12,
  TURBO_WHOOSH_BASE: 0.2,
  TURBO_WHOOSH_THROTTLE: 0.8,

  // Combustion noise
  COMBUSTION_PULSE_FILTER: 0.9,
  COMBUSTION_PULSE_ATTACK: 0.1,
  COMBUSTION_GAIN_BASE: 0.2,
  COMBUSTION_GAIN_THROTTLE: 0.9,
  COMBUSTION_LOAD_FACTOR: 0.6,
  COMBUSTION_BURST_POWER_BASE: 3.2,
  COMBUSTION_BURST_LOAD_SCALE: 0.8,

  // Load stress
  LOAD_STRESS_BASE: 0.3,
  LOAD_STRESS_THROTTLE: 0.7,

  // Valvetrain
  VALVE_CLICK_POWER: 12.0,
  VALVE_CLICK_BASE: 0.08,
  VALVE_CLICK_RPM: 0.12,

  // Backfire
  BACKFIRE_DECAY: 0.94,
  BACKFIRE_THRESHOLD: 0.3,
  BACKFIRE_CENTER_RPM: 4500.0,
  BACKFIRE_WIDTH: 3500.0,
  BACKFIRE_GAIN_BASE: 0.35,
  BACKFIRE_GAIN_LPF: 0.65,

  // Resonance
  BODY_RESONANCE_ALPHA: 0.02,
  BODY_RESONANCE_GAIN: 0.6,
  EXHAUST_RES1_BASE: 180,
  EXHAUST_RES1_RPM_SCALE: 0.02,
  EXHAUST_RES2_BASE: 650,
  EXHAUST_RES2_RPM_SCALE: 0.04,
  EXHAUST_RES3_BASE: 1800,
  EXHAUST_RES3_RPM_SCALE: 0.08,
  EXHAUST_RES1_GAIN: 0.28,
  EXHAUST_RES2_GAIN: 0.22,
  EXHAUST_RES3_GAIN: 0.15,
  EXHAUST_RESONANCE_BASE: 0.5,
  EXHAUST_RESONANCE_THROTTLE: 0.5,

  // Rev limiter
  REV_LIMITER_THRESHOLD: 0.98,
  REV_LIMITER_RATE: 0.15,
  REV_LIMITER_CUT_THRESHOLD: 0.3,
  REV_LIMITER_CUT_VALUE: 0.05,

  // Distortion
  DISTORTION_BASE: 0.9,
  DISTORTION_THROTTLE: 2.2,
  DISTORTION_VTEC: 0.35,
  DISTORTION_FA24: 0.28,
  DISTORTION_LOAD: 0.4,
  POST_LPF_ALPHA_BASE: 0.12,
  POST_LPF_ALPHA_THROTTLE: 0.10,
  POST_LPF_MIX_FILTERED: 0.82,
  POST_LPF_MIX_DRY: 0.18,

  // Output
  MASTER_VOLUME: 0.34
};

/**
 * Helper to extract parameter values from AudioParam arrays
 */
function getParamValue(paramArray, index) {
  return paramArray.length > 1 ? paramArray[index] : paramArray[0];
}

class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.lpfState = 0;
    this.hpfState = 0;
    this.bpfState = 0;
    this.postLpfState = 0;
    this.randomWalk = 0;
    this.combPulse = 0;
    this.turboPhase = 0;
    this.boxerPulse = 0;
    this.boxerRumbleState = 0;

    // Pre-calculate random phase offsets for each harmonic to break phase coherence
    // This makes it sound less like a synth/organ
    this.phaseOffsets = new Float32Array(32).map(() => Math.random() * 2 * Math.PI);
    this.harmonicColor = new Float32Array(32).map(() =>
      SynthConstants.HARMONIC_COLOR_MIN + Math.random() * SynthConstants.HARMONIC_COLOR_RANGE
    );

    // Cylinder-to-cylinder variation for more organic combustion
    this.cylinderPhaseOffsets = new Float32Array(12).map(() =>
      Math.random() * SynthConstants.CYLINDER_PHASE_OFFSET_RANGE - SynthConstants.CYLINDER_PHASE_OFFSET_RANGE / 2
    );
    this.cylinderAmplitudes = new Float32Array(12).map(() =>
      SynthConstants.CYLINDER_AMP_MIN + Math.random() * SynthConstants.CYLINDER_AMP_RANGE
    );

    // Exhaust resonance states (formant-like filtering)
    this.exhaustRes1State = 0;
    this.exhaustRes2State = 0;
    this.exhaustRes3State = 0;

    // Deceleration/backfire state
    this.backfirePulse = 0;
    this.lastThrottle = 0;

    // Valvetrain noise state
    this.valveClickPhase = 0;

    // Rev limiter state
    this.revLimiterCycle = 0;
    this.revLimiterActive = false;
  }

  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 1000, minValue: 0, maxValue: 12000 },
      { name: 'throttle', defaultValue: 0.15, minValue: 0, maxValue: 1 },
      { name: 'ncyl', defaultValue: 4, minValue: 1, maxValue: 12 },
      { name: 'noiseGain', defaultValue: 0.2, minValue: 0, maxValue: 1 },
      { name: 'turboMode', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'boxerMode', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'vtecMode', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'fa24Mode', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'redlineRpm', defaultValue: 7000, minValue: 3000, maxValue: 12000 },
      { name: 'load', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'v8Mode', defaultValue: 0, minValue: 0, maxValue: 1 },
      { name: 'rotaryMode', defaultValue: 0, minValue: 0, maxValue: 1 }
    ];
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0];
    
    if (!channel) return true;

    const n_harm = SynthConstants.HARMONIC_COUNT;
    const nyquist = sampleRate / 2;

    for (let i = 0; i < channel.length; i++) {
      // Extract current parameters using helper function
      const rpm = getParamValue(parameters.rpm, i);
      const throttle = getParamValue(parameters.throttle, i);
      const ncyl = getParamValue(parameters.ncyl, i);
      const noiseGain = getParamValue(parameters.noiseGain, i);
      const turboMode = getParamValue(parameters.turboMode, i);
      const boxerMode = getParamValue(parameters.boxerMode, i);
      const vtecMode = getParamValue(parameters.vtecMode, i);
      const fa24Mode = getParamValue(parameters.fa24Mode, i);
      const redlineRpm = getParamValue(parameters.redlineRpm, i);
      const load = getParamValue(parameters.load, i);
      const v8Mode = getParamValue(parameters.v8Mode, i);
      const rotaryMode = getParamValue(parameters.rotaryMode, i);

      // Rev limiter simulation: fuel cut at redline
      let revLimiterCut = 1.0;
      if (rpm > redlineRpm * SynthConstants.REV_LIMITER_THRESHOLD) {
        this.revLimiterCycle += SynthConstants.REV_LIMITER_RATE;
        if (this.revLimiterCycle > 1.0) this.revLimiterCycle = 0;
        this.revLimiterActive = true;
        // Hard cut creates distinctive bouncing on/off pattern
        revLimiterCut = this.revLimiterCycle < SynthConstants.REV_LIMITER_CUT_THRESHOLD
          ? SynthConstants.REV_LIMITER_CUT_VALUE
          : 1.0;
      } else {
        this.revLimiterActive = false;
        this.revLimiterCycle = 0;
      }

      // 1. Fundamental Frequency & Jitter
      const jitterAmount = SynthConstants.JITTER_BASE + SynthConstants.JITTER_RANGE * (1.0 - throttle);
      const jitter = 1.0 + (Math.random() - 0.5) * jitterAmount;

      // Very slow random walk on pitch to emulate tiny cycle-to-cycle combustion variation
      this.randomWalk += (Math.random() - 0.5) * SynthConstants.RANDOM_WALK_RATE;
      this.randomWalk *= SynthConstants.RANDOM_WALK_DECAY;
      const drift = 1.0 + this.randomWalk;

      const f_fire = (rpm / 60.0) * (ncyl / 2.0) * jitter * drift;
      const phaseInc = (2.0 * Math.PI * f_fire) / sampleRate;
      
      this.phase += phaseInc;
      if (this.phase > 2.0 * Math.PI) {
        this.phase -= 2.0 * Math.PI;
      }

      // 2. Harmonic Synthesis (Anti-aliased)
      // VTEC profile: blend from low-cam tone to high-cam tone around crossover RPM.
      const crossoverCenter = SynthConstants.VTEC_CROSSOVER_CENTER;
      const crossoverWidth = SynthConstants.VTEC_CROSSOVER_WIDTH;
      const x = (rpm - (crossoverCenter - crossoverWidth * 0.5)) / crossoverWidth;
      const vtecBlendRaw = Math.min(1.0, Math.max(0.0, x));
      const vtecBlend = vtecMode * (vtecBlendRaw * vtecBlendRaw * (3.0 - 2.0 * vtecBlendRaw));

      const alphaLowCam = SynthConstants.VTEC_ALPHA_LOW_CAM_BASE - SynthConstants.VTEC_ALPHA_LOW_CAM_THROTTLE * throttle;
      const alphaHighCam = SynthConstants.VTEC_ALPHA_HIGH_CAM_BASE - SynthConstants.VTEC_ALPHA_HIGH_CAM_THROTTLE * throttle;
      const alpha = alphaLowCam + (alphaHighCam - alphaLowCam) * vtecBlend;

      const dampingLowCam = Math.max(
        SynthConstants.VTEC_DAMPING_LOW_CAM_MIN,
        1.0 - (rpm / 12000.0) * SynthConstants.VTEC_DAMPING_LOW_CAM_SCALE
      );
      const dampingHighCam = Math.max(
        SynthConstants.VTEC_DAMPING_HIGH_CAM_MIN,
        SynthConstants.VTEC_DAMPING_HIGH_CAM_BASE - (rpm / 12000.0) * SynthConstants.VTEC_DAMPING_HIGH_CAM_SCALE
      );
      const harmonicDamping = dampingLowCam + (dampingHighCam - dampingLowCam) * vtecBlend;

      let signal = 0;

      // FA24: emphasize low-order boxer pulse with slight off-beat wobble.
      const boxerLump = fa24Mode * (SynthConstants.BOXER_LUMP_BASE + SynthConstants.BOXER_LUMP_THROTTLE * throttle);
      const boxerWobble = fa24Mode * (SynthConstants.BOXER_WOBBLE_BASE + SynthConstants.BOXER_WOBBLE_THROTTLE * throttle) * Math.sin(0.5 * this.phase + 0.9);

      // Cylinder-to-cylinder variation: each cylinder fires with slightly different timing/amplitude
      const cylPerRev = ncyl / 2.0;
      const firingInterval = (2.0 * Math.PI) / cylPerRev;
      let cylinderContribution = 0;

      for (let cyl = 0; cyl < Math.min(ncyl, 12); cyl++) {
        const cylPhase = this.phase + cyl * firingInterval + this.cylinderPhaseOffsets[cyl];
        const cylAmp = this.cylinderAmplitudes[cyl];
        const cylPulse = Math.pow(Math.max(0, Math.sin(cylPhase)), 5.0);
        cylinderContribution += cylAmp * cylPulse * SynthConstants.CYLINDER_CONTRIBUTION;
      }

      for (let k = 1; k <= n_harm; k++) {
        const freq = k * f_fire;

        // Anti-aliasing: Skip harmonics above Nyquist frequency
        if (freq >= nyquist) break;

        // Amplitude decay
        let amp = 1.0 / Math.pow(k, alpha);
        amp *= this.harmonicColor[k];

        if (fa24Mode > 0.0) {
          if (k <= 3) amp *= 1.0 + boxerLump * (SynthConstants.BOXER_LOW_BOOST_BASE - 0.2 * k);
          if (k >= 6) amp *= Math.max(0.45, 1.0 - SynthConstants.BOXER_HIGH_REDUCTION * (k - 5) * fa24Mode);
        }

        // High-cam adds stronger high-order content above crossover.
        if (k >= SynthConstants.VTEC_HIGH_HARMONIC_THRESHOLD) {
          amp *= 1.0 + SynthConstants.VTEC_HIGH_HARMONIC_BOOST * vtecBlend;
        }

        // Reduce high harmonics amplitude further to avoid "buzz"
        // Frequencies above 4kHz roll off
        if (freq > SynthConstants.HARMONIC_ROLLOFF_FREQ) {
          amp *= Math.max(0, 1.0 - (freq - SynthConstants.HARMONIC_ROLLOFF_FREQ) / SynthConstants.HARMONIC_ROLLOFF_RANGE);
        }

        // Use pre-calculated phase offset for organic sound
        // k * this.phase aligns them perfectly (sawtooth-like) -> electronic sound
        // Adding offset breaks this perfect alignment
        signal += amp * harmonicDamping * Math.sin(k * this.phase + this.phaseOffsets[k]);
      }

      // Add cylinder-to-cylinder variation contribution
      signal += cylinderContribution * (0.8 + 0.2 * throttle);

      // Subaru FA24-like boxer cadence: create slightly uneven paired pulses
      // and low-mid "dorodoro" energy instead of smooth harmonic continuity.
      const pulseA = Math.pow(Math.max(0, Math.sin(this.phase + 0.10)), 7.0);
      const pulseB = Math.pow(Math.max(0, Math.sin(this.phase + 1.22)), 7.0);
      const pairedPulse = pulseA + 0.78 * pulseB;

      // Slow loping envelope creates the characteristic rolling boxer texture.
      const loping = 0.55 + 0.45 * Math.sin(this.phase * 0.5 + 0.9);
      this.boxerPulse = SynthConstants.BOXER_PULSE_FILTER * this.boxerPulse + (1.0 - SynthConstants.BOXER_PULSE_FILTER) * pairedPulse * loping;

      const boxerFund = Math.sin(this.phase * 0.5 + 0.2);
      const boxerOdd = Math.sin(this.phase * 1.5 + 1.0);
      const boxerLow = 0.62 * boxerFund + 0.34 * boxerOdd;
      this.boxerRumbleState += SynthConstants.BOXER_RUMBLE_FILTER * (boxerLow - this.boxerRumbleState);
      const boxerRumble = (0.58 + 0.42 * this.boxerPulse) * this.boxerRumbleState;

      // Shift part of smooth harmonics into lumpy low-mid boxer band.
      signal = signal * (1.0 - SynthConstants.BOXER_MODE_BLEND * boxerMode) + boxerRumble * (SynthConstants.BOXER_RUMBLE_BLEND * boxerMode);
      // High-cam lobe texture: slight extra emphasis around 2nd/3rd order at crossover.
      const camLobe = (SynthConstants.VTEC_CAM_LOBE_BASE + SynthConstants.VTEC_CAM_LOBE_THROTTLE * throttle) * vtecBlend;
      signal += camLobe * Math.sin(2.0 * this.phase + 0.2);
      signal += (camLobe * 0.65) * Math.sin(3.0 * this.phase + 0.55);

      // FA24 boxer growl layer: sub/low-mid reinforcement with uneven combustion feel.
      const boxerSub = fa24Mode * (SynthConstants.BOXER_SUB_BASE + SynthConstants.BOXER_SUB_THROTTLE * throttle) * Math.sin(0.5 * this.phase + 0.35);
      const boxerMid = fa24Mode * (SynthConstants.BOXER_MID_BASE + SynthConstants.BOXER_MID_THROTTLE * throttle) * Math.sin(1.5 * this.phase + 1.1 + boxerWobble);
      signal += boxerSub + boxerMid;

      // V8: deep rumble with cross-plane crank firing order irregularity
      if (v8Mode > 0.0) {
        // Cross-plane V8 firing order creates a distinctive uneven 90-degree pulse pair
        const v8PulseA = Math.pow(Math.max(0, Math.sin(this.phase + 0.0)), 6.0);
        const v8PulseB = Math.pow(Math.max(0, Math.sin(this.phase + Math.PI * 0.5)), 6.0);
        const v8PulseC = Math.pow(Math.max(0, Math.sin(this.phase + Math.PI)), 6.0);
        const v8PulseD = Math.pow(Math.max(0, Math.sin(this.phase + Math.PI * 1.5)), 6.0);
        const v8Rumble = 0.28 * (v8PulseA + 0.9 * v8PulseB + 0.95 * v8PulseC + 0.85 * v8PulseD);
        // V8 deep burble layer
        const v8Deep = Math.sin(this.phase * 0.5) * (0.25 + 0.35 * throttle);
        signal = signal * (1.0 - 0.25 * v8Mode) + (v8Rumble + v8Deep) * (0.6 * v8Mode);
      }

      // Rotary (Wankel): smooth, high-revving with distinctive trochoid pulse
      if (rotaryMode > 0.0) {
        // Rotary has 3 power strokes per rotor revolution (per 2-rotor = 6 per crankshaft rev)
        // Creates a smooth, almost turbine-like sound with a unique "brap" texture
        const rotaryPulse = Math.pow(Math.max(0, Math.sin(this.phase * 1.5 + 0.4)), 4.0)
                          + 0.6 * Math.pow(Math.max(0, Math.sin(this.phase * 1.5 + Math.PI * 2 / 3 + 0.4)), 4.0);
        const rotarySmooth = 0.55 + 0.45 * Math.sin(this.phase * 3.0 + 0.1);
        const rotaryLayer = rotaryPulse * rotarySmooth * (0.18 + 0.32 * throttle);
        // Suppress low harmonics, emphasize mids (characteristic rotary tone)
        signal = signal * (1.0 - 0.3 * rotaryMode) + rotaryLayer * (0.7 * rotaryMode);
      }

      const white = (Math.random() * 2.0 - 1.0);

      // Load-dependent noise: under load, engine produces more mechanical and combustion noise
      const loadStress = load * (SynthConstants.LOAD_STRESS_BASE + SynthConstants.LOAD_STRESS_THROTTLE * throttle); // Load effect increases with throttle

      // Intake rumble: low-mid broadband that grows strongly with throttle
      const intakeLpfAlpha = SynthConstants.INTAKE_LPF_ALPHA_BASE + SynthConstants.INTAKE_LPF_ALPHA_THROTTLE * throttle;
      this.lpfState += intakeLpfAlpha * (white - this.lpfState);
      const intakeNoise = (SynthConstants.INTAKE_GAIN_BASE + SynthConstants.INTAKE_GAIN_THROTTLE * throttle + SynthConstants.INTAKE_LOAD_FACTOR * loadStress) * this.lpfState;

      // Mechanical hiss: high-frequency texture, stronger at high RPM and under load
      this.hpfState += SynthConstants.MECH_HPF_ALPHA * (white - this.hpfState);
      const hpf = white - this.hpfState;
      const rpmNorm = Math.min(1.0, rpm / SynthConstants.MECH_RPM_NORM);
      const mechNoise = (SynthConstants.MECH_GAIN_BASE + SynthConstants.MECH_GAIN_RPM * rpmNorm + SynthConstants.MECH_LOAD_FACTOR * loadStress) * hpf;

      // Turbo-like whistle and spool texture
      const turboSpool = turboMode * Math.max(0.0, throttle - 0.2) * Math.min(1.0, rpm / 7000.0);
      const whistleFreq = SynthConstants.TURBO_SPOOL_BASE + SynthConstants.TURBO_SPOOL_RANGE * turboSpool;
      this.turboPhase += (2.0 * Math.PI * whistleFreq) / sampleRate;
      if (this.turboPhase > 2.0 * Math.PI) this.turboPhase -= 2.0 * Math.PI;
      const whistle = Math.sin(this.turboPhase) * (SynthConstants.TURBO_WHISTLE_GAIN * turboSpool);
      const turboWhoosh = turboSpool * (SynthConstants.TURBO_WHOOSH_BASE + SynthConstants.TURBO_WHOOSH_THROTTLE * throttle) * hpf;

      // Combustion crackle: bursty modulation tied to firing phase
      // Under load, combustion is more aggressive and uneven
      const cycleEnergy = 0.5 + 0.5 * Math.sin(this.phase);
      const burst = Math.pow(cycleEnergy, SynthConstants.COMBUSTION_BURST_POWER_BASE - SynthConstants.COMBUSTION_BURST_LOAD_SCALE * loadStress); // Load makes combustion less smooth
      this.combPulse = SynthConstants.COMBUSTION_PULSE_FILTER * this.combPulse + SynthConstants.COMBUSTION_PULSE_ATTACK * burst;
      const combustionNoise = this.combPulse * white * (SynthConstants.COMBUSTION_GAIN_BASE + SynthConstants.COMBUSTION_GAIN_THROTTLE * throttle + SynthConstants.COMBUSTION_LOAD_FACTOR * loadStress);

      // Alternating-bank roughness in the 100-280Hz area for boxer exhaust note.
      const boxerNoiseShape = SynthConstants.BOXER_NOISE_BASE + SynthConstants.BOXER_NOISE_RANGE * (0.5 + 0.5 * Math.sin(this.phase * 0.5 + 1.25));
      const boxerNoise = boxerMode * boxerNoiseShape * this.lpfState * (0.45 + 0.95 * throttle);

      const rpmWindow = Math.max(0.0, 1.0 - Math.abs(rpm - SynthConstants.BOXER_BURBLE_CENTER_RPM) / SynthConstants.BOXER_BURBLE_WIDTH);
      const liftOff = Math.max(0.0, 0.35 - throttle) / 0.35;
      const boxerBurble = fa24Mode * rpmWindow * liftOff * (SynthConstants.BOXER_BURBLE_BASE + SynthConstants.BOXER_BURBLE_RANGE * (white * white));

      const vtecIntakeEdge = vtecBlend * (SynthConstants.VTEC_INTAKE_EDGE_BASE + SynthConstants.VTEC_INTAKE_EDGE_THROTTLE * throttle) * (intakeNoise + 0.6 * hpf);
      const fa24RumbleNoise = fa24Mode * (SynthConstants.FA24_RUMBLE_BASE + SynthConstants.FA24_RUMBLE_THROTTLE * throttle) * this.lpfState;

      // Valvetrain mechanical noise: distinct clicks at valve events
      const valveFreq = f_fire * 2.0; // Twice per revolution (intake + exhaust)
      this.valveClickPhase += (2.0 * Math.PI * valveFreq) / sampleRate;
      if (this.valveClickPhase > 2.0 * Math.PI) this.valveClickPhase -= 2.0 * Math.PI;
      const valveClickEnvelope = Math.pow(Math.max(0, Math.sin(this.valveClickPhase)), SynthConstants.VALVE_CLICK_POWER);
      const valveClick = valveClickEnvelope * hpf * (SynthConstants.VALVE_CLICK_BASE + SynthConstants.VALVE_CLICK_RPM * (rpm / SynthConstants.MECH_RPM_NORM));

      // Deceleration backfire: detect throttle lift and create popping
      const throttleDrop = Math.max(0, this.lastThrottle - throttle);
      this.lastThrottle = throttle;
      const decelWindow = Math.max(0.0, 1.0 - Math.abs(rpm - SynthConstants.BACKFIRE_CENTER_RPM) / SynthConstants.BACKFIRE_WIDTH);
      const backfireTrigger = throttleDrop > SynthConstants.BACKFIRE_THRESHOLD ? Math.random() : 0;
      this.backfirePulse = Math.max(this.backfirePulse * SynthConstants.BACKFIRE_DECAY, backfireTrigger * decelWindow);
      const backfireNoise = this.backfirePulse * white * white * (SynthConstants.BACKFIRE_GAIN_BASE + SynthConstants.BACKFIRE_GAIN_LPF * this.lpfState);

      const noiseComp = noiseGain * (intakeNoise + mechNoise + combustionNoise + turboWhoosh + boxerNoise + vtecIntakeEdge + fa24RumbleNoise + boxerBurble + valveClick + backfireNoise);
      signal += whistle;
      signal += noiseComp;

      // 4. Body Resonance
      this.bpfState += SynthConstants.BODY_RESONANCE_ALPHA * (signal - this.bpfState);
      signal += SynthConstants.BODY_RESONANCE_GAIN * this.bpfState;

      // 4b. Exhaust Resonance (Formant-like filtering)
      // Three resonant peaks simulate exhaust pipe length and chamber resonances
      // These shift slightly with RPM to mimic real exhaust behavior
      const exhaustRes1Freq = SynthConstants.EXHAUST_RES1_BASE + rpm * SynthConstants.EXHAUST_RES1_RPM_SCALE; // Low-mid resonance
      const exhaustRes2Freq = SynthConstants.EXHAUST_RES2_BASE + rpm * SynthConstants.EXHAUST_RES2_RPM_SCALE; // Mid resonance
      const exhaustRes3Freq = SynthConstants.EXHAUST_RES3_BASE + rpm * SynthConstants.EXHAUST_RES3_RPM_SCALE; // High-mid resonance

      // Simple resonant filters (2-pole approximation)
      const res1Alpha = Math.min(0.45, (2.0 * Math.PI * exhaustRes1Freq) / sampleRate);
      const res2Alpha = Math.min(0.35, (2.0 * Math.PI * exhaustRes2Freq) / sampleRate);
      const res3Alpha = Math.min(0.25, (2.0 * Math.PI * exhaustRes3Freq) / sampleRate);

      this.exhaustRes1State += res1Alpha * (signal - this.exhaustRes1State);
      this.exhaustRes2State += res2Alpha * (signal - this.exhaustRes2State);
      this.exhaustRes3State += res3Alpha * (signal - this.exhaustRes3State);

      const exhaustResonance = SynthConstants.EXHAUST_RES1_GAIN * this.exhaustRes1State + SynthConstants.EXHAUST_RES2_GAIN * this.exhaustRes2State + SynthConstants.EXHAUST_RES3_GAIN * this.exhaustRes3State;
      signal += exhaustResonance * (SynthConstants.EXHAUST_RESONANCE_BASE + SynthConstants.EXHAUST_RESONANCE_THROTTLE * throttle);

      // Apply rev limiter cut (simulates fuel cut)
      signal *= revLimiterCut;

      // 5. Distortion
      // Under load, engine runs harder and produces more distortion
      const drive = SynthConstants.DISTORTION_BASE + SynthConstants.DISTORTION_THROTTLE * throttle + SynthConstants.DISTORTION_VTEC * vtecBlend + SynthConstants.DISTORTION_FA24 * fa24Mode + SynthConstants.DISTORTION_LOAD * loadStress;
      signal = Math.tanh(drive * signal);

      // Post-filter distortion output to reduce buzzy high-RPM edge
      const postLpfAlpha = SynthConstants.POST_LPF_ALPHA_BASE + SynthConstants.POST_LPF_ALPHA_THROTTLE * throttle;
      this.postLpfState += postLpfAlpha * (signal - this.postLpfState);
      signal = SynthConstants.POST_LPF_MIX_FILTERED * this.postLpfState + SynthConstants.POST_LPF_MIX_DRY * signal;

      // Volume scaling
      signal *= SynthConstants.MASTER_VOLUME;

      channel[i] = signal;
    }

    // Copy to other channels
    for (let c = 1; c < output.length; c++) {
      if (output[c]) output[c].set(channel);
    }

    return true;
  }
}

registerProcessor('engine-processor', EngineProcessor);
