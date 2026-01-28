/**
 * Structured Logging with Winston
 * 
 * Logging is like keeping a diary for your application - it helps us understand what's
 * happening, when things go wrong, and how the system is performing. But unlike a diary,
 * we need our logs to be structured and searchable so we can find specific events quickly.
 * 
 * We use Winston (a popular Node.js logging library) because it gives us:
 * - Multiple log levels (error, warn, info, debug) so we can filter by severity
 * - Structured output (JSON format) that's easy to parse and search
 * - Multiple transports (console, files) so we can log to different places
 * - Automatic log rotation to prevent log files from growing too large
 * 
 * In development, we use colorful console output so logs are easy to read. In production,
 * we use JSON format so log aggregation tools (like Datadog, CloudWatch, etc.) can parse
 * and analyze them easily.
 * 
 * We also log to files:
 * - error.log: Only errors (for quick debugging of critical issues)
 * - combined.log: All logs (for comprehensive analysis)
 * - exceptions.log: Uncaught exceptions (for crash analysis)
 * - rejections.log: Unhandled promise rejections (for async error tracking)
 */

import winston from 'winston';
import { NODE_ENV } from '../config/env.validation.js';
import { mkdirSync } from 'fs';
import { join } from 'path';

// Create logs directory if it doesn't exist
// We do this synchronously at module load time so it's ready when we need it
try {
  mkdirSync(join(process.cwd(), 'logs'), { recursive: true });
} catch (error) {
  // Directory might already exist, or we might not have write permissions
  // That's okay - Winston will handle file creation errors gracefully
}

/**
 * Log Format for Production (JSON)
 * 
 * JSON format is machine-readable, making it easy for log aggregation tools to:
 * - Parse and index logs
 * - Search across millions of log entries
 * - Create dashboards and alerts
 * - Correlate logs from different services
 * 
 * We include:
 * - timestamp: When the log was created
 * - level: How severe the log is (error, warn, info, debug)
 * - message: What happened
 * - ...meta: Any additional context (error stacks, request IDs, etc.)
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }), // Include error stack traces
  winston.format.splat(), // Support for string interpolation (%s, %d, etc.)
  winston.format.json() // Output as JSON
);

/**
 * Log Format for Development (Human-Readable)
 * 
 * In development, we want logs that are easy to read at a glance. This format:
 * - Uses colors to distinguish log levels (red for errors, yellow for warnings, etc.)
 * - Shows timestamps in a readable format
 * - Includes all metadata in a readable way
 * - Makes it easy to spot issues while developing
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(), // Add colors based on log level
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    // Format: [timestamp] [level]: message {metadata}
    let msg = `${timestamp} [${level}]: ${message}`;
    // If there's additional metadata, append it as JSON
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

/**
 * Winston Logger Instance
 * 
 * This is our main logger that we'll use throughout the application. It's configured
 * to log at different levels based on the environment:
 * - Production: 'info' level and above (no debug logs cluttering production logs)
 * - Development: 'debug' level and above (more verbose for debugging)
 * 
 * We set up multiple transports (output destinations):
 * 1. Console: Always logs to console (for immediate feedback)
 * 2. error.log: Only errors (for quick access to critical issues)
 * 3. combined.log: All logs (for comprehensive analysis)
 * 
 * We also set up special handlers for uncaught exceptions and unhandled rejections,
 * which are logged to separate files so we can track crashes and async errors.
 */
export const logger = winston.createLogger({
  level: NODE_ENV === 'production' ? 'info' : 'debug', // More verbose in development
  format: logFormat, // Use JSON format for file logs
  defaultMeta: { service: 'devai-api' }, // Tag all logs with our service name
  transports: [
    // Console transport - always output to console
    // In development, use colorful format; in production, use JSON
    new winston.transports.Console({
      format: NODE_ENV === 'production' ? logFormat : consoleFormat,
    }),
    // Error log - only errors, for quick debugging of critical issues
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880, // 5MB max file size
      maxFiles: 5, // Keep up to 5 rotated files
    }),
    // Combined log - all logs, for comprehensive analysis
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880, // 5MB max file size
      maxFiles: 5, // Keep up to 5 rotated files
    }),
  ],
  // Handle uncaught exceptions (synchronous errors that crash the process)
  exceptionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/exceptions.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
  // Handle unhandled promise rejections (async errors that could crash the process)
  rejectionHandlers: [
    new winston.transports.File({ 
      filename: 'logs/rejections.log',
      maxsize: 5242880,
      maxFiles: 5,
    }),
  ],
});

/**
 * Helper function to create child loggers with additional context
 * 
 * Sometimes we want to add context to all logs from a specific module or request.
 * For example, we might want to tag all logs from a specific user or request ID.
 * Child loggers make this easy - they inherit all the parent logger's settings
 * but add additional metadata to every log.
 * 
 * @param meta - Additional metadata to include in all logs from this child logger
 * @returns A new logger instance with the additional metadata
 * 
 * @example
 * ```typescript
 * const requestLogger = logger.child({ requestId: 'abc123', userId: 'user456' });
 * requestLogger.info('Processing request'); // Automatically includes requestId and userId
 * ```
 */
export const createChildLogger = (meta: Record<string, any>) => {
  return logger.child(meta);
};


