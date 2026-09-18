type BeatBuffer = Pick<AudioBuffer, "duration" | "length" | "numberOfChannels" | "sampleRate" | "getChannelData">;

/**
 * Finds the phase of a known BPM in a decoded stem. This is deliberately
 * bounded: it analyses at most 75 seconds and works on short amplitude-flux
 * frames, so it can run once in the browser without delaying playback.
 */
export function estimateBeatOffset(buffer: BeatBuffer, bpm: number): number | null {
  if (!Number.isFinite(bpm) || bpm < 30 || bpm > 300 || !buffer.numberOfChannels)
    return null;
  const framesToRead = Math.min(buffer.length, Math.floor(buffer.sampleRate * 75));
  const hop = Math.max(256, Math.round(buffer.sampleRate * 0.02));
  const frameCount = Math.floor(framesToRead / hop);
  if (frameCount < 40) return null;
  const left = buffer.getChannelData(0);
  const right = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : left;
  const energy = new Float64Array(frameCount);
  let previous = 0;
  for (let frame = 0; frame < frameCount; frame++) {
    let flux = 0;
    const end = Math.min(framesToRead, (frame + 1) * hop);
    for (let sample = frame * hop; sample < end; sample++) {
      const value = Math.abs((left[sample] + right[sample]) * 0.5);
      flux += Math.max(0, value - previous);
      previous = value;
    }
    energy[frame] = flux / hop;
  }
  const onset = new Float64Array(frameCount);
  for (let frame = 8; frame < frameCount; frame++) {
    let average = 0;
    for (let before = frame - 8; before < frame; before++) average += energy[before];
    onset[frame] = Math.max(0, energy[frame] - average / 8);
  }
  const periodFrames = (60 / bpm) * buffer.sampleRate / hop;
  const candidates = Math.max(1, Math.round(periodFrames));
  let bestScore = -1;
  let totalScore = 0;
  let best = 0;
  for (let candidate = 0; candidate < candidates; candidate++) {
    let score = 0;
    for (let frame = candidate; frame < frameCount; frame += periodFrames) {
      const index = Math.round(frame);
      score += onset[index] ?? 0;
      score += (onset[index - 1] ?? 0) * 0.5;
      score += (onset[index + 1] ?? 0) * 0.5;
    }
    totalScore += score;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  // A flat score means the stem has no dependable rhythmic pulse.
  if (bestScore <= 0 || bestScore < (totalScore / candidates) * 1.12) return null;
  return Number((best * hop / buffer.sampleRate).toFixed(3));
}
