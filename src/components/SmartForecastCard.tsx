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
    <View style={[styles.container, isUrgent && styles.containerUrgent]}>
      {/* Top Banner Row */}
      <View style={styles.topRow}>
        <View style={[styles.badge, { backgroundColor: forecast.badgeColor + '20' }]}>
          <Ionicons name="sparkles" size={12} color={forecast.badgeColor} style={{ marginRight: 4 }} />
          <Text style={[styles.badgeText, { color: forecast.badgeColor }]}>
            {forecast.badgeText}
          </Text>
        </View>

        <Pressable
          onPress={handleDismiss}
          hitSlop={12}
          style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="close" size={16} color={THEME.textMuted} />
        </Pressable>
      </View>

      {/* Main Content Row */}
      <View style={styles.bodyRow}>
        <View style={[styles.iconWrapper, { backgroundColor: forecast.category.color + '15' }]}>
          <Ionicons
            name={(forecast.category.icon as any) || 'flash-outline'}
            size={24}
            color={forecast.category.color}
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
            { backgroundColor: forecast.badgeColor },
            pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Ionicons name="add-circle" size={16} color="#FFFFFF" style={{ marginRight: 6 }} />
          <Text style={styles.actionButtonText}>Ghi chép nhanh</Text>
          <Ionicons name="chevron-forward" size={14} color="#FFFFFF" style={{ marginLeft: 4 }} />
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1.5,
    borderColor: '#FDE68A', // soft amber border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerUrgent: {
    borderColor: '#FCA5A5', // soft red border
    backgroundColor: '#FFF5F5',
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
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  dismissBtn: {
    padding: 4,
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
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  contentCol: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: THEME.text,
    marginBottom: 3,
  },
  subtitle: {
    fontSize: 12,
    color: THEME.textSecondary,
    lineHeight: 17,
  },
  amountText: {
    fontSize: 12,
    color: THEME.textMuted,
    marginTop: 4,
    fontWeight: '500',
  },
  amountValue: {
    color: THEME.text,
    fontWeight: '700',
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
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
