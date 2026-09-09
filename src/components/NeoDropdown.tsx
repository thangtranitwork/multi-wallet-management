import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Modal,
  ScrollView,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../constants';

export interface DropdownOption {
  id: string | null;
  label: string;
  icon?: string;
  color?: string;
  badge?: string | number;
}

interface NeoDropdownProps {
  title: string;
  triggerLabel: string;
  triggerIcon?: string;
  isActive?: boolean;
  options: DropdownOption[];
  selectedValue: string | null;
  onSelect: (value: string | null) => void;
  style?: StyleProp<ViewStyle>;
}

export const NeoDropdown: React.FC<NeoDropdownProps> = ({
  title,
  triggerLabel,
  triggerIcon,
  isActive = false,
  options,
  selectedValue,
  onSelect,
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelect = (val: string | null) => {
    onSelect(val);
    setModalVisible(false);
  };

  return (
    <>
      {/* Trigger Button with Neo-Brutalist Shadow */}
      <View style={[styles.triggerShadow, style]}>
        <Pressable
          style={[styles.triggerInner, isActive && styles.triggerInnerActive]}
          onPress={() => setModalVisible(true)}
        >
          {triggerIcon ? (
            <Ionicons
              name={triggerIcon as any}
              size={15}
              color="#000000"
              style={styles.triggerIcon}
            />
          ) : null}
          <Text
            style={[styles.triggerText, isActive && styles.triggerTextActive]}
            numberOfLines={1}
          >
            {triggerLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color="#000000"
            style={styles.chevronIcon}
          />
        </Pressable>
      </View>

      {/* Selection Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setModalVisible(false)}
        >
          <Pressable
            style={styles.modalContentShadow}
            onPress={e => e.stopPropagation()}
          >
            <View style={styles.modalContentInner}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{title}</Text>
                <Pressable
                  style={styles.closeBtn}
                  onPress={() => setModalVisible(false)}
                >
                  <Ionicons name="close" size={18} color="#000000" />
                </Pressable>
              </View>

              {/* Options List */}
              <ScrollView
                style={styles.optionsList}
                showsVerticalScrollIndicator={false}
              >
                {options.map((opt, idx) => {
                  const isSelected = selectedValue === opt.id;
                  return (
                    <Pressable
                      key={opt.id ?? `all-${idx}`}
                      style={[
                        styles.optionItem,
                        isSelected && styles.optionItemSelected,
                      ]}
                      onPress={() => handleSelect(opt.id)}
                    >
                      <View style={styles.optionLeft}>
                        {opt.color ? (
                          <View
                            style={[
                              styles.colorDot,
                              { backgroundColor: opt.color },
                            ]}
                          />
                        ) : opt.icon ? (
                          <View
                            style={[
                              styles.iconWrap,
                              isSelected && { backgroundColor: '#000000' },
                            ]}
                          >
                            <Ionicons
                              name={opt.icon as any}
                              size={16}
                              color={isSelected ? '#FFFFFF' : '#000000'}
                            />
                          </View>
                        ) : null}
                        <Text
                          style={[
                            styles.optionLabel,
                            isSelected && styles.optionLabelSelected,
                          ]}
                        >
                          {opt.label}
                        </Text>
                      </View>

                      <View style={styles.optionRight}>
                        {opt.badge !== undefined && (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{opt.badge}</Text>
                          </View>
                        )}
                        {isSelected ? (
                          <View style={styles.checkCircle}>
                            <Ionicons
                              name="checkmark-sharp"
                              size={14}
                              color="#FFFFFF"
                            />
                          </View>
                        ) : (
                          <View style={styles.uncheckCircle} />
                        )}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  triggerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    transform: [{ translateX: -2.5 }, { translateY: -2.5 }],
    gap: 6,
  },
  triggerInnerActive: {
    backgroundColor: THEME.popYellow,
  },
  triggerIcon: {
    marginRight: -2,
  },
  triggerText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    maxWidth: 130,
  },
  triggerTextActive: {
    fontWeight: '900',
  },
  chevronIcon: {
    marginLeft: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalContentShadow: {
    backgroundColor: '#000000',
    borderRadius: 22,
    width: '100%',
    maxWidth: 380,
  },
  modalContentInner: {
    backgroundColor: THEME.bg,
    borderRadius: 22,
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 18,
    transform: [{ translateX: -3.5 }, { translateY: -3.5 }],
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsList: {
    maxHeight: 340,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  optionItemSelected: {
    backgroundColor: THEME.popYellow,
    borderWidth: 2.5,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  colorDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: '#000000',
  },
  iconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    flex: 1,
  },
  optionLabelSelected: {
    fontWeight: '900',
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#000000',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uncheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
  },
});
