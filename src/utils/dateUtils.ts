/**
 * dateUtils.ts
 * Tiện ích chuẩn hóa và xử lý ngày giờ đồng bộ cho toàn bộ ứng dụng MultiWallet.
 * Đảm bảo tất cả thời gian (transacted_at, created_at, paid_at...) lưu vào SQLite
 * đều ở dạng chuẩn ISO 8601 UTC (YYYY-MM-DDTHH:mm:ss.sssZ).
 */

/**
 * Chuyển đổi an toàn mọi định dạng chuỗi ngày giờ (kể cả do AI tạo ra) thành chuỗi ISO 8601 UTC.
 * 
 * Các trường hợp xử lý:
 * 1. Đã là chuỗi ISO UTC (kết thúc bằng Z/z): giữ nguyên hoặc chuẩn hóa.
 * 2. Chuỗi có múi giờ cụ thể (+07:00, -05:00...): parse và chuyển sang UTC.
 * 3. Chuỗi giờ địa phương "YYYY-MM-DD HH:mm:ss" hoặc "YYYY-MM-DDTHH:mm:ss" (không có Z/múi giờ):
 *    Hiểu là giờ địa phương của thiết bị (Việt Nam GMT+7) và chuyển đổi sang ISO UTC tương ứng.
 * 4. Chuỗi định dạng Việt Nam "DD/MM/YYYY HH:mm:ss" hoặc "DD/MM/YYYY HH:mm".
 * 5. Chuỗi định dạng "HH:mm DD/MM/YYYY".
 * 6. Chuỗi chỉ có ngày "YYYY-MM-DD": gán 12:00 trưa giờ địa phương rồi chuyển sang UTC.
 * 7. Rỗng / null / không hợp lệ: mặc định lấy thời điểm hiện tại `new Date().toISOString()`.
 */
export function normalizeToIsoString(dateInput?: string | Date | null): string {
  if (!dateInput) {
    return new Date().toISOString();
  }

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date().toISOString() : dateInput.toISOString();
  }

  const trimmed = String(dateInput).trim();
  if (!trimmed) {
    return new Date().toISOString();
  }

  // 1. Đã kết thúc bằng Z hoặc z (chuẩn UTC)
  if (/Z$/i.test(trimmed)) {
    const dt = new Date(trimmed);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  // 2. Có timezone offset rõ ràng (+07:00, +0700, -05:00...)
  if (/[+-]\d{2}:?\d{2}$/.test(trimmed)) {
    const dt = new Date(trimmed);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  // 3. Định dạng "YYYY-MM-DD HH:mm:ss" hoặc "YYYY-MM-DDTHH:mm:ss" (giờ địa phương, không Z)
  const isoLocalMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?(?:\.\d+)?$/
  );
  if (isoLocalMatch) {
    const [, y, mo, d, h, min, s] = isoLocalMatch;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(min),
      s ? Number(s) : 0
    );
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  // 4. Định dạng "DD/MM/YYYY HH:mm:ss" hoặc "DD/MM/YYYY HH:mm"
  const dmyMatch = trimmed.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})[T\s](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/
  );
  if (dmyMatch) {
    const [, d, mo, y, h, min, s] = dmyMatch;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(min),
      s ? Number(s) : 0
    );
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  // 5. Định dạng "HH:mm DD/MM/YYYY" hoặc "HH:mm:ss DD/MM/YYYY"
  const timeDmyMatch = trimmed.match(
    /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\s+(\d{1,2})\/(\d{1,2})\/(\d{4})$/
  );
  if (timeDmyMatch) {
    const [, h, min, s, d, mo, y] = timeDmyMatch;
    const dt = new Date(
      Number(y),
      Number(mo) - 1,
      Number(d),
      Number(h),
      Number(min),
      s ? Number(s) : 0
    );
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  // 6. Định dạng chỉ có ngày "YYYY-MM-DD"
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, y, mo, d] = dateOnlyMatch;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  // 7. Định dạng chỉ có ngày "DD/MM/YYYY"
  const dmyOnlyMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmyOnlyMatch) {
    const [, d, mo, y] = dmyOnlyMatch;
    const dt = new Date(Number(y), Number(mo) - 1, Number(d), 12, 0, 0);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString();
    }
  }

  // 8. Thử parse tự nhiên bằng JavaScript Date
  const naturalDt = new Date(trimmed);
  if (!isNaN(naturalDt.getTime())) {
    return naturalDt.toISOString();
  }

  // Fallback an toàn cuối cùng
  return new Date().toISOString();
}

/**
 * Parse an toàn bất kỳ chuỗi thời gian nào thành đối tượng JS Date hợp lệ.
 */
export function parseDateSafe(dateInput?: string | Date | null): Date {
  if (!dateInput) return new Date();
  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? new Date() : dateInput;
  }
  const isoStr = normalizeToIsoString(dateInput);
  const dt = new Date(isoStr);
  return isNaN(dt.getTime()) ? new Date() : dt;
}
