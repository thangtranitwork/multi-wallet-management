import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DashboardForecast } from '../services/predictionService';
import { THEME, formatVND } from '../constants';
import { hapticMedium, hapticLight } from '../utils/haptics';

interface SmartForecastCardProps {
  forecast: DashboardForecast | null;
  onQuickAction: (forecast: DashboardForecast) => void;
}

export const SmartForecastCard: React.FC<SmartForecastCardProps> = ({
  forecast,
  onQuickAction,
}) => {
  const [dismissed, setDismissed] = useState(false);

  if (!forecast || dismissed) {
    return null;
  }

  const handlePress = () => {
    hapticMedium();
    onQuickAction(forecast);
  };

  const handleDismiss = () => {
    hapticLight();
    setDismissed(true);
  };

  const isUrgent = forecast.isUrgent;

  return (
    <View style={styles.cardShadow}>
      <View style={styles.cardShadowBlock} />
      <View style={[styles.cardInner, isUrgent && styles.cardInnerUrgent]}>
        {/* Top Banner Row */}
        <View style={styles.topRow}>
          <View style={[styles.badge, { backgroundColor: isUrgent ? '#FEE2E2' : '#FEF08A' }]}>
            <Ionicons name="sparkles" size={12} color="#000000" style={{ marginRight: 4 }} />
            <Text style={styles.badgeText} numberOfLines={1}>
              {forecast.badgeText}
            </Text>
          </View>

          <Pressable
            onPress={handleDismiss}
            hitSlop={12}
            style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="close" size={14} color="#000000" />
          </Pressable>
        </View>

        {/* Main Content Row */}
        <View style={styles.bodyRow}>
          <View
            style={[
              styles.iconWrapper,
              { backgroundColor: forecast.category.color ? forecast.category.color + '25' : '#FEF08A' },
            ]}
          >
            <Ionicons
              name={(forecast.category.icon as any) || 'flash-outline'}
              size={22}
              color="#000000"
            />
          </View>

          <View style={styles.contentCol}>
            <Text style={styles.title} numberOfLines={1}>
              {forecast.title}
            </Text>
            <Text style={styles.subtitle} numberOfLines={2}>
              {forecast.subtitle}
            </Text>

            {forecast.suggestedAmount ? (
              <Text style={styles.amountText}>
                Dự kiến: <Text style={styles.amountValue}>{formatVND(forecast.suggestedAmount)}</Text>
              </Text>
            ) : null}
          </View>
        </View>

        {/* Action Footer */}
        <View style={styles.footerRow}>
          <Pressable
            onPress={handlePress}
            style={({ pressed }) => [
              styles.actionButton,
              isUrgent ? styles.actionButtonUrgent : styles.actionButtonNormal,
              pressed && styles.actionButtonPressed,
            ]}
          >
            <Ionicons name="add-circle" size={16} color="#000000" style={{ marginRight: 6 }} />
            <Text style={styles.actionButtonText}>Ghi chép nhanh</Text>
            <Ionicons name="chevron-forward" size={14} color="#000000" style={{ marginLeft: 4 }} />
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardShadow: {
    position: 'relative',
    marginBottom: 16,
    marginRight: 4,
  },
  cardShadowBlock: {
    position: 'absolute',
    top: 4,
    left: 4,
    right: -4,
    bottom: -4,
    backgroundColor: '#000000',
    borderRadius: 16,
  },
  cardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2.5,
    borderColor: '#000000',
  },
  cardInnerUrgent: {
    backgroundColor: '#FFF1F2',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#000000',
    flexShrink: 1,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '900',
    color: '#000000',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dismissBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  bodyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    shadowColor: '#000000',
    shadowOffset: { width: 1.5, height: 1.5 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  contentCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '900',
    color: '#000000',
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    color: '#4B5563',
    lineHeight: 17,
    fontWeight: '600',
  },
  amountText: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    fontWeight: '600',
  },
  amountValue: {
    color: '#000000',
    fontWeight: '900',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#000000',
    shadowColor: '#000000',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  actionButtonNormal: {
    backgroundColor: '#FFE600',
  },
  actionButtonUrgent: {
    backgroundColor: '#FCA5A5',
  },
  actionButtonPressed: {
    transform: [{ translateX: 1 }, { translateY: 1 }],
    shadowOffset: { width: 1, height: 1 },
  },
  actionButtonText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '900',
  },
});
