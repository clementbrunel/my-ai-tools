/** Small app icons for the hero and the dock (ai-env-manager keeps its own drawn tile). */
export default function AppIcon({ id, size = 46 }: { id: string; size?: number }) {
  const s = { width: size, height: size, borderRadius: size * 0.26 }
  // prono-core: pixel-art football / F1 icon (1024 px original cropped to the tile, 256 px)
  if (id === 'prono-core') return <img className="ico" src="./icons/prono-core.webp" alt="" width={size} height={size} style={{ ...s, borderRadius: size * 0.22, objectFit: 'cover' }} />
  // the real app icon (bbb-vite/public/BBB300.jpg)
  if (id === 'bienvenuebebe') return <img className="ico" src="./icons/bienvenuebebe.jpg" alt="" width={size} height={size} style={{ ...s, objectFit: 'cover' }} />
  return <span className="ico" style={{ ...s, background: '#0b0f0c', border: '1px solid #2a4a34' }}><svg viewBox="0 0 24 24" width="62%"><path d="M5 8l5 4-5 4M12 17h7" stroke="#7dff9b" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></span>
}
