// src/services/loggerService.ts
// Quản lý & lưu trữ nhật ký (logs) hoạt động trong ứng dụng
// Hỗ trợ lưu trữ vĩnh viễn trên bộ nhớ máy (disk persistence) và bắt lỗi fatal crash
import dayjs from 'dayjs';
import * as LegacyFileSystem from 'expo-file-system/legacy';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: string; // HH:mm:ss.SSS
  timeFull: string;  // YYYY-MM-DD HH:mm:ss
  level: LogLevel;
  tag: string;
  message: string;
  details?: string;
}

type LogListener = (logs: LogEntry[]) => void;

const MAX_LOGS = 500;
const MAX_DISK_LOGS = 300;
let logs: LogEntry[] = [];
const listeners: Set<LogListener> = new Set();
let isInitialized = false;

function getLogFilePath(): string {
  const dir = LegacyFileSystem.documentDirectory || LegacyFileSystem.cacheDirectory || '';
  return `${dir}app_logs.json`;
}

let saveTimeout: any = null;
let isWritingDisk = false;

async function writeLogsToDisk() {
  if (isWritingDisk) return;
  try {
    isWritingDisk = true;
    const path = getLogFilePath();
    if (!path) return;
    const toSave = logs.slice(0, MAX_DISK_LOGS);
    await LegacyFileSystem.writeAsStringAsync(path, JSON.stringify(toSave), {
      encoding: LegacyFileSystem.EncodingType.UTF8,
    });
  } catch (err) {
    // console fallback without loop
  } finally {
    isWritingDisk = false;
  }
}

function scheduleSaveLogs(immediate = false) {
  if (immediate) {
    if (saveTimeout) clearTimeout(saveTimeout);
    writeLogsToDisk().catch(() => {});
    return;
  }
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    writeLogsToDisk().catch(() => {});
  }, 1000);
}

export async function loadPersistedLogs(): Promise<LogEntry[]> {
  try {
    const path = getLogFilePath();
    if (!path) return logs;
    const info = await LegacyFileSystem.getInfoAsync(path);
    if (info.exists) {
      const content = await LegacyFileSystem.readAsStringAsync(path, {
        encoding: LegacyFileSystem.EncodingType.UTF8,
      });
      if (content && content.trim().length > 0) {
        const loaded = JSON.parse(content);
        if (Array.isArray(loaded) && loaded.length > 0) {
          const currentMap = new Map<string, LogEntry>(logs.map(l => [l.id, l]));
          for (const item of loaded) {
            if (!currentMap.has(item.id)) {
              currentMap.set(item.id, item);
            }
          }
          logs = Array.from(currentMap.values())
            .sort((a, b) => b.timeFull.localeCompare(a.timeFull))
            .slice(0, MAX_LOGS);
          notifyListeners();
        }
      }
    }
  } catch (err) {
    // ignore
  }
  return logs;
}

