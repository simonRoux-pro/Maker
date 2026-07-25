import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'maker:';

export async function getItem<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function setItem<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export async function removeAll(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const ours = keys.filter((k) => k.startsWith(PREFIX));
  await AsyncStorage.removeMany(ours);
}

export const StorageKeys = {
  profile: 'profile',
  permissions: 'permissions',
  progress: 'progress',
  contacts: 'contacts',
  coachSettings: 'coachSettings',
  webhookSettings: 'webhookSettings',
  onboardingDone: 'onboardingDone',
} as const;
