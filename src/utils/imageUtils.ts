/**
 * Tiện ích xử lý URI ảnh dùng chung cho toàn bộ app
 */

/**
 * Phân tích chuỗi JSON lưu trong DB thành danh sách đường dẫn ảnh
 */
export function parseImageUris(raw?: string | null): string[] {
  if (!raw) return [];
  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === 'string' && item.length > 0);
      }
    } catch {
      // Fallback nếu chuỗi JSON lỗi
    }
  }
  return [trimmed];
}
