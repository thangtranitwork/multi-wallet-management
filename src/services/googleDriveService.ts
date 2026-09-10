import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import dayjs from 'dayjs';

WebBrowser.maybeCompleteAuthSession();

export interface GoogleUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface DriveBackupFile {
  id: string;
  name: string;
  size?: string;
  createdTime: string;
  modifiedTime?: string;
}

// Client ID mặc định của ứng dụng (Người dùng có thể ghi đè bằng Client ID riêng)
export const DEFAULT_GOOGLE_CLIENT_ID =
  '615826839377-7vu4qip994vlo3qggl4ufp529h5e4jck.apps.googleusercontent.com';

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';
const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';

export const GOOGLE_DRIVE_SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.appdata',
];

/**
 * Tạo URL chuyển hướng OAuth
 */
export function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({
    scheme: 'com.thang.multiwallet',
  });
}

/**
 * Đăng nhập Google để cấp quyền Google Drive
 */
export async function signInWithGoogle(customClientId?: string): Promise<{
  success: boolean;
  accessToken?: string;
  user?: GoogleUser;
  error?: string;
}> {
  try {
    const clientId = (customClientId && customClientId.trim().length > 0)
      ? customClientId.trim()
      : DEFAULT_GOOGLE_CLIENT_ID;

    const redirectUri = getRedirectUri();

    // Khởi tạo AuthRequest
    const request = new AuthSession.AuthRequest({
      clientId,
      redirectUri,
      scopes: GOOGLE_DRIVE_SCOPES,
      responseType: AuthSession.ResponseType.Token,
      usePKCE: false,
    });

    const discovery = {
      authorizationEndpoint: GOOGLE_AUTH_ENDPOINT,
    };

    const result = await request.promptAsync(discovery);

    if (result.type === 'success' && result.params && result.params.access_token) {
      const accessToken = result.params.access_token;
      const user = await fetchGoogleUserInfo(accessToken);

      return {
        success: true,
        accessToken,
        user: user || {
          id: 'user_connected',
          email: 'Đã liên kết Google Drive',
          name: 'Tài khoản Google',
        },
      };
    } else if (result.type === 'cancel' || result.type === 'dismiss') {
      return {
        success: false,
        error: 'Người dùng đã hủy đăng nhập.',
      };
    } else {
      return {
        success: false,
        error: (result as any).error?.message || 'Không thể hoàn tất đăng nhập Google.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Đã xảy ra lỗi khi kết nối Google.',
    };
  }
}

/**
 * Lấy thông tin tài khoản Google của người dùng
 */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUser | null> {
  try {
    const res = await fetch(GOOGLE_USERINFO_ENDPOINT, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return {
      id: data.id || data.sub,
      email: data.email,
      name: data.name || data.given_name || 'Người dùng Google',
      picture: data.picture,
    };
  } catch {
    return null;
  }
}

/**
 * Upload bản sao lưu JSON lên Google Drive
 */
export async function uploadBackupToDrive(
  accessToken: string,
  jsonContent: string,
  customFileName?: string
): Promise<{ success: boolean; fileId?: string; fileName?: string; error?: string }> {
  try {
    const dateStr = dayjs().format('YYYYMMDD_HHmmss');
    const fileName = customFileName || `MultiWallet_Backup_${dateStr}.json`;

    const metadata = {
      name: fileName,
      mimeType: 'application/json',
      description: 'MultiWallet Cloud Backup snapshot',
    };

    const boundary = 'foo_bar_baz_multiwallet_boundary';
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      jsonContent +
      closeDelimiter;

    const res = await fetch(DRIVE_UPLOAD_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        success: false,
        error: `Lỗi Google Drive (${res.status}): ${errText}`,
      };
    }

    const resData = await res.json();
    return {
      success: true,
      fileId: resData.id,
      fileName,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Không thể upload lên Google Drive.',
    };
  }
}

/**
 * Lấy danh sách các bản sao lưu hiện có trên Google Drive
 */
export async function listDriveBackups(accessToken: string): Promise<DriveBackupFile[]> {
  try {
    const query = encodeURIComponent("name contains 'MultiWallet_Backup' and trashed = false");
    const fields = encodeURIComponent('files(id,name,size,createdTime,modifiedTime)');
    const url = `${DRIVE_FILES_ENDPOINT}?q=${query}&fields=${fields}&orderBy=createdTime desc&pageSize=20`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    return (data.files || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      size: f.size ? `${(parseInt(f.size, 10) / 1024).toFixed(1)} KB` : undefined,
      createdTime: f.createdTime || f.modifiedTime,
    }));
  } catch {
    return [];
  }
}

/**
 * Tải nội dung bản sao lưu từ Google Drive theo File ID
 */
export async function downloadDriveBackup(accessToken: string, fileId: string): Promise<string> {
  const url = `${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Không thể tải file từ Google Drive (HTTP ${res.status})`);
  }

  return await res.text();
}

/**
 * Xóa một bản sao lưu trên Google Drive
 */
export async function deleteDriveBackup(accessToken: string, fileId: string): Promise<boolean> {
  try {
    const url = `${DRIVE_FILES_ENDPOINT}/${fileId}`;
    const res = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}
