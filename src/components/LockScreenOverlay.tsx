import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useSecurity } from '../context/SecurityContext';
import { THEME } from '../constants';
import { hapticLight, hapticError, hapticSuccess } from '../utils/haptics';

export const LockScreenOverlay: React.FC = () => {
  const {
    isLocked,
    useFingerprint,
    hasPinCode,
    isHardwareSupported,
    authenticateWithFingerprint,
    verifyPin,
    unlockApp,
  } = useSecurity();

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const shakeAnimation = useRef(new Animated.Value(0)).current;

  // Tự động quét vân tay khi màn hình khóa xuất hiện (nếu bật vân tay)
  useEffect(() => {
    if (isLocked && useFingerprint && isHardwareSupported) {
      const timer = setTimeout(() => {
        handleFingerprintPress();
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [isLocked, useFingerprint, isHardwareSupported]);

  // Reset PIN khi khóa/mở
  useEffect(() => {
    if (isLocked) {
      setEnteredPin('');
      setErrorMessage('');
    }
  }, [isLocked]);

  const triggerShake = () => {
    hapticError();
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 60, useNativeDriver: true }),
    ]).start();
  };

  const handleDigitPress = async (digit: string) => {
    if (enteredPin.length >= 4) return;
    hapticLight();
    const newPin = enteredPin + digit;
    setEnteredPin(newPin);
    setErrorMessage('');

    if (newPin.length === 4) {
      if (!hasPinCode) {
        // Chưa đặt PIN thì mở luôn
        hapticSuccess();
        unlockApp();
        return;
      }
      const isValid = await verifyPin(newPin);
      if (isValid) {
        hapticSuccess();
      } else {
        triggerShake();
        setErrorMessage('Mã PIN không đúng, vui lòng thử lại');
        setTimeout(() => {
          setEnteredPin('');
        }, 400);
      }
    }
  };

  const handleBackspace = () => {
    hapticLight();
    if (enteredPin.length > 0) {
      setEnteredPin(prev => prev.slice(0, -1));
      setErrorMessage('');
    }
  };

  const handleFingerprintPress = async () => {
    hapticLight();
    const success = await authenticateWithFingerprint();
    if (success) {
      hapticSuccess();
    }
  };

  if (!isLocked) return null;

  return (
    <Modal visible={isLocked} animationType="fade" transparent={false}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          {/* Header & Logo */}
          <View style={styles.header}>
            <View style={styles.logoShadow}>
              <View style={styles.logoInner}>
                <Ionicons name="finger-print" size={44} color="#000000" />
              </View>
            </View>

            <Text style={styles.appTitle}>Ví Của Tôi</Text>
            <Text style={styles.subTitle}>
              {useFingerprint
                ? 'Nhập mã PIN hoặc quét vân tay để mở khóa'
                : 'Nhập mã PIN 4 số để tiếp tục'}
            </Text>
          </View>

          {/* PIN Indicator Dots */}
          <Animated.View
            style={[
              styles.pinDotsRow,
              { transform: [{ translateX: shakeAnimation }] },
            ]}
          >
            {[0, 1, 2, 3].map(idx => {
              const isFilled = enteredPin.length > idx;
              return (
                <View
                  key={idx}
                  style={[
                    styles.pinDotShadow,
                    isFilled && styles.pinDotShadowFilled,
                  ]}
                >
                  <View
                    style={[
                      styles.pinDotInner,
                      isFilled && styles.pinDotInnerFilled,
                    ]}
                  />
                </View>
              );
            })}
          </Animated.View>

          {/* Error message */}
          <View style={styles.errorContainer}>
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}
          </View>

          {/* Neo-Brutalist Keypad */}
          <View style={styles.keypadGrid}>
            {[
              ['1', '2', '3'],
              ['4', '5', '6'],
              ['7', '8', '9'],
            ].map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map(digit => (
                  <Pressable
                    key={digit}
                    style={styles.keyShadow}
                    onPress={() => handleDigitPress(digit)}
                  >
                    <View style={styles.keyInner}>
                      <Text style={styles.keyText}>{digit}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ))}

            {/* Hàng cuối: Vân tay, số 0, Backspace */}
            <View style={styles.keypadRow}>
              {useFingerprint && isHardwareSupported ? (
                <Pressable
                  style={styles.keyShadow}
                  onPress={handleFingerprintPress}
                >
                  <View style={[styles.keyInner, { backgroundColor: THEME.popYellow }]}>
                    <Ionicons name="finger-print" size={26} color="#000000" />
                  </View>
                </Pressable>
              ) : (
                <View style={styles.emptyKey} />
              )}

              <Pressable
                style={styles.keyShadow}
                onPress={() => handleDigitPress('0')}
              >
                <View style={styles.keyInner}>
                  <Text style={styles.keyText}>0</Text>
                </View>
              </Pressable>

              <Pressable
                style={styles.keyShadow}
                onPress={handleBackspace}
              >
                <View style={styles.keyInner}>
                  <Ionicons name="backspace-outline" size={24} color="#000000" />
                </View>
              </Pressable>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  container: {
    flex: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
  },
  logoShadow: {
    backgroundColor: '#000000',
    borderRadius: 22,
    marginBottom: 16,
  },
  logoInner: {
    width: 76,
    height: 76,
    borderRadius: 22,
    backgroundColor: THEME.primaryLight,
    borderWidth: 2.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  appTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 6,
    textAlign: 'center',
  },
  pinDotsRow: {
    flexDirection: 'row',
    gap: 18,
    marginVertical: 18,
  },
  pinDotShadow: {
    backgroundColor: '#000000',
    borderRadius: 14,
  },
  pinDotShadowFilled: {
    backgroundColor: '#000000',
  },
  pinDotInner: {
    width: 22,
    height: 22,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  pinDotInnerFilled: {
    backgroundColor: THEME.primary,
    borderColor: '#000000',
  },
  errorContainer: {
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#EF4444',
  },
  keypadGrid: {
    width: '100%',
    maxWidth: 320,
    gap: 14,
    marginBottom: 20,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 14,
  },
  keyShadow: {
    flex: 1,
    height: 64,
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  keyInner: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  keyText: {
    fontSize: 24,
    fontWeight: '900',
    color: '#000000',
  },
  emptyKey: {
    flex: 1,
    height: 64,
  },
});
