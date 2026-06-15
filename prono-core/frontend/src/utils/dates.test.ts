import { describe, it, expect } from 'vitest';
import { formatDate, formatDateTime, parseDDMMYYYY } from './dates';

describe('formatDate', () => {
  it('formats a LocalDate string', () => {
    expect(formatDate('2026-06-11')).toBe('11/06/2026');
  });

  it('formats a LocalDateTime string', () => {
    expect(formatDate('2026-06-11T21:00:00')).toBe('11/06/2026');
  });

  it('formats a Date object', () => {
    expect(formatDate(new Date('2026-06-11T00:00:00.000Z'))).toBe('11/06/2026');
  });

  it('pads single-digit day and month', () => {
    expect(formatDate('2026-01-05')).toBe('05/01/2026');
  });

  it('handles end-of-year date', () => {
    expect(formatDate('2026-12-31')).toBe('31/12/2026');
  });
});

describe('formatDateTime', () => {
  it('includes the date part', () => {
    const result = formatDateTime('2026-06-11T21:00:00');
    expect(result).toMatch(/^11\/06\/2026/);
  });

  it('includes hours and minutes', () => {
    const result = formatDateTime('2026-06-11T21:30:00');
    expect(result).toMatch(/\d{2}:\d{2}$/);
  });

  it('accepts a Date object', () => {
    const d = new Date('2026-06-11T10:00:00Z');
    const result = formatDateTime(d);
    expect(result).toMatch(/^11\/06\/2026/);
  });
});

describe('parseDDMMYYYY', () => {
  it('converts DD/MM/YYYY to YYYY-MM-DD', () => {
    expect(parseDDMMYYYY('11/06/2026')).toBe('2026-06-11');
  });

  it('handles padding zeros', () => {
    expect(parseDDMMYYYY('05/01/2026')).toBe('2026-01-05');
  });

  it('returns empty string for invalid format', () => {
    expect(parseDDMMYYYY('2026-06-11')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(parseDDMMYYYY('')).toBe('');
  });

  it('returns empty string for partial input', () => {
    expect(parseDDMMYYYY('11/06')).toBe('');
  });

  it('is the inverse of formatDate', () => {
    const iso = '2026-07-14';
    expect(parseDDMMYYYY(formatDate(iso))).toBe(iso);
  });
});
