import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { Category } from '../types';
import { THEME } from '../constants';
import { hapticLight, hapticMedium, hapticSuccess, hapticError } from '../utils/haptics';

interface CategoryManagementModalProps {
  visible: boolean;
  onClose: () => void;
}

const POPULAR_ICONS = [
  'restaurant-outline',
  'cafe-outline',
  'car-outline',
  'cart-outline',
  'flash-outline',
  'home-outline',
  'game-controller-outline',
  'medkit-outline',
  'book-outline',
  'barbell-outline',
  'airplane-outline',
  'gift-outline',
  'briefcase-outline',
  'wallet-outline',
  'cash-outline',
  'card-outline',
  'trending-up-outline',
  'sparkles-outline',
  'paw-outline',
  'musical-notes-outline',
  'shirt-outline',
  'film-outline',
  'construct-outline',
  'school-outline',
];

const NEO_PALETTE = [
  '#F97316',
  '#EF4444',
  '#EC4899',
  '#8B5CF6',
  '#6366F1',
  '#3B82F6',
  '#06B6D4',
  '#10B981',
  '#84CC16',
  '#EAB308',
  '#B45309',
  '#64748B',
];

export const CategoryManagementModal: React.FC<CategoryManagementModalProps> = ({
  visible,
  onClose,
}) => {
  const { categories, addCategory, editCategory, removeCategory } = useWallet();

  const [activeTab, setActiveTab] = useState<'expense' | 'income'>('expense');

  // Modal thêm / sửa
  const [editorVisible, setEditorVisible] = useState<boolean>(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [nameInput, setNameInput] = useState<string>('');
  const [selectedIcon, setSelectedIcon] = useState<string>('cart-outline');
  const [selectedColor, setSelectedColor] = useState<string>('#F97316');

  const filteredCategories = categories.filter(c => c.type === activeTab);

  const handleOpenCreate = () => {
    hapticMedium();
    setEditingCategory(null);
    setNameInput('');
    setSelectedIcon(activeTab === 'income' ? 'cash-outline' : 'cart-outline');
    setSelectedColor(activeTab === 'income' ? '#10B981' : '#F97316');
    setEditorVisible(true);
  };

  const handleOpenEdit = (cat: Category) => {
    hapticMedium();
    setEditingCategory(cat);
    setNameInput(cat.name);
    setSelectedIcon(cat.icon);
    setSelectedColor(cat.color);
    setEditorVisible(true);
  };

  const handleSaveCategory = async () => {
    if (!nameInput.trim()) {
      hapticError();
      Alert.alert('Thiếu thông tin', 'Vui lòng nhập tên danh mục');
      return;
    }

    try {
      if (editingCategory) {
        await editCategory({
          id: editingCategory.id,
          name: nameInput.trim(),
          type: activeTab,
          icon: selectedIcon,
          color: selectedColor,
        });
      } else {
        await addCategory({
          name: nameInput.trim(),
          type: activeTab,
          icon: selectedIcon,
          color: selectedColor,
        });
      }
      hapticSuccess();
      setEditorVisible(false);
    } catch (err: any) {
      hapticError();
      Alert.alert('Lỗi', err?.message || 'Không thể lưu danh mục');
    }
  };

  const handleDeleteCategory = (cat: Category) => {
    hapticLight();
    Alert.alert(
      'Xóa danh mục',
      `Bạn có chắc chắn muốn xóa danh mục "${cat.name}"? Các giao dịch thuộc danh mục này sẽ chuyển về "Chưa phân loại".`,
      [
        { text: 'Hủy', style: 'cancel' },
        {
          text: 'Xóa',
          style: 'destructive',
          onPress: async () => {
            await removeCategory(cat.id);
            hapticSuccess();
          },
        },
      ]
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>Quản Lý Danh Mục</Text>
            <Text style={styles.subTitle}>Tùy chỉnh danh mục thu & chi tiêu</Text>
          </View>

          <Pressable
            style={styles.closeBtnShadow}
            onPress={() => {
              hapticLight();
              onClose();
            }}
          >
            <View style={styles.closeBtnInner}>
              <Ionicons name="close" size={20} color="#000000" />
            </View>
          </Pressable>
        </View>

        {/* Tab Switcher: Chi tiêu / Thu nhập */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[
              styles.tabBtn,
              activeTab === 'expense' && styles.tabBtnActive,
            ]}
            onPress={() => {
              hapticLight();
              setActiveTab('expense');
            }}
          >
            <Ionicons
              name="arrow-down-circle-outline"
              size={18}
              color={activeTab === 'expense' ? '#000000' : '#6B7280'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'expense' && styles.tabBtnTextActive,
              ]}
            >
              Chi tiêu
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.tabBtn,
              activeTab === 'income' && styles.tabBtnActive,
            ]}
            onPress={() => {
              hapticLight();
              setActiveTab('income');
            }}
          >
            <Ionicons
              name="arrow-up-circle-outline"
              size={18}
              color={activeTab === 'income' ? '#000000' : '#6B7280'}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === 'income' && styles.tabBtnTextActive,
              ]}
            >
              Thu nhập
            </Text>
          </Pressable>
        </View>

        {/* Action button: Thêm danh mục mới */}
        <View style={styles.actionRow}>
          <Text style={styles.countText}>
            {filteredCategories.length} danh mục khả dụng
          </Text>

          <Pressable style={styles.addBtnShadow} onPress={handleOpenCreate}>
            <View style={styles.addBtnInner}>
              <Ionicons name="add" size={17} color="#000000" />
              <Text style={styles.addBtnText}>Thêm danh mục</Text>
            </View>
          </Pressable>
        </View>

        {/* Danh sách danh mục */}
        <ScrollView
          style={styles.listArea}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {filteredCategories.map(cat => (
            <View key={cat.id} style={styles.catCardShadow}>
              <View style={styles.catCardInner}>
                <View style={[styles.catIconBox, { backgroundColor: cat.color }]}>
                  <Ionicons name={cat.icon as any} size={20} color="#FFFFFF" />
                </View>

                <View style={styles.catInfo}>
                  <Text style={styles.catName}>{cat.name}</Text>
                  <Text style={styles.catType}>
                    {cat.type === 'expense' ? 'Khoản chi' : 'Khoản thu'}
                  </Text>
                </View>

                <View style={styles.catActions}>
                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => handleOpenEdit(cat)}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#000000" />
                  </Pressable>

                  <Pressable
                    style={styles.iconBtn}
                    onPress={() => handleDeleteCategory(cat)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Modal Thêm / Sửa Danh mục */}
        <Modal visible={editorVisible} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.editorCardShadow}>
              <View style={styles.editorCardInner}>
                <View style={styles.editorHeader}>
                  <Text style={styles.editorTitle}>
                    {editingCategory ? 'Sửa Danh Mục' : 'Thêm Danh Mục Mới'}
                  </Text>
                  <Pressable
                    onPress={() => {
                      hapticLight();
                      setEditorVisible(false);
                    }}
                  >
                    <Ionicons name="close" size={22} color="#000000" />
                  </Pressable>
                </View>

                <ScrollView showsVerticalScrollIndicator={false}>
                  {/* Tên danh mục */}
                  <Text style={styles.inputLabel}>TÊN DANH MỤC</Text>
                  <TextInput
                    style={styles.inputField}
                    placeholder="Ví dụ: Ăn vặt, Tiền điện nước..."
                    placeholderTextColor="#9CA3AF"
                    value={nameInput}
                    onChangeText={setNameInput}
                  />

                  {/* Chọn màu sắc */}
                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>MÀU SẮC ĐẠI DIỆN</Text>
                  <View style={styles.paletteRow}>
                    {NEO_PALETTE.map(color => {
                      const isSelected = selectedColor === color;
                      return (
                        <Pressable
                          key={color}
                          style={[
                            styles.colorDot,
                            { backgroundColor: color },
                            isSelected && styles.colorDotSelected,
                          ]}
                          onPress={() => {
                            hapticLight();
                            setSelectedColor(color);
                          }}
                        >
                          {isSelected && (
                            <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          )}
                        </Pressable>
                      );
                    })}
                  </View>

                  {/* Chọn biểu tượng */}
                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>BIỂU TƯỢNG (ICON)</Text>
                  <View style={styles.iconGrid}>
                    {POPULAR_ICONS.map(iconName => {
                      const isSelected = selectedIcon === iconName;
                      return (
                        <Pressable
                          key={iconName}
                          style={[
                            styles.iconPickBox,
                            isSelected && {
                              backgroundColor: selectedColor,
                              borderColor: '#000000',
                            },
                          ]}
                          onPress={() => {
                            hapticLight();
                            setSelectedIcon(iconName);
                          }}
                        >
                          <Ionicons
                            name={iconName as any}
                            size={20}
                            color={isSelected ? '#FFFFFF' : '#000000'}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>

                {/* Nút lưu */}
                <View style={styles.editorBtnRow}>
                  <Pressable
                    style={styles.cancelBtn}
                    onPress={() => {
                      hapticLight();
                      setEditorVisible(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Hủy</Text>
                  </Pressable>

                  <Pressable
                    style={styles.saveBtnShadow}
                    onPress={handleSaveCategory}
                  >
                    <View style={styles.saveBtnInner}>
                      <Text style={styles.saveBtnText}>Lưu danh mục</Text>
                    </View>
                  </Pressable>
                </View>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FAF8F5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  closeBtnInner: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 6,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  tabBtnActive: {
    backgroundColor: THEME.primaryLight,
    borderColor: '#000000',
  },
  tabBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
  },
  tabBtnTextActive: {
    color: '#000000',
  },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
  },
  addBtnShadow: {
    backgroundColor: '#000000',
    borderRadius: 10,
  },
  addBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: '#000000',
    transform: [{ translateX: -1.5 }, { translateY: -1.5 }],
  },
  addBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  listArea: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 30,
    gap: 10,
  },
  catCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 14,
  },
  catCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  catIconBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catInfo: {
    flex: 1,
    marginLeft: 12,
  },
  catName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#000000',
  },
  catType: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 2,
  },
  catActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconBtn: {
    padding: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editorCardShadow: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#000000',
    borderRadius: 20,
  },
  editorCardInner: {
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#000000',
    padding: 18,
    maxHeight: 520,
    transform: [{ translateX: -3 }, { translateY: -3 }],
  },
  editorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  editorTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#000000',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#374151',
    marginBottom: 6,
  },
  inputField: {
    borderWidth: 2,
    borderColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    backgroundColor: '#F9FAFB',
  },
  paletteRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  colorDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  colorDotSelected: {
    transform: [{ scale: 1.15 }],
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconPickBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  editorBtnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 18,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  saveBtnShadow: {
    flex: 2,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  saveBtnInner: {
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: THEME.primary,
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
});
