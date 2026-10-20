// Markup of the startup splash (splash.ts), kept free of Electron so that it can be unit-tested.

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Splash page markup; colors follow the theme tokens of the renderer (styles.css). */
export function splashHtml(version: string, dark: boolean): string {
  const bg = dark ? "#14171a" : "#ffffff";
  const fg = dark ? "#e6e9ec" : "#1b1f24";
  const muted = dark ? "#8b95a0" : "#5b6570";
  const border = dark ? "#2d333a" : "#d0d5da";
  const accent = dark ? "#3b82f6" : "#2f6fdc";
  return `<!doctype html>
<html lang="fr"><head><meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'" />
<title>cbl-log</title>
<style>
  html, body { height: 100%; margin: 0; }
  body {
    background: ${bg}; color: ${fg}; border: 1px solid ${border}; box-sizing: border-box;
    font-family: "Segoe UI", system-ui, sans-serif; -webkit-user-select: none; user-select: none; cursor: default;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px;
  }
  h1 { margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; }
  p { margin: 0; color: ${muted}; font-size: 12px; }
  .spinner {
    width: 28px; height: 28px; border-radius: 50%;
    border: 3px solid ${border}; border-top-color: ${accent};
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style></head>
<body>
  <h1>cbl-log</h1>
  <div class="spinner" role="progressbar" aria-label="Chargement"></div>
  <p>Démarrage… v${escapeHtml(version)}</p>
</body></html>`;
}
