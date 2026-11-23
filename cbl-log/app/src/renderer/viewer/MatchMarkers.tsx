import "./MatchMarkers.css";
import { memo } from "react";

/** Width of the markers when the scrollbars are overlays (they take no room of their own). */
const OVERLAY_BAR_PX = 12;

export interface ScrollbarSize {
  /** Width of the vertical scrollbar (0 for an overlay scrollbar). */
  w: number;
  /** Height of the horizontal scrollbar. */
  h: number;
}

/**
 * Thin strip over the vertical scrollbar: a tick where matches lie, more opaque where there are more.
 * Its height is that of the scrollbar track (the arrow buttons at both ends are left out), on which the
 * thumb moves linearly with the rows, so a tick sits where the thumb has to go to see those matches.
 * Memoized: the viewport re-renders at every row scrolled, the markers only when the density changes.
 */
export const MatchMarkers = memo(function MatchMarkers({ density, bars }: { density: readonly number[]; bars: ScrollbarSize }) {
  const peak = Math.max(1, ...density);
  const n = density.length;
  return (
    <div className="match-markers" aria-hidden="true" style={{ width: bars.w || OVERLAY_BAR_PX, top: bars.w, bottom: bars.w + bars.h }}>
      {density.map((count, i) =>
        count > 0 ? (
          <span key={i} className="match-tick" style={{ top: `${(i / n) * 100}%`, height: `${100 / n}%`, opacity: 0.55 + 0.45 * (count / peak) }} />
        ) : null,
      )}
    </div>
  );
});
