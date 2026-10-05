import dayjs from 'dayjs';
import { Transaction, Category } from '../types';

export interface CategorySuggestion {
  category: Category;
  score: number;
  reason: string; // e.g. "Thói quen lúc 11:30", "Khoản chi định kỳ ngày 10", "Khớp từ khóa 'cơm'"
  confidence: 'high' | 'medium' | 'low';
}

export interface PredictionResult {
  primarySuggestion: CategorySuggestion | null;
  topSuggestions: CategorySuggestion[];
  predictedAmount?: number;
  predictedNote?: string;
}

export const VIETNAMESE_DAYS = [
  'Chủ Nhật',
  'Thứ Hai',
  'Thứ Ba',
  'Thứ Tư',
  'Thứ Năm',
  'Thứ Sáu',
  'Thứ Bảy',
];

export interface WeeklyHabitPattern {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dayOfWeekName: string; // e.g. "Thứ Bảy", "Chủ Nhật"
  averageAmount: number;
  mostCommonNote: string;
  occurrences: number;
  preferredHour: number; // e.g. 9.5
}

export interface RecurringBillPattern {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  approxDayOfMonth: number; // e.g. 10
  averageAmount: number;
  mostCommonNote: string;
  occurrences: number;
  lastTransactedDate: string;
  isPaidThisMonth: boolean;
}

export interface DashboardForecast {
  id: string;
  type: 'recurring_bill' | 'meal_time' | 'routine_habit' | 'weekly_habit';
  title: string;
  subtitle: string;
  category: Category;
  suggestedAmount?: number;
  suggestedNote?: string;
  badgeText: string;
  badgeColor: string;
  isUrgent?: boolean;
}

// Default heuristic mappings based on Vietnamese daily routines
const TIME_OF_DAY_HEURISTICS: Array<{
  startHour: number;
  endHour: number;
  preferredCategoryKeywords: string[];
  defaultNote: string;
  reason: string;
}> = [
  {
    startHour: 6,
    endHour: 9.5,
    preferredCategoryKeywords: ['cà phê', 'đồ uống', 'ăn uống', 'coffee', 'cafe'],
    defaultNote: 'Ăn sáng / Cà phê',
    reason: 'Thói quen ăn sáng, cà phê đầu ngày',
  },
  {
    startHour: 11,
    endHour: 13.5,
    preferredCategoryKeywords: ['ăn uống', 'food'],
    defaultNote: 'Cơm trưa',
    reason: 'Thói quen ăn trưa lúc 11h - 13h',
  },
  {
    startHour: 14,
    endHour: 17,
    preferredCategoryKeywords: ['cà phê', 'đồ uống', 'ăn vặt', 'trà'],
    defaultNote: 'Trà chiều / Ăn vặt',
    reason: 'Thói quen nạp năng lượng buổi chiều',
  },
  {
    startHour: 18,
    endHour: 20.5,
    preferredCategoryKeywords: ['ăn uống', 'food'],
    defaultNote: 'Bữa tối',
    reason: 'Thói quen ăn tối lúc 18h - 20h',
  },
  {
    startHour: 21,
    endHour: 24,
    preferredCategoryKeywords: ['giải trí', 'mua sắm', 'ăn uống'],
    defaultNote: 'Giải trí buổi tối',
    reason: 'Thói quen thư giãn cuối ngày',
  },
];

