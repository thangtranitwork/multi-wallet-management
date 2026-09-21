import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { File, Paths } from 'expo-file-system';
import dayjs from 'dayjs';
import { Transaction, Category } from '../types';
import {
  detectRecurringBills,
  RecurringBillPattern,
  detectWeeklyHabits,
  WeeklyHabitPattern,
} from './predictionService';

// Cấu hình hiển thị thông báo cục bộ
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const HABIT_CHANNEL_ID = 'habit-reminders';

export interface LearnedHabit {
  id: string;
  type: 'daily_time' | 'monthly_bill' | 'weekly_routine' | 'daily_wrapup';
  categoryId?: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  title: string;
  subtitle: string;
  triggerTimeStr: string; // e.g. "13:15" hoặc "Ngày 15 hàng tháng (09:00)"
  triggerHour: number;
  triggerMinute: number;
  dayOfMonth?: number;
  daysOfWeek?: number[]; // e.g. [1, 2, 3, 4, 5] cho T2-T6, [0, 6] cho cuối tuần, [6] cho Thứ 7
  scheduleBadge: string; // e.g. "Thứ 2 - Thứ 6", "Cuối tuần", "Thứ Bảy hàng tuần", "Ngày 10 hàng tháng", "Hằng ngày"
  scheduleBadgeColor: string; // e.g. "#3B82F6", "#F97316", "#8B5CF6", "#EF4444", "#6B7280"
  suggestedNote: string;
  occurrences: number;
  isLoggedTodayOrThisMonth?: boolean;
  isEnabled: boolean;
}

export interface HabitReminderConfig {
  enabled: boolean;
  autoLearn: boolean;
  disabledHabitIds: string[];
  dailyWrapUpTime: string; // HH:mm, e.g. "21:30"
}

export const DEFAULT_HABIT_CONFIG: HabitReminderConfig = {
  enabled: true,
  autoLearn: true,
  disabledHabitIds: [],
  dailyWrapUpTime: '21:30',
};

function getConfigFile(): File {
  return new File(Paths.document, 'habit_reminder_config.json');
}

/**
 * Đọc cấu hình nhắc nhở thói quen từ bộ nhớ cục bộ
 */
export async function loadHabitConfig(): Promise<HabitReminderConfig> {
  try {
    const file = getConfigFile();
    if (file.exists) {
      const content = await file.text();
      const parsed = JSON.parse(content);
      return {
        ...DEFAULT_HABIT_CONFIG,
        ...parsed,
        disabledHabitIds: Array.isArray(parsed.disabledHabitIds)
          ? parsed.disabledHabitIds
          : [],
      };
    }
  } catch (e) {
    console.warn('Lỗi đọc cấu hình nhắc nhở thói quen:', e);
  }
  return DEFAULT_HABIT_CONFIG;
}

/**
 * Lưu cấu hình nhắc nhở thói quen
 */
export async function saveHabitConfig(
  newConfig: Partial<HabitReminderConfig>
): Promise<HabitReminderConfig> {
  try {
    const current = await loadHabitConfig();
    const updated = { ...current, ...newConfig };
    const file = getConfigFile();
    await file.write(JSON.stringify(updated, null, 2));
    return updated;
  } catch (e) {
    console.warn('Lỗi lưu cấu hình nhắc nhở thói quen:', e);
    return DEFAULT_HABIT_CONFIG;
  }
}

/**
 * Bật/Tắt một thói quen cụ thể
 */
export async function toggleHabitItem(
  habitId: string,
  enabled: boolean
): Promise<HabitReminderConfig> {
  const current = await loadHabitConfig();
  let disabledIds = current.disabledHabitIds || [];
  if (enabled) {
    disabledIds = disabledIds.filter((id) => id !== habitId);
  } else {
    if (!disabledIds.includes(habitId)) {
      disabledIds = [...disabledIds, habitId];
    }
  }
  return await saveHabitConfig({ disabledHabitIds: disabledIds });
}

/**
 * Đăng ký Notification Channel trên Android và kiểm tra quyền thông báo
 */
