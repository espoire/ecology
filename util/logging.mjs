export function valueAndType(value) {
  if (Array.isArray(value)) {
    return `[${value.map(valueAndType).join(', ')}] (Array)`;
  }
  return `'${value}' (${typeof value})`;
}

export function overrideConsoleWarnAndErrorTextColors() {
  const originalWarn = console.warn;
  const originalError = console.error;

  const warnColor = '\x1b[33m'; // Yellow
  const errorColor = '\x1b[31m'; // Red
  const resetColor = '\x1b[0m'; // Reset
  console.warn = function overriddenConsoleWarn(...args) {
    originalWarn(warnColor, ...args, resetColor);
  };

  console.error = function overriddenConsoleError(...args) {
    originalError(errorColor, ...args, resetColor);
  };
}