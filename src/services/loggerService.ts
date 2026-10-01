// src/services/loggerService.ts
// Quản lý & lưu trữ nhật ký (logs) hoạt động trong ứng dụng
import dayjs from 'dayjs';

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
let logs: LogEntry[] = [];
const listeners: Set<LogListener> = new Set();
let isInitialized = false;

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
    return formatted.length > 2000 ? formatted.slice(0, 2000) + '... (truncated)' : formatted;
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

function addLog(level: LogLevel, tag: string, message: string, details?: any) {
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
}

/**
 * Khởi tạo hệ thống logger tự động hook vào console.*
 */
export function initLogger() {
  if (isInitialized) return;
  isInitialized = true;

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
      addLog('error', tag, cleanMessage || firstArg || 'Error', details);
    } catch {
      // safe fallback
    }
  };

  // Log khởi tạo
  addLog('info', 'APP', 'Hệ thống Logger đã khởi tạo thành công.', { maxBufferSize: MAX_LOGS });
}

export const logger = {
  info: (tag: string, message: string, details?: any) => addLog('info', tag, message, details),
  warn: (tag: string, message: string, details?: any) => addLog('warn', tag, message, details),
  error: (tag: string, message: string, details?: any) => addLog('error', tag, message, details),
  debug: (tag: string, message: string, details?: any) => addLog('debug', tag, message, details),
  getLogs: (): LogEntry[] => [...logs],
  clearLogs: () => {
    logs = [];
    notifyListeners();
  },
  subscribe: (listener: LogListener): (() => void) => {
    listeners.add(listener);
    listener([...logs]);
    return () => listeners.delete(listener);
  },
  exportAsString: (): string => {
    return logs
      .map(l => `[${l.timeFull}] [${l.level.toUpperCase()}] [${l.tag}] ${l.message}${l.details ? `\n--> Details: ${l.details}` : ''}`)
      .join('\n\n');
  },
};
