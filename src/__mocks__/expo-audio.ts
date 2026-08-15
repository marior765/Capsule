// Mock for expo-audio — tests must never touch a real microphone.
//
// expo-audio's recording API is hook-centric (`useAudioRecorder`), which
// shared/stt can't use — it's a plain function module, not a component. The
// real, non-hook path is `AudioModule.AudioRecorder`, a constructable class
// exported from the package. This mocks exactly that surface.

export type MockPermissionResponse = {
  status: "granted" | "undetermined" | "denied";
  expires: "never";
  granted: boolean;
  canAskAgain: boolean;
};

let nextPermission: MockPermissionResponse = {
  status: "granted",
  expires: "never",
  granted: true,
  canAskAgain: true,
};

export function __setNextPermission(granted: boolean): void {
  nextPermission = {
    status: granted ? "granted" : "denied",
    expires: "never",
    granted,
    canAskAgain: true,
  };
}

export const requestRecordingPermissionsAsync = jest.fn(
  async (): Promise<MockPermissionResponse> => nextPermission,
);

export const RecordingPresets = {
  HIGH_QUALITY: {
    extension: ".m4a",
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 128000,
  },
  LOW_QUALITY: {
    extension: ".m4a",
    sampleRate: 44100,
    numberOfChannels: 2,
    bitRate: 64000,
  },
};

let nextRecordingUri: string | null = "file:///mock/recording.m4a";

export function __setNextRecordingUri(uri: string | null): void {
  nextRecordingUri = uri;
}

class MockAudioRecorderInstance {
  uri: string | null = null;
  isRecording = false;
  options: Record<string, unknown>;

  constructor(options: Record<string, unknown>) {
    this.options = options;
  }

  prepareToRecordAsync = jest.fn(async (): Promise<void> => {});

  record = jest.fn((): void => {
    this.isRecording = true;
  });

  stop = jest.fn(async (): Promise<void> => {
    this.isRecording = false;
    this.uri = nextRecordingUri;
  });
}

/**
 * A jest mock *function* wrapping the instance class, rather than the class
 * itself — `startRecording` calls `new AudioRecorder(options)`, and tests
 * assert on which options it was constructed with. A plain ES class isn't a
 * jest mock and can't be asserted against; a `jest.fn` that constructs the
 * real instance underneath is both `new`-able and inspectable.
 */
export const AudioRecorder = jest
  .fn()
  .mockImplementation(
    (options: Record<string, unknown>) =>
      new MockAudioRecorderInstance(options),
  ) as unknown as new (
  options: Record<string, unknown>,
) => MockAudioRecorderInstance;

export const AudioModule = { AudioRecorder };

export function __resetAudioMock(): void {
  requestRecordingPermissionsAsync.mockClear();
  (AudioRecorder as unknown as jest.Mock).mockClear();
  nextPermission = {
    status: "granted",
    expires: "never",
    granted: true,
    canAskAgain: true,
  };
  nextRecordingUri = "file:///mock/recording.m4a";
}
