// Markup of the startup splash and of the "À propos" window (brand-windows.ts), kept free of Electron so
// that it can be unit-tested. Both show the author's avatar (resources/avatar.png, passed as a data URL)
// independently of the app icon, and colors follow the theme tokens of the renderer (styles.css).

export const AUTHOR = "Clement Brunel";
export const AUTHOR_URL = "https://github.com/clementbrunel";
export const REPO_URL = "https://github.com/clementbrunel/my-ai-tools";

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export const themeColors = (dark: boolean) =>
  dark
    ? { bg: "#14171a", fg: "#e6e9ec", muted: "#8b95a0", border: "#2d333a", accent: "#3b82f6" }
    : { bg: "#ffffff", fg: "#1b1f24", muted: "#5b6570", border: "#d0d5da", accent: "#2f6fdc" };

function page(dark: boolean, css: string, body: string): string {
  const c = themeColors(dark);
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:" />
<title>cbl-log</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    background: ${c.bg}; color: ${c.fg}; box-sizing: border-box;
    font-family: "Segoe UI", system-ui, sans-serif; -webkit-user-select: none; user-select: none; cursor: default;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
  }
  h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
  p { margin: 0; color: ${c.muted}; font-size: 12px; }
  a { color: ${c.accent}; text-decoration: none; cursor: pointer; }
  a:hover { text-decoration: underline; }
  .avatar { border-radius: 50%; border: 2px solid ${c.border}; object-fit: cover; }
  .spinner {
    width: 22px; height: 22px; border-radius: 50%;
    border: 3px solid ${c.border}; border-top-color: ${c.accent};
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
${css}
</style></head>
<body>
${body}
</body></html>`;
}

const avatarImg = (avatar: string | undefined, size: number): string =>
  avatar ? `<img class="avatar" src="${escapeHtml(avatar)}" width="${size}" height="${size}" alt="${AUTHOR}" />` : "";

/** Splash shown while the main window starts (the frameless window gets a border drawn by the page). */
export function splashHtml(version: string, dark: boolean, avatar?: string): string {
  const css = `  body { border: 1px solid ${themeColors(dark).border}; gap: 10px; }
  .row { display: flex; align-items: center; gap: 10px; }`;
  return page(
    dark,
    css,
    `  ${avatarImg(avatar, 64)}
  <h1>cbl-log</h1>
  <div class="row"><div class="spinner" role="progressbar" aria-label="Chargement"></div><p>Démarrage… v${escapeHtml(version)}</p></div>
  <p>par ${AUTHOR}</p>`,
  );
}

/** "À propos" window: links open in the browser (see brand-windows.ts). */
export function aboutHtml(version: string, dark: boolean, avatar?: string): string {
  const css = `  body { gap: 8px; padding: 16px; }
  h1 { margin-top: 6px; }
  .desc { color: inherit; font-size: 13px; margin: 4px 0 8px; }`;
  return page(
    dark,
    css,
    `  ${avatarImg(avatar, 96)}
  <h1>cbl-log</h1>
  <p>Version ${escapeHtml(version)}</p>
  <p class="desc">Visualiseur de logs temps réel</p>
  <p>par <a href="${AUTHOR_URL}" target="_blank">${AUTHOR}</a> · <a href="${AUTHOR_URL}" target="_blank">github.com/clementbrunel</a></p>
  <p><a href="${REPO_URL}" target="_blank">Code source</a></p>`,
  );
}
