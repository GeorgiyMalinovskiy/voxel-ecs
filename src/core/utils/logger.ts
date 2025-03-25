export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

export class Logger {
  private static logBuffer: string[] = [];
  private static logLevel: LogLevel = LogLevel.INFO;
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  static setLogLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  static dumpLogs(): string {
    return Logger.logBuffer.join("\n");
  }

  static downloadLogs(filename: string = "scene-logs.txt"): void {
    const logs = Logger.dumpLogs();
    const blob = new Blob([logs], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    Logger.clearLogs();
  }

  static clearLogs(): void {
    Logger.logBuffer = [];
  }

  static cleanup(): void {
    Logger.clearLogs();
    Logger.logLevel = LogLevel.INFO;
  }

  private log(level: LogLevel, message: string): void {
    if (level >= Logger.logLevel) {
      const timestamp = new Date().toISOString();
      const logMessage = `[${timestamp}] [${LogLevel[level]}] [${this.context}] ${message}`;
      console.log(logMessage);
      Logger.logBuffer.push(logMessage);
    }
  }

  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }

  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }
}
