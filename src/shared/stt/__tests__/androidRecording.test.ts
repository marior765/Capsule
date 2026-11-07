// Tests for step 10.42 — written before implementation (TDD)
//
// Android's MediaRecorder can't write WAV, and whisper.rn reads only 16-bit
// PCM WAV, so Android voice input recorded AAC and every transcription
// failed. On Android, startRecording now streams raw PCM with
// @fugood/react-native-audio-pcm-stream and stop() writes a WAV file itself.
//
// Each test loads shared/stt in a fresh module registry, with the mocks taken
// from that same registry. Platform.OS is set to "android" in both the fresh
// registry (read at load time) and the main one: react-native's `Platform`
// export is a lazy getter, so code running after isolateModules returns reads
// the main registry's Platform. afterEach puts it back to "ios".
type Stt = typeof import("../index");
type PcmMock = typeof import("@/__mocks__/react-native-audio-pcm-stream");
type AudioMock = typeof import("@/__mocks__/expo-audio");
type FsMock = typeof import("@/__mocks__/expo-file-system");

function loadOnAndroid(): {
  stt: Stt;
  pcm: PcmMock;
  audio: AudioMock;
  fs: FsMock;
} {
  let loaded:
    | { stt: Stt; pcm: PcmMock; audio: AudioMock; fs: FsMock }
    | undefined;
  Object.defineProperty(
    jest.requireActual<typeof import("react-native")>("react-native").Platform,
    "OS",
    { value: "android", configurable: true },
  );
  jest.isolateModules(() => {
    const { Platform } =
      jest.requireActual<typeof import("react-native")>("react-native");
    Object.defineProperty(Platform, "OS", {
      value: "android",
      configurable: true,
    });
    const pcm = jest.requireActual<PcmMock>(
      "@fugood/react-native-audio-pcm-stream",
    );
    const audio = jest.requireActual<AudioMock>("expo-audio");
    const fs = jest.requireActual<FsMock>("expo-file-system");
    pcm.__resetPcmMock();
    audio.__resetAudioMock();
    fs.__resetFsMock();
    const stt = jest.requireActual<Stt>("../index");
    loaded = { stt, pcm, audio, fs };
  });
  if (!loaded) throw new Error("not loaded");
  return loaded;
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  const { Platform } =
    jest.requireActual<typeof import("react-native")>("react-native");
  Object.defineProperty(Platform, "OS", { value: "ios", configurable: true });
});

/** Stops, lets the native drain window pass, and returns stop()'s result. */
async function stopAndDrain(
  stt: Stt,
  handle: { stop: () => Promise<{ uri: string }> },
): Promise<{ uri: string }> {
  const stopped = handle.stop();
  await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS);
  return stopped;
}

const recordedFile = (fs: FsMock, uri: string): Uint8Array => {
  const bytes = fs.__fileContents.get(uri);
  if (!bytes) throw new Error(`no file at ${uri}`);
  return bytes;
};

