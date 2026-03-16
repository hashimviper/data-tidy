/**
 * Structured Logger for data processing pipeline.
 * Tracks rows processed, errors, timing, and events.
 */

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  phase: string;
  message: string;
  meta?: Record<string, unknown>;
}

export class ProcessingLogger {
  private entries: LogEntry[] = [];
  private startTime: number = 0;
  private rowsProcessed = 0;
  private errorsEncountered = 0;

  start(): void {
    this.startTime = performance.now();
    this.log('info', 'pipeline', 'Processing started');
  }

  stop(): void {
    const elapsed = this.getElapsedMs();
    this.log('info', 'pipeline', `Processing finished in ${elapsed.toFixed(1)}ms`, {
      rowsProcessed: this.rowsProcessed,
      errors: this.errorsEncountered,
    });
  }

  log(level: LogEntry['level'], phase: string, message: string, meta?: Record<string, unknown>): void {
    const entry: LogEntry = { timestamp: Date.now(), level, phase, message, meta };
    this.entries.push(entry);

    const prefix = `[${phase.toUpperCase()}]`;
    if (level === 'error') {
      console.error(prefix, message, meta ?? '');
      this.errorsEncountered++;
    } else if (level === 'warn') {
      console.warn(prefix, message, meta ?? '');
    } else {
      console.log(prefix, message, meta ?? '');
    }
  }

  trackRows(count: number): void {
    this.rowsProcessed += count;
  }

  getElapsedMs(): number {
    return performance.now() - this.startTime;
  }

  getSummary() {
    return {
      totalEntries: this.entries.length,
      rowsProcessed: this.rowsProcessed,
      errorsEncountered: this.errorsEncountered,
      elapsedMs: this.getElapsedMs(),
      entries: [...this.entries],
    };
  }
}
