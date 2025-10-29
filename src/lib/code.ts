export function toBase36(n: number) {
  return n.toString(36).toUpperCase();
}

export function checksum(source: string) {
  let value = 0;
  for (const ch of source) {
    const digit = parseInt(ch, 36);
    if (Number.isNaN(digit)) {
      continue;
    }
    value = (value * 36 + digit) % 97;
  }
  const first = toBase36(value % 36);
  const second = toBase36(Math.floor(value / 36) % 36);
  return `${first}${second}`;
}

export function generateItemCode(date = new Date()) {
  const timestamp = Math.floor(date.getTime() / 1000);
  const core = `C-${toBase36(timestamp)}`;
  return `${core}-${checksum(core.replace('-', ''))}`;
}