describe("startRecording on Android (10.42)", () => {
  it("captures 16 kHz mono 16-bit PCM from the voice-recognition source", async () => {
    const { stt, pcm, audio } = loadOnAndroid();
    await stt.startRecording();

    expect(pcm.init).toHaveBeenCalledWith(
      expect.objectContaining({
        sampleRate: 16000,
        channels: 1,
        bitsPerSample: 16,
        audioSource: 6,
      }),
    );
    expect(pcm.start).toHaveBeenCalledTimes(1);
    expect(pcm.init.mock.invocationCallOrder[0]).toBeLessThan(
      pcm.start.mock.invocationCallOrder[0],
    );
    // Not the AAC MediaRecorder path any more.
    expect(audio.AudioRecorder).not.toHaveBeenCalled();
  });

  it("asks for microphone permission first and refuses without it", async () => {
    const { stt, pcm, audio } = loadOnAndroid();
    audio.__setNextPermission(false);

    await expect(stt.startRecording()).rejects.toThrow(
      "Microphone permission was not granted",
    );
    expect(pcm.init).not.toHaveBeenCalled();
    expect(pcm.start).not.toHaveBeenCalled();
  });

  it("stop() writes the captured PCM as a WAV file and returns its uri", async () => {
    const { stt, pcm, fs } = loadOnAndroid();
    const handle = await stt.startRecording();
    pcm.__emitPcm(new Uint8Array([1, 2, 3, 4]));
    pcm.__emitPcm(new Uint8Array([5, 6]));

    const { uri } = await stopAndDrain(stt, handle);

    expect(uri).toMatch(/^file:\/\/\/cache\/Recordings\/.+\.wav$/);
    const wav = recordedFile(fs, uri);
    expect(String.fromCharCode(...wav.slice(0, 4))).toBe("RIFF");
    expect(String.fromCharCode(...wav.slice(8, 12))).toBe("WAVE");
    expect(new DataView(wav.buffer, wav.byteOffset).getUint32(24, true)).toBe(
      16000,
    );
    expect([...wav.slice(44)]).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("stops the native stream and its listener on stop()", async () => {
    const { stt, pcm } = loadOnAndroid();
    const handle = await stt.startRecording();
    pcm.__emitPcm(new Uint8Array([1, 2]));
    await stopAndDrain(stt, handle);

    expect(pcm.stop).toHaveBeenCalledTimes(1);
    expect(pcm.removeListener).toHaveBeenCalledTimes(1);
    expect(pcm.__hasListener()).toBe(false);
  });

  // Reviewer finding (10.42): the native stop() only flags the read thread,
  // which finishes the buffer it is reading and emits it AFTER stop() — and
  // events reach JS asynchronously. Removing the listener at once dropped the
  // end of every recording.
  it("keeps the last buffer the native side emits after stop()", async () => {
    const { stt, pcm, fs } = loadOnAndroid();
    const handle = await stt.startRecording();
    pcm.__emitPcm(new Uint8Array([1, 2]));

    const stopped = handle.stop();
    expect(pcm.stop).toHaveBeenCalledTimes(1);
    pcm.__emitPcm(new Uint8Array([3, 4])); // the in-flight buffer
    await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS);
    const { uri } = await stopped;

    expect([...recordedFile(fs, uri).slice(44)]).toEqual([1, 2, 3, 4]);
  });

  it("ignores audio that arrives after the drain window", async () => {
    const { stt, pcm, fs } = loadOnAndroid();
    const handle = await stt.startRecording();
    pcm.__emitPcm(new Uint8Array([1, 2]));
    const listener = pcm.on.mock.calls[0][1];
    const { uri } = await stopAndDrain(stt, handle);
    listener(btoa("\u0009\u0009"));

    expect([...recordedFile(fs, uri).slice(44)]).toEqual([1, 2]);
  });

  // Reviewer finding (10.42): the native module keeps one shared recorder,
  // and its read thread lives on for up to a buffer after stop(). A quick
  // re-press that called init() meanwhile replaced the open recorder and
  // could crash the app. The next recording waits for the drain.
  it("a quick re-press waits for the previous recording to finish draining", async () => {
    const { stt, pcm } = loadOnAndroid();
    const first = await stt.startRecording();
    pcm.__emitPcm(new Uint8Array([1, 2]));
    const firstStopped = first.stop();

    const secondStarted = stt.startRecording();
    await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS - 1);
    expect(pcm.init).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await firstStopped;
    await secondStarted;
    expect(pcm.init).toHaveBeenCalledTimes(2);
  });

  // Reviewer finding (10.42, round 2): one shared "settled" promise let two
  // presses queued behind the same drain start together. Each recording
  // takes its own turn: the third waits for the second's stop and drain.
  it("recordings queued behind one drain start one at a time", async () => {
    const { stt, pcm } = loadOnAndroid();
    const first = await stt.startRecording();
    pcm.__emitPcm(new Uint8Array([1, 2]));
    const firstStopped = first.stop();
    const secondStarted = stt.startRecording();
    const thirdStarted = stt.startRecording();

    await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS);
    await firstStopped;
    const second = await secondStarted;
    expect(pcm.init).toHaveBeenCalledTimes(2);

    // The third is still waiting for the second recording to finish.
    await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS * 4);
    expect(pcm.init).toHaveBeenCalledTimes(2);

    pcm.__emitPcm(new Uint8Array([3, 4]));
    const secondStopped = second.stop();
    await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS - 1);
    expect(pcm.init).toHaveBeenCalledTimes(2);
    await jest.advanceTimersByTimeAsync(1);
    await secondStopped;
    await thirdStarted;
    expect(pcm.init).toHaveBeenCalledTimes(3);
  });

  it("a failed start gives the next recording its turn", async () => {
    const { stt, pcm } = loadOnAndroid();
    pcm.__setInitError(new Error("AudioRecord initialization failed"));
    await expect(stt.startRecording()).rejects.toThrow("initialization failed");
    pcm.__setInitError(null);

    await stt.startRecording();
    expect(pcm.init).toHaveBeenCalledTimes(2);
  });

  // A failed stop (nothing captured) still drains before the next init.
  it("waits for the drain even when the previous recording captured nothing", async () => {
    const { stt, pcm } = loadOnAndroid();
    const first = await stt.startRecording();
    const firstStopped = first.stop().catch((e: Error) => e);
    const secondStarted = stt.startRecording();
    await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS - 1);
    expect(pcm.init).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(await firstStopped).toEqual(
      new Error("Recording captured no audio"),
    );
    await secondStarted;
    expect(pcm.init).toHaveBeenCalledTimes(2);
  });

  // Reviewer finding (10.42): the native side skips its first two buffers,
  // so a large buffer clipped the first syllable. The device default is used.
  it("leaves the buffer size to the device default", async () => {
    const { stt, pcm } = loadOnAndroid();
    await stt.startRecording();
    expect(pcm.init.mock.calls[0][0]).not.toHaveProperty("bufferSize");
  });

  // A tap too short to deliver a single buffer: nothing for whisper to read.
  it("throws when nothing was captured, and writes no file", async () => {
    const { stt, pcm, fs } = loadOnAndroid();
    const handle = await stt.startRecording();

    const stopped = handle.stop().catch((e: Error) => e);
    await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS);
    expect(await stopped).toEqual(new Error("Recording captured no audio"));
    expect(pcm.stop).toHaveBeenCalledTimes(1);
    expect(fs.__fileContents.size).toBe(0);
  });

  it("cleans up the listener when the native stream fails to start", async () => {
    const { stt, pcm } = loadOnAndroid();
    pcm.__setInitError(new Error("AudioRecord initialization failed"));

    await expect(stt.startRecording()).rejects.toThrow(
      "AudioRecord initialization failed",
    );
    expect(pcm.start).not.toHaveBeenCalled();
    expect(pcm.__hasListener()).toBe(false);
  });

  it("gives each recording its own file", async () => {
    const { stt, pcm } = loadOnAndroid();
    const first = await stt.startRecording();
    pcm.__emitPcm(new Uint8Array([1, 2]));
    const a = await stopAndDrain(stt, first);
    const second = await stt.startRecording();
    pcm.__emitPcm(new Uint8Array([3, 4]));
    const b = await stopAndDrain(stt, second);

    expect(a.uri).not.toBe(b.uri);
  });

  // 10.46 safety net: a missed stop must not wedge the module.
  describe("safety net (10.46)", () => {
    it("stop() twice ends the native stream once and gives the same result", async () => {
      const { stt, pcm } = loadOnAndroid();
      const handle = await stt.startRecording();
      pcm.__emitPcm(new Uint8Array([1, 2]));

      const first = handle.stop();
      const second = handle.stop();
      await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS);

      expect(await second).toEqual(await first);
      expect(pcm.stop).toHaveBeenCalledTimes(1);
    });

    it("a late second stop() can't end the next recording", async () => {
      const { stt, pcm } = loadOnAndroid();
      const first = await stt.startRecording();
      pcm.__emitPcm(new Uint8Array([1, 2]));
      await stopAndDrain(stt, first);
      await stt.startRecording();

      await first.stop();
      expect(pcm.stop).toHaveBeenCalledTimes(1);
    });

    // The UI allows one hold at a time, so a recording still live when the
    // next one starts was stranded (its stop never came).
    it("a new recording force-stops one that was never stopped", async () => {
      const { stt, pcm, fs } = loadOnAndroid();
      const stranded = await stt.startRecording();
      pcm.__emitPcm(new Uint8Array([1, 2]));

      const next = stt.startRecording();
      await jest.advanceTimersByTimeAsync(0); // past the permission check
      expect(pcm.stop).toHaveBeenCalledTimes(1);
      expect(pcm.init).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS);
      await next;
      expect(pcm.init).toHaveBeenCalledTimes(2);

      // Its audio is discarded: no file, and its own stop() says so.
      expect(fs.__fileContents.size).toBe(0);
      await expect(stranded.stop()).rejects.toThrow(
        "Recording was stopped by a newer one",
      );
      expect(pcm.stop).toHaveBeenCalledTimes(1);
    });

    it("a recording that is already stopping is left to finish (not discarded)", async () => {
      const { stt, pcm, fs } = loadOnAndroid();
      const first = await stt.startRecording();
      pcm.__emitPcm(new Uint8Array([1, 2]));
      const firstStopped = first.stop();
      const next = stt.startRecording(); // during the first one's drain
      await jest.advanceTimersByTimeAsync(stt.PCM_DRAIN_MS);

      const { uri } = await firstStopped;
      expect([...recordedFile(fs, uri).slice(44)]).toEqual([1, 2]);
      await next;
    });

    it("names every folder voice recordings are written to, for the wipe", () => {
      const { stt } = loadOnAndroid();
      expect(stt.RECORDING_CACHE_DIRECTORIES).toContain(
        stt.RECORDINGS_CACHE_DIRECTORY,
      );
    });
  });
});
