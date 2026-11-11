import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';
import indexHtml from '../index.html?raw';
import manifestRaw from '../public/manifest.webmanifest?raw';

// Vitest vide les imports CSS : on lit le fichier brut.
const indexCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

// jsdom ne calcule pas les styles : on vérifie statiquement la config PWA
// qui évite la barre blanche / le contenu sous l'encoche en mode installé.

describe('PWA — safe-area-inset-top', () => {
  it('le viewport déclare viewport-fit=cover (sinon env(safe-area-inset-*) vaut 0)', () => {
    const viewport = indexHtml.match(/<meta[^>]+name="viewport"[^>]*>/)?.[0] ?? '';
    expect(viewport).toContain('viewport-fit=cover');
  });

  it('le header .wc-header applique env(safe-area-inset-top) en padding-top', () => {
    const block = indexCss.match(/\.wc-header\s*\{[^}]*\}/)?.[0] ?? '';
    expect(block).toMatch(/padding-top:\s*env\(safe-area-inset-top/);
  });
});

describe('PWA — manifest', () => {
  const manifest = JSON.parse(manifestRaw);

  it('est lié depuis index.html', () => {
    expect(indexHtml).toContain('rel="manifest" href="/manifest.webmanifest"');
  });

  it('démarre en standalone (pas de barre navigateur)', () => {
    expect(manifest.display).toBe('standalone');
  });

  it('fournit des icônes 192, 512 et maskable', () => {
    const sizes = manifest.icons.map((i: { sizes: string; purpose?: string }) => `${i.sizes}:${i.purpose}`);
    expect(sizes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
  });

  it('déclare un theme-color dans index.html', () => {
    expect(indexHtml).toMatch(/<meta name="theme-color" content="#[0-9a-fA-F]{6}"/);
  });
});
