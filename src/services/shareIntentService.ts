import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { ShareIntentModule } = NativeModules;

export interface SharedImagePayload {
  uri: string;
}

/**
 * Lấy ảnh được chia sẻ từ app ngân hàng / ví điện tử khi app được mở từ trạng thái đóng (Cold start)
 */
export async function getInitialSharedImage(): Promise<string | null> {
  if (Platform.OS !== 'android' || !ShareIntentModule) {
    return null;
  }
  try {
    const uri = await ShareIntentModule.getInitialSharedImage();
    return uri || null;
  } catch (error) {
    console.warn('[ShareIntentService] Lỗi lấy ảnh chia sẻ ban đầu:', error);
    return null;
  }
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
 * Đăng ký lắng nghe sự kiện khi app đang chạy nền (Warm start) nhận được ảnh chia sẻ từ app ngân hàng
 */
export function subscribeToSharedImages(callback: (uri: string) => void): () => void {
  if (Platform.OS !== 'android' || !ShareIntentModule) {
    return () => {};
  }

  const eventEmitter = new NativeEventEmitter(ShareIntentModule);
  const subscription = eventEmitter.addListener('onSharedImageReceived', (event: SharedImagePayload) => {
    if (event?.uri) {
      callback(event.uri);
    }
  });

  return () => {
    subscription.remove();
  };
}
