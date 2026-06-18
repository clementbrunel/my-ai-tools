import { describe, it, expect } from 'vitest';
import { getFlagUrl } from './countryFlags';

describe('getFlagUrl', () => {
  it('returns a flagcdn URL for a known country', () => {
    expect(getFlagUrl('France')).toBe('https://flagcdn.com/fr.svg');
  });

  it('returns correct code for Angleterre (subdivision code)', () => {
    expect(getFlagUrl('Angleterre')).toBe('https://flagcdn.com/gb-eng.svg');
  });

  it('returns correct code for Écosse (subdivision code)', () => {
    expect(getFlagUrl('Écosse')).toBe('https://flagcdn.com/gb-sct.svg');
  });

  it('returns correct URL for Brésil', () => {
    expect(getFlagUrl('Brésil')).toBe('https://flagcdn.com/br.svg');
  });

  it('returns correct URL for États-Unis', () => {
    expect(getFlagUrl('États-Unis')).toBe('https://flagcdn.com/us.svg');
  });

  it("returns correct URL for Côte d'Ivoire", () => {
    expect(getFlagUrl("Côte d'Ivoire")).toBe('https://flagcdn.com/ci.svg');
  });

  it('returns null for an unknown country', () => {
    expect(getFlagUrl('Narnia')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getFlagUrl('')).toBeNull();
  });

  it('is case-sensitive (wrong case returns null)', () => {
    expect(getFlagUrl('france')).toBeNull();
  });

  it('returns an .svg URL', () => {
    const url = getFlagUrl('Espagne');
    expect(url).toMatch(/\.svg$/);
  });
});
