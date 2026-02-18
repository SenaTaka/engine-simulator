class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
    this.lpfState = 0;
    this.bpfState = 0;
    
    // Pre-calculate random phase offsets for each harmonic to break phase coherence
    // This makes it sound less like a synth/organ
    this.phaseOffsets = new Float32Array(32).map(() => Math.random() * 2 * Math.PI);
  }

  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 1000, minValue: 0, maxValue: 12000 },
      { name: 'throttle', defaultValue: 0.15, minValue: 0, maxValue: 1 },
      { name: 'ncyl', defaultValue: 4, minValue: 1, maxValue: 12 },
      { name: 'noiseGain', defaultValue: 0.1, minValue: 0, maxValue: 1 }
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
    
    // Constant for harmonic count
    const n_harm = 24;
    const nyquist = sampleRate / 2;

    for (let i = 0; i < channel.length; i++) {
      // Get current parameters
      const rpm = rpmParams.length > 1 ? rpmParams[i] : rpmParams[0];
      const throttle = throttleParams.length > 1 ? throttleParams[i] : throttleParams[0];
      const ncyl = ncylParams.length > 1 ? ncylParams[i] : ncylParams[0];
      const noiseGain = noiseGainParams.length > 1 ? noiseGainParams[i] : noiseGainParams[0];

      // 1. Fundamental Frequency & Jitter
      const jitterAmount = 0.002 + 0.005 * (1.0 - throttle);
      const jitter = 1.0 + (Math.random() - 0.5) * jitterAmount;

      const f_fire = (rpm / 60.0) * (ncyl / 2.0) * jitter;
      const phaseInc = (2.0 * Math.PI * f_fire) / sampleRate;
      
      this.phase += phaseInc;
      if (this.phase > 2.0 * Math.PI) {
        this.phase -= 2.0 * Math.PI;
      }

      // 2. Harmonic Synthesis (Anti-aliased)
      const alpha = 1.3 - 0.9 * throttle;
      
      let signal = 0;
      
      for (let k = 1; k <= n_harm; k++) {
        const freq = k * f_fire;
        
        // Anti-aliasing: Skip harmonics above Nyquist frequency
        if (freq >= nyquist) break;

        // Amplitude decay
        let amp = 1.0 / Math.pow(k, alpha);

        // Reduce high harmonics amplitude further to avoid "buzz"
        // Frequencies above 4kHz roll off
        if (freq > 4000) {
            amp *= Math.max(0, 1.0 - (freq - 4000) / 10000);
        }

        // Use pre-calculated phase offset for organic sound
        // k * this.phase aligns them perfectly (sawtooth-like) -> electronic sound
        // Adding offset breaks this perfect alignment
        signal += amp * Math.sin(k * this.phase + this.phaseOffsets[k]);
      }

      // 3. Intake/Mechanical Noise
      const white = (Math.random() * 2.0 - 1.0);
      const noiseLpfAlpha = 0.1 + 0.3 * throttle; 
      this.lpfState += noiseLpfAlpha * (white - this.lpfState);
      const noiseComp = noiseGain * (0.5 + 2.0 * throttle) * this.lpfState;
      signal += noiseComp;

      // 4. Body Resonance
      this.bpfState += 0.02 * (signal - this.bpfState);
      signal += 0.6 * this.bpfState; 

      // 5. Distortion
      const drive = 1.0 + 3.0 * throttle;
      signal = Math.tanh(drive * signal);

      // Volume scaling
      signal *= 0.35;

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
