/**
 * Structured Logging Utility
 * Provides consistent structured logging for webhooks and job processors
 */

/**
 * Log levels
 */
export const LogLevel = {
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  DEBUG: 'debug'
}

/**
 * Create a structured log entry
 * @param {string} level - Log level (info, warn, error, debug)
 * @param {string} message - Human-readable message
 * @param {object} metadata - Additional metadata
 * @returns {object} Structured log object
 */
export function createStructuredLog(level, message, metadata = {}) {
  return {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...metadata
  }
}

/**
 * Log structured message
 * @param {string} level - Log level
 * @param {string} message - Message
 * @param {object} metadata - Metadata
 */
export function logStructured(level, message, metadata = {}) {
  const logEntry = createStructuredLog(level, message, metadata)
  console.log(JSON.stringify(logEntry))
}

/**
 * Convenience methods
 */
export const logger = {
  info: (message, metadata) => logStructured(LogLevel.INFO, message, metadata),
  warn: (message, metadata) => logStructured(LogLevel.WARN, message, metadata),
  error: (message, metadata) => logStructured(LogLevel.ERROR, message, metadata),
  debug: (message, metadata) => logStructured(LogLevel.DEBUG, message, metadata)
}

/**
 * Error reporting hook
 * Can be extended to send errors to external service (Sentry, etc.)
 */
export function reportError(error, context = {}) {
  const errorLog = createStructuredLog(LogLevel.ERROR, error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack
    },
    context
  })
  
  console.error(JSON.stringify(errorLog))
  
  // TODO: Integrate with error reporting service
  // if (window.Sentry) {
  //   window.Sentry.captureException(error, { extra: context })
  // }
}
