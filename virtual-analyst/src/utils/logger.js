// Prosty logger poziomowany do stderr (REQ-NFR-004).
// Nie loguje kluczy ani pełnych treści dokumentów.

function log(level, message, meta) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}`;
  if (meta !== undefined) {
    process.stderr.write(`${line} ${JSON.stringify(meta)}\n`);
  } else {
    process.stderr.write(`${line}\n`);
  }
}

export const logger = {
  info: (msg, meta) => log('INFO', msg, meta),
  warn: (msg, meta) => log('WARN', msg, meta),
  error: (msg, meta) => log('ERROR', msg, meta),
};
