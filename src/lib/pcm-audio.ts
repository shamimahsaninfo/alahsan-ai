export function encodePcm(input: Float32Array, sampleRate: number): string {
  const length = Math.floor(input.length * 16000 / sampleRate);
  const bytes = new Uint8Array(length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < length; i++) {
    const from = Math.floor(i * sampleRate / 16000);
    const to = Math.min(input.length, Math.max(from + 1, Math.floor((i + 1) * sampleRate / 16000)));
    let sum = 0;
    for (let j = from; j < to; j++) sum += input[j] ?? 0;
    const value = Math.max(-1, Math.min(1, sum / (to - from)));
    view.setInt16(i * 2, value * (value < 0 ? 32768 : 32767), true);
  }
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}
export function decodePcm(data: string): Float32Array {
  const binary = atob(data);
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const output = new Float32Array(Math.floor(bytes.length / 2));
  for (let i = 0; i < output.length; i++) output[i] = view.getInt16(i * 2, true) / 32768;
  return output;
}