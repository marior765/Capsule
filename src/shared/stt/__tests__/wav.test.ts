// Tests for step 10.42 — written before implementation (TDD)
//
// Android can't record WAV with MediaRecorder, so it captures raw PCM and
// shared/stt writes the WAV header itself. whisper.rn's reader needs a 16-bit
// PCM WAV with exact RIFF/fmt/data chunks (it resamples to 16 kHz mono
// itself; recording at 16 kHz mono just skips that work).
import { encodeWav } from "../index";

const text = (bytes: Uint8Array, at: number, length: number) =>
  String.fromCharCode(...bytes.slice(at, at + length));
const u32 = (bytes: Uint8Array, at: number) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint32(at, true);
const u16 = (bytes: Uint8Array, at: number) =>
  new DataView(bytes.buffer, bytes.byteOffset).getUint16(at, true);

describe("encodeWav (10.42)", () => {
  const pcm = new Uint8Array([1, 2, 3, 4, 5, 6]);
  const wav = encodeWav(pcm, {
    sampleRate: 16000,
    channels: 1,
    bitsPerSample: 16,
  });

  it("writes a 44-byte canonical PCM WAV header", () => {
    expect(wav.length).toBe(44 + pcm.length);
    expect(text(wav, 0, 4)).toBe("RIFF");
    expect(u32(wav, 4)).toBe(36 + pcm.length);
    expect(text(wav, 8, 4)).toBe("WAVE");
    expect(text(wav, 12, 4)).toBe("fmt ");
    expect(u32(wav, 16)).toBe(16);
    expect(u16(wav, 20)).toBe(1); // linear PCM
    expect(u16(wav, 22)).toBe(1); // mono
    expect(u32(wav, 24)).toBe(16000);
    expect(u32(wav, 28)).toBe(32000); // byte rate = 16000 × 1 × 2
    expect(u16(wav, 32)).toBe(2); // block align
    expect(u16(wav, 34)).toBe(16);
    expect(text(wav, 36, 4)).toBe("data");
    expect(u32(wav, 40)).toBe(pcm.length);
  });

  it("copies the PCM samples unchanged after the header", () => {
    expect([...wav.slice(44)]).toEqual([...pcm]);
  });

  it("derives byte rate and block align from the format", () => {
    const stereo = encodeWav(new Uint8Array(8), {
      sampleRate: 44100,
      channels: 2,
      bitsPerSample: 16,
    });
    expect(u32(stereo, 28)).toBe(44100 * 2 * 2);
    expect(u16(stereo, 32)).toBe(4);
  });

  // A frame is channels × bytesPerSample; a partial last frame would
  // misalign every sample whisper reads after it.
  it("drops a trailing partial frame", () => {
    const odd = encodeWav(new Uint8Array([9, 8, 7]), {
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
    });
    expect(u32(odd, 40)).toBe(2);
    expect([...odd.slice(44)]).toEqual([9, 8]);
  });

  it("encodes an empty recording as a header with no data", () => {
    const empty = encodeWav(new Uint8Array(0), {
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
    });
    expect(empty.length).toBe(44);
    expect(u32(empty, 40)).toBe(0);
  });
});
