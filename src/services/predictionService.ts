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
  type: 'recurring_bill' | 'meal_time' | 'routine_habit';
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
  const recurringBills = detectRecurringBills(relevantTxs, categories);
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
          entry.reasons.unshift(`Khoản định kỳ ngày ${bill.approxDayOfMonth} (${bill.occurrences} lần: ${bill.mostCommonNote})`);
          
          if (!predictedRecurringAmount) {
            predictedRecurringAmount = bill.averageAmount;
            predictedRecurringNote = bill.mostCommonNote;
          }
        }
      }
    }
  }

  // ==========================================
  // SIGNAL 4: Day-of-Week Pattern (Weekend vs Weekday)
  // ==========================================
  const dayOfWeekCounts = new Map<string, number>();
  relevantTxs.forEach(t => {
    if (!t.transacted_at || !t.category_id) return;
    const tDay = dayjs(t.transacted_at).day();
    const tIsWeekend = tDay === 0 || tDay === 6;
    if (tIsWeekend === isWeekend) {
      dayOfWeekCounts.set(t.category_id, (dayOfWeekCounts.get(t.category_id) || 0) + 1);
    }
  });

  dayOfWeekCounts.forEach((count, catId) => {
    const entry = scoreMap.get(catId);
    if (entry) {
      entry.score += count * 2;
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
  categories: Category[]
): RecurringBillPattern[] {
  // Group expense transactions by category + day of month window
  const catMap = new Map<string, Category>(categories.map(c => [c.id, c]));
  const expenses = transactions.filter(t => t.type === 'expense' && t.category_id && t.amount > 0);

  // Group by category_id
  const byCategory = new Map<string, Transaction[]>();
  expenses.forEach(t => {
    const list = byCategory.get(t.category_id!) || [];
    list.push(t);
    byCategory.set(t.category_id!, list);
  });

  const patterns: RecurringBillPattern[] = [];
  const currentMonthStr = dayjs().format('YYYY-MM');

  byCategory.forEach((txList, categoryId) => {
    if (txList.length < 2) return;

    // Check days of month
    const dayCluster: { [day: number]: Transaction[] } = {};
    txList.forEach(tx => {
      const day = dayjs(tx.transacted_at).date();
      // Bucket into 3-day clusters
      const bucket = Math.round(day / 2) * 2;
      dayCluster[bucket] = dayCluster[bucket] || [];
      dayCluster[bucket].push(tx);
    });

    Object.entries(dayCluster).forEach(([dayStr, clusterTxs]) => {
      // Must occur across at least 2 different months
      const distinctMonths = new Set(clusterTxs.map(t => dayjs(t.transacted_at).format('YYYY-MM')));
      if (distinctMonths.size >= 2) {
        const cat = catMap.get(categoryId);
        if (!cat) return;

        // Average amount
        const totalAmount = clusterTxs.reduce((sum, t) => sum + t.amount, 0);
        const avgAmount = Math.round(totalAmount / clusterTxs.length);

        // Most frequent note
        const noteCounts: { [k: string]: number } = {};
        clusterTxs.forEach(t => {
          if (t.note) {
            noteCounts[t.note] = (noteCounts[t.note] || 0) + 1;
          }
        });
        const mostCommonNote = Object.entries(noteCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || cat.name;

        // Latest transacted date
        const sortedDates = clusterTxs.map(t => t.transacted_at).sort().reverse();
        const latestDate = sortedDates[0];
        const isPaidThisMonth = sortedDates.some(d => dayjs(d).format('YYYY-MM') === currentMonthStr);

        patterns.push({
          categoryId,
          categoryName: cat.name,
          categoryIcon: cat.icon,
          categoryColor: cat.color,
          approxDayOfMonth: parseInt(dayStr, 10),
          averageAmount: avgAmount,
          mostCommonNote,
          occurrences: clusterTxs.length,
          lastTransactedDate: latestDate,
          isPaidThisMonth,
        });
      }
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
  const todayStr = dayjs(now).format('YYYY-MM-DD');

  // Check 1: Day-of-Month Recurring Bills (e.g. Ngày 10 - Tiền nhà trọ)
  const recurringBills = detectRecurringBills(transactions, categories);
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
        subtitle: `Bạn thường chi trả định kỳ ~${matchedBill.averageAmount.toLocaleString('vi-VN')}đ vào dịp này.`,
        category,
        suggestedAmount: matchedBill.averageAmount,
        suggestedNote: matchedBill.mostCommonNote,
        badgeText: isToday ? 'Đến hạn hôm nay' : 'Sắp đến hạn',
        badgeColor: '#EF4444',
        isUrgent: isToday,
      };
    }
  }

  // Check 2: Meal-Time Routine (11:00 - 13:30 Ăn trưa, 18:00 - 20:30 Ăn tối)
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
          const mealName = isLunchTime ? 'bữa trưa' : 'bữa tối';
          const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

          return {
            id: `meal_${isLunchTime ? 'lunch' : 'dinner'}_${todayStr}`,
            type: 'meal_time',
            title: `Đã đến giờ ${mealName} (${timeStr})`,
            subtitle: `Thói quen ăn uống (đã lặp lại ${historicalMealCount} lần). Ghi nhanh để không bị quên nhé!`,
            category: foodCategory,
            suggestedNote: isLunchTime ? 'Cơm trưa' : 'Cơm tối',
            badgeText: 'Thói quen giờ ăn',
            badgeColor: '#F97316',
          };
        }
      }
    }
  }

  return null;
}