export async function setupNotificationChannelAsync(): Promise<boolean> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(HABIT_CHANNEL_ID, {
        name: 'Nhắc nhở chi tiêu',
        description: 'Nhắc nhở thông minh theo thói quen sinh hoạt và chốt sổ chi tiêu',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FFE600',
        enableLights: true,
        enableVibrate: true,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    return finalStatus === 'granted';
  } catch (e) {
    console.warn('Lỗi khởi tạo Notification Channel:', e);
    return false;
  }
}

// Cấu trúc khung giờ sinh hoạt trong ngày
interface TimeWindowDef {
  key: string;
  name: string;
  startHour: number;
  endHour: number;
  defaultReminderTime: string; // HH:mm
  defaultCategoryNamePart: string;
  defaultNote: string;
}

const TIME_WINDOWS: TimeWindowDef[] = [
  {
    key: 'morning',
    name: 'Buổi sáng',
    startHour: 6,
    endHour: 10,
    defaultReminderTime: '09:15',
    defaultCategoryNamePart: 'cà phê',
    defaultNote: 'Cà phê sáng / Ăn sáng',
  },
  {
    key: 'lunch',
    name: 'Bữa trưa',
    startHour: 11,
    endHour: 14,
    defaultReminderTime: '13:15',
    defaultCategoryNamePart: 'ăn uống',
    defaultNote: 'Cơm trưa',
  },
  {
    key: 'afternoon',
    name: 'Buổi chiều',
    startHour: 14,
    endHour: 17.5,
    defaultReminderTime: '16:15',
    defaultCategoryNamePart: 'đồ uống',
    defaultNote: 'Trà chiều / Ăn vặt',
  },
  {
    key: 'dinner',
    name: 'Bữa tối',
    startHour: 17.5,
    endHour: 21,
    defaultReminderTime: '20:00',
    defaultCategoryNamePart: 'ăn uống',
    defaultNote: 'Bữa tối',
  },
];

/**
 * Tạo nội dung thông báo dí dỏm bằng tiếng Việt theo ngữ cảnh (100% KHÔNG DÙNG EMOJI)
 */
function generateHabitMessage(
  habitType: string,
  categoryName: string,
  suggestedNote: string
): { title: string; body: string } {
  const catLower = categoryName.toLowerCase();

  // 1. Cà phê & Đồ uống
  if (catLower.includes('cà phê') || catLower.includes('đồ uống') || catLower.includes('cafe')) {
    if (habitType === 'morning') {
      return {
        title: 'Ví Của Tôi: Cốc cà phê sáng nay thế nào bạn ơi?',
        body: 'Ví chưa thấy bạn ghi lại khoản cà phê nạp năng lượng sáng nay. Vào ghi nhanh 2 giây cho ví nhé!',
      };
    }
    return {
      title: 'Ví Của Tôi: Nạp năng lượng buổi chiều chưa bạn?',
      body: 'Chiếc ví đang đợi bạn điểm danh cốc trà chiều hoặc cà phê đây. Mở app gõ nhẹ vài số tiền nào!',
    };
  }

  // 2. Ăn uống / Cơm
  if (catLower.includes('ăn') || catLower.includes('cơm') || catLower.includes('food')) {
    if (habitType === 'lunch') {
      return {
        title: 'Ví Của Tôi: Trưa nay ăn gì ngon không bạn ơi?',
        body: 'Ví chưa thấy bạn ghi lại bữa trưa. Mải làm quên ăn hay quên ghi thế? Vào ghi ngay 2 giây kẻo chiều lại quên mất nha!',
      };
    }
    return {
      title: 'Ví Của Tôi: Tối nay ăn gì ngon không bạn ơi?',
      body: 'Chiếc ví đang đợi bạn điểm danh bữa tối đây. Vào cập nhật ngay để số dư luôn chuẩn chỉnh nhé!',
    };
  }

  // 3. Đi lại / Xăng xe
  if (catLower.includes('xăng') || catLower.includes('đi lại') || catLower.includes('transport')) {
    return {
      title: 'Ví Của Tôi: Hôm nay có phát sinh đi lại không bạn?',
      body: 'Ví chưa thấy bạn ghi lại chi phí xăng xe hoặc di chuyển. Vào cập nhật ngay kẻo trôi mất khoản tiền lẻ nhé!',
    };
  }

  // 4. Mua sắm / Siêu thị
  if (catLower.includes('mua sắm') || catLower.includes('siêu thị') || catLower.includes('shopping')) {
    return {
      title: 'Ví Của Tôi: Hôm nay có ghé sắm gì không bạn ơi?',
      body: 'Nếu vừa đi chợ hoặc mua đồ về, đừng quên mở ví ghi lại ngay để kiểm soát ngân sách tháng này nha!',
    };
  }

  // 5. Thể thao / Gym / Sức khỏe
  if (catLower.includes('sức khỏe') || catLower.includes('thể thao') || catLower.includes('gym')) {
    return {
      title: 'Ví Của Tôi: Rèn luyện sức khỏe hôm nay thế nào?',
      body: 'Ví nhắc nhẹ bạn ghi lại chi phí thể thao, bơi lội hoặc thuốc men nếu có phát sinh hôm nay nhé!',
    };
  }

  // Mặc định cho các danh mục khác
  return {
    title: `Ví Của Tôi: Đã ghi chép mục ${categoryName} chưa?`,
    body: `Ví nhận thấy bạn thường có chi tiêu cho ${suggestedNote || categoryName} vào khung giờ này. Vào ghi nhanh 2 giây bạn nhé!`,
  };
}

