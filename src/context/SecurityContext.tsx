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

interface SecurityContextType {
  isLocked: boolean;
  isAppLockEnabled: boolean;
  useFingerprint: boolean;
  hasPinCode: boolean;
  isHardwareSupported: boolean;
  hapticsEnabled: boolean;
  unlockApp: () => void;
  lockApp: () => void;
  authenticateWithFingerprint: () => Promise<boolean>;
  verifyPin: (pin: string) => Promise<boolean>;
  updatePinCode: (newPin: string) => Promise<void>;
  toggleAppLock: (enabled: boolean) => Promise<void>;
  toggleFingerprint: (enabled: boolean) => Promise<void>;
  toggleHaptics: (enabled: boolean) => Promise<void>;
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

  const storedPinRef = useRef<string>('');
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // Khởi tạo và đọc cấu hình từ SQLite
  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const [
          lockVal,
          fpVal,
          pinVal,
          hapticsVal,
          hasHw,
          isEnrolled,
        ] = await Promise.all([
          queries.getAppSetting(db, 'is_app_lock_enabled', 'false'),
          queries.getAppSetting(db, 'use_fingerprint', 'false'),
          queries.getAppSetting(db, 'pin_code', ''),
          queries.getAppSetting(db, 'haptics_enabled', 'true'),
          LocalAuthentication.hasHardwareAsync(),
          LocalAuthentication.isEnrolledAsync(),
        ]);

        if (!isMounted) return;

        const lockEnabled = lockVal === 'true';
        const fpEnabled = fpVal === 'true';
        const haptics = hapticsVal !== 'false';

        setIsAppLockEnabled(lockEnabled);
        setUseFingerprint(fpEnabled);
        storedPinRef.current = pinVal;
        setHasPinCode(pinVal.length > 0);
        setIsHardwareSupported(hasHw && isEnrolled);
        setHapticsEnabled(haptics);
        setGlobalHaptics(haptics);

        // Nếu người dùng đã bật khóa, khóa ngay khi mở app
        if (lockEnabled) {
          setIsLocked(true);
        }
      } catch (err) {
        console.warn('Lỗi khi tải cấu hình bảo mật:', err);
      }
    }

    loadSettings();

    // Lắng nghe trạng thái ứng dụng (Background -> Active)
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App quay trở lại màn hình chính
        queries.getAppSetting(db, 'is_app_lock_enabled', 'false').then((val) => {
          if (val === 'true') {
            setIsLocked(true);
          }
        });
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
    if (pin === storedPinRef.current) {
      setIsLocked(false);
      return true;
    }
    return false;
  }, []);

  const updatePinCode = useCallback(
    async (newPin: string): Promise<void> => {
      await queries.setAppSetting(db, 'pin_code', newPin);
      storedPinRef.current = newPin;
      setHasPinCode(newPin.length > 0);
    },
    [db]
  );

  const toggleAppLock = useCallback(
    async (enabled: boolean): Promise<void> => {
      await queries.setAppSetting(db, 'is_app_lock_enabled', enabled ? 'true' : 'false');
      setIsAppLockEnabled(enabled);
      if (!enabled) {
        setIsLocked(false);
      }
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

  return (
    <SecurityContext.Provider
      value={{
        isLocked,
        isAppLockEnabled,
        useFingerprint,
        hasPinCode,
        isHardwareSupported,
        hapticsEnabled,
        unlockApp,
        lockApp,
        authenticateWithFingerprint,
        verifyPin,
        updatePinCode,
        toggleAppLock,
        toggleFingerprint,
        toggleHaptics,
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
