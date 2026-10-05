import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWallet } from '../context/WalletContext';
import { ContactPerson } from '../types';
import { THEME } from '../constants';
import { hapticLight, hapticSuccess } from '../utils/haptics';

interface ContactPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectContact?: (contact: { name: string; phone?: string | null }) => void;
  multiSelect?: boolean;
  selectedNames?: string[];
  onConfirmMultiSelect?: (contacts: Array<{ name: string; phone?: string | null }>) => void;
  title?: string;
}

const AVATAR_COLORS = [
  '#FACC15', // Pop Yellow
  '#22C55E', // Pop Green
  '#38BDF8', // Sky Blue
  '#FB7185', // Pink
  '#A855F7', // Purple
  '#FB923C', // Orange
  '#84CC16', // Lime
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

export const ContactPickerSheet: React.FC<ContactPickerSheetProps> = ({
  visible,
  onClose,
  onSelectContact,
  multiSelect = false,
  selectedNames = [],
  onConfirmMultiSelect,
  title = 'Chọn người',
}) => {
  const { contacts, recentDebtPersons, addContact, removeContact } = useWallet();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedList, setSelectedList] = useState<Array<{ name: string; phone?: string | null }>>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');

  // Sync selectedNames when opening
  React.useEffect(() => {
    if (visible) {
      setSearchQuery('');
      setShowAddForm(false);
      setNewName('');
      setNewPhone('');

      if (multiSelect && selectedNames.length > 0) {
        const initial = selectedNames
          .filter(Boolean)
          .map(name => {
            const lowerName = (name || '').toLowerCase();
            const found = contacts.find(c => c?.name && c.name.toLowerCase() === lowerName)
              || recentDebtPersons.find(r => r?.name && r.name.toLowerCase() === lowerName);
            return { name, phone: found?.phone || null };
          });
        setSelectedList(initial);
      } else {
        setSelectedList([]);
      }
    }
  }, [visible, selectedNames, multiSelect, contacts, recentDebtPersons]);

  // Hợp nhất danh sách liên hệ: từ contacts table + recent debt persons không trùng
  const allAvailableContacts = useMemo(() => {
    const list: Array<{ id?: string; name: string; phone?: string | null; isSaved: boolean }> = [];
    const nameMap = new Set<string>();

    (contacts || []).forEach(c => {
      if (c && c.name && c.name.trim()) {
        const cleanName = c.name.trim();
        list.push({ id: c.id, name: cleanName, phone: c.phone || null, isSaved: true });
        nameMap.add(cleanName.toLowerCase());
      }
    });

    (recentDebtPersons || []).forEach(r => {
      if (r && r.name && r.name.trim()) {
        const cleanName = r.name.trim();
        const lower = cleanName.toLowerCase();
        if (!nameMap.has(lower)) {
          list.push({ name: cleanName, phone: r.phone || null, isSaved: false });
          nameMap.add(lower);
        }
      }
    });

    return list;
  }, [contacts, recentDebtPersons]);

  // Lọc theo search
  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allAvailableContacts;
    return allAvailableContacts.filter(
      c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
    );
  }, [allAvailableContacts, searchQuery]);

  const isExactMatch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return false;
    return allAvailableContacts.some(c => c.name.toLowerCase() === q);
  }, [allAvailableContacts, searchQuery]);

  // Click chọn 1 người
  const handleItemPress = (contact: { name: string; phone?: string | null }) => {
    hapticLight();
    if (multiSelect) {
      const exists = selectedList.some(
        s => s.name.toLowerCase() === contact.name.toLowerCase()
      );
      if (exists) {
        setSelectedList(prev =>
          prev.filter(s => s.name.toLowerCase() !== contact.name.toLowerCase())
        );
      } else {
        setSelectedList(prev => [...prev, contact]);
      }
    } else {
      if (onSelectContact) {
        onSelectContact(contact);
      }
      onClose();
    }
  };

  // Thêm người mới nhanh
  const handleAddNew = async () => {
    const trimmedName = (newName || searchQuery).trim();
    if (!trimmedName) return;

    hapticSuccess();
    try {
      const created = await addContact({
        name: trimmedName,
        phone: newPhone.trim() || null,
      });

      if (multiSelect) {
        setSelectedList(prev => [...prev, { name: created.name, phone: created.phone }]);
        setSearchQuery('');
        setShowAddForm(false);
        setNewName('');
        setNewPhone('');
      } else {
        if (onSelectContact) {
          onSelectContact({ name: created.name, phone: created.phone });
        }
        onClose();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Xác nhận cho chế độ multiSelect
  const handleConfirmMulti = () => {
    hapticSuccess();
    if (onConfirmMultiSelect) {
      onConfirmMultiSelect(selectedList);
    }
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerTitleWrap}>
              <Ionicons name="people" size={22} color={THEME.text} style={{ marginRight: 8 }} />
              <Text style={styles.headerTitle}>{title}</Text>
            </View>
            <Pressable style={styles.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={20} color={THEME.text} />
            </Pressable>
          </View>

          {/* Search Bar */}
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={THEME.textSecondary} style={{ marginRight: 8 }} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo tên hoặc số điện thoại..."
              placeholderTextColor={THEME.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="words"
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
                <Ionicons name="close-circle" size={18} color={THEME.textMuted} />
              </Pressable>
            )}
          </View>

          {/* Quick Add Button if typed name doesn't match */}
          {searchQuery.trim().length > 0 && !isExactMatch && !showAddForm && (
            <Pressable
              style={styles.quickAddRow}
              onPress={() => {
                setNewName(searchQuery.trim());
                setShowAddForm(true);
              }}
            >
              <View style={styles.quickAddIcon}>
                <Ionicons name="person-add" size={16} color="#000000" />
              </View>
              <Text style={styles.quickAddText}>
                Thêm mới & chọn: <Text style={{ fontWeight: '900' }}>"{searchQuery.trim()}"</Text>
              </Text>
            </Pressable>
          )}

          {/* Add form inline */}
          {showAddForm && (
            <View style={styles.addFormBox}>
              <Text style={styles.addFormTitle}>Thêm người mới vào danh bạ</Text>
              <TextInput
                style={styles.formInput}
                placeholder="Tên người (*)"
                placeholderTextColor={THEME.textMuted}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={[styles.formInput, { marginTop: 8 }]}
                placeholder="Số điện thoại (tùy chọn)"
                placeholderTextColor={THEME.textMuted}
                keyboardType="phone-pad"
                value={newPhone}
                onChangeText={setNewPhone}
              />
              <View style={styles.addFormActions}>
                <Pressable
                  style={styles.cancelFormBtn}
                  onPress={() => {
                    setShowAddForm(false);
                    setNewName('');
                    setNewPhone('');
                  }}
                >
                  <Text style={styles.cancelFormText}>Hủy</Text>
                </Pressable>
                <Pressable
                  style={[styles.saveFormBtn, !newName.trim() && { opacity: 0.5 }]}
                  disabled={!newName.trim()}
                  onPress={handleAddNew}
                >
                  <Text style={styles.saveFormText}>Lưu & Chọn</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* Contact List */}
          <ScrollView
            style={styles.listArea}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Quick chips if recent debt persons available and no search */}
            {!searchQuery && recentDebtPersons.length > 0 && (
              <View style={styles.recentSection}>
                <Text style={styles.sectionSubtitle}>Gần đây:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                  {recentDebtPersons.slice(0, 8).map((r, idx) => {
                    const isSelected = selectedList.some(
                      s => s.name.toLowerCase() === r.name.toLowerCase()
                    );
                    return (
                      <Pressable
                        key={`recent_${idx}`}
                        style={[
                          styles.recentChip,
                          isSelected && styles.recentChipSelected,
                        ]}
                        onPress={() => handleItemPress(r)}
                      >
                        <Text
                          style={[
                            styles.recentChipText,
                            isSelected && styles.recentChipTextSelected,
                          ]}
                        >
                          {r.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            {filteredContacts.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Ionicons name="person-outline" size={40} color={THEME.textMuted} />
                <Text style={styles.emptyText}>Chưa có người nào phù hợp</Text>
                <Pressable
                  style={styles.emptyAddBtn}
                  onPress={() => {
                    setNewName(searchQuery.trim());
                    setShowAddForm(true);
                  }}
                >
                  <Text style={styles.emptyAddBtnText}>+ Thêm người này</Text>
                </Pressable>
              </View>
            ) : (
              filteredContacts.map((c, idx) => {
                const isSelected = selectedList.some(
                  s => s.name.toLowerCase() === c.name.toLowerCase()
                );
                const avatarColor = getAvatarColor(c.name);
                const firstChar = (c.name.trim()[0] || '?').toUpperCase();

                return (
                  <Pressable
                    key={c.id || `contact_${idx}`}
                    style={[
                      styles.contactRow,
                      isSelected && styles.contactRowSelected,
                    ]}
                    onPress={() => handleItemPress(c)}
                  >
                    <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                      <Text style={styles.avatarText}>{firstChar}</Text>
                    </View>

                    <View style={styles.contactInfo}>
                      <Text style={styles.contactName} numberOfLines={1}>
                        {c.name}
                      </Text>
                      {c.phone ? (
                        <Text style={styles.contactPhone}>{c.phone}</Text>
                      ) : (
                        <Text style={styles.contactSub}>
                          {c.isSaved ? 'Đã lưu danh bạ' : 'Từ lịch sử giao dịch'}
                        </Text>
                      )}
                    </View>

                    {multiSelect ? (
                      <View
                        style={[
                          styles.checkbox,
                          isSelected && styles.checkboxActive,
                        ]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color="#000000" />
                        )}
                      </View>
                    ) : (
                      c.id && (
                        <Pressable
                          style={styles.deleteContactBtn}
                          hitSlop={8}
                          onPress={async () => {
                            hapticLight();
                            if (c.id) {
                              await removeContact(c.id);
                            }
                          }}
                        >
                          <Ionicons name="trash-outline" size={16} color={THEME.textMuted} />
                        </Pressable>
                      )
                    )}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* Bottom Actions for MultiSelect */}
          {multiSelect && (
            <View style={styles.multiFooter}>
              <Text style={styles.multiCountText}>
                Đã chọn: <Text style={{ fontWeight: '900' }}>{selectedList.length}</Text> người
              </Text>
              <Pressable style={styles.multiConfirmBtn} onPress={handleConfirmMulti}>
                <Text style={styles.multiConfirmText}>Xong</Text>
                <Ionicons name="arrow-forward" size={18} color="#000000" />
              </Pressable>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  sheetContainer: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: THEME.borderWidth,
    borderBottomWidth: 0,
    borderColor: THEME.border,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    paddingHorizontal: 16,
    maxHeight: '85%',
    shadowColor: THEME.shadow,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: THEME.text,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: THEME.surface,
    borderWidth: THEME.borderWidth,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: THEME.borderWidth,
    borderColor: THEME.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: THEME.text,
    padding: 0,
  },
  quickAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.popYellowLight,
    borderWidth: THEME.borderWidth,
    borderColor: THEME.border,
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  quickAddIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  quickAddText: {
    fontSize: 13,
    color: THEME.text,
    flex: 1,
  },
  addFormBox: {
    backgroundColor: THEME.surface,
    borderWidth: THEME.borderWidth,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  addFormTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: THEME.text,
    marginBottom: 8,
  },
  formInput: {
    backgroundColor: THEME.bg,
    borderWidth: 1.5,
    borderColor: THEME.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 14,
    color: THEME.text,
    fontWeight: '600',
  },
  addFormActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    gap: 8,
  },
  cancelFormBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
  },
  cancelFormText: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.textSecondary,
  },
  saveFormBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.border,
    backgroundColor: THEME.primary,
  },
  saveFormText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
  listArea: {
    maxHeight: 380,
  },
  recentSection: {
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 12,
    fontWeight: '800',
    color: THEME.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  chipsScroll: {
    flexDirection: 'row',
  },
  recentChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
    marginRight: 6,
  },
  recentChipSelected: {
    backgroundColor: THEME.popYellow,
  },
  recentChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.text,
  },
  recentChipTextSelected: {
    fontWeight: '900',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surface,
    borderWidth: 1.5,
    borderColor: THEME.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  contactRowSelected: {
    backgroundColor: THEME.popYellowLight,
    borderColor: THEME.border,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: THEME.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#000000',
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 15,
    fontWeight: '800',
    color: THEME.text,
  },
  contactPhone: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginTop: 2,
    fontWeight: '600',
  },
  contactSub: {
    fontSize: 11,
    color: THEME.textMuted,
    marginTop: 2,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: THEME.border,
    backgroundColor: THEME.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: THEME.primary,
  },
  deleteContactBtn: {
    padding: 6,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.textMuted,
    marginTop: 8,
    marginBottom: 12,
  },
  emptyAddBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: THEME.popYellow,
    borderWidth: 1.5,
    borderColor: THEME.border,
  },
  emptyAddBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: THEME.text,
  },
  multiFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1.5,
    borderColor: THEME.border,
    marginTop: 8,
  },
  multiCountText: {
    fontSize: 14,
    color: THEME.text,
  },
  multiConfirmBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.primary,
    borderWidth: THEME.borderWidth,
    borderColor: THEME.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
    shadowColor: THEME.shadow,
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  multiConfirmText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#000000',
  },
});
