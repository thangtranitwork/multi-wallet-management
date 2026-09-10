import * as SQLite from 'expo-sqlite';
import * as queries from '../database/queries';
import { GoogleUser } from './googleDriveService';

export interface CloudBackupConfig {
  isLinked: boolean;
  user: GoogleUser | null;
  accessToken: string;
  customClientId: string;
  autoBackupEnabled: boolean;
  autoBackupFrequency: 'on_change' | 'daily' | 'weekly';
  lastBackupTime: string | null;
  lastBackupFileName: string | null;
}

const SETTING_KEYS = {
  IS_LINKED: 'gdrive_is_linked',
  USER_ID: 'gdrive_user_id',
  USER_EMAIL: 'gdrive_user_email',
  USER_NAME: 'gdrive_user_name',
  USER_PICTURE: 'gdrive_user_picture',
  ACCESS_TOKEN: 'gdrive_access_token',
  CUSTOM_CLIENT_ID: 'gdrive_custom_client_id',
  AUTO_BACKUP_ENABLED: 'gdrive_auto_backup_enabled',
  AUTO_BACKUP_FREQ: 'gdrive_auto_backup_freq',
  LAST_BACKUP_TIME: 'gdrive_last_backup_time',
  LAST_BACKUP_FILE: 'gdrive_last_backup_file',
};

/**
 * Tải cấu hình sao lưu Google Drive từ SQLite
 */
export async function loadCloudBackupConfig(
  db: SQLite.SQLiteDatabase
): Promise<CloudBackupConfig> {
  const [
    isLinkedVal,
    userId,
    userEmail,
    userName,
    userPicture,
    accessToken,
    customClientId,
    autoBackupVal,
    autoBackupFreq,
    lastBackupTime,
    lastBackupFileName,
  ] = await Promise.all([
    queries.getAppSetting(db, SETTING_KEYS.IS_LINKED, 'false'),
    queries.getAppSetting(db, SETTING_KEYS.USER_ID, ''),
    queries.getAppSetting(db, SETTING_KEYS.USER_EMAIL, ''),
    queries.getAppSetting(db, SETTING_KEYS.USER_NAME, ''),
    queries.getAppSetting(db, SETTING_KEYS.USER_PICTURE, ''),
    queries.getAppSetting(db, SETTING_KEYS.ACCESS_TOKEN, ''),
    queries.getAppSetting(db, SETTING_KEYS.CUSTOM_CLIENT_ID, ''),
    queries.getAppSetting(db, SETTING_KEYS.AUTO_BACKUP_ENABLED, 'true'),
    queries.getAppSetting(db, SETTING_KEYS.AUTO_BACKUP_FREQ, 'on_change'),
    queries.getAppSetting(db, SETTING_KEYS.LAST_BACKUP_TIME, ''),
    queries.getAppSetting(db, SETTING_KEYS.LAST_BACKUP_FILE, ''),
  ]);

  const isLinked = isLinkedVal === 'true' && accessToken.length > 0;

  const user: GoogleUser | null = isLinked
    ? {
        id: userId || 'google_user',
        email: userEmail || 'Tài khoản Google',
        name: userName || 'Người dùng',
        picture: userPicture || undefined,
      }
    : null;

  return {
    isLinked,
    user,
    accessToken,
    customClientId,
    autoBackupEnabled: autoBackupVal === 'true',
    autoBackupFrequency: (autoBackupFreq as any) || 'on_change',
    lastBackupTime: lastBackupTime || null,
    lastBackupFileName: lastBackupFileName || null,
  };
}

/**
 * Lưu cấu hình hoặc cập nhật thông tin Google Drive
 */
export async function saveCloudBackupConfig(
  db: SQLite.SQLiteDatabase,
  updates: Partial<CloudBackupConfig>
): Promise<void> {
  const promises: Promise<void>[] = [];

  if (updates.isLinked !== undefined) {
    promises.push(
      queries.setAppSetting(db, SETTING_KEYS.IS_LINKED, updates.isLinked ? 'true' : 'false')
    );
  }

  if (updates.user !== undefined) {
    promises.push(
      queries.setAppSetting(db, SETTING_KEYS.USER_ID, updates.user?.id || ''),
      queries.setAppSetting(db, SETTING_KEYS.USER_EMAIL, updates.user?.email || ''),
      queries.setAppSetting(db, SETTING_KEYS.USER_NAME, updates.user?.name || ''),
      queries.setAppSetting(db, SETTING_KEYS.USER_PICTURE, updates.user?.picture || '')
    );
  }

  if (updates.accessToken !== undefined) {
    promises.push(queries.setAppSetting(db, SETTING_KEYS.ACCESS_TOKEN, updates.accessToken));
  }

  if (updates.customClientId !== undefined) {
    promises.push(queries.setAppSetting(db, SETTING_KEYS.CUSTOM_CLIENT_ID, updates.customClientId));
  }

  if (updates.autoBackupEnabled !== undefined) {
    promises.push(
      queries.setAppSetting(
        db,
        SETTING_KEYS.AUTO_BACKUP_ENABLED,
        updates.autoBackupEnabled ? 'true' : 'false'
      )
    );
  }

  if (updates.autoBackupFrequency !== undefined) {
    promises.push(queries.setAppSetting(db, SETTING_KEYS.AUTO_BACKUP_FREQ, updates.autoBackupFrequency));
  }

  if (updates.lastBackupTime !== undefined) {
    promises.push(queries.setAppSetting(db, SETTING_KEYS.LAST_BACKUP_TIME, updates.lastBackupTime || ''));
  }

  if (updates.lastBackupFileName !== undefined) {
    promises.push(queries.setAppSetting(db, SETTING_KEYS.LAST_BACKUP_FILE, updates.lastBackupFileName || ''));
  }

  await Promise.all(promises);
}

/**
 * Đăng xuất / Xóa liên kết Google Drive
 */
export async function clearCloudBackupConfig(db: SQLite.SQLiteDatabase): Promise<void> {
  await Promise.all([
    queries.setAppSetting(db, SETTING_KEYS.IS_LINKED, 'false'),
    queries.setAppSetting(db, SETTING_KEYS.USER_ID, ''),
    queries.setAppSetting(db, SETTING_KEYS.USER_EMAIL, ''),
    queries.setAppSetting(db, SETTING_KEYS.USER_NAME, ''),
    queries.setAppSetting(db, SETTING_KEYS.USER_PICTURE, ''),
    queries.setAppSetting(db, SETTING_KEYS.ACCESS_TOKEN, ''),
  ]);
}
