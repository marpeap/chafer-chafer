import pino from 'pino';

let _logger: pino.Logger | null = null;

function getOrCreateLogger(): pino.Logger {
  if (!_logger) {
    // Create a default logger if not yet initialized via initLogger
    _logger = pino({
      level: process.env.LOG_LEVEL || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level(label) {
          return { level: label };
        },
      },
    });
  }
  return _logger;
}

export function initLogger(): pino.Logger {
  _logger = pino({
    level: process.env.LOG_LEVEL || 'info',
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
  return getOrCreateLogger();
}

export function childLogger(module: string): pino.Logger {
  return getOrCreateLogger().child({ module });
}
