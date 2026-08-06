// ZzFX ships no types. Its whole API is one variadic function of sparse numbers.
declare module 'zzfx' {
  export function zzfx(...params: (number | undefined)[]): AudioBufferSourceNode | undefined
  export const zzfxX: AudioContext
}