// Format data or objects safely into string
function formatDetails(args: any[]): string | undefined {
  if (!args || args.length === 0) return undefined;
  try {
    const formatted = args
      .map(arg => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack || ''}`;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      })
      .join(' ');
    return formatted.length > 2500 ? formatted.slice(0, 2500) + '... (truncated)' : formatted;
  } catch {
    return undefined;
  }
}

// Extract tag from message if formatted like "[TAG] message"
function extractTag(message: string): { tag: string; cleanMessage: string } {
  const match = message.match(/^\[([A-Za-z0-9_-]+)\]\s*(.*)$/);
  if (match) {
    return { tag: match[1].toUpperCase(), cleanMessage: match[2] || message };
  }
  return { tag: 'SYSTEM', cleanMessage: message };
}

function notifyListeners() {
  const snapshot = [...logs];
  listeners.forEach(listener => {
    try {
      listener(snapshot);
    } catch {
      // Ignore listener error
    }
  });
}

function addLog(level: LogLevel, tag: string, message: string, details?: any, immediatePersist = false) {
  const now = dayjs();
  let detailStr: string | undefined = undefined;

  if (details !== undefined) {
    if (typeof details === 'string') {
      detailStr = details;
    } else if (details instanceof Error) {
      detailStr = `${details.name}: ${details.message}\n${details.stack || ''}`;
    } else {
      try {
        detailStr = JSON.stringify(details, null, 2);
      } catch {
        detailStr = String(details);
      }
    }
  }

  const newEntry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now.format('HH:mm:ss.SSS'),
    timeFull: now.format('YYYY-MM-DD HH:mm:ss'),
    level,
    tag: tag.toUpperCase(),
    message: String(message),
    details: detailStr,
  };

  logs.unshift(newEntry);
  if (logs.length > MAX_LOGS) {
    logs = logs.slice(0, MAX_LOGS);
  }

  notifyListeners();

  const isErrorOrCrash = level === 'error' || tag.includes('CRASH') || tag.includes('FATAL') || immediatePersist;
  scheduleSaveLogs(isErrorOrCrash);
}

/**
 * Khởi tạo hệ thống logger tự động hook vào console.* và bắt lỗi toàn cục (Global Crash Handlers)
 */
export function initLogger() {
  if (isInitialized) return;
  isInitialized = true;

  // Nạp lại các bản ghi nhật ký từ phiên hoạt động trước (kể cả sau khi văng app)
  loadPersistedLogs().catch(() => {});

  // Bắt lỗi Unhandled JavaScript Exception toàn cục từ React Native runtime
  if ((globalThis as any).ErrorUtils) {
    const defaultHandler = (globalThis as any).ErrorUtils.getGlobalHandler?.();
    (globalThis as any).ErrorUtils.setGlobalHandler((error: any, isFatal?: boolean) => {
      try {
        const errorMsg = error?.message || (typeof error === 'string' ? error : 'Lỗi không xác định');
        const stack = error?.stack || '';
        const tag = isFatal ? 'FATAL_CRASH' : 'UNCAUGHT_ERR';
        const prefix = isFatal ? '[VĂNG APP - CRASH]' : '[LỖI BẤT NGỜ]';
        addLog('error', tag, `${prefix} ${errorMsg}`, stack, true);
        writeLogsToDisk().catch(() => {});
      } catch {
        // safe fallback
      }
      if (defaultHandler) {
        defaultHandler(error, isFatal);
      }
    });
  }

  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;
  const originalConsoleInfo = console.info;

  console.log = (...args: any[]) => {
    originalConsoleLog.apply(console, args);
    try {
      const firstArg = typeof args[0] === 'string' ? args[0] : '';
      const { tag, cleanMessage } = extractTag(firstArg);
      const restArgs = args.length > 1 ? args.slice(1) : (typeof args[0] !== 'string' ? [args[0]] : []);
      const details = restArgs.length > 0 ? formatDetails(restArgs) : undefined;
      addLog('info', tag, cleanMessage || firstArg || 'Log', details);
    } catch {
      // safe fallback
    }
  };

  console.info = (...args: any[]) => {
    originalConsoleInfo.apply(console, args);
    try {
      const firstArg = typeof args[0] === 'string' ? args[0] : '';
      const { tag, cleanMessage } = extractTag(firstArg);
      const restArgs = args.length > 1 ? args.slice(1) : (typeof args[0] !== 'string' ? [args[0]] : []);
      const details = restArgs.length > 0 ? formatDetails(restArgs) : undefined;
      addLog('info', tag, cleanMessage || firstArg || 'Info', details);
    } catch {
      // safe fallback
    }
  };

  console.warn = (...args: any[]) => {
    originalConsoleWarn.apply(console, args);
    try {
      const firstArg = typeof args[0] === 'string' ? args[0] : '';
      const { tag, cleanMessage } = extractTag(firstArg);
      const restArgs = args.length > 1 ? args.slice(1) : (typeof args[0] !== 'string' ? [args[0]] : []);
      const details = restArgs.length > 0 ? formatDetails(restArgs) : undefined;
      addLog('warn', tag, cleanMessage || firstArg || 'Warning', details);
    } catch {
      // safe fallback
    }
  };

  console.error = (...args: any[]) => {
    originalConsoleError.apply(console, args);
    try {
      const firstArg = typeof args[0] === 'string' ? args[0] : '';
      const { tag, cleanMessage } = extractTag(firstArg);
      const restArgs = args.length > 1 ? args.slice(1) : (typeof args[0] !== 'string' ? [args[0]] : []);
      const details = restArgs.length > 0 ? formatDetails(restArgs) : undefined;
      addLog('error', tag, cleanMessage || firstArg || 'Error', details, true);
    } catch {
      // safe fallback
    }
  };

  // Log khởi tạo
  addLog('info', 'APP', 'Hệ thống Logger đã khởi tạo với Disk Persistence & Global Crash Hook.', { maxBufferSize: MAX_LOGS });
}

export const logger = {
  info: (tag: string, message: string, details?: any) => addLog('info', tag, message, details),
  warn: (tag: string, message: string, details?: any) => addLog('warn', tag, message, details),
  error: (tag: string, message: string, details?: any) => addLog('error', tag, message, details, true),
  debug: (tag: string, message: string, details?: any) => addLog('debug', tag, message, details),
  getLogs: (): LogEntry[] => [...logs],
  clearLogs: async () => {
    logs = [];
    notifyListeners();
    try {
      const path = getLogFilePath();
      if (path) {
        const info = await LegacyFileSystem.getInfoAsync(path);
        if (info.exists) {
          await LegacyFileSystem.deleteAsync(path, { idempotent: true });
        }
      }
    } catch {}
  },
  subscribe: (listener: LogListener): (() => void) => {
    listeners.add(listener);
    listener([...logs]);
    return () => listeners.delete(listener);
  },
  flushLogs: async () => {
    await writeLogsToDisk();
  },
  loadPersistedLogs,
  exportAsString: (): string => {
    return logs
      .map(l => `[${l.timeFull}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message}${l.details ? `\n--> Details: ${l.details}` : ''}`)
      .join('\n\n');
  },
};
