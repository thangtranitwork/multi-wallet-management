import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { ShareIntentModule } = NativeModules;

export interface SharedImagePayload {
  uri: string;
  target?: 'copilot' | 'quick_add';
}

/**
 * Lấy dữ liệu ảnh và mục tiêu xử lý (Copilot hoặc Quick Add) khi app được mở từ trạng thái đóng (Cold start)
 */
export async function getInitialSharedData(): Promise<SharedImagePayload | null> {
  if (Platform.OS !== 'android' || !ShareIntentModule) {
    return null;
  }
  try {
    if (typeof ShareIntentModule.getInitialSharedData === 'function') {
      const data = await ShareIntentModule.getInitialSharedData();
      if (data?.uri) {
        return {
          uri: data.uri,
          target: data.target === 'copilot' ? 'copilot' : 'quick_add',
        };
      }
    }
    const uri = await ShareIntentModule.getInitialSharedImage();
    return uri ? { uri, target: 'quick_add' } : null;
  } catch (error) {
    console.warn('[ShareIntentService] Lỗi lấy dữ liệu chia sẻ ban đầu:', error);
    return null;
  }
}

/**
 * Lấy ảnh được chia sẻ từ app ngân hàng / ví điện tử khi app được mở từ trạng thái đóng (Cold start)
 */
export async function getInitialSharedImage(): Promise<string | null> {
  const data = await getInitialSharedData();
  return data?.uri || null;
}

/**
 * Dọn dẹp trạng thái ảnh đã xử lý
 */
export async function clearSharedImage(): Promise<void> {
  if (Platform.OS !== 'android' || !ShareIntentModule) {
    return;
  }
  try {
    await ShareIntentModule.clearSharedImage();
  } catch (error) {
    console.warn('[ShareIntentService] Lỗi xóa trạng thái ảnh chia sẻ:', error);
  }
}

/**
 * Đăng ký lắng nghe sự kiện khi app đang chạy nền (Warm start) nhận được ảnh chia sẻ từ app khác
 */
export function subscribeToSharedImages(
  callback: (payload: SharedImagePayload) => void
): () => void {
  if (Platform.OS !== 'android' || !ShareIntentModule) {
    return () => {};
  }

  const eventEmitter = new NativeEventEmitter(ShareIntentModule);
  const subscription = eventEmitter.addListener('onSharedImageReceived', (event: any) => {
    if (event?.uri) {
      callback({
        uri: event.uri,
        target: event.target === 'copilot' ? 'copilot' : 'quick_add',
      });
    }
  });

  return () => {
    subscription.remove();
  };
}
