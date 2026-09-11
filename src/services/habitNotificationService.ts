import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { File, Paths } from 'expo-file-system';
import dayjs from 'dayjs';
import { Transaction, Category } from '../types';

// Cấu hình thông báo cho phép hiển thị banner, âm thanh khi app đang mở
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
export const NOTIFICATION_ID_LUNCH = 'habit-reminder-lunch';
export const NOTIFICATION_ID_DINNER = 'habit-reminder-dinner';
export const NOTIFICATION_ID_DAILY = 'habit-reminder-daily';

export interface HabitReminderConfig {
  enabled: boolean;
  autoLearn: boolean;
  lunchTime: string; // HH:mm, e.g. "13:15"
  dinnerTime: string; // HH:mm, e.g. "20:00"
  dailyWrapUpTime: string; // HH:mm, e.g. "21:30"
  detectedLunchPeak?: string; // e.g. "12:15"
  detectedDinnerPeak?: string; // e.g. "18:45"
  lastAbsenceCheckDate?: string;
}

export const DEFAULT_HABIT_CONFIG: HabitReminderConfig = {
  enabled: true,
  autoLearn: true,
  lunchTime: '13:15',
  dinnerTime: '20:00',
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
      return { ...DEFAULT_HABIT_CONFIG, ...parsed };
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
 * Đăng ký Notification Channel trên Android và xin quyền thông báo
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

/**
 * Danh sách thông điệp dí dỏm bằng tiếng Việt (100% KHÔNG DÙNG EMOJI)
 */
const LUNCH_MESSAGES = [
  {
    title: 'Ví Của Tôi: Trưa nay ăn gì ngon không bạn ơi?',
    body: 'Ví chưa thấy bạn ghi lại bữa trưa. Mải làm quên ăn hay quên ghi thế? Vào ghi ngay 2 giây kẻo chiều lại quên mất nha!',
  },
  {
    title: 'Ví Của Tôi: Bữa trưa nay bao nhiêu cành thế?',
    body: 'Chiếc ví đang đợi bạn điểm danh cơm trưa đây. Mở app ghi nhanh một chạm để số dư luôn chuẩn chỉnh nào!',
  },
  {
    title: 'Ví Của Tôi: Nạp năng lượng buổi trưa chưa bạn?',
    body: 'Đừng để chiếc ví đói thông tin. Vào khai báo bữa trưa ngay với ví bạn thân nhé!',
  },
];

const DINNER_MESSAGES = [
  {
    title: 'Ví Của Tôi: Tối nay ăn gì ngon không bạn ơi?',
    body: 'Ví chưa thấy bạn ghi lại bữa tối này. Vào gõ nhẹ vài số tiền để ví quản lý tài chính chuẩn chỉ cho bạn nha!',
  },
  {
    title: 'Ví Của Tôi: Đi ăn tối về chưa bạn ơi?',
    body: 'Chiếc ví đang ngóng bạn vào chốt bữa tối đây. Mở app điểm danh ngay trong 2 giây nào!',
  },
  {
    title: 'Ví Của Tôi: Bữa tối hôm nay thế nào rồi?',
    body: 'Dù tự nấu hay đi ăn ngoài, đừng quên ghé qua ví ghi lại nhé. Quản lý chi tiêu đều đặn để ví luôn đầy đặn!',
  },
];

const DAILY_WRAP_UP_MESSAGES = [
  {
    title: 'Ví Của Tôi: Giờ chốt sổ cuối ngày rồi!',
    body: 'Hôm nay bạn quản lý tài chính rất tốt. Kiểm tra lại ví xem còn khoản lặt vặt nào phát sinh chưa kịp ghi không nhé!',
  },
  {
    title: 'Ví Của Tôi: Nhìn lại chi tiêu hôm nay nào!',
    body: 'Dành 10 giây cùng ví rà soát lại số dư hôm nay trước khi đi ngủ nhé. Chúc bạn ngủ ngon và tài chính vững vàng!',
  },
];

const ZERO_TX_DAILY_MESSAGES = [
  {
    title: 'Ví Của Tôi: Hôm nay bạn bận lắm đúng không?',
    body: 'Cả ngày hôm nay chưa thấy bạn ghé thăm ví. Một ngày tiết kiệm tuyệt đối hay bận quá chưa kịp ghi chép thế?',
  },
  {
    title: 'Ví Của Tôi: Ví nhớ bạn rồi đấy!',
    body: 'Hôm nay có phát sinh khoản chi tiêu nào chưa ghi lại không bạn ơi? Vào ghi chép ngay kẻo mai lại quên mất nhé!',
  },
];

function getRandomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

/**
 * Phân tích lịch sử giao dịch SQLite để học giờ đỉnh (Peak Hours) của các bữa ăn
 */
export function analyzeHabitPeakHours(
  transactions: Transaction[],
  categories: Category[]
): {
  detectedLunchPeak?: string;
  suggestedLunchTime: string;
  detectedDinnerPeak?: string;
  suggestedDinnerTime: string;
} {
  // Tìm các ID danh mục thuộc nhóm Ăn uống / Cà phê
  const foodCatIds = new Set<string>();
  categories.forEach((cat) => {
    const nameLower = cat.name.toLowerCase();
    if (
      cat.type === 'expense' &&
      (nameLower.includes('ăn') ||
        nameLower.includes('uống') ||
        nameLower.includes('cơm') ||
        nameLower.includes('food') ||
        cat.id === 'cat_food' ||
        cat.id === 'cat_coffee')
    ) {
      foodCatIds.add(cat.id);
    }
  });

  const lunchMinutes: number[] = [];
  const dinnerMinutes: number[] = [];

  transactions.forEach((tx) => {
    if (tx.type !== 'expense' || !tx.category_id || !foodCatIds.has(tx.category_id)) {
      return;
    }

    const date = dayjs(tx.transacted_at);
    if (!date.isValid()) return;

    const hour = date.hour();
    const minute = date.minute();
    const totalMinutes = hour * 60 + minute;

    // Khung giờ trưa: 11:00 - 13:59 (660 - 839 phút)
    if (totalMinutes >= 660 && totalMinutes <= 839) {
      lunchMinutes.push(totalMinutes);
    }
    // Khung giờ tối: 17:30 - 21:00 (1050 - 1260 phút)
    else if (totalMinutes >= 1050 && totalMinutes <= 1260) {
      dinnerMinutes.push(totalMinutes);
    }
  });

  let detectedLunchPeak: string | undefined;
  let suggestedLunchTime = DEFAULT_HABIT_CONFIG.lunchTime;

  if (lunchMinutes.length >= 3) {
    lunchMinutes.sort((a, b) => a - b);
    const medianLunchMin = lunchMinutes[Math.floor(lunchMinutes.length / 2)];
    const peakH = Math.floor(medianLunchMin / 60);
    const peakM = medianLunchMin % 60;
    detectedLunchPeak = `${String(peakH).padStart(2, '0')}:${String(peakM).padStart(2, '0')}`;

    // Nhắc sau đỉnh khoảng 50 phút
    const reminderMin = Math.min(medianLunchMin + 50, 14 * 60); // không quá 14:00
    const remH = Math.floor(reminderMin / 60);
    const remM = reminderMin % 60;
    suggestedLunchTime = `${String(remH).padStart(2, '0')}:${String(remM).padStart(2, '0')}`;
  }

  let detectedDinnerPeak: string | undefined;
  let suggestedDinnerTime = DEFAULT_HABIT_CONFIG.dinnerTime;

  if (dinnerMinutes.length >= 3) {
    dinnerMinutes.sort((a, b) => a - b);
    const medianDinnerMin = dinnerMinutes[Math.floor(dinnerMinutes.length / 2)];
    const peakH = Math.floor(medianDinnerMin / 60);
    const peakM = medianDinnerMin % 60;
    detectedDinnerPeak = `${String(peakH).padStart(2, '0')}:${String(peakM).padStart(2, '0')}`;

    // Nhắc sau đỉnh khoảng 65 phút
    const reminderMin = Math.min(medianDinnerMin + 65, 21 * 60); // không quá 21:00
    const remH = Math.floor(reminderMin / 60);
    const remM = reminderMin % 60;
    suggestedDinnerTime = `${String(remH).padStart(2, '0')}:${String(remM).padStart(2, '0')}`;
  }

  return {
    detectedLunchPeak,
    suggestedLunchTime,
    detectedDinnerPeak,
    suggestedDinnerTime,
  };
}

/**
 * Kiểm tra xem hôm nay đã ghi chép danh mục ăn uống trong khung giờ trưa / tối chưa (Smart Absence Check)
 */
export function checkDailyMealAbsence(
  transactions: Transaction[],
  categories: Category[]
): {
  hasLoggedLunchToday: boolean;
  hasLoggedDinnerToday: boolean;
  totalTransactionsToday: number;
} {
  const todayStr = dayjs().format('YYYY-MM-DD');

  const foodCatIds = new Set<string>();
  categories.forEach((cat) => {
    const nameLower = cat.name.toLowerCase();
    if (
      cat.type === 'expense' &&
      (nameLower.includes('ăn') ||
        nameLower.includes('uống') ||
        nameLower.includes('cơm') ||
        cat.id === 'cat_food' ||
        cat.id === 'cat_coffee')
    ) {
      foodCatIds.add(cat.id);
    }
  });

  let hasLoggedLunchToday = false;
  let hasLoggedDinnerToday = false;
  let totalTransactionsToday = 0;

  transactions.forEach((tx) => {
    const txDate = dayjs(tx.transacted_at);
    if (!txDate.isValid() || txDate.format('YYYY-MM-DD') !== todayStr) {
      return;
    }

    totalTransactionsToday++;

    if (tx.type === 'expense' && tx.category_id && foodCatIds.has(tx.category_id)) {
      const hour = txDate.hour();
      const minute = txDate.minute();
      const totalMin = hour * 60 + minute;

      // Khoảng ăn trưa: 10:45 - 14:30
      if (totalMin >= 645 && totalMin <= 870) {
        hasLoggedLunchToday = true;
      }
      // Khoảng ăn tối: 17:00 - 21:30
      if (totalMin >= 1020 && totalMin <= 1290) {
        hasLoggedDinnerToday = true;
      }
    }
  });

  return {
    hasLoggedLunchToday,
    hasLoggedDinnerToday,
    totalTransactionsToday,
  };
}

/**
 * Tính toán thời điểm Date kế tiếp cho một mốc giờ HH:mm
 * Nếu targetDate đã qua trong ngày hôm nay hoặc conditionForToday = false, lên lịch cho ngày mai
 */
function getNextTriggerDate(timeHHmm: string, scheduleForToday: boolean): Date {
  const [hStr, mStr] = timeHHmm.split(':');
  const h = parseInt(hStr, 10) || 12;
  const m = parseInt(mStr, 10) || 0;

  let target = dayjs().hour(h).minute(m).second(0).millisecond(0);
  const now = dayjs();

  if (!scheduleForToday || target.isBefore(now)) {
    // Chuyển sang ngày mai
    target = target.add(1, 'day');
  }

  return target.toDate();
}

/**
 * Tìm ID danh mục ăn uống chính để điền sẵn vào QuickAddModal khi bấm thông báo
 */
function findDefaultFoodCategoryId(categories: Category[]): string {
  const cat = categories.find(
    (c) =>
      c.id === 'cat_food' ||
      (c.type === 'expense' && c.name.toLowerCase().includes('ăn uống'))
  );
  return cat ? cat.id : 'cat_food';
}

/**
 * Làm mới toàn bộ lịch thông báo nhắc nhở thông minh
 * Gọi hàm này mỗi khi mở app, thay đổi cấu hình, hoặc khi thêm/sửa/xóa giao dịch
 */
export async function refreshHabitReminders(
  transactions: Transaction[],
  categories: Category[]
): Promise<void> {
  try {
    const config = await loadHabitConfig();
    if (!config.enabled) {
      // Hủy mọi lịch nhắc nếu tính năng đang tắt
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID_LUNCH);
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID_DINNER);
      await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID_DAILY);
      return;
    }

    // Tự động phân tích giờ nếu bật autoLearn
    let lunchTime = config.lunchTime;
    let dinnerTime = config.dinnerTime;
    let detectedLunchPeak = config.detectedLunchPeak;
    let detectedDinnerPeak = config.detectedDinnerPeak;

    if (config.autoLearn) {
      const analysis = analyzeHabitPeakHours(transactions, categories);
      lunchTime = analysis.suggestedLunchTime;
      dinnerTime = analysis.suggestedDinnerTime;
      detectedLunchPeak = analysis.detectedLunchPeak;
      detectedDinnerPeak = analysis.detectedDinnerPeak;

      // Lưu lại thông tin nhận diện
      await saveHabitConfig({
        lunchTime,
        dinnerTime,
        detectedLunchPeak,
        detectedDinnerPeak,
      });
    }

    // Kiểm tra vắng mặt hôm nay (Smart Absence Check)
    const { hasLoggedLunchToday, hasLoggedDinnerToday, totalTransactionsToday } =
      checkDailyMealAbsence(transactions, categories);

    const defaultFoodCatId = findDefaultFoodCategoryId(categories);

    // 1. Lập lịch nhắc BỮA TRƯA
    // Nếu hôm nay ĐÃ ghi bữa trưa rồi -> Chỉ lên lịch cho ngày mai
    // Nếu hôm nay CHƯA ghi -> Lên lịch cho hôm nay (nếu chưa quá giờ) hoặc ngày mai
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID_LUNCH);
    const lunchTriggerDate = getNextTriggerDate(lunchTime, !hasLoggedLunchToday);
    const lunchMsg = getRandomItem(LUNCH_MESSAGES);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID_LUNCH,
      content: {
        title: lunchMsg.title,
        body: lunchMsg.body,
        sound: true,
        data: {
          action: 'QUICK_ADD',
          categoryId: defaultFoodCatId,
          type: 'expense',
          suggestedNote: 'Cơm trưa',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: lunchTriggerDate,
        channelId: HABIT_CHANNEL_ID,
      },
    });

    // 2. Lập lịch nhắc BỮA TỐI
    // Nếu hôm nay ĐÃ ghi bữa tối rồi -> Chỉ lên lịch cho ngày mai
    // Nếu hôm nay CHƯA ghi -> Lên lịch cho hôm nay (nếu chưa quá giờ) hoặc ngày mai
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID_DINNER);
    const dinnerTriggerDate = getNextTriggerDate(dinnerTime, !hasLoggedDinnerToday);
    const dinnerMsg = getRandomItem(DINNER_MESSAGES);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID_DINNER,
      content: {
        title: dinnerMsg.title,
        body: dinnerMsg.body,
        sound: true,
        data: {
          action: 'QUICK_ADD',
          categoryId: defaultFoodCatId,
          type: 'expense',
          suggestedNote: 'Bữa tối',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dinnerTriggerDate,
        channelId: HABIT_CHANNEL_ID,
      },
    });

    // 3. Lập lịch CHỐT SỔ CUỐI NGÀY
    await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID_DAILY);
    const dailyTriggerDate = getNextTriggerDate(config.dailyWrapUpTime, true);
    const dailyMsg =
      totalTransactionsToday === 0
        ? getRandomItem(ZERO_TX_DAILY_MESSAGES)
        : getRandomItem(DAILY_WRAP_UP_MESSAGES);

    await Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID_DAILY,
      content: {
        title: dailyMsg.title,
        body: dailyMsg.body,
        sound: true,
        data: {
          action: 'DAILY_WRAP_UP',
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: dailyTriggerDate,
        channelId: HABIT_CHANNEL_ID,
      },
    });
  } catch (e) {
    console.warn('Lỗi khi lập lịch nhắc nhở thói quen:', e);
  }
}

/**
 * Gửi một thông báo thử nghiệm sau 2 giây (được kích hoạt từ nút bấm trong Cài đặt)
 */
export async function sendTestHabitNotificationAsync(categoryId?: string): Promise<boolean> {
  try {
    const isGranted = await setupNotificationChannelAsync();
    if (!isGranted) {
      return false;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Ví Của Tôi: Thử nghiệm thông báo thành công!',
        body: 'Chiếc ví hoạt động hoàn hảo. Chạm vào thông báo này để trải nghiệm tính năng ghi chép nhanh trong 2 giây nhé!',
        sound: true,
        data: {
          action: 'QUICK_ADD',
          categoryId: categoryId || 'cat_food',
          type: 'expense',
          suggestedNote: 'Ăn uống thử nghiệm',
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
