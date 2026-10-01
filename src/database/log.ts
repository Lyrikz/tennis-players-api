/** Minimal structured logger for code running outside Nest (migrations, scripts). */
export type Log = (message: string, details?: Record<string, unknown>) => void;

/** One JSON line per entry on stdout: parsed by CloudWatch Logs Insights. */
export const jsonLog: Log = (message, details) => {
  process.stdout.write(`${JSON.stringify({ level: 'INFO', message, ...details })}\n`);
};
