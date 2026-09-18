import type { StretchNode } from "signalsmith-stretch";

export type StudioStem = "vocals" | "instrumental" | "drums" | "bass" | "other";
export type StudioEngine = {
  context: AudioContext;
  buffers: Partial<Record<StudioStem, AudioBuffer>>;
  nodes: Partial<Record<StudioStem, StretchNode>>;
  gains: Partial<Record<StudioStem, GainNode>>;
  master: GainNode;
  sources: AudioBufferSourceNode[];
  offset: number;
  started: number;
  playing: boolean;
  duration: number;
  rate: number;
  semitones: number;
  latency: number;
};

export async function createRealtimeStem(
  context: BaseAudioContext,
  buffer: AudioBuffer,
) {
  if (!context.audioWorklet)
    throw Error("Áudio em tempo real indisponível neste navegador.");
  if (buffer.numberOfChannels !== 2)
    throw Error("A faixa precisa estar em estéreo.");
  const { default: create } = await import("signalsmith-stretch");
  // Load the original worklet as a static asset: bundlers can rename closures
  // which the library's generated Blob would otherwise serialize with toString().
  create.moduleUrl = "/audio/signalsmith-stretch-1.3.2.js";
  const node = await create(context, {
    // Signalsmith uses its own buffered PCM when this input is disconnected,
    // but its worklet still expects inputList[0] to exist. Keep one silent
    // input, as in the library's default configuration.
    numberOfInputs: 1,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  try {
    await node.configure({
      blockMs: 120,
      intervalMs: 30,
      splitComputation: true,
    });
    const channels = [0, 1].map(
      (c) => new Float32Array(buffer.getChannelData(c)),
    );
    await node.addBuffers(
      channels,
      channels.map((c) => c.buffer),
    );
    return node;
  } catch (error) {
    node.disconnect();
    node.port.close();
    throw error;
  }
}

export function at(engine: StudioEngine) {
  return (
    engine.offset +
    (engine.playing
      ? Math.max(0, engine.context.currentTime - engine.started) * engine.rate
      : 0)
  );
}

export function stop(engine: StudioEngine) {
  engine.offset = Math.max(0, Math.min(at(engine), engine.duration));
  engine.playing = false;
  for (const node of Object.values(engine.nodes)) {
    void node.schedule({
      active: false,
      output: engine.context.currentTime,
      outputTime: engine.context.currentTime,
    });
  }
  engine.sources.forEach((source) => {
    try {
      source.stop();
    } catch {}
    source.disconnect();
  });
  engine.sources = [];
}

export function start(engine: StudioEngine, offset: number) {
  stop(engine);
  engine.offset = Math.max(0, Math.min(offset, engine.duration - 0.01));
  const when =
    engine.context.currentTime + Math.max(0.03, engine.latency + 0.01);
  for (const [stem, node] of Object.entries(engine.nodes)) {
    void node.schedule({
      active: true,
      input: engine.offset,
      output: when,
      outputTime: when,
      rate: engine.rate,
      semitones: stem === "drums" ? 0 : engine.semitones,
      formantCompensation: stem === "vocals",
      formantBaseHz: 0,
    });
  }
  // Browsers without AudioWorklet retain original playback.
  if (!Object.keys(engine.nodes).length)
    for (const [stem, buffer] of Object.entries(engine.buffers)) {
      const source = engine.context.createBufferSource();
      source.buffer = buffer;
      source.connect(engine.gains[stem as StudioStem]!);
      source.start(when, engine.offset);
      engine.sources.push(source);
    }
  engine.started = when;
  engine.playing = true;
}

export function setRealtimePitch(engine: StudioEngine, semitones: number) {
  if (!Object.keys(engine.nodes).length) return false;
  // One output timestamp for every stereo stem; do not stop, seek or refetch audio.
  const when = Math.max(engine.started, engine.context.currentTime + 0.015);
  for (const [stem, node] of Object.entries(engine.nodes)) {
    void node.schedule({
      output: when,
      outputTime: when,
      semitones: stem === "drums" ? 0 : semitones,
      formantCompensation: stem === "vocals",
      formantBaseHz: 0,
    });
  }
  engine.semitones = semitones;
  return true;
}

export function setRealtimeRate(engine: StudioEngine, rate: number) {
  if (!Object.keys(engine.nodes).length) return false;
  const when = Math.max(engine.started, engine.context.currentTime + 0.015);
  const input =
    engine.offset +
    (engine.playing ? Math.max(0, when - engine.started) * engine.rate : 0);
  for (const node of Object.values(engine.nodes))
    void node.schedule({ output: when, outputTime: when, input, rate });
  engine.offset = input;
  engine.started = when;
  engine.rate = rate;
  return true;
}
