// src/services/loggerService.ts
// Quản lý & lưu trữ nhật ký (logs) hoạt động trong ứng dụng
// Hỗ trợ lưu trữ vĩnh viễn trên bộ nhớ máy (disk persistence) và bắt lỗi fatal crash
import dayjs from 'dayjs';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import * as Clipboard from 'expo-clipboard';
import { Platform, Share } from 'react-native';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface LogEntry {
  id: string;
  timestamp: string; // HH:mm:ss.SSS
  timeFull: string;  // YYYY-MM-DD HH:mm:ss
  level: LogLevel;
  tag: string;
  message: string;
  details?: string;
  screen?: string;
  context?: Record<string, any>;
  stack?: string;
}

type LogListener = (logs: LogEntry[]) => void;

const MAX_LOGS = 500;
const MAX_DISK_LOGS = 300;
let logs: LogEntry[] = [];
const listeners: Set<LogListener> = new Set();
let isInitialized = false;
let currentScreen: string = 'Dashboard';
let lastErrorEntry: LogEntry | null = null;

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
    return formatted.length > 5000 ? formatted.slice(0, 5000) + '... (truncated)' : formatted;
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

function addLog(
  level: LogLevel,
  tag: string,
  message: string,
  details?: any,
  immediatePersist = false,
  extra?: { screen?: string; context?: Record<string, any>; stack?: string }
) {
  const now = dayjs();
  let detailStr: string | undefined = undefined;
  let stackStr: string | undefined = extra?.stack;

  if (details !== undefined) {
    if (typeof details === 'string') {
      detailStr = details;
    } else if (details instanceof Error) {
      detailStr = `${details.name}: ${details.message}\n${details.stack || ''}`;
      if (!stackStr) stackStr = details.stack;
    } else {
      try {
        detailStr = JSON.stringify(details, null, 2);
      } catch {
        detailStr = String(details);
      }
    }
  }

  const activeScreen = extra?.screen || currentScreen || 'App';

  const newEntry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: now.format('HH:mm:ss.SSS'),
    timeFull: now.format('YYYY-MM-DD HH:mm:ss'),
    level,
    tag: tag.toUpperCase(),
    message: String(message),
    details: detailStr,
    screen: activeScreen,
    context: extra?.context,
    stack: stackStr,
  };

  if (level === 'error') {
    lastErrorEntry = newEntry;
  }

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
        addLog('error', tag, `${prefix} ${errorMsg}`, stack, true, {
          screen: currentScreen,
          stack,
        });
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
      addLog('info', tag, cleanMessage || firstArg || 'Log', details, false, { screen: currentScreen });
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
      addLog('info', tag, cleanMessage || firstArg || 'Info', details, false, { screen: currentScreen });
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
      addLog('warn', tag, cleanMessage || firstArg || 'Warning', details, false, { screen: currentScreen });
    } catch {
      // safe fallback
    }
  };

  console.error = (...args: any[]) => {
    originalConsoleError.apply(console, args);
    try {
      if (args.length === 0) {
        addLog('error', 'SYSTEM', 'console.error called with no arguments', undefined, true, { screen: currentScreen });
        return;
      }

      let tag = 'SYSTEM';
      let message = '';
      let details: any = undefined;
      let stack: string | undefined = undefined;

      const firstArg = args[0];

      if (firstArg instanceof Error) {
        tag = 'ERROR';
        message = `${firstArg.name}: ${firstArg.message}`;
        stack = firstArg.stack;
        const rest = args.slice(1);
        details = rest.length > 0 ? formatDetails(rest) : undefined;
      } else if (typeof firstArg === 'string') {
        const extracted = extractTag(firstArg);
        tag = extracted.tag;
        message = extracted.cleanMessage || firstArg;

        const restArgs = args.slice(1);
        const errorArg = restArgs.find(a => a instanceof Error);
        if (errorArg instanceof Error) {
          stack = errorArg.stack;
        }
        details = restArgs.length > 0 ? formatDetails(restArgs) : undefined;
      } else {
        message = typeof firstArg === 'object' ? JSON.stringify(firstArg) : String(firstArg);
        const restArgs = args.slice(1);
        details = restArgs.length > 0 ? formatDetails(restArgs) : undefined;
      }

      addLog('error', tag, message || 'Lỗi không xác định', details, true, {
        screen: currentScreen,
        stack,
      });
    } catch {
      // safe fallback
    }
  };

  // Log khởi tạo
  addLog('info', 'APP', 'Hệ thống Logger đã khởi tạo với Disk Persistence & Global Crash Hook.', { maxBufferSize: MAX_LOGS }, false, { screen: currentScreen });
}

