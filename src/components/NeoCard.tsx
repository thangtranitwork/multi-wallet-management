import React, { useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ViewStyle,
  StyleProp,
  Text,
} from 'react-native';
import { THEME } from '../constants';

interface NeoBoxProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  color?: string;
  shadowOffset?: number;
  borderRadius?: number;
  borderWidth?: number;
}

/**
 * NeoBox: Reusable Neo-Brutalist container with crisp solid pitch-black offset shadow
 */
export const NeoBox: React.FC<NeoBoxProps> = ({
  children,
  style,
  contentStyle,
  color = '#FFFFFF',
  shadowOffset = 4,
  borderRadius = 18,
  borderWidth = 2.5,
}) => {
  return (
    <View
      style={[
        {
          backgroundColor: '#000000',
          borderRadius,
          marginBottom: shadowOffset,
          marginRight: shadowOffset,
        },
        style,
      ]}
    >
      <View
        style={[
          {
            backgroundColor: color,
            borderRadius,
            borderWidth,
            borderColor: '#000000',
            transform: [{ translateX: -shadowOffset }, { translateY: -shadowOffset }],
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </View>
  );
};

interface NeoButtonProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  color?: string;
  shadowOffset?: number;
  borderRadius?: number;
  borderWidth?: number;
  disabled?: boolean;
}

/**
 * NeoButton: Interactive Neo-Brutalist button with physical tactile press feedback
 */
export const NeoButton: React.FC<NeoButtonProps> = ({
  children,
  onPress,
  style,
  contentStyle,
  color = THEME.popYellow,
  shadowOffset = 4,
  borderRadius = 16,
  borderWidth = 2.5,
  disabled = false,
}) => {
  const [pressed, setPressed] = useState(false);

  const currentOffset = pressed ? 0 : shadowOffset;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          backgroundColor: '#000000',
          borderRadius,
          marginBottom: shadowOffset,
          marginRight: shadowOffset,
          opacity: disabled ? 0.6 : 1,
        },
        style,
      ]}
    >
      <View
        style={[
          {
            backgroundColor: color,
            borderRadius,
            borderWidth,
            borderColor: '#000000',
            transform: [{ translateX: -currentOffset }, { translateY: -currentOffset }],
          },
          contentStyle,
        ]}
      >
        {children}
      </View>
    </Pressable>
  );
};

interface FolderTabCardProps {
  tabColor?: string;
  tabWidth?: number;
  tabLabel?: string;
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  shadowOffset?: number;
  borderRadius?: number;
}

/**
 * FolderTabCard: Recreates the exact folder-tab design seen in Ngài's reference image!
 * A physical file folder with a colored tab at the top and black offset shadow behind it.
 */
export const FolderTabCard: React.FC<FolderTabCardProps> = ({
  tabColor = THEME.primary,
  tabWidth = 84,
  tabLabel,
  children,
  onPress,
  style,
  contentStyle,
  shadowOffset = 4,
  borderRadius = 18,
}) => {
  const [pressed, setPressed] = useState(false);
  const currentOffset = pressed ? 0 : shadowOffset;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={[
        {
          backgroundColor: '#000000',
          borderRadius,
          marginBottom: shadowOffset + 4,
          marginRight: shadowOffset,
          marginTop: 10,
        },
        style,
      ]}
    >
      {/* The Animated Wrapper that shifts on press */}
      <View
        style={{
          transform: [{ translateX: -currentOffset }, { translateY: -currentOffset }],
        }}
      >
        {/* Top Folder Tab sticking out */}
        <View
          style={{
            position: 'absolute',
            top: -12,
            left: 12,
            width: tabWidth,
            height: 14,
            backgroundColor: tabColor,
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
            borderWidth: 2.5,
            borderColor: '#000000',
            borderBottomWidth: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1,
          }}
        >
          {tabLabel ? (
            <Text
              numberOfLines={1}
              style={{
                fontSize: 8,
                fontWeight: '900',
                color: '#000000',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {tabLabel}
            </Text>
          ) : null}
        </View>

        {/* Main Folder Card Body */}
        <View
          style={[
            {
              backgroundColor: '#FFFFFF',
              borderRadius,
              borderWidth: 2.5,
              borderColor: '#000000',
              overflow: 'hidden',
            },
            contentStyle,
          ]}
        >
          {children}
        </View>
      </View>
    </Pressable>
  );
};
