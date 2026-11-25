let audioContext = null;
let noiseBuffer = null;

export function playCardSound(revolution = false) {
  if (!window.AudioContext) return;

  audioContext ??= new window.AudioContext();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }

  if (!noiseBuffer) {
    const duration = 0.7;
    const buffer = audioContext.createBuffer(
      1,
      Math.ceil(audioContext.sampleRate * duration),
      audioContext.sampleRate
    );
    const samples = buffer.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = Math.random() * 2 - 1;
    }
    noiseBuffer = buffer;
  }

  const now = audioContext.currentTime;
  if (revolution) {
    playRevolutionSound(now);
    return;
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const volume = audioContext.createGain();
  source.buffer = noiseBuffer;
  filter.type = "bandpass";
  filter.frequency.setValueAtTime(1100, now);
  filter.frequency.exponentialRampToValueAtTime(2600, now + 0.07);
  filter.Q.setValueAtTime(0.7, now);
  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.linearRampToValueAtTime(0.16, now + 0.012);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
  source.connect(filter);
  filter.connect(volume);
  volume.connect(audioContext.destination);
  source.start(now);
  source.stop(now + 0.18);
}

function playRevolutionSound(now) {
  const bass = audioContext.createOscillator();
  const bassVolume = audioContext.createGain();
  bass.type = "sine";
  bass.frequency.setValueAtTime(78, now);
  bass.frequency.exponentialRampToValueAtTime(38, now + 0.72);
  bassVolume.gain.setValueAtTime(0.0001, now);
  bassVolume.gain.linearRampToValueAtTime(0.38, now + 0.025);
  bassVolume.gain.exponentialRampToValueAtTime(0.0001, now + 0.76);
  bass.connect(bassVolume);
  bassVolume.connect(audioContext.destination);
  bass.start(now);
  bass.stop(now + 0.78);

  const tone = audioContext.createOscillator();
  const toneFilter = audioContext.createBiquadFilter();
  const toneVolume = audioContext.createGain();
  tone.type = "triangle";
  tone.frequency.setValueAtTime(118, now);
  tone.frequency.exponentialRampToValueAtTime(54, now + 0.55);
  toneFilter.type = "lowpass";
  toneFilter.frequency.setValueAtTime(420, now);
  toneFilter.frequency.exponentialRampToValueAtTime(110, now + 0.62);
  toneVolume.gain.setValueAtTime(0.0001, now);
  toneVolume.gain.linearRampToValueAtTime(0.12, now + 0.035);
  toneVolume.gain.exponentialRampToValueAtTime(0.0001, now + 0.68);
  tone.connect(toneFilter);
  toneFilter.connect(toneVolume);
  toneVolume.connect(audioContext.destination);
  tone.start(now);
  tone.stop(now + 0.7);

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const volume = audioContext.createGain();
  source.buffer = noiseBuffer;
  filter.type = "lowpass";
  filter.frequency.setValueAtTime(900, now);
  filter.frequency.exponentialRampToValueAtTime(140, now + 0.5);
  volume.gain.setValueAtTime(0.0001, now);
  volume.gain.linearRampToValueAtTime(0.15, now + 0.025);
  volume.gain.exponentialRampToValueAtTime(0.0001, now + 0.56);
  source.connect(filter);
  filter.connect(volume);
  volume.connect(audioContext.destination);
  source.start(now);
  source.stop(now + 0.58);
}
