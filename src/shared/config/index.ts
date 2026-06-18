export const FEATURE_FLAGS = {
  lanSync: false,
  encryption: false,
  ephemeralChats: false,
  cloudApis: false,
} as const;

export const APP_CONSTANTS = {
  dbName: "capsule.db",
  mmkvId: "capsule",
  maxContentWidth: 800,
  bottomTabInset: { ios: 50, android: 80 },
} as const;
