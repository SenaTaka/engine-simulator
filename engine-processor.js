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
    this.harmonicColor = new Float32Array(32).map(() => 0.85 + Math.random() * 0.3);

    // Cylinder-to-cylinder variation for more organic combustion
    this.cylinderPhaseOffsets = new Float32Array(12).map(() => Math.random() * 0.08 - 0.04);
    this.cylinderAmplitudes = new Float32Array(12).map(() => 0.92 + Math.random() * 0.16);

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
      { name: 'redlineRpm', defaultValue: 7000, minValue: 3000, maxValue: 12000 }
    ];
  }

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    const channel = output[0];
    
    if (!channel) return true;

    const rpmParams = parameters.rpm;
    const throttleParams = parameters.throttle;
    const ncylParams = parameters.ncyl;
    const noiseGainParams = parameters.noiseGain;
    const turboModeParams = parameters.turboMode;
    const boxerModeParams = parameters.boxerMode;
    const vtecModeParams = parameters.vtecMode;
    const fa24ModeParams = parameters.fa24Mode;
    const redlineRpmParams = parameters.redlineRpm;
    
    // Constant for harmonic count
    const n_harm = 24;
    const nyquist = sampleRate / 2;

    for (let i = 0; i < channel.length; i++) {
      // Get current parameters
      const rpm = rpmParams.length > 1 ? rpmParams[i] : rpmParams[0];
      const throttle = throttleParams.length > 1 ? throttleParams[i] : throttleParams[0];
      const ncyl = ncylParams.length > 1 ? ncylParams[i] : ncylParams[0];
      const noiseGain = noiseGainParams.length > 1 ? noiseGainParams[i] : noiseGainParams[0];
      const turboMode = turboModeParams.length > 1 ? turboModeParams[i] : turboModeParams[0];
      const boxerMode = boxerModeParams.length > 1 ? boxerModeParams[i] : boxerModeParams[0];
      const vtecMode = vtecModeParams.length > 1 ? vtecModeParams[i] : vtecModeParams[0];
      const fa24Mode = fa24ModeParams.length > 1 ? fa24ModeParams[i] : fa24ModeParams[0];
      const redlineRpm = redlineRpmParams.length > 1 ? redlineRpmParams[i] : redlineRpmParams[0];

      // Rev limiter simulation: fuel cut at redline
      let revLimiterCut = 1.0;
      if (rpm > redlineRpm * 0.98) {
        this.revLimiterCycle += 0.15;
        if (this.revLimiterCycle > 1.0) this.revLimiterCycle = 0;
        this.revLimiterActive = true;
        // Hard cut creates distinctive bouncing on/off pattern
        revLimiterCut = this.revLimiterCycle < 0.3 ? 0.05 : 1.0;
      } else {
        this.revLimiterActive = false;
        this.revLimiterCycle = 0;
      }

      // 1. Fundamental Frequency & Jitter
      const jitterAmount = 0.001 + 0.003 * (1.0 - throttle);
      const jitter = 1.0 + (Math.random() - 0.5) * jitterAmount;

      // Very slow random walk on pitch to emulate tiny cycle-to-cycle combustion variation
      this.randomWalk += (Math.random() - 0.5) * 0.00015;
      this.randomWalk *= 0.9995;
      const drift = 1.0 + this.randomWalk;

      const f_fire = (rpm / 60.0) * (ncyl / 2.0) * jitter * drift;
      const phaseInc = (2.0 * Math.PI * f_fire) / sampleRate;
      
      this.phase += phaseInc;
      if (this.phase > 2.0 * Math.PI) {
        this.phase -= 2.0 * Math.PI;
      }

      // 2. Harmonic Synthesis (Anti-aliased)
      // VTEC profile: blend from low-cam tone to high-cam tone around crossover RPM.
      const crossoverCenter = 5600.0;
      const crossoverWidth = 900.0;
      const x = (rpm - (crossoverCenter - crossoverWidth * 0.5)) / crossoverWidth;
      const vtecBlendRaw = Math.min(1.0, Math.max(0.0, x));
      const vtecBlend = vtecMode * (vtecBlendRaw * vtecBlendRaw * (3.0 - 2.0 * vtecBlendRaw));

      const alphaLowCam = 1.35 - 0.85 * throttle;
      const alphaHighCam = 1.00 - 0.55 * throttle;
      const alpha = alphaLowCam + (alphaHighCam - alphaLowCam) * vtecBlend;

      const dampingLowCam = Math.max(0.45, 1.0 - (rpm / 12000.0) * 0.5);
      const dampingHighCam = Math.max(0.35, 1.08 - (rpm / 12000.0) * 0.38);
      const harmonicDamping = dampingLowCam + (dampingHighCam - dampingLowCam) * vtecBlend;

      let signal = 0;

      // FA24: emphasize low-order boxer pulse with slight off-beat wobble.
      const boxerLump = fa24Mode * (0.55 + 0.45 * throttle);
      const boxerWobble = fa24Mode * (0.01 + 0.02 * throttle) * Math.sin(0.5 * this.phase + 0.9);

      // Cylinder-to-cylinder variation: each cylinder fires with slightly different timing/amplitude
      const cylPerRev = ncyl / 2.0;
      const firingInterval = (2.0 * Math.PI) / cylPerRev;
      let cylinderContribution = 0;

      for (let cyl = 0; cyl < Math.min(ncyl, 12); cyl++) {
        const cylPhase = this.phase + cyl * firingInterval + this.cylinderPhaseOffsets[cyl];
        const cylAmp = this.cylinderAmplitudes[cyl];
        const cylPulse = Math.pow(Math.max(0, Math.sin(cylPhase)), 5.0);
        cylinderContribution += cylAmp * cylPulse * 0.15;
      }

      for (let k = 1; k <= n_harm; k++) {
        const freq = k * f_fire;

        // Anti-aliasing: Skip harmonics above Nyquist frequency
        if (freq >= nyquist) break;

        // Amplitude decay
        let amp = 1.0 / Math.pow(k, alpha);
        amp *= this.harmonicColor[k];

        if (fa24Mode > 0.0) {
          if (k <= 3) amp *= 1.0 + boxerLump * (0.95 - 0.2 * k);
          if (k >= 6) amp *= Math.max(0.45, 1.0 - 0.085 * (k - 5) * fa24Mode);
        }

        // High-cam adds stronger high-order content above crossover.
        if (k >= 7) {
          amp *= 1.0 + 0.55 * vtecBlend;
        }

        // Reduce high harmonics amplitude further to avoid "buzz"
        // Frequencies above 4kHz roll off
        if (freq > 4000) {
            amp *= Math.max(0, 1.0 - (freq - 4000) / 10000);
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
      this.boxerPulse = 0.84 * this.boxerPulse + 0.16 * pairedPulse * loping;

      const boxerFund = Math.sin(this.phase * 0.5 + 0.2);
      const boxerOdd = Math.sin(this.phase * 1.5 + 1.0);
      const boxerLow = 0.62 * boxerFund + 0.34 * boxerOdd;
      this.boxerRumbleState += 0.028 * (boxerLow - this.boxerRumbleState);
      const boxerRumble = (0.58 + 0.42 * this.boxerPulse) * this.boxerRumbleState;

      // Shift part of smooth harmonics into lumpy low-mid boxer band.
      signal = signal * (1.0 - 0.22 * boxerMode) + boxerRumble * (0.72 * boxerMode);
      // High-cam lobe texture: slight extra emphasis around 2nd/3rd order at crossover.
      const camLobe = (0.12 + 0.18 * throttle) * vtecBlend;
      signal += camLobe * Math.sin(2.0 * this.phase + 0.2);
      signal += (camLobe * 0.65) * Math.sin(3.0 * this.phase + 0.55);

      // FA24 boxer growl layer: sub/low-mid reinforcement with uneven combustion feel.
      const boxerSub = fa24Mode * (0.22 + 0.28 * throttle) * Math.sin(0.5 * this.phase + 0.35);
      const boxerMid = fa24Mode * (0.14 + 0.22 * throttle) * Math.sin(1.5 * this.phase + 1.1 + boxerWobble);
      signal += boxerSub + boxerMid;

      // 3. Intake/Mechanical/Combustion Noise (multi-band)
      const white = (Math.random() * 2.0 - 1.0);

      // Intake rumble: low-mid broadband that grows strongly with throttle
      const intakeLpfAlpha = 0.05 + 0.18 * throttle;
      this.lpfState += intakeLpfAlpha * (white - this.lpfState);
      const intakeNoise = (0.35 + 1.35 * throttle) * this.lpfState;

      // Mechanical hiss: high-frequency texture, stronger at high RPM
      this.hpfState += 0.055 * (white - this.hpfState);
      const hpf = white - this.hpfState;
      const rpmNorm = Math.min(1.0, rpm / 8000.0);
      const mechNoise = (0.18 + 0.75 * rpmNorm) * hpf;

      // Turbo-like whistle and spool texture
      const turboSpool = turboMode * Math.max(0.0, throttle - 0.2) * Math.min(1.0, rpm / 7000.0);
      const whistleFreq = 900 + 2500 * turboSpool;
      this.turboPhase += (2.0 * Math.PI * whistleFreq) / sampleRate;
      if (this.turboPhase > 2.0 * Math.PI) this.turboPhase -= 2.0 * Math.PI;
      const whistle = Math.sin(this.turboPhase) * (0.12 * turboSpool);
      const turboWhoosh = turboSpool * (0.2 + 0.8 * throttle) * hpf;

      // Combustion crackle: bursty modulation tied to firing phase
      const cycleEnergy = 0.5 + 0.5 * Math.sin(this.phase);
      const burst = Math.pow(cycleEnergy, 3.2);
      this.combPulse = 0.9 * this.combPulse + 0.1 * burst;
      const combustionNoise = this.combPulse * white * (0.2 + 0.9 * throttle);

      // Alternating-bank roughness in the 100-280Hz area for boxer exhaust note.
      const boxerNoiseShape = 0.15 + 0.85 * (0.5 + 0.5 * Math.sin(this.phase * 0.5 + 1.25));
      const boxerNoise = boxerMode * boxerNoiseShape * this.lpfState * (0.45 + 0.95 * throttle);

      const rpmWindow = Math.max(0.0, 1.0 - Math.abs(rpm - 3200.0) / 2600.0);
      const liftOff = Math.max(0.0, 0.35 - throttle) / 0.35;
      const boxerBurble = fa24Mode * rpmWindow * liftOff * (0.16 + 0.22 * (white * white));

      const vtecIntakeEdge = vtecBlend * (0.08 + 0.22 * throttle) * (intakeNoise + 0.6 * hpf);
      const fa24RumbleNoise = fa24Mode * (0.28 + 0.48 * throttle) * this.lpfState;

      // Valvetrain mechanical noise: distinct clicks at valve events
      const valveFreq = f_fire * 2.0; // Twice per revolution (intake + exhaust)
      this.valveClickPhase += (2.0 * Math.PI * valveFreq) / sampleRate;
      if (this.valveClickPhase > 2.0 * Math.PI) this.valveClickPhase -= 2.0 * Math.PI;
      const valveClickEnvelope = Math.pow(Math.max(0, Math.sin(this.valveClickPhase)), 12.0);
      const valveClick = valveClickEnvelope * hpf * (0.08 + 0.12 * (rpm / 8000.0));

      // Deceleration backfire: detect throttle lift and create popping
      const throttleDrop = Math.max(0, this.lastThrottle - throttle);
      this.lastThrottle = throttle;
      const decelWindow = Math.max(0.0, 1.0 - Math.abs(rpm - 4500.0) / 3500.0);
      const backfireTrigger = throttleDrop > 0.3 ? Math.random() : 0;
      this.backfirePulse = Math.max(this.backfirePulse * 0.94, backfireTrigger * decelWindow);
      const backfireNoise = this.backfirePulse * white * white * (0.35 + 0.65 * this.lpfState);

      const noiseComp = noiseGain * (intakeNoise + mechNoise + combustionNoise + turboWhoosh + boxerNoise + vtecIntakeEdge + fa24RumbleNoise + boxerBurble + valveClick + backfireNoise);
      signal += whistle;
      signal += noiseComp;

      // 4. Body Resonance
      this.bpfState += 0.02 * (signal - this.bpfState);
      signal += 0.6 * this.bpfState;

      // 4b. Exhaust Resonance (Formant-like filtering)
      // Three resonant peaks simulate exhaust pipe length and chamber resonances
      // These shift slightly with RPM to mimic real exhaust behavior
      const exhaustRes1Freq = 180 + rpm * 0.02; // Low-mid resonance
      const exhaustRes2Freq = 650 + rpm * 0.04; // Mid resonance
      const exhaustRes3Freq = 1800 + rpm * 0.08; // High-mid resonance

      // Simple resonant filters (2-pole approximation)
      const res1Alpha = Math.min(0.45, (2.0 * Math.PI * exhaustRes1Freq) / sampleRate);
      const res2Alpha = Math.min(0.35, (2.0 * Math.PI * exhaustRes2Freq) / sampleRate);
      const res3Alpha = Math.min(0.25, (2.0 * Math.PI * exhaustRes3Freq) / sampleRate);

      this.exhaustRes1State += res1Alpha * (signal - this.exhaustRes1State);
      this.exhaustRes2State += res2Alpha * (signal - this.exhaustRes2State);
      this.exhaustRes3State += res3Alpha * (signal - this.exhaustRes3State);

      const exhaustResonance = 0.28 * this.exhaustRes1State + 0.22 * this.exhaustRes2State + 0.15 * this.exhaustRes3State;
      signal += exhaustResonance * (0.5 + 0.5 * throttle);

      // Apply rev limiter cut (simulates fuel cut)
      signal *= revLimiterCut; 

      // 5. Distortion
      const drive = 0.9 + 2.2 * throttle + 0.35 * vtecBlend + 0.28 * fa24Mode;
      signal = Math.tanh(drive * signal);

      // Post-filter distortion output to reduce buzzy high-RPM edge
      const postLpfAlpha = 0.12 + 0.10 * throttle;
      this.postLpfState += postLpfAlpha * (signal - this.postLpfState);
      signal = 0.82 * this.postLpfState + 0.18 * signal;

      // Volume scaling
      signal *= 0.34;

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
