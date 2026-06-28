import { describe, it, expect } from 'vitest';
import { getFlagUrl } from './countryFlags';

describe('getFlagUrl', () => {
  it('returns a flagcdn URL for a valid iso2 code', () => {
    expect(getFlagUrl('fr')).toBe('https://flagcdn.com/fr.svg');
  });

  it('returns correct URL for subdivision code (England)', () => {
    expect(getFlagUrl('gb-eng')).toBe('https://flagcdn.com/gb-eng.svg');
  });

  it('returns correct URL for subdivision code (Scotland)', () => {
    expect(getFlagUrl('gb-sct')).toBe('https://flagcdn.com/gb-sct.svg');
  });

  it('returns correct URL for br', () => {
    expect(getFlagUrl('br')).toBe('https://flagcdn.com/br.svg');
  });

  it('returns correct URL for us', () => {
    expect(getFlagUrl('us')).toBe('https://flagcdn.com/us.svg');
  });

  it('returns null for null', () => {
    expect(getFlagUrl(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(getFlagUrl(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getFlagUrl('')).toBeNull();
  });

  it('returns an .svg URL', () => {
    const url = getFlagUrl('es');
    expect(url).toMatch(/\.svg$/);
  });
});