// Semantic dictionary for note keyword matching
const KEYWORD_CATEGORY_MAP: Array<{
  keywords: string[];
  categoryKeywords: string[];
  priority: number;
}> = [
  // Ăn uống
  {
    keywords: [
      'cơm', 'phở', 'bún', 'bánh mì', 'hủ tiếu', 'cháo', 'lẩu', 'nướng', 'mì', 'miến',
      'ăn trưa', 'ăn sáng', 'ăn tối', 'buffet', 'đồ ăn', 'thức ăn', 'kfc', 'lotteria',
      'mcdonald', 'pizza', 'sushi', 'gà rán', 'cơm tấm', 'bánh tráng', 'trưa', 'sáng', 'tối'
    ],
    categoryKeywords: ['ăn uống', 'food'],
    priority: 10,
  },
  // Cà phê & Đồ uống
  {
    keywords: [
      'cafe', 'cà phê', 'cf', 'trà sữa', 'highlands', 'phúc long', 'starbucks', 'katinat',
      'nước mía', 'sinh tố', 'nước ngọt', 'bia', 'rượu', 'cocktail', 'pub', 'bar', 'the coffee house'
    ],
    categoryKeywords: ['cà phê', 'đồ uống', 'coffee'],
    priority: 10,
  },
  // Đi lại & Xăng xe
  {
    keywords: [
      'xăng', 'đổ xăng', 'grab', 'be', 'gojek', 'taxi', 'gửi xe', 'rửa xe', 'vé xe',
      'vé tàu', 'vé máy bay', 'cầu đường', 'thay nhớt', 'sửa xe', 'bảo dưỡng xe'
    ],
    categoryKeywords: ['đi lại', 'xăng xe', 'transport'],
    priority: 10,
  },
  // Nhà cửa / Tiền trọ / Hóa đơn
  {
    keywords: [
      'tiền nhà', 'tiền trọ', 'nhà trọ', 'thuê nhà', 'phòng trọ', 'chung cư',
      'tiền điện', 'tiền nước', 'điện nước', 'wifi', 'internet', 'truyền hình',
      'vệ sinh', 'quản lý chung cư', 'rác', 'bình gas', 'nạp thẻ'
    ],
    categoryKeywords: ['nhà cửa', 'hóa đơn', 'tiện ích', 'home', 'bill'],
    priority: 10,
  },
  // Mua sắm
  {
    keywords: [
      'shopee', 'lazada', 'tiki', 'tiktok shop', 'siêu thị', 'chợ', 'quần áo', 'giày',
      'dép', 'mỹ phẩm', 'mua sắm', 'shopping', 'tạp hóa', 'bách hóa xanh', 'winmart'
    ],
    categoryKeywords: ['mua sắm', 'shopping'],
    priority: 8,
  },
  // Sức khỏe
  {
    keywords: ['thuốc', 'nhà thuốc', 'khám', 'bệnh viện', 'nha khoa', 'bác sĩ', 'vitamin'],
    categoryKeywords: ['sức khỏe', 'y tế', 'health'],
    priority: 9,
  },
  // Giáo dục
  {
    keywords: ['học phí', 'khóa học', 'sách', 'vở', 'tiếng anh', 'ielts'],
    categoryKeywords: ['học tập', 'sách', 'giáo dục', 'education'],
    priority: 9,
  },
  // Thu nhập / Lương
  {
    keywords: ['lương', 'tiền lương', 'salary', 'thưởng', 'bonus', 'hoa hồng', 'tiền làm thêm'],
    categoryKeywords: ['tiền lương', 'lương', 'salary', 'thưởng'],
    priority: 10,
  },
];

/**
 * Normalizes Vietnamese text by converting to lowercase and stripping accents for fuzzy match
 */
function normalizeText(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .trim();
}

/**
 * Normalizes recurring notes by removing fluctuating month/period markers
 * e.g. "Tiền phòng T8" -> "tien phong", "Internet tháng 9" -> "internet"
 */
