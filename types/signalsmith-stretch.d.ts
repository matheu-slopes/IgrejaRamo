declare module "signalsmith-stretch" {
  export type StretchSchedule = {
    output?: number;
    outputTime?: number;
    input?: number;
    active?: boolean;
    rate?: number;
    semitones?: number;
    formantCompensation?: boolean;
    formantBaseHz?: number;
    loopStart?: number;
    loopEnd?: number;
  };
  export interface StretchNode extends AudioWorkletNode {
    inputTime: number;
    configure(config: {
      blockMs: number;
      intervalMs: number;
      splitComputation: boolean;
    }): Promise<void>;
    schedule(config: StretchSchedule): Promise<StretchSchedule>;
    addBuffers(
      buffers: Float32Array[],
      transfer?: ArrayBuffer[],
    ): Promise<number>;
    dropBuffers(): Promise<unknown>;
    latency(): Promise<number>;
  }
  const create: {
    (
      context: BaseAudioContext,
      options?: AudioWorkletNodeOptions,
    ): Promise<StretchNode>;
    moduleUrl?: string;
  };
  export default create;
}
