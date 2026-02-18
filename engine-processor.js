class EngineProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.phase = 0;
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

    // Get parameters
    // Automation handling: get array if automated, or single value if constant
    const rpmParams = parameters.rpm;
    const throttleParams = parameters.throttle;
    const ncylParams = parameters.ncyl;
    const noiseGainParams = parameters.noiseGain;
    
    const n_harm = 24;

    for (let i = 0; i < channel.length; i++) {
      // Per-sample automation
      const rpm = rpmParams.length > 1 ? rpmParams[i] : rpmParams[0];
      const throttle = throttleParams.length > 1 ? throttleParams[i] : throttleParams[0];
      const ncyl = ncylParams.length > 1 ? ncylParams[i] : ncylParams[0];
      const noiseGain = noiseGainParams.length > 1 ? noiseGainParams[i] : noiseGainParams[0];

      // Fundamental frequency (firing rate)
      // 4-stroke: RPM / 60 * (ncyl / 2)
      const f_fire = (rpm / 60.0) * (ncyl / 2.0);
      
      // Phase increment
      // phase = 2 * PI * f * t
      // phase += 2 * PI * f_fire / sampleRate
      const phaseInc = (2.0 * Math.PI * f_fire) / sampleRate;
      this.phase += phaseInc;
      
      if (this.phase > 2.0 * Math.PI) {
        this.phase -= 2.0 * Math.PI;
      }

      // Synthesis Logic
      // alpha = 1.2 - 0.8 * throttle
      const alpha = 1.2 - 0.8 * throttle;
      
      let signal = 0;
      
      // Harmonics loop
      for (let k = 1; k <= n_harm; k++) {
        // amp = 1 / k^alpha
        const amp = 1.0 / Math.pow(k, alpha);
        // detune could be added here, but omitted for perf
        signal += amp * Math.sin(k * this.phase);
      }

      // Noise
      // noise = random (-1 to 1)
      const noise = (Math.random() * 2.0 - 1.0);
      
      // Noise component
      // gain * (0.3 + 1.7 * throttle) * noise
      signal += noiseGain * (0.3 + 1.7 * throttle) * noise;

      // Distortion / Saturation
      // drive = 1.0 + 2.5 * throttle
      // y = tanh(drive * y)
      const drive = 1.0 + 2.5 * throttle;
      signal = Math.tanh(drive * signal);

      // Normalize / Volume Control
      // Python does normalization by max. Here we just scale down to prevent clipping.
      // tanh limits to [-1, 1], so we can output directly or scale slightly.
      signal *= 0.5;

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
