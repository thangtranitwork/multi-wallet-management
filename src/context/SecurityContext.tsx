import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import * as LocalAuthentication from 'expo-local-authentication';
import * as queries from '../database/queries';
import { setHapticsEnabled as setGlobalHaptics } from '../utils/haptics';
import { saveWidgetData, syncWidgetData } from '../services/widgetSyncService';
import { hashPin, verifyPinHash } from '../utils/security';

interface SecurityContextType {
  isLocked: boolean;
  isAppLockEnabled: boolean;
  useFingerprint: boolean;
  hasPinCode: boolean;
  isHardwareSupported: boolean;
  hapticsEnabled: boolean;
  autoLockTimeout: number;
  unlockApp: () => void;
  lockApp: () => void;
  authenticateWithFingerprint: () => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  updatePinCode: (newPin: string) => Promise<void>;
  toggleAppLock: (enabled: boolean) => Promise<void>;
  toggleFingerprint: (enabled: boolean) => Promise<void>;
  toggleHaptics: (enabled: boolean) => Promise<void>;
  updateAutoLockTimeout: (seconds: number) => Promise<void>;
  temporarilyBypassLock: (durationMs?: number) => void;
}

const SecurityContext = createContext<SecurityContextType | undefined>(undefined);

export const SecurityProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const db = useSQLiteContext();

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isAppLockEnabled, setIsAppLockEnabled] = useState<boolean>(false);
  const [useFingerprint, setUseFingerprint] = useState<boolean>(false);
  const [hasPinCode, setHasPinCode] = useState<boolean>(false);
  const [isHardwareSupported, setIsHardwareSupported] = useState<boolean>(false);
  const [hapticsEnabled, setHapticsEnabled] = useState<boolean>(true);
  const [autoLockTimeout, setAutoLockTimeout] = useState<number>(30);

  const storedPinHashRef = useRef<string>('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const isAppLockEnabledRef = useRef<boolean>(false);
  const autoLockTimeoutRef = useRef<number>(30);
  const bypassLockUntilRef = useRef<number>(0);
  const lastBackgroundTimeRef = useRef<number>(0);

  // Khởi tạo và đọc cấu hình từ SQLite
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      if (!db) return;
      try {
        const lockVal = await queries.getAppSetting(db, 'is_app_lock_enabled', 'false');
        const fpVal = await queries.getAppSetting(db, 'use_fingerprint', 'false');
        let pinHash = await queries.getAppSetting(db, 'pin_hash', '');
        const legacyPin = await queries.getAppSetting(db, 'pin_code', '');

        // Tự động nâng cấp mã PIN cũ (plaintext) sang định dạng salted hash an toàn
        if (!pinHash && legacyPin) {
          const { encoded } = await hashPin(legacyPin);
          await queries.setAppSetting(db, 'pin_hash', encoded);
          await queries.setAppSetting(db, 'pin_code', '');
          pinHash = encoded;
        }

        const hapticsVal = await queries.getAppSetting(db, 'haptics_enabled', 'true');
        const timeoutVal = await queries.getAppSetting(db, 'auto_lock_timeout', '30');
        const [hasHw, isEnrolled] = await Promise.all([
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);

        if (!isMounted) return;

        const hasPin = pinHash.length > 0;
        let lockEnabled = lockVal === 'true';

        // Tuyệt đối không cho phép bật khóa nếu chưa thiết lập mã PIN
        if (lockEnabled && !hasPin) {
          await queries.setAppSetting(db, 'is_app_lock_enabled', 'false');
          lockEnabled = false;
        }

        const fpEnabled = fpVal === 'true';
        const haptics = hapticsVal !== 'false';
        const parsedTimeout = parseInt(timeoutVal, 10);
        const timeout = isNaN(parsedTimeout) ? 30 : parsedTimeout;

        setIsAppLockEnabled(lockEnabled);
        isAppLockEnabledRef.current = lockEnabled;
        setUseFingerprint(fpEnabled);
        storedPinHashRef.current = pinHash;
        setHasPinCode(hasPin);
        setIsHardwareSupported(hasHw && isEnrolled);
        setHapticsEnabled(haptics);
        setGlobalHaptics(haptics);
        setAutoLockTimeout(timeout);
        autoLockTimeoutRef.current = timeout;

        // Nếu người dùng đã bật khóa và có PIN, khóa ngay khi khởi động app lần đầu
        if (lockEnabled && hasPin) {
          setIsLocked(true);
        }
      } catch (err) {
        console.warn('Lỗi khi tải cấu hình bảo mật:', err);
      }
    }

    loadSettings();

    // Lắng nghe trạng thái ứng dụng (Background -> Active)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      const isGoingBackground = nextAppState.match(/inactive|background/);
      const isComingActive =
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active';

      if (isGoingBackground) {
        lastBackgroundTimeRef.current = Date.now();
      }

      if (isComingActive) {
        const now = Date.now();
        const isBypassed = now < bypassLockUntilRef.current;
        const elapsedSec =
          lastBackgroundTimeRef.current > 0
            ? (now - lastBackgroundTimeRef.current) / 1000
            : 999;

        // Xóa cờ bypass tạm thời sau khi đã active trở lại
        bypassLockUntilRef.current = 0;

        if (!isBypassed && isAppLockEnabledRef.current) {
          if (elapsedSec >= autoLockTimeoutRef.current) {
            setIsLocked(true);
          }
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, [db]);

  const unlockApp = useCallback(() => {
    setIsLocked(false);
  }, []);

  const lockApp = useCallback(() => {
    setIsLocked(true);
  }, []);

  const temporarilyBypassLock = useCallback((durationMs: number = 90000) => {
    bypassLockUntilRef.current = Date.now() + durationMs;
  }, []);

  const authenticateWithFingerprint = useCallback(async (): Promise<boolean> => {
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHw || !isEnrolled) {
        return false;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Quét vân tay để mở khóa ứng dụng',
        fallbackLabel: 'Sử dụng mã PIN',
        cancelLabel: 'Hủy',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, []);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!storedPinHashRef.current) return false;
    const isValid = await verifyPinHash(pin, storedPinHashRef.current);
    if (isValid) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const updatePinCode = useCallback(
    async (newPin: string): Promise<void> => {
      if (!newPin || newPin.trim().length === 0) {
        await queries.setAppSetting(db, 'pin_hash', '');
        await queries.setAppSetting(db, 'pin_code', '');
        storedPinHashRef.current = '';
        setHasPinCode(false);
        return;
      }
      const { encoded } = await hashPin(newPin);
      await queries.setAppSetting(db, 'pin_hash', encoded);
      await queries.setAppSetting(db, 'pin_code', ''); // Xóa bỏ hoàn toàn plaintext cũ nếu có
      storedPinHashRef.current = encoded;
      setHasPinCode(true);
    },
    [db]
  );

  const toggleAppLock = useCallback(
    async (enabled: boolean): Promise<void> => {
      if (enabled && (!storedPinHashRef.current || storedPinHashRef.current.length === 0)) {
        throw new Error('Bạn cần thiết lập mã PIN trước khi bật tính năng khóa ứng dụng.');
      }
      await queries.setAppSetting(db, 'is_app_lock_enabled', enabled ? 'true' : 'false');
      setIsAppLockEnabled(enabled);
      isAppLockEnabledRef.current = enabled;
      if (!enabled) {
        setIsLocked(false);
      }
      syncWidgetData({ isAppLockEnabled: enabled });
    },
    [db]
  );

  const toggleFingerprint = useCallback(
    async (enabled: boolean): Promise<void> => {
      await queries.setAppSetting(db, 'use_fingerprint', enabled ? 'true' : 'false');
      setUseFingerprint(enabled);
    },
    [db]
  );

  const toggleHaptics = useCallback(
    async (enabled: boolean): Promise<void> => {
      await queries.setAppSetting(db, 'haptics_enabled', enabled ? 'true' : 'false');
      setHapticsEnabled(enabled);
      setGlobalHaptics(enabled);
    },
    [db]
  );

  const updateAutoLockTimeout = useCallback(
    async (seconds: number): Promise<void> => {
      await queries.setAppSetting(db, 'auto_lock_timeout', String(seconds));
      setAutoLockTimeout(seconds);
      autoLockTimeoutRef.current = seconds;
    },
    [db]
  );

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        isAppLockEnabled,
        useFingerprint,
        hasPinCode,
        isHardwareSupported,
        hapticsEnabled,
        autoLockTimeout,
        unlockApp,
        lockApp,
        authenticateWithFingerprint,
        verifyPin,
        updatePinCode,
        toggleAppLock,
        toggleFingerprint,
        toggleHaptics,
        updateAutoLockTimeout,
        temporarilyBypassLock,
      }}
    >
      {children}
    </SecurityContext.Provider>
  );
};

export const useSecurity = (): SecurityContextType => {
  const context = useContext(SecurityContext);
  if (!context) {
    throw new Error('useSecurity phải được dùng bên trong SecurityProvider');
  }
  return context;
};
