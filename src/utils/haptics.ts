import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

export function isHapticsEnabled(): boolean {
  return hapticsEnabled;
}

export async function hapticLight(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Ignore unsupported devices
  }
}

export async function hapticMedium(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  } catch {
    // Ignore
  }
}

export async function hapticHeavy(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Ignore
  }
}

export async function hapticSuccess(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Ignore
  }
}

export async function hapticWarning(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  } catch {
    // Ignore
  }
}

export async function hapticError(): Promise<void> {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  } catch {
    // Ignore
  }
}
