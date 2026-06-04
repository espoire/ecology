export function valueAndType(value) {
  if (Array.isArray(value)) {
    return `[${value.map(valueAndType).join(', ')}] (Array)`;
  }
  return `'${value}' (${typeof value})`;
}