/**
 * Phân tích và phát hiện toàn bộ thói quen hành vi từ SQLite:
 * 1. Thói quen theo khung giờ hàng ngày (Cà phê sáng, Cơm trưa, Trà chiều, Bữa tối, v.v.)
 * 2. Hóa đơn định kỳ theo ngày trong tháng (Điện, Nước, Internet, Tiền nhà)
 * 3. Chốt sổ chi tiêu cuối ngày
 */
export function discoverLearnedHabits(
  transactions: Transaction[],
  categories: Category[],
  config: HabitReminderConfig
): LearnedHabit[] {
  const catMap = new Map<string, Category>(categories.map((c) => [c.id, c]));
  const expenseTxs = transactions.filter(
    (t) => t.type === 'expense' && t.category_id && t.amount > 0
  );

  const disabledSet = new Set(config.disabledHabitIds || []);
  const habits: LearnedHabit[] = [];

  // ==========================================
  // PHẦN 1: THÓI QUEN THEO KHUNG GIỜ HÀNG NGÀY
  // ==========================================
  TIME_WINDOWS.forEach((win) => {
    // Lọc các giao dịch rơi vào khung giờ này
    const windowTxs: { tx: Transaction; minuteOfDay: number }[] = [];

    expenseTxs.forEach((tx) => {
      const d = dayjs(tx.transacted_at);
      if (!d.isValid()) return;
      const h = d.hour() + d.minute() / 60;
      if (h >= win.startHour && h < win.endHour) {
        windowTxs.push({ tx, minuteOfDay: d.hour() * 60 + d.minute() });
      }
    });

    // Đếm tần suất theo danh mục trong khung giờ, phân biệt ngày thường và cuối tuần
    const catCountMap = new Map<
      string,
      { count: number; minutes: number[]; notes: string[]; weekdayCount: number; weekendCount: number }
    >();

    windowTxs.forEach(({ tx, minuteOfDay }) => {
      const catId = tx.category_id!;
      const cur = catCountMap.get(catId) || {
        count: 0,
        minutes: [],
        notes: [],
        weekdayCount: 0,
        weekendCount: 0,
      };
      cur.count += 1;
      cur.minutes.push(minuteOfDay);
      if (tx.note) cur.notes.push(tx.note);
      const dow = dayjs(tx.transacted_at).day();
      if (dow === 0 || dow === 6) {
        cur.weekendCount += 1;
      } else {
        cur.weekdayCount += 1;
      }
      catCountMap.set(catId, cur);
    });

    // Chọn danh mục nổi bật nhất
    let topCatId: string | null = null;
    let maxCount = 0;

    catCountMap.forEach((data, cId) => {
      if (data.count > maxCount) {
        maxCount = data.count;
        topCatId = cId;
      }
    });

    // Nếu không đủ dữ liệu (dưới 2 giao dịch), tìm danh mục mặc định phù hợp
    let chosenCat: Category | undefined;
    let reminderHour: number;
    let reminderMinute: number;
    let detectedPeakStr = '';
    let occurrences = maxCount;
    let suggestedNote = win.defaultNote;
    let daysOfWeek: number[] = [0, 1, 2, 3, 4, 5, 6];
    let scheduleBadge = 'Hằng ngày';
    let scheduleBadgeColor = '#6B7280';

    if (topCatId && maxCount >= 2) {
      chosenCat = catMap.get(topCatId);
      const data = catCountMap.get(topCatId)!;
      data.minutes.sort((a, b) => a - b);
      const medianMin = data.minutes[Math.floor(data.minutes.length / 2)];

      const peakH = Math.floor(medianMin / 60);
      const peakM = medianMin % 60;
      detectedPeakStr = `${String(peakH).padStart(2, '0')}:${String(peakM).padStart(2, '0')}`;

      // Giờ nhắc = Đỉnh + 45 phút (không vượt quá giờ kết thúc khung)
      const remMin = Math.min(medianMin + 45, Math.floor(win.endHour * 60));
      reminderHour = Math.floor(remMin / 60);
      reminderMinute = remMin % 60;

      // Note phổ biến nhất
      if (data.notes.length > 0) {
        const noteCounts: Record<string, number> = {};
        data.notes.forEach((n) => (noteCounts[n] = (noteCounts[n] || 0) + 1));
        suggestedNote = Object.entries(noteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || suggestedNote;
      }

      // Phân tích thói quen ngày thường vs cuối tuần
      if (
        (data.weekdayCount >= 2 && data.weekendCount === 0) ||
        (data.count >= 4 && data.weekdayCount / data.count >= 0.75)
      ) {
        daysOfWeek = [1, 2, 3, 4, 5];
        scheduleBadge = 'Thứ 2 - Thứ 6';
        scheduleBadgeColor = '#3B82F6';
      } else if (
        (data.weekendCount >= 2 && data.weekdayCount === 0) ||
        (data.count >= 4 && data.weekendCount / data.count >= 0.75)
      ) {
        daysOfWeek = [0, 6];
        scheduleBadge = 'Cuối tuần (T7, CN)';
        scheduleBadgeColor = '#F97316';
      }
    } else {
      // Fallback danh mục mặc định
      chosenCat = categories.find(
        (c) =>
          c.type === 'expense' &&
          c.name.toLowerCase().includes(win.defaultCategoryNamePart)
      ) || categories.find((c) => c.type === 'expense');

      const [defH, defM] = win.defaultReminderTime.split(':').map((s) => parseInt(s, 10));
      reminderHour = defH;
      reminderMinute = defM;
    }

    if (chosenCat) {
      const habitId = `habit_daily_${win.key}`;
      const timeStr = `${String(reminderHour).padStart(2, '0')}:${String(reminderMinute).padStart(2, '0')}`;
      const subtitle = detectedPeakStr
        ? `Giờ quen thuộc ~${detectedPeakStr} • ${scheduleBadge} (${timeStr})`
        : `Khung giờ vàng sinh hoạt • ${scheduleBadge} (${timeStr})`;

      habits.push({
        id: habitId,
        type: 'daily_time',
        categoryId: chosenCat.id,
        categoryName: chosenCat.name,
        categoryIcon: chosenCat.icon,
        categoryColor: chosenCat.color,
        title: `${win.name}: ${chosenCat.name}`,
        subtitle,
        triggerTimeStr: timeStr,
        triggerHour: reminderHour,
        triggerMinute: reminderMinute,
        daysOfWeek,
        scheduleBadge,
        scheduleBadgeColor,
        suggestedNote,
        occurrences,
        isEnabled: !disabledSet.has(habitId),
      });
    }
  });

  // ==========================================
  // PHẦN 2: THÓI QUEN THEO THỨ TRONG TUẦN (WEEKLY HABITS)
  // ==========================================
  try {
    const weeklyHabits = detectWeeklyHabits(transactions, categories);
    // Lấy tối đa 3 thói quen định kỳ rõ rệt theo thứ trong tuần
    weeklyHabits.slice(0, 3).forEach((habit) => {
      const habitId = `habit_weekly_${habit.categoryId}_dow_${habit.dayOfWeek}`;
      const triggerHour = Math.floor(habit.preferredHour || 9);
      const triggerMinute = Math.round(((habit.preferredHour || 9) % 1) * 60);
      const timeStr = `${String(triggerHour).padStart(2, '0')}:${String(triggerMinute).padStart(2, '0')}`;
      const dayBadge = `${habit.dayOfWeekName} hàng tuần`;

      habits.push({
        id: habitId,
        type: 'weekly_routine',
        categoryId: habit.categoryId,
        categoryName: habit.categoryName,
        categoryIcon: habit.categoryIcon,
        categoryColor: habit.categoryColor,
        title: `${habit.dayOfWeekName}: ${habit.categoryName}`,
        subtitle: `Thói quen ${habit.dayOfWeekName} (~${habit.averageAmount.toLocaleString('vi-VN')} đ) • Nhắc lúc ${timeStr}`,
        triggerTimeStr: `${habit.dayOfWeekName} (${timeStr})`,
        triggerHour,
        triggerMinute,
        daysOfWeek: [habit.dayOfWeek],
        scheduleBadge: dayBadge,
        scheduleBadgeColor: '#8B5CF6',
        suggestedNote: habit.mostCommonNote,
        occurrences: habit.occurrences,
        isEnabled: !disabledSet.has(habitId),
      });
    });
  } catch (e) {
    console.warn('Lỗi phân tích thói quen theo thứ trong tuần:', e);
  }

  // ==========================================
  // PHẦN 3: HÓA ĐƠN ĐỊNH KỲ HÀNG THÁNG
  // ==========================================
  try {
    const billPatterns: RecurringBillPattern[] = detectRecurringBills(transactions, categories);
    // Lấy tối đa 3 hóa đơn định kỳ rõ nét nhất
    billPatterns.slice(0, 3).forEach((bill) => {
      const habitId = `habit_bill_${bill.categoryId}_day_${bill.approxDayOfMonth}`;
      const dayStr = String(bill.approxDayOfMonth).padStart(2, '0');
      const timeStr = `Ngày ${dayStr} hàng tháng (09:00)`;

      habits.push({
        id: habitId,
        type: 'monthly_bill',
        categoryId: bill.categoryId,
        categoryName: bill.categoryName,
        categoryIcon: bill.categoryIcon,
        categoryColor: bill.categoryColor,
        title: `Hóa đơn định kỳ: ${bill.categoryName}`,
        subtitle: `Khoản chi lặp lại (~${bill.averageAmount.toLocaleString('vi-VN')} đ) • ${timeStr}`,
        triggerTimeStr: timeStr,
        triggerHour: 9,
        triggerMinute: 0,
        dayOfMonth: bill.approxDayOfMonth,
        scheduleBadge: `Ngày ${dayStr} hàng tháng`,
        scheduleBadgeColor: '#EF4444',
        suggestedNote: bill.mostCommonNote,
        occurrences: bill.occurrences,
        isLoggedTodayOrThisMonth: bill.isPaidThisMonth,
        isEnabled: !disabledSet.has(habitId),
      });
    });
  } catch (e) {
    console.warn('Lỗi phân tích hóa đơn định kỳ:', e);
  }

  // ==========================================
  // PHẦN 4: CHỐT SỔ CHI TIÊU CUỐI NGÀY
  // ==========================================
  const dailyWrapId = 'habit_daily_wrapup';
  const [wrapH, wrapM] = (config.dailyWrapUpTime || '21:30')
    .split(':')
    .map((s) => parseInt(s, 10));

  habits.push({
    id: dailyWrapId,
    type: 'daily_wrapup',
    categoryName: 'Chốt sổ ngày',
    categoryIcon: 'calendar-outline',
    categoryColor: '#8B5CF6',
    title: 'Chốt sổ chi tiêu cuối ngày',
    subtitle: `Rà soát số dư & khoản chi phát sinh • Nhắc lúc ${config.dailyWrapUpTime || '21:30'}`,
    triggerTimeStr: config.dailyWrapUpTime || '21:30',
    triggerHour: wrapH || 21,
    triggerMinute: wrapM || 30,
    daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
    scheduleBadge: 'Hằng ngày',
    scheduleBadgeColor: '#6B7280',
    suggestedNote: 'Chốt sổ cuối ngày',
    occurrences: 0,
    isEnabled: !disabledSet.has(dailyWrapId),
  });

  return habits;
}

/**
 * Kiểm tra xem hôm nay đã ghi giao dịch cho một thói quen cụ thể chưa (Smart Absence Check động)
 */
export function checkHabitAbsenceToday(
  habit: LearnedHabit,
  transactions: Transaction[]
): boolean {
  const todayStr = dayjs().format('YYYY-MM-DD');
  const currentDow = dayjs().day();

  // Nếu thói quen quy định các thứ áp dụng mà hôm nay không thuộc danh sách đó -> coi như đã xong hôm nay
  if (habit.daysOfWeek && habit.daysOfWeek.length > 0 && !habit.daysOfWeek.includes(currentDow)) {
    return true;
  }

  if (habit.type === 'monthly_bill') {
    // Hóa đơn hàng tháng: xem tháng này đã chi mục đó chưa
    return Boolean(habit.isLoggedTodayOrThisMonth);
  }

  if (habit.type === 'daily_wrapup') {
    // Chốt sổ cuối ngày luôn hợp lệ để lên lịch
    return false;
  }

  // Thói quen theo giờ trong ngày hoặc weekly_routine: kiểm tra giao dịch của category đó trong ngày hôm nay
  const hasLogged = transactions.some((tx) => {
    if (tx.type !== 'expense' || tx.category_id !== habit.categoryId) {
      return false;
    }
    const txDate = dayjs(tx.transacted_at);
    if (!txDate.isValid() || txDate.format('YYYY-MM-DD') !== todayStr) {
      return false;
    }

    // Nếu là thói quen theo giờ, kiểm tra thêm giờ giao dịch có gần mốc không (trong vòng ±2.5 tiếng)
    if (habit.type === 'daily_time') {
      const txHour = txDate.hour() + txDate.minute() / 60;
      return Math.abs(txHour - habit.triggerHour) <= 2.5;
    }

    return true;
  });

  return hasLogged;
}

/**
 * Lập lịch thông báo cho một thời điểm Date cụ thể
 */
function getNextTriggerDateForHabit(habit: LearnedHabit, isAlreadyLoggedToday: boolean): Date {
  const now = dayjs();

  if (habit.type === 'monthly_bill' && habit.dayOfMonth) {
    let target = dayjs().date(habit.dayOfMonth).hour(habit.triggerHour).minute(habit.triggerMinute).second(0).millisecond(0);
    if (target.isBefore(now) || isAlreadyLoggedToday) {
      target = target.add(1, 'month');
    }
    return target.toDate();
  }

  // Lập lịch theo danh sách thứ trong tuần (VD: [1,2,3,4,5] hoặc [6] hoặc [0,6])
  if (habit.daysOfWeek && habit.daysOfWeek.length > 0) {
    let candidate = dayjs().hour(habit.triggerHour).minute(habit.triggerMinute).second(0).millisecond(0);
    
    // Nếu hôm nay không nằm trong thứ áp dụng, hoặc hôm nay đã ghi, hoặc giờ hẹn hôm nay đã qua:
    if (!habit.daysOfWeek.includes(candidate.day()) || candidate.isBefore(now) || isAlreadyLoggedToday) {
      candidate = candidate.add(1, 'day');
      while (!habit.daysOfWeek.includes(candidate.day())) {
        candidate = candidate.add(1, 'day');
      }
    }
    return candidate.toDate();
  }

  // Daily time mặc định
  let target = dayjs().hour(habit.triggerHour).minute(habit.triggerMinute).second(0).millisecond(0);
  if (isAlreadyLoggedToday || target.isBefore(now)) {
    target = target.add(1, 'day');
  }
  return target.toDate();
}

/**
 * Làm mới toàn bộ lịch nhắc nhở thông minh dựa trên toàn bộ thói quen đã học
 */
export async function refreshHabitReminders(
  transactions: Transaction[],
  categories: Category[]
): Promise<void> {
  try {
    const config = await loadHabitConfig();
    if (!config.enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return;
    }

    const habits = discoverLearnedHabits(transactions, categories, config);

    // Hủy các lịch thông báo cũ để đồng bộ danh sách mới nhất
    await Notifications.cancelAllScheduledNotificationsAsync();

    const todayTxs = transactions.filter((t) => dayjs(t.transacted_at).isSame(dayjs(), 'day'));

    for (const habit of habits) {
      if (!habit.isEnabled) continue;

      const isAlreadyLogged = checkHabitAbsenceToday(habit, transactions);
      const triggerDate = getNextTriggerDateForHabit(habit, isAlreadyLogged);

      let title = '';
      let body = '';

      if (habit.type === 'daily_wrapup') {
        if (todayTxs.length === 0) {
          title = 'Ví Của Tôi: Hôm nay bạn bận lắm đúng không?';
          body = 'Cả ngày chưa thấy bạn ghé thăm ví. Không biết hôm nay có chi tiêu gì không hay một ngày tiết kiệm tuyệt đối đây?';
        } else {
          title = 'Ví Của Tôi: Giờ chốt sổ cuối ngày rồi!';
          body = 'Hôm nay bạn quản lý tài chính rất tốt. Kiểm tra lại ví xem còn khoản lặt vặt nào phát sinh chưa kịp ghi không nhé!';
        }
      } else if (habit.type === 'monthly_bill') {
        title = `Ví Của Tôi: Đến hạn ${habit.categoryName} rồi!`;
        body = `Hôm nay là mốc thanh toán định kỳ cho ${habit.suggestedNote || habit.categoryName}. Bạn đã hoàn tất chưa? Vào ghi nhận ngay nhé!`;
      } else if (habit.type === 'weekly_routine') {
        title = `Ví Của Tôi: Đến hẹn ${habit.title}!`;
        body = `Hôm nay là dịp quen thuộc bạn hay chi tiêu cho ${habit.suggestedNote || habit.categoryName}. Vào ghi nhanh 2 giây cho ví nhé!`;
      } else {
        const msg = generateHabitMessage(
          habit.id.replace('habit_daily_', ''),
          habit.categoryName,
          habit.suggestedNote
        );
        title = msg.title;
        body = msg.body;
      }

      await Notifications.scheduleNotificationAsync({
        identifier: `habit-reminder-${habit.id}`,
        content: {
          title,
          body,
          sound: true,
          data: {
            action: 'QUICK_ADD',
            categoryId: habit.categoryId,
            type: 'expense',
            suggestedNote: habit.suggestedNote,
          },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
          channelId: HABIT_CHANNEL_ID,
        },
      });
    }
  } catch (e) {
    console.warn('Lỗi khi lập lịch nhắc nhở thói quen tổng quát:', e);
  }
}

/**
 * Gửi một thông báo thử nghiệm sau 2 giây (được kích hoạt từ nút bấm trong Cài đặt)
 */
export async function sendTestHabitNotificationAsync(
  categoryId?: string,
  customTitle?: string,
  customBody?: string
): Promise<boolean> {
  try {
    const isGranted = await setupNotificationChannelAsync();
    if (!isGranted) {
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: customTitle || 'Ví Của Tôi: Thử nghiệm thông báo thành công!',
        body:
          customBody ||
          'Chiếc ví hoạt động hoàn hảo. Chạm vào thông báo này để trải nghiệm tính năng ghi chép nhanh trong 2 giây nhé!',
        sound: true,
        data: {
          action: 'QUICK_ADD',
          categoryId: categoryId || 'cat_food',
          type: 'expense',
          suggestedNote: 'Chi tiêu thử nghiệm',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 2,
        channelId: HABIT_CHANNEL_ID,
      },
    });

    return true;
  } catch (e) {
    console.error('Lỗi khi gửi thông báo thử nghiệm:', e);
    return false;
  }
}
