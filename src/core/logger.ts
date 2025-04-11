/**
 * Log levels for the application
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * Central logging system for the application
 */
class Logger {
    private level: LogLevel = LogLevel.INFO;
    
    /**
     * Set the minimum log level
     * @param level Minimum level to log
     */
    setLevel(level: LogLevel): void {
        this.level = level;
    }
    
    /**
     * Log a debug message
     * @param message Message to log
     * @param data Additional data to log
     */
    debug(message: string, ...data: any[]): void {
        if (this.level <= LogLevel.DEBUG) {
            console.debug(`[DEBUG] ${message}`, ...data);
        }
    }
    
    /**
     * Log an info message
     * @param message Message to log
     * @param data Additional data to log
     */
    info(message: string, ...data: any[]): void {
        if (this.level <= LogLevel.INFO) {
            console.info(`[INFO] ${message}`, ...data);
        }
    }
    
    /**
     * Log a warning message
     * @param message Message to log
     * @param data Additional data to log
     */
    warn(message: string, ...data: any[]): void {
        if (this.level <= LogLevel.WARN) {
            console.warn(`[WARN] ${message}`, ...data);
        }
    }
    
    /**
     * Log an error message
     * @param message Message to log
     * @param data Additional data to log
     */
    error(message: string, ...data: any[]): void {
        if (this.level <= LogLevel.ERROR) {
            console.error(`[ERROR] ${message}`, ...data);
        }
    }
}

// Export a singleton instance
export const logger = new Logger();