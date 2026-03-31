type Unit = 'day' | 'week' | 'month' | 'year' | 'hour' | 'minute' | 'second';

type DayjsMockInstance = {
  tz: () => DayjsMockInstance;
  utc: () => DayjsMockInstance;
  toDate: () => Date;
  format: (pattern?: string) => string;
  startOf: (unit: Unit) => DayjsMockInstance;
  endOf: (unit: Unit) => DayjsMockInstance;
  add: (amount: number, unit: Unit) => DayjsMockInstance;
  subtract: (amount: number, unit: Unit) => DayjsMockInstance;
  isBefore: (value: unknown) => boolean;
  isAfter: (value: unknown) => boolean;
  isSame: (value: unknown) => boolean;
  hour: () => number;
  minute: () => number;
  second: () => number;
  millisecond: () => number;
  clone: () => DayjsMockInstance;
};

function normalizeInput(value?: unknown): Date {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }
  if (value && typeof value === 'object' && 'toDate' in (value as object)) {
    return normalizeInput((value as { toDate: () => Date }).toDate());
  }
  return new Date('2026-01-01T00:00:00.000Z');
}

function formatDate(date: Date, pattern?: string): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const ss = String(date.getUTCSeconds()).padStart(2, '0');

  switch (pattern) {
    case 'YYYY-MM-DD':
      return `${yyyy}-${mm}-${dd}`;
    case 'YYYY-MM':
      return `${yyyy}-${mm}`;
    case 'HH:mm:ss':
      return `${hh}:${mi}:${ss}`;
    default:
      return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.000Z`;
  }
}

function createInstance(input?: unknown): DayjsMockInstance {
  const current = normalizeInput(input);
  const adjust = (amount: number, unit: Unit, multiplier: number): Date => {
    const next = new Date(current.getTime());
    if (unit === 'day') next.setUTCDate(next.getUTCDate() + amount * multiplier);
    if (unit === 'week') next.setUTCDate(next.getUTCDate() + amount * 7 * multiplier);
    if (unit === 'month') next.setUTCMonth(next.getUTCMonth() + amount * multiplier);
    if (unit === 'year') next.setUTCFullYear(next.getUTCFullYear() + amount * multiplier);
    if (unit === 'hour') next.setUTCHours(next.getUTCHours() + amount * multiplier);
    if (unit === 'minute') next.setUTCMinutes(next.getUTCMinutes() + amount * multiplier);
    if (unit === 'second') next.setUTCSeconds(next.getUTCSeconds() + amount * multiplier);
    return next;
  };

  return {
    tz: () => createInstance(current),
    utc: () => createInstance(current),
    toDate: () => new Date(current.getTime()),
    format: (pattern?: string) => formatDate(current, pattern),
    startOf: (unit: Unit) => {
      const next = new Date(current.getTime());
      if (unit === 'day') next.setUTCHours(0, 0, 0, 0);
      return createInstance(next);
    },
    endOf: (unit: Unit) => {
      const next = new Date(current.getTime());
      if (unit === 'day') next.setUTCHours(23, 59, 59, 999);
      return createInstance(next);
    },
    add: (amount: number, unit: Unit) => createInstance(adjust(amount, unit, 1)),
    subtract: (amount: number, unit: Unit) => createInstance(adjust(amount, unit, -1)),
    isBefore: (value: unknown) => current.getTime() < normalizeInput(value).getTime(),
    isAfter: (value: unknown) => current.getTime() > normalizeInput(value).getTime(),
    isSame: (value: unknown) => current.getTime() === normalizeInput(value).getTime(),
    hour: () => current.getUTCHours(),
    minute: () => current.getUTCMinutes(),
    second: () => current.getUTCSeconds(),
    millisecond: () => current.getUTCMilliseconds(),
    clone: () => createInstance(current),
  };
}

const dayjs = Object.assign(
  (value?: unknown) => createInstance(value),
  {
    extend: () => undefined,
    tz: (value?: unknown) => createInstance(value),
    utc: (value?: unknown) => createInstance(value),
  },
);

export default dayjs;
