import pino from 'pino';
import { env } from '../config/env.js';

let _logger: pino.Logger | null = null;

export function initLogger(): pino.Logger {
  _logger = pino({
    level: env().LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level(label) {
        return { level: label };
      },
    },
  });
  return _logger;
}

export function logger(): pino.Logger {
  if (!_logger) throw new Error('Logger not initialized');
  return _logger;
}

export function childLogger(module: string): pino.Logger {
  return logger().child({ module });
}