export function cleanRecurringNote(note: string): string {
  if (!note) return '';
  let cleaned = normalizeText(note);
  // Loại bỏ các chỉ số tháng/năm, kỳ hạn, số hóa đơn thường biến động theo tháng:
  // Ví dụ: "tháng 8", "tháng 09", "t8", "t09", "tháng 10/2026", "t10/2026", "kỳ 1", "đợt 1"...
  cleaned = cleaned
    .replace(/\b(thang|th|t|ky|dot)\s*\d+(\/\d+)?\b/gi, '')
    .replace(/\b\d{1,2}\/\d{4}\b/g, '')
    .replace(/[\s\-_.:,]+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Main prediction function: evaluates current context and scores all candidate categories
 */
export function predictCategory({
  type,
  currentDate = new Date(),
  note = '',
  transactions,
  categories,
}: {
  type: 'expense' | 'income' | 'transfer';
  currentDate?: Date;
  note?: string;
  transactions: Transaction[];
  categories: Category[];
}): PredictionResult {
  if (type === 'transfer') {
    return { primarySuggestion: null, topSuggestions: [] };
  }

  const candidateCategories = categories.filter(c => c.type === (type === 'income' ? 'income' : 'expense'));
  if (candidateCategories.length === 0) {
    return { primarySuggestion: null, topSuggestions: [] };
  }

  const currentHour = currentDate.getHours() + currentDate.getMinutes() / 60;
  const currentDayOfMonth = currentDate.getDate();
  const currentDayOfWeek = currentDate.getDay(); // 0 = Sun, 6 = Sat
  const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;
  const normalizedNote = normalizeText(note);

  // Filter user's past transactions of the same type
  const relevantTxs = transactions.filter(t => t.type === type && t.category_id);

  // Scores map: categoryId -> { score: number, reasons: string[] }
  const scoreMap = new Map<string, { score: number; reasons: string[] }>();
  candidateCategories.forEach(c => scoreMap.set(c.id, { score: 0, reasons: [] }));



  // ==========================================
  // SIGNAL 1: Semantic Keyword Match from Note
  // ==========================================
  if (normalizedNote.length >= 2) {
    // 1A. General dictionary keyword match
    for (const rule of KEYWORD_CATEGORY_MAP) {
      const matchesKeyword = rule.keywords.some(kw => normalizedNote.includes(normalizeText(kw)));
      if (matchesKeyword) {
        for (const cat of candidateCategories) {
          const catNameNorm = normalizeText(cat.name);
          const isCatMatch = rule.categoryKeywords.some(ckw => catNameNorm.includes(normalizeText(ckw)));
          if (isCatMatch) {
            const entry = scoreMap.get(cat.id)!;
            entry.score += 80 * rule.priority;
            entry.reasons.push(`Khớp từ khóa "${note}"`);
          }
        }
      }
    }

    // 1B. Direct note history learning: ONLY if repeated at least 2 times
    const noteCounts = new Map<string, number>();
    relevantTxs.forEach(t => {
      if (t.note && t.category_id && normalizeText(t.note).includes(normalizedNote)) {
        noteCounts.set(t.category_id, (noteCounts.get(t.category_id) || 0) + 1);
      }
    });

    noteCounts.forEach((count, catId) => {
      // Yêu cầu lặp lại ít nhất 2 lần mới ghi nhận học từ lịch sử ghi chú
      if (count >= 2) {
        const entry = scoreMap.get(catId);
        if (entry) {
          entry.score += count * 40;
          if (!entry.reasons.some(r => r.includes('ghi chú') || r.includes('từ khóa'))) {
            entry.reasons.push(`Đã ghi "${note}" ${count} lần cho mục này`);
          }
        }
      }
    });
  }

  // ==========================================
  // SIGNAL 2: Time-of-Day Pattern Learning (Yêu cầu lặp lại >= 2 lần trong khung giờ)
  // ==========================================
  const hourWindowCounts = new Map<string, number>();
  const hourWindowWeights = new Map<string, number>();

  relevantTxs.forEach(t => {
    if (!t.transacted_at || !t.category_id) return;
    const tDate = dayjs(t.transacted_at);
    if (!tDate.isValid()) return;

    const tHour = tDate.hour() + tDate.minute() / 60;
    const hourDiff = Math.abs(tHour - currentHour);
    const circularHourDiff = Math.min(hourDiff, 24 - hourDiff);

    // Biên độ ±1.5 giờ xung quanh thời điểm hiện tại
    if (circularHourDiff <= 1.5) {
      const weight = Math.exp(-Math.pow(circularHourDiff, 2) / 1.5);
      hourWindowCounts.set(t.category_id, (hourWindowCounts.get(t.category_id) || 0) + 1);
      hourWindowWeights.set(t.category_id, (hourWindowWeights.get(t.category_id) || 0) + weight);
    }
  });

  // CHỈ ghi nhận thói quen nếu danh mục đó xuất hiện ÍT NHẤT 2 - 3 LẦN trong khung giờ này
  hourWindowCounts.forEach((count, catId) => {
    if (count >= 2) {
      const weightedScore = hourWindowWeights.get(catId) || count;
      const entry = scoreMap.get(catId);
      if (entry) {
        entry.score += weightedScore * 30;
        const timeStr = `${Math.floor(currentHour).toString().padStart(2, '0')}:${Math.floor((currentHour % 1) * 60).toString().padStart(2, '0')}`;
        entry.reasons.push(`Thói quen lúc ${timeStr} (đã lặp lại ${count} lần)`);
      }
    }
  });

  // ==========================================
  // SIGNAL 3: Day-of-Month Recurring Patterns (Yêu cầu lặp lại >= 2 tháng)
  // ==========================================
  const recurringBills = detectRecurringBills(relevantTxs, categories, type === 'income' ? 'income' : 'expense');
  let predictedRecurringAmount: number | undefined;
  let predictedRecurringNote: string | undefined;

  for (const bill of recurringBills) {
    // Chỉ ghi nhận nếu đã lặp lại từ 2 lần trở lên qua các tháng
    if (bill.occurrences >= 2) {
      const dayDiff = Math.abs(bill.approxDayOfMonth - currentDayOfMonth);
      if (dayDiff <= 2) {
        const entry = scoreMap.get(bill.categoryId);
        if (entry) {
          const multiplier = bill.isPaidThisMonth ? 1.0 : 2.5;
          entry.score += bill.occurrences * 35 * multiplier;
          entry.reasons.unshift(
            `${type === 'income' ? 'Thu nhập' : 'Khoản'} định kỳ ngày ${bill.approxDayOfMonth} (${bill.occurrences} lần: ${bill.mostCommonNote})`
          );
          
          if (!predictedRecurringAmount) {
            predictedRecurringAmount = bill.averageAmount;
            predictedRecurringNote = bill.mostCommonNote;
          }
        }
      }
    }
  }

  // ==========================================
  // SIGNAL 4: Day-of-Week Pattern (Thứ trong tuần & Weekly Habits)
  // ==========================================
  // 4A. Weekly Habit Pattern Matching (Lặp lại theo thứ cụ thể như Thứ 7 đi siêu thị, Thứ 5 đá bóng)
  if (type === 'expense') {
    const weeklyHabits = detectWeeklyHabits(relevantTxs, categories);
    const todayWeeklyHabit = weeklyHabits.find(h => h.dayOfWeek === currentDayOfWeek);
    if (todayWeeklyHabit) {
      const entry = scoreMap.get(todayWeeklyHabit.categoryId);
      if (entry) {
        entry.score += todayWeeklyHabit.occurrences * 25;
        entry.reasons.unshift(
          `Thói quen ${todayWeeklyHabit.dayOfWeekName} hàng tuần (${todayWeeklyHabit.occurrences} lần: ${todayWeeklyHabit.mostCommonNote})`
        );
        if (!predictedRecurringAmount) {
          predictedRecurringAmount = todayWeeklyHabit.averageAmount;
        }
        if (!predictedRecurringNote) {
          predictedRecurringNote = todayWeeklyHabit.mostCommonNote;
        }
      }
    }
  }

  // 4B. Exact Day-of-Week & Weekend vs Weekday Frequency
  const sameDayOfWeekCounts = new Map<string, number>();
  const weekdayWeekendCounts = new Map<string, number>();

  relevantTxs.forEach(t => {
    if (!t.transacted_at || !t.category_id) return;
    const tDate = dayjs(t.transacted_at);
    if (!tDate.isValid()) return;
    const tDay = tDate.day();

    // Khớp chính xác thứ trong tuần
    if (tDay === currentDayOfWeek) {
      sameDayOfWeekCounts.set(t.category_id, (sameDayOfWeekCounts.get(t.category_id) || 0) + 1);
    }

    // Khớp nhóm Ngày thường (T2-T6) vs Cuối tuần (T7, CN)
    const tIsWeekend = tDay === 0 || tDay === 6;
    if (tIsWeekend === isWeekend) {
      weekdayWeekendCounts.set(t.category_id, (weekdayWeekendCounts.get(t.category_id) || 0) + 1);
    }
  });

  sameDayOfWeekCounts.forEach((count, catId) => {
    const entry = scoreMap.get(catId);
    if (entry) {
      entry.score += count * 6; // Thưởng điểm cho danh mục hay chi tiêu vào đúng thứ này
    }
  });

  weekdayWeekendCounts.forEach((count, catId) => {
    const entry = scoreMap.get(catId);
    if (entry) {
      entry.score += count * 2.5; // Thưởng điểm cho danh mục phù hợp ngày làm việc vs ngày nghỉ
    }
  });

  // ==========================================
  // SIGNAL 5: General Recency & Frequency
  // ==========================================
  relevantTxs.slice(0, 30).forEach((t, index) => {
    if (!t.category_id) return;
    const entry = scoreMap.get(t.category_id);
    if (entry) {
      // Recent transactions get a slight bonus
      entry.score += Math.max(1, 10 - index * 0.3);
    }
  });

  // Sort candidate categories by final score
  const suggestions: CategorySuggestion[] = candidateCategories
    .map(c => {
      const { score, reasons } = scoreMap.get(c.id)!;
      let reason = reasons[0] || 'Gợi ý phổ biến';
      let confidence: 'high' | 'medium' | 'low' = 'low';
      if (score >= 80) confidence = 'high';
      else if (score >= 30) confidence = 'medium';

      return {
        category: c,
        score,
        reason,
        confidence,
      };
    })
    .sort((a, b) => b.score - a.score);

  const primary = suggestions.length > 0 ? suggestions[0] : null;

  return {
    primarySuggestion: primary,
    topSuggestions: suggestions.slice(0, 4),
    predictedAmount: predictedRecurringAmount,
    predictedNote: predictedRecurringNote,
  };
}

/**
 * Detects recurring monthly transactions (such as rent on the 10th, internet, insurance, tuition)
 */
export function detectRecurringBills(
  transactions: Transaction[],
  categories: Category[],
  filterType: 'expense' | 'income' = 'expense'
): RecurringBillPattern[] {
  const catMap = new Map<string, Category>(categories.map(c => [c.id, c]));
  const targetTxs = transactions.filter(
    t => t.type === filterType && t.category_id && t.amount > 0 && t.transacted_at
  );

  const patterns: RecurringBillPattern[] = [];
  const currentMonthStr = dayjs().format('YYYY-MM');

  // Nhóm giao dịch trước hết theo: Danh mục + Định danh nội dung ghi chú (hoặc loại hóa đơn tiện ích)
  const byIdentity = new Map<string, Transaction[]>();

  targetTxs.forEach(t => {
    const d = dayjs(t.transacted_at);
    if (!d.isValid()) return;
    const cat = catMap.get(t.category_id!);
    if (!cat) return;

    const cleanedNote = cleanRecurringNote(t.note || '');

    // Nếu có ghi chú: định danh = `${categoryId}:::note:::${cleanedNote}`
    // Nếu không có ghi chú: chỉ gom nếu danh mục mang tính chất hóa đơn/tiện ích cố định
    let groupKey: string;
    if (cleanedNote.length >= 2) {
      groupKey = `${t.category_id}:::note:::${cleanedNote}`;
    } else {
      const catNorm = normalizeText(cat.name);
      const isUtilityCat = [
        'hoa don',
        'tien ich',
        'nha cua',
        'thue nha',
        'tien dien',
        'tien nuoc',
        'wifi',
        'internet',
        'hoc phi',
        'bao hiem',
        'tra gop',
        'subscription',
      ].some(k => catNorm.includes(k));

      if (!isUtilityCat) {
        // Danh mục thông thường (ăn uống, mua sắm...) không có ghi chú thì không coi là hóa đơn định kỳ!
        return;
      }
      groupKey = `${t.category_id}:::empty_note`;
    }

    const list = byIdentity.get(groupKey) || [];
    list.push(t);
    byIdentity.set(groupKey, list);
  });

  byIdentity.forEach((txList, groupKey) => {
    // Phải có ít nhất 2 giao dịch có cùng nội dung/định danh
    if (txList.length < 2) return;

    const categoryId = groupKey.split(':::')[0];
    const cat = catMap.get(categoryId);
    if (!cat) return;

    // Phân cụm theo ngày trong tháng (khoảng cách ngày chi trả <= 3 ngày)
    const clusters: Transaction[][] = [];
    const sortedByDay = [...txList].sort(
      (a, b) => dayjs(a.transacted_at).date() - dayjs(b.transacted_at).date()
    );

    sortedByDay.forEach(tx => {
      const day = dayjs(tx.transacted_at).date();
      let added = false;
      for (const cluster of clusters) {
        const clusterDays = cluster.map(t => dayjs(t.transacted_at).date());
        const avgDay = clusterDays.reduce((s, d) => s + d, 0) / clusterDays.length;
        if (Math.abs(day - avgDay) <= 3) {
          cluster.push(tx);
          added = true;
          break;
        }
      }
      if (!added) {
        clusters.push([tx]);
      }
    });

    clusters.forEach(clusterTxs => {
      if (clusterTxs.length < 2) return;

      // 1. Phải diễn ra ở ít nhất 2 tháng KHÁC NHAU
      const distinctMonths = new Set(clusterTxs.map(t => dayjs(t.transacted_at).format('YYYY-MM')));
      if (distinctMonths.size < 2) return;

      // 2. Độ tương đồng về số tiền (Amount consistency):
      // Các hóa đơn định kỳ cùng tên không được chênh lệch nhau quá 2.5 lần
      const amounts = clusterTxs.map(t => t.amount);
      const minAmount = Math.min(...amounts);
      const maxAmount = Math.max(...amounts);
      if (minAmount <= 0 || maxAmount / minAmount > 2.5) {
        return;
      }

      // 3. Ghi chú đại diện
      const noteCounts: { [k: string]: number } = {};
      clusterTxs.forEach(t => {
        if (t.note && t.note.trim()) {
          noteCounts[t.note.trim()] = (noteCounts[t.note.trim()] || 0) + 1;
        }
      });
      const sortedNotes = Object.entries(noteCounts).sort((a, b) => b[1] - a[1]);
      let mostCommonNote = sortedNotes[0]?.[0] || cat.name;

      // 4. Số tiền trung bình & ngày trung bình
      const totalAmount = clusterTxs.reduce((sum, t) => sum + t.amount, 0);
      const avgAmount = Math.round(totalAmount / clusterTxs.length);
      const approxDayOfMonth = Math.round(
        clusterTxs.reduce((s, t) => s + dayjs(t.transacted_at).date(), 0) / clusterTxs.length
      );

      // Latest transacted date
      const sortedDates = clusterTxs.map(t => t.transacted_at).sort().reverse();
      const latestDate = sortedDates[0];
      const isPaidThisMonth = sortedDates.some(d => dayjs(d).format('YYYY-MM') === currentMonthStr);

      patterns.push({
        categoryId,
        categoryName: cat.name,
        categoryIcon: cat.icon,
        categoryColor: cat.color,
        approxDayOfMonth,
        averageAmount: avgAmount,
        mostCommonNote,
        occurrences: clusterTxs.length,
        lastTransactedDate: latestDate,
        isPaidThisMonth,
      });
    });
  });

  return patterns.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Detects recurring habits associated with specific days of the week (e.g. Supermarket on Saturday, Sports on Thursday)
 */
export function detectWeeklyHabits(
  transactions: Transaction[],
  categories: Category[]
): WeeklyHabitPattern[] {
  const catMap = new Map<string, Category>(categories.map(c => [c.id, c]));
  const expenses = transactions.filter(
    t => t.type === 'expense' && t.category_id && t.amount > 0 && t.transacted_at
  );

  // Group by `${categoryId}:::${dayOfWeek}`
  const groupMap = new Map<string, Transaction[]>();
  expenses.forEach(t => {
    const d = dayjs(t.transacted_at);
    if (!d.isValid()) return;
    const dow = d.day(); // 0 = Sun, 6 = Sat
    const key = `${t.category_id}:::${dow}`;
    const list = groupMap.get(key) || [];
    list.push(t);
    groupMap.set(key, list);
  });

  const patterns: WeeklyHabitPattern[] = [];

  groupMap.forEach((txList, key) => {
    // Yêu cầu ít nhất 3 giao dịch vào thứ này
    if (txList.length < 3) return;

    // Phải diễn ra ở ít nhất 2 tuần khác nhau
    const distinctDates = new Set(txList.map(t => dayjs(t.transacted_at).format('YYYY-MM-DD')));
    if (distinctDates.size < 2) return;

    const [categoryId, dowStr] = key.split(':::');
    const dayOfWeek = parseInt(dowStr, 10);
    const cat = catMap.get(categoryId);
    if (!cat) return;

    // Tìm ghi chú thực sự lặp lại vào ngày thứ này (ví dụ: thứ Bảy nào cũng ghi "Siêu thị")
    const noteMap = new Map<string, Transaction[]>();
    txList.forEach(t => {
      const cleaned = cleanRecurringNote(t.note || '');
      if (cleaned.length >= 2) {
        const list = noteMap.get(cleaned) || [];
        list.push(t);
        noteMap.set(cleaned, list);
      }
    });

    const repeatedNotes = Array.from(noteMap.entries())
      .filter(([_, list]) => list.length >= 2)
      .sort((a, b) => b[1].length - a[1].length);

    // Nếu không có bất kỳ hành vi/ghi chú nào lặp lại trên ngày thứ này -> Không phải thói quen tuần!
    if (repeatedNotes.length === 0) {
      return;
    }

    const habitTxs = repeatedNotes[0][1];
    const rawNoteCounts: Record<string, number> = {};
    habitTxs.forEach(t => {
      if (t.note) rawNoteCounts[t.note] = (rawNoteCounts[t.note] || 0) + 1;
    });
    const mostCommonNote = Object.entries(rawNoteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || cat.name;

    // Tính số tiền trung bình dựa trên các giao dịch của chính thói quen này
    const totalAmount = habitTxs.reduce((sum, t) => sum + t.amount, 0);
    const avgAmount = Math.round(totalAmount / habitTxs.length);

    // Preferred hour (median hour)
    const hours = habitTxs
      .map(t => {
        const d = dayjs(t.transacted_at);
        return d.hour() + d.minute() / 60;
      })
      .sort((a, b) => a - b);
    const medianHour = hours[Math.floor(hours.length / 2)];

    patterns.push({
      categoryId,
      categoryName: cat.name,
      categoryIcon: cat.icon,
      categoryColor: cat.color,
      dayOfWeek,
      dayOfWeekName: VIETNAMESE_DAYS[dayOfWeek] || `Thứ ${dayOfWeek + 1}`,
      averageAmount: avgAmount,
      mostCommonNote,
      occurrences: habitTxs.length,
      preferredHour: Math.round(medianHour * 10) / 10,
    });
  });

  return patterns.sort((a, b) => b.occurrences - a.occurrences);
}

/**
 * Generates smart proactive forecast alerts for the Dashboard widget
 */
export function getDashboardForecast(
  transactions: Transaction[],
  categories: Category[]
): DashboardForecast | null {
  const now = new Date();
  const currentHour = now.getHours() + now.getMinutes() / 60;
  const currentDayOfMonth = now.getDate();
  const currentDayOfWeek = now.getDay();
  const isWeekend = currentDayOfWeek === 0 || currentDayOfWeek === 6;
  const todayStr = dayjs(now).format('YYYY-MM-DD');

  // Check 1: Day-of-Month Recurring Bills (e.g. Ngày 10 - Tiền nhà trọ)
  const recurringBills = detectRecurringBills(transactions, categories, 'expense');
  const matchedBill = recurringBills.find(bill => {
    const dayDiff = Math.abs(bill.approxDayOfMonth - currentDayOfMonth);
    return dayDiff <= 2 && !bill.isPaidThisMonth;
  });

  if (matchedBill) {
    const category = categories.find(c => c.id === matchedBill.categoryId);
    if (category) {
      const isToday = matchedBill.approxDayOfMonth === currentDayOfMonth;
      const dayLabel = isToday
        ? `Hôm nay (ngày ${currentDayOfMonth})`
        : `Khoảng ngày ${matchedBill.approxDayOfMonth} hàng tháng`;

      return {
        id: `recurring_${matchedBill.categoryId}_${currentDayOfMonth}`,
        type: 'recurring_bill',
        title: `${dayLabel}: ${matchedBill.mostCommonNote}`,
        subtitle: `Bạn thường chi trả định kỳ ~${matchedBill.averageAmount.toLocaleString('vi-VN')} đ vào dịp này.`,
        category,
        suggestedAmount: matchedBill.averageAmount,
        suggestedNote: matchedBill.mostCommonNote,
        badgeText: isToday ? 'Đến hạn hôm nay' : 'Sắp đến hạn',
        badgeColor: '#EF4444',
        isUrgent: isToday,
      };
    }
  }

  // Check 2: Day-of-Week Weekly Habit (e.g. Hôm nay Thứ 7: Siêu thị / Cà phê)
  const weeklyHabits = detectWeeklyHabits(transactions, categories);
  const matchedWeeklyHabit = weeklyHabits.find(h => {
    if (h.dayOfWeek !== currentDayOfWeek) return false;
    // Check if user has already transacted in this category today
    const alreadyLoggedToday = transactions.some(t => {
      if (t.type !== 'expense' || t.category_id !== h.categoryId) return false;
      return dayjs(t.transacted_at).format('YYYY-MM-DD') === todayStr;
    });
    return !alreadyLoggedToday;
  });

  if (matchedWeeklyHabit) {
    const category = categories.find(c => c.id === matchedWeeklyHabit.categoryId);
    if (category) {
      return {
        id: `weekly_${matchedWeeklyHabit.categoryId}_${matchedWeeklyHabit.dayOfWeek}_${todayStr}`,
        type: 'weekly_habit',
        title: `Hôm nay ${matchedWeeklyHabit.dayOfWeekName}: ${matchedWeeklyHabit.mostCommonNote}`,
        subtitle: `Thói quen ${matchedWeeklyHabit.dayOfWeekName} hàng tuần (~${matchedWeeklyHabit.averageAmount.toLocaleString('vi-VN')} đ).`,
        category,
        suggestedAmount: matchedWeeklyHabit.averageAmount,
        suggestedNote: matchedWeeklyHabit.mostCommonNote,
        badgeText: `Thói quen ${matchedWeeklyHabit.dayOfWeekName}`,
        badgeColor: '#8B5CF6',
        isUrgent: false,
      };
    }
  }

  // Check 3: Meal-Time Routine (11:00 - 13:30 Ăn trưa, 18:00 - 20:30 Ăn tối)
  const isLunchTime = currentHour >= 11.0 && currentHour <= 13.5;
  const isDinnerTime = currentHour >= 18.0 && currentHour <= 20.5;

  if (isLunchTime || isDinnerTime) {
    // Check if user has already logged a food/dining expense today during this window
    const alreadyLogged = transactions.some(t => {
      if (t.type !== 'expense') return false;
      const tDate = dayjs(t.transacted_at);
      if (tDate.format('YYYY-MM-DD') !== todayStr) return false;
      const tHour = tDate.hour() + tDate.minute() / 60;
      if (isLunchTime && tHour >= 10.5 && tHour <= 14.0) return true;
      if (isDinnerTime && tHour >= 17.5 && tHour <= 21.0) return true;
      return false;
    });

    if (!alreadyLogged) {
      // Yêu cầu người dùng phải có ít nhất 2 lần giao dịch trong khung giờ này trong quá khứ
      const historicalMealCount = transactions.filter(t => {
        if (t.type !== 'expense') return false;
        const tDate = dayjs(t.transacted_at);
        const tHour = tDate.hour() + tDate.minute() / 60;
        if (isLunchTime && tHour >= 10.5 && tHour <= 14.0) return true;
        if (isDinnerTime && tHour >= 17.5 && tHour <= 21.0) return true;
        return false;
      }).length;

      if (historicalMealCount >= 2) {
        const foodCategory =
          categories.find(c => c.type === 'expense' && normalizeText(c.name).includes('an uong')) ||
          categories.find(c => c.type === 'expense' && c.icon.includes('restaurant')) ||
          categories.find(c => c.type === 'expense');

        if (foodCategory) {
          const mealName = isLunchTime
            ? (isWeekend ? 'bữa trưa cuối tuần' : 'bữa trưa')
            : (isWeekend ? 'bữa tối cuối tuần' : 'bữa tối');
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

          return {
            id: `meal_${isLunchTime ? 'lunch' : 'dinner'}_${todayStr}`,
            type: 'meal_time',
            title: `Đã đến giờ ${mealName} (${timeStr})`,
            subtitle: `Thói quen ăn uống (đã lặp lại ${historicalMealCount} lần). Ghi nhanh để không bị quên nhé!`,
            category: foodCategory,
            suggestedNote: isLunchTime
              ? (isWeekend ? 'Ăn trưa cuối tuần' : 'Cơm trưa')
              : (isWeekend ? 'Ăn tối cuối tuần' : 'Bữa tối'),
            badgeText: isWeekend ? 'Giờ ăn cuối tuần' : 'Thói quen giờ ăn',
            badgeColor: '#F97316',
          };
        }
      }
    }
  }

  return null;
}
