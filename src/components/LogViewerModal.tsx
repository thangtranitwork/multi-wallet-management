// src/components/LogViewerModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  FlatList,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { logger, LogEntry, LogLevel } from '../services/loggerService';
import { THEME } from '../constants';

interface LogViewerModalProps {
  visible: boolean;
  onClose: () => void;
}

export const LogViewerModal: React.FC<LogViewerModalProps> = ({ visible, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLevel, setSelectedLevel] = useState<LogLevel | 'all'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [expandedLogIds, setExpandedLogIds] = useState<Set<string>>(new Set());
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);
  const [copiedSingleId, setCopiedSingleId] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const unsubscribe = logger.subscribe(currentLogs => {
      setLogs(currentLogs);
    });
    return () => unsubscribe();
  }, [visible]);

  // Unique tags extracted from logs
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    logs.forEach(l => {
      if (l.tag) tags.add(l.tag);
    });
    return Array.from(tags).sort();
  }, [logs]);

  // Counts by level
  const counts = useMemo(() => {
    let errorCount = 0;
    let warnCount = 0;
    let infoCount = 0;
    logs.forEach(l => {
      if (l.level === 'error') errorCount++;
      else if (l.level === 'warn') warnCount++;
      else infoCount++;
    });
    return {
      all: logs.length,
      error: errorCount,
      warn: warnCount,
      info: infoCount,
    };
  }, [logs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    return logs.filter(item => {
      // Level filter
      if (selectedLevel !== 'all' && item.level !== selectedLevel) {
        return false;
      }
      // Tag filter
      if (selectedTag !== 'all' && item.tag !== selectedTag) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const inMsg = item.message.toLowerCase().includes(q);
        const inTag = item.tag.toLowerCase().includes(q);
        const inDetails = item.details ? item.details.toLowerCase().includes(q) : false;
        return inMsg || inTag || inDetails;
      }
      return true;
    });
  }, [logs, selectedLevel, selectedTag, searchQuery]);

  const toggleExpand = (id: string) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    setExpandedLogIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCopyLogs = async () => {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}

    const textToCopy = filteredLogs
      .map(
        l =>
          `[${l.timeFull}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message}${
            l.details ? `\n  Chi tiết:\n${l.details}` : ''
          }`
      )
      .join('\n\n');

    await Clipboard.setStringAsync(textToCopy || 'Không có log nào');
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  const handleCopySingleLog = async (item: LogEntry) => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}

    const textToCopy = `[${item.timeFull}] [${item.level.toUpperCase()}] [${item.tag}] ${item.message}${
      item.details ? `\n\nChi tiết:\n${item.details}` : ''
    }`;

    await Clipboard.setStringAsync(textToCopy);
    setCopiedSingleId(item.id);
    setTimeout(() => {
      setCopiedSingleId(null);
    }, 1500);
  };

  const handleShareLogs = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    const textToShare = filteredLogs
      .map(
        l =>
          `[${l.timeFull}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message}${
            l.details ? `\n  Details:\n${l.details}` : ''
          }`
      )
      .join('\n\n');

    await Share.share({
      title: 'Nhật ký ứng dụng Multi-Wallet',
      message: textToShare || 'Không có log nào',
    });
  };

  const handleClearLogs = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}

    Alert.alert('Xóa nhật ký', 'Bạn có chắc chắn muốn xóa toàn bộ log hiện tại không?', [
      { text: 'Hủy', style: 'cancel' },
      {
        text: 'Xóa sạch',
        style: 'destructive',
        onPress: () => {
          logger.clearLogs();
          setExpandedLogIds(new Set());
        },
      },
    ]);
  };

  const renderLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'error':
        return (
          <View style={[styles.levelBadge, { backgroundColor: '#FEE2E2', borderColor: '#DC2626' }]}>
            <Text style={[styles.levelBadgeText, { color: '#DC2626' }]}>ERROR</Text>
          </View>
        );
      case 'warn':
        return (
          <View style={[styles.levelBadge, { backgroundColor: '#FEF3C7', borderColor: '#D97706' }]}>
            <Text style={[styles.levelBadgeText, { color: '#B45309' }]}>WARN</Text>
          </View>
        );
      case 'debug':
        return (
          <View style={[styles.levelBadge, { backgroundColor: '#F3E8FF', borderColor: '#7E22CE' }]}>
            <Text style={[styles.levelBadgeText, { color: '#7E22CE' }]}>DEBUG</Text>
          </View>
        );
      default:
        return (
          <View style={[styles.levelBadge, { backgroundColor: '#DBEAFE', borderColor: '#2563EB' }]}>
            <Text style={[styles.levelBadgeText, { color: '#1D4ED8' }]}>INFO</Text>
          </View>
        );
    }
  };

  const renderLogItem = ({ item }: { item: LogEntry }) => {
    const isExpanded = expandedLogIds.has(item.id);
    const hasDetails = !!item.details;

    return (
      <View style={styles.logCardShadow}>
        <View
          style={[
            styles.logCardInner,
            item.level === 'error' && styles.logCardError,
            item.level === 'warn' && styles.logCardWarn,
          ]}
        >
          {/* Top metadata row */}
          <View style={styles.logMetaRow}>
            <View style={styles.logMetaLeft}>
              {renderLevelBadge(item.level)}
              <View style={styles.tagBadge}>
                <Text style={styles.tagBadgeText}>{item.tag}</Text>
              </View>
            </View>
            <View style={styles.logMetaRight}>
              <Text style={styles.logTimeText}>{item.timestamp}</Text>
              <Pressable
                style={[
                  styles.itemCopyBtn,
                  copiedSingleId === item.id && styles.itemCopyBtnSuccess,
                ]}
                onPress={() => handleCopySingleLog(item)}
                hitSlop={6}
              >
                <Ionicons
                  name={copiedSingleId === item.id ? 'checkmark' : 'copy-outline'}
                  size={12}
                  color={copiedSingleId === item.id ? '#15803D' : '#374151'}
                />
                <Text
                  style={[
                    styles.itemCopyBtnText,
                    copiedSingleId === item.id && styles.itemCopyBtnTextSuccess,
                  ]}
                >
                  {copiedSingleId === item.id ? 'Đã chép' : 'Chép'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Message row */}
          <Text style={styles.logMessageText} selectable>
            {item.message}
          </Text>

          {/* Details toggle */}
          {hasDetails && (
            <View style={styles.detailsContainer}>
              <Pressable
                style={styles.detailsToggleBtn}
                onPress={() => toggleExpand(item.id)}
              >
                <Ionicons
                  name={isExpanded ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color="#4B5563"
                />
                <Text style={styles.detailsToggleText}>
                  {isExpanded ? 'Thu gọn chi tiết' : 'Xem chi tiết (JSON / Stack)'}
                </Text>
              </Pressable>

              {isExpanded && (
                <View style={styles.detailsBox}>
                  <Text style={styles.detailsText} selectable>
                    {item.details}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <View style={styles.folderTabBadge}>
              <Text style={styles.folderTabBadgeText}>SYSTEM & DEBUG</Text>
            </View>
            <Text style={styles.headerTitle} numberOfLines={1}>
              Nhật Ký Hoạt Động
            </Text>
            <Text style={styles.headerSubtitle}>
              {filteredLogs.length} / {logs.length} bản ghi • Tự động ghi nhận
            </Text>
          </View>

          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Ionicons name="close" size={20} color="#000000" />
          </Pressable>
        </View>

        {/* Search Input */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={16} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm theo từ khóa, lỗi, tag..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={16} color="#6B7280" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Level Filters */}
        <View style={styles.levelFilterRow}>
          {[
            { key: 'all', label: `Tất cả (${counts.all})` },
            { key: 'error', label: `Lỗi (${counts.error})`, isAlert: counts.error > 0 },
            { key: 'warn', label: `Cảnh báo (${counts.warn})` },
            { key: 'info', label: `Thông tin (${counts.info})` },
          ].map(lvl => {
            const isActive = selectedLevel === lvl.key;
            return (
              <Pressable
                key={lvl.key}
                style={[
                  styles.levelTab,
                  isActive && styles.levelTabActive,
                  lvl.isAlert && !isActive && styles.levelTabAlert,
                ]}
                onPress={() => {
                  try {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  } catch {}
                  setSelectedLevel(lvl.key as any);
                }}
              >
                <Text
                  style={[
                    styles.levelTabText,
                    isActive && styles.levelTabTextActive,
                    lvl.isAlert && !isActive && styles.levelTabTextAlert,
                  ]}
                >
                  {lvl.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Tag Filters Horizontal */}
        {availableTags.length > 1 && (
          <View style={styles.tagsFilterWrapper}>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={['all', ...availableTags]}
              keyExtractor={item => item}
              contentContainerStyle={styles.tagsScrollContent}
              renderItem={({ item }) => {
                const isActive = selectedTag === item;
                return (
                  <Pressable
                    style={[styles.tagPill, isActive && styles.tagPillActive]}
                    onPress={() => {
                      try {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      } catch {}
                      setSelectedTag(item);
                    }}
                  >
                    <Text style={[styles.tagPillText, isActive && styles.tagPillTextActive]}>
                      {item === 'all' ? 'Tất cả tag' : `#${item}`}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        )}

        {/* Copied Notification Toast */}
        {copiedNotification && (
          <View style={styles.copiedToast}>
            <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
            <Text style={styles.copiedToastText}>Đã sao chép nhật ký vào bộ nhớ tạm!</Text>
          </View>
        )}

        {/* Logs List */}
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyTitle}>Chưa có log nào phù hợp</Text>
            <Text style={styles.emptyDesc}>
              Các thao tác database, gọi AI copilot, lỗi hệ thống và đồng bộ sẽ xuất hiện tại đây.
            </Text>
          </View>
        ) : (
          <FlatList
            data={filteredLogs}
            keyExtractor={item => item.id}
            renderItem={renderLogItem}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={20}
          />
        )}

        {/* Bottom Actions Bar */}
        <View style={styles.bottomBar}>
          <Pressable style={styles.bottomBtn} onPress={handleCopyLogs}>
            <Ionicons name="copy-outline" size={16} color="#000000" />
            <Text style={styles.bottomBtnText}>Sao chép</Text>
          </Pressable>

          <Pressable style={styles.bottomBtn} onPress={handleShareLogs}>
            <Ionicons name="share-social-outline" size={16} color="#000000" />
            <Text style={styles.bottomBtnText}>Chia sẻ</Text>
          </Pressable>

          <Pressable
            style={[styles.bottomBtn, styles.bottomBtnDanger]}
            onPress={handleClearLogs}
          >
            <Ionicons name="trash-outline" size={16} color="#DC2626" />
            <Text style={[styles.bottomBtnText, { color: '#DC2626' }]}>Xóa log</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#000000',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flex: 1,
  },
  folderTabBadge: {
    alignSelf: 'flex-start',
    backgroundColor: THEME.popYellow,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#000000',
    marginBottom: 4,
  },
  folderTabBadgeText: {
    fontSize: 9,
    fontWeight: '900',
    color: '#000000',
    letterSpacing: 0.5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#000000',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchRow: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
    backgroundColor: '#FFFFFF',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderWidth: 1.5,
    borderColor: '#000000',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    padding: 0,
  },

  // Level Tabs
  levelFilterRow: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 6,
    gap: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#E5E7EB',
  },
  levelTab: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelTabActive: {
    backgroundColor: THEME.popYellow,
    borderColor: '#000000',
    borderWidth: 2,
  },
  levelTabAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FCA5A5',
  },
  levelTabText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  levelTabTextActive: {
    color: '#000000',
  },
  levelTabTextAlert: {
    color: '#DC2626',
  },

  // Tags filter
  tagsFilterWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000',
  },
  tagsScrollContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  tagPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  tagPillActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  tagPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  tagPillTextActive: {
    color: '#FFFFFF',
  },

  // Log Card
  listContent: {
    padding: 14,
    paddingBottom: 24,
  },
  logCardShadow: {
    backgroundColor: '#000000',
    borderRadius: 12,
    marginBottom: 10,
  },
  logCardInner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#000000',
    padding: 10,
    transform: [{ translateX: -2 }, { translateY: -2 }],
  },
  logCardError: {
    backgroundColor: '#FFF5F5',
  },
  logCardWarn: {
    backgroundColor: '#FFFDF0',
  },
  logMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  logMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    borderWidth: 1,
  },
  levelBadgeText: {
    fontSize: 9,
    fontWeight: '900',
  },
  tagBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#000000',
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
  },
  logTimeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#6B7280',
    fontVariant: ['tabular-nums'],
  },
  logMetaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  itemCopyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F3F4F6',
  },
  itemCopyBtnSuccess: {
    borderColor: '#86EFAC',
    backgroundColor: '#DCFCE7',
  },
  itemCopyBtnText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#374151',
  },
  itemCopyBtnTextSuccess: {
    color: '#15803D',
  },
  logMessageText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#111827',
    lineHeight: 18,
  },

  // Details
  detailsContainer: {
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 6,
  },
  detailsToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  detailsToggleText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#4B5563',
  },
  detailsBox: {
    marginTop: 6,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    padding: 8,
    borderWidth: 1,
    borderColor: '#000000',
  },
  detailsText: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#F8FAFC',
    lineHeight: 16,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#111827',
    marginTop: 10,
  },
  emptyDesc: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },

  // Toast
  copiedToast: {
    position: 'absolute',
    top: 130,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#059669',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    zIndex: 99,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  copiedToastText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  // Bottom bar
  bottomBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 2,
    borderTopColor: '#000000',
    gap: 10,
  },
  bottomBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#000000',
    backgroundColor: '#F3F4F6',
  },
  bottomBtnDanger: {
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  bottomBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#000000',
  },
});
