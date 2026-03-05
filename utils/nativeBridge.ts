
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { StatusBar, Style } from '@capacitor/status-bar';

/**
 * Checks if the application is currently running in a native (Android/iOS) container.
 */
export const isNative = (): boolean => {
  return (window as { Capacitor?: { isNativePlatform: () => boolean } }).Capacitor?.isNativePlatform() || false;
};

/**
 * Triggers a light haptic pulse on the device if supported.
 */
export const triggerHaptic = async (style: ImpactStyle = ImpactStyle.Light) => {
  if (isNative()) {
    try {
      await Haptics.impact({ style });
    } catch {
      console.debug('Haptics not supported');
    }
  }
};

/**
 * Optimizes the native Android environment (Status Bar, etc.)
 */
export const initNativeApp = async () => {
  if (isNative()) {
    try {
      await StatusBar.setStyle({ style: Style.Light });
      // Match the KittenReader theme color
      await StatusBar.setBackgroundColor({ color: '#FDFCFB' });
    } catch {
      console.debug('Native UI initialization skipped');
    }
  }
};
