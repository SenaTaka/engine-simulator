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
    
    // Pre-calculate random phase offsets for each harmonic to break phase coherence
    // This makes it sound less like a synth/organ
    this.phaseOffsets = new Float32Array(32).map(() => Math.random() * 2 * Math.PI);
    this.harmonicColor = new Float32Array(32).map(() => 0.85 + Math.random() * 0.3);
  }

  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 1000, minValue: 0, maxValue: 12000 },
      { name: 'throttle', defaultValue: 0.15, minValue: 0, maxValue: 1 },
      { name: 'ncyl', defaultValue: 4, minValue: 1, maxValue: 12 },
      { name: 'noiseGain', defaultValue: 0.2, minValue: 0, maxValue: 1 },
      { name: 'turboMode', defaultValue: 0, minValue: 0, maxValue: 1 }
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
      const alpha = 1.35 - 0.85 * throttle;
      const harmonicDamping = Math.max(0.45, 1.0 - (rpm / 12000.0) * 0.5);
      
      let signal = 0;
      
      for (let k = 1; k <= n_harm; k++) {
        const freq = k * f_fire;
        
        // Anti-aliasing: Skip harmonics above Nyquist frequency
        if (freq >= nyquist) break;

        // Amplitude decay
        let amp = 1.0 / Math.pow(k, alpha);
        amp *= this.harmonicColor[k];

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

      const noiseComp = noiseGain * (intakeNoise + mechNoise + combustionNoise + turboWhoosh);
      signal += whistle;
      signal += noiseComp;

      // 4. Body Resonance
      this.bpfState += 0.02 * (signal - this.bpfState);
      signal += 0.6 * this.bpfState; 

      // 5. Distortion
      const drive = 0.9 + 2.2 * throttle;
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