function buildFormattedErrorReport(targetError?: any, context?: Record<string, any>): string {
  const nowStr = dayjs().format('YYYY-MM-DD HH:mm:ss');
  const osInfo = `${Platform.OS} (Phiên bản: ${Platform.Version})`;
  const screen = currentScreen;

  let errTitle = 'Lỗi không xác định';
  let errStack = '';
  let errDetails = '';

  if (targetError) {
    if (targetError instanceof Error) {
      errTitle = `${targetError.name}: ${targetError.message}`;
      errStack = targetError.stack || '';
    } else if (typeof targetError === 'string') {
      errTitle = targetError;
    } else {
      try {
        errTitle = JSON.stringify(targetError);
      } catch {
        errTitle = String(targetError);
      }
    }
  } else if (lastErrorEntry) {
    errTitle = `[${lastErrorEntry.tag}] ${lastErrorEntry.message}`;
    errStack = lastErrorEntry.stack || '';
    errDetails = lastErrorEntry.details || '';
  }

  // Lấy 15 bản ghi log gần nhất làm breadcrumbs
  const breadcrumbs = logs
    .slice(0, 15)
    .reverse()
    .map(l => `[${l.timestamp}] [${l.level.toUpperCase()}] [${l.tag}] ${l.screen ? `[${l.screen}] ` : ''}${l.message}${l.details ? ` -> ${l.details.slice(0, 120)}` : ''}`)
    .join('\n');

  let report = `==================== BÁO CÁO LỖI HỆ THỐNG ====================\n`;
  report += `⏰ Thời gian: ${nowStr}\n`;
  report += `📱 Thiết bị: ${osInfo}\n`;
  report += `📍 Màn hình: ${screen}\n`;
  report += `❌ Lỗi: ${errTitle}\n`;

  if (context && Object.keys(context).length > 0) {
    report += `\n-------------------- NGỮ CẢNH (CONTEXT) --------------------\n`;
    try {
      report += JSON.stringify(context, null, 2) + '\n';
    } catch {
      report += String(context) + '\n';
    }
  }

  if (errStack) {
    report += `\n-------------------- MÃ THEO DÕI (STACK TRACE) --------------------\n`;
    report += errStack + '\n';
  } else if (errDetails) {
    report += `\n-------------------- CHI TIẾT LỖI --------------------\n`;
    report += errDetails + '\n';
  }

  if (breadcrumbs) {
    report += `\n-------------------- NHẬT KÝ GẦN ĐÂY (BREADCRUMBS) --------------------\n`;
    report += breadcrumbs + '\n';
  }

  report += `==============================================================\n`;
  return report;
}

export const logger = {
  setCurrentScreen: (screen: string) => {
    currentScreen = screen;
  },
  getCurrentScreen: (): string => currentScreen,
  getLastError: (): LogEntry | null => lastErrorEntry,
  info: (tag: string, message: string, details?: any, context?: Record<string, any>) =>
    addLog('info', tag, message, details, false, { screen: currentScreen, context }),
  warn: (tag: string, message: string, details?: any, context?: Record<string, any>) =>
    addLog('warn', tag, message, details, false, { screen: currentScreen, context }),
  error: (tag: string, messageOrError: any, detailsOrContext?: any, extraContext?: Record<string, any>) => {
    let msg = '';
    let details = detailsOrContext;
    let stack: string | undefined = undefined;
    let ctx = extraContext;

    if (messageOrError instanceof Error) {
      msg = `${messageOrError.name}: ${messageOrError.message}`;
      stack = messageOrError.stack;
      if (detailsOrContext && typeof detailsOrContext === 'object' && !(detailsOrContext instanceof Error) && !Array.isArray(detailsOrContext)) {
        ctx = { ...detailsOrContext, ...extraContext };
        details = undefined;
      }
    } else {
      msg = String(messageOrError);
      if (detailsOrContext instanceof Error) {
        stack = detailsOrContext.stack;
      }
    }

    addLog('error', tag, msg, details, true, { screen: currentScreen, stack, context: ctx });
  },
  captureError: (tag: string, error: any, context?: Record<string, any>) => {
    const msg = error?.message ? `${error.name || 'Error'}: ${error.message}` : String(error);
    const stack = error?.stack || undefined;
    addLog('error', tag, msg, error, true, { screen: currentScreen, stack, context });
  },
  debug: (tag: string, message: string, details?: any) =>
    addLog('debug', tag, message, details, false, { screen: currentScreen }),
  getLogs: (): LogEntry[] => [...logs],
  clearLogs: async () => {
    logs = [];
    lastErrorEntry = null;
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
      .map(l => `[${l.timeFull}] [${l.level.toUpperCase()}] [${l.tag}] ${l.screen ? `[${l.screen}] ` : ''}${l.message}${l.details ? `\n--> Details: ${l.details}` : ''}`)
      .join('\n\n');
  },
  getFormattedErrorReport: buildFormattedErrorReport,
  copyErrorReport: async (targetError?: any, context?: Record<string, any>): Promise<boolean> => {
    try {
      const report = buildFormattedErrorReport(targetError, context);
      await Clipboard.setStringAsync(report);
      return true;
    } catch {
      return false;
    }
  },
  shareErrorReport: async (targetError?: any, context?: Record<string, any>): Promise<void> => {
    try {
      const report = buildFormattedErrorReport(targetError, context);
      await Share.share({
        title: 'Báo cáo lỗi ứng dụng',
        message: report,
      });
    } catch {
      // ignore
    }
  },
};
