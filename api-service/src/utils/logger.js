import winston from "winston";

// Normalize logging configuration from environment
const LOG_LEVEL = process.env.LOG_LEVEL || "info";
const NODE_ENV = process.env.APP_ENV || process.env.NODE_ENV || "development";
const LOG_TO_FILE = process.env.LOG_TO_FILE === "true";
const LOG_FILE = process.env.LOG_FILE || "logs/app.log";

const createLogger = () => {
  const consistentFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      const logData = {
        timestamp,
        level,
        message,
        ...meta,
      };

      if (stack) {
        logData.stack = stack;
      }

      return JSON.stringify(logData, null, 2);
    })
  );

  const developmentFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.errors({ stack: true }),
    winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
      let logMessage = `${timestamp} [${level}]: ${message}`;

      if (stack) {
        logMessage += `\n${stack}`;
      }

      if (Object.keys(meta).length > 0) {
        logMessage += `\n${JSON.stringify(meta, null, 2)}`;
      }

      return logMessage;
    })
  );

  const transports = [
    new winston.transports.Console({
      level: LOG_LEVEL,
      format: NODE_ENV === "production" ? consistentFormat : developmentFormat,
    }),
  ];

  if (LOG_TO_FILE) {
    transports.push(
      new winston.transports.File({
        filename: LOG_FILE,
        level: LOG_LEVEL,
        format: consistentFormat,
      })
    );
  }

  return winston.createLogger({
    level: LOG_LEVEL,
    transports,
    exitOnError: false,
  });
};

const logger = createLogger();

const safeLogger = {
  error: (message, meta = {}) => logger.error(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  info: (message, meta = {}) => logger.info(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
};

export { logger, safeLogger };
export default logger;
