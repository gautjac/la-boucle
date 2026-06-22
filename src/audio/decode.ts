/** Decode an audio file blob to an AudioBuffer and compute compact peaks. */

export interface DecodedAudio {
  buffer: AudioBuffer;
  peaks: number[]; // interleaved min,max pairs, mono-summed
}

const PEAK_BUCKETS = 2400;

export function computePeaks(buffer: AudioBuffer, buckets = PEAK_BUCKETS): number[] {
  const chans = buffer.numberOfChannels;
  const len = buffer.length;
  const data: Float32Array[] = [];
  for (let c = 0; c < chans; c++) data.push(buffer.getChannelData(c));

  const peaks = new Array<number>(buckets * 2);
  const block = Math.max(1, Math.floor(len / buckets));

  for (let b = 0; b < buckets; b++) {
    const start = b * block;
    const end = Math.min(len, start + block);
    let min = 1;
    let max = -1;
    for (let i = start; i < end; i++) {
      // mono sum
      let s = 0;
      for (let c = 0; c < chans; c++) s += data[c][i];
      s /= chans;
      if (s < min) min = s;
      if (s > max) max = s;
    }
    if (end <= start) {
      min = 0;
      max = 0;
    }
    peaks[b * 2] = min;
    peaks[b * 2 + 1] = max;
  }
  return peaks;
}

export async function decodeBlob(blob: Blob): Promise<DecodedAudio> {
  const arrayBuf = await blob.arrayBuffer();
  // a throwaway context just for decoding
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const buffer = await ctx.decodeAudioData(arrayBuf.slice(0));
    const peaks = computePeaks(buffer);
    return { buffer, peaks };
  } finally {
    ctx.close();
  }
}

export const ACCEPTED =
  "audio/*,.mp3,.m4a,.aac,.wav,.flac,.ogg,.opus,.aiff,.aif,.wma";

export function isAudioFile(file: File): boolean {
  if (file.type.startsWith("audio/")) return true;
  return /\.(mp3|m4a|aac|wav|flac|ogg|opus|aiff?|wma)$/i.test(file.name);
}
