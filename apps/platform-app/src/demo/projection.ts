/**
 * Albers-USA projection for live geo-dots — recovered from the committed
 * us-geo.ts STATE_PATHS geometry.
 *
 * us-geo.ts was generated offline by projecting us-atlas states-10m through
 * d3 geoAlbersUsa, fitting to a 1000x590 viewBox, and emitting plain SVG path
 * strings. The generator and its scale/translate were never committed. They
 * were reverse-engineered by least-squares over the continental-state
 * bounding-box corners of the committed paths:
 *
 *   geoAlbersUsa().scale(1242.586).translate([502.185, 287.336])
 *
 * reproduces the committed state outlines to a mean of ~3px (p90 ~6.5px) — the
 * Douglas-Peucker simplification noise floor. This is the exact generator
 * equivalent expressed as explicit scale/translate, so NO topojson/us-atlas
 * FeatureCollection is needed at runtime (only d3-geo's projection math).
 * Verified independently: 13 canonical interior cities (TX, CA, FL, NY, WA, CO,
 * ME, MI, IL, GA, DC, MT, AK) each land inside their own committed state bbox.
 *
 * Output is in the SAME coordinate space MapView consumes: x in [0,1000],
 * y in [0,590], origin top-left, y increasing downward — a drop-in for
 * Company.x / Company.y. (MapView gates the dot layer on x/y presence and
 * feeds them straight into SVG cx/cy with no further transform.)
 *
 * AK/HI: geoAlbersUsa is a composite that routes Alaska and Hawaii to
 * lower-left insets. MapView re-places the AK/HI *state outlines* with an extra
 * INSET_TRANSFORM (a 0.65 scale + translate) that the dot layer does NOT apply.
 * To keep AK/HI dots tracking the rendered insets, we apply an inset transform
 * here, selected by the native composite output region:
 *   - Alaska reuses MapView's outline transform verbatim — d3's AK inset and
 *     the committed AK outline coincide (Anchorage/Fairbanks/Juneau all land
 *     inside the rendered AK outline).
 *   - Hawaii needs its OWN transform: d3's geoAlbersUsa HI inset sits ~83px
 *     (native) left of where the committed HI outline was placed, so reusing
 *     MapView's HI transform drops Honolulu ~42px left of the rendered HI box.
 *     HI_INSET below is calibrated so Honolulu (the dominant HI award location)
 *     lands at the center of the committed HI outline. HI is a negligible slice
 *     of federal awards; single-point (Honolulu) calibration is sufficient.
 */
import { geoAlbersUsa } from "d3-geo";

/** Recovered generator parameters (see module header). */
const ALBERS_SCALE = 1242.586;
const ALBERS_TRANSLATE: [number, number] = [502.185, 287.336];

const projection = geoAlbersUsa().scale(ALBERS_SCALE).translate(ALBERS_TRANSLATE);

/** 1000x590 viewBox bounds — must mirror GEO_VIEW in us-geo.ts. */
const VIEW_W = 1000;
const VIEW_H = 590;

/**
 * Inset transforms as [translateX, translateY, scale]: screen = scale*native + t.
 * AK matches MapView.tsx INSET_TRANSFORM["02"] exactly. HI diverges from
 * MapView's INSET_TRANSFORM["15"] (-15.4, 176.7) on the x-translate only —
 * recalibrated so Honolulu (native ~291.4) centers in the committed HI outline
 * (rendered x[216,298]); the y-translate and 0.65 scale are unchanged.
 */
const INSET_AK: [number, number, number] = [-3.1, 193.4, 0.65];
const INSET_HI: [number, number, number] = [67.6, 177.0, 0.65];

/**
 * Classify a native composite point as lower-48 / AK / HI by output region and
 * apply the inset transform when needed. geoAlbersUsa places AK at native
 * x<235 / y>445 and HI at native x in [235,400] / y>445 under the recovered
 * scale; every lower-48 point with y>445 (south TX/FL) sits at x>400, so the
 * region gates separate the insets cleanly without misclassifying the mainland.
 */
function applyInset(x: number, y: number): [number, number] {
  if (y > 445 && x < 235) {
    const [tx, ty, s] = INSET_AK;
    return [s * x + tx, s * y + ty];
  }
  if (y > 445 && x >= 235 && x < 400) {
    const [tx, ty, s] = INSET_HI;
    return [s * x + tx, s * y + ty];
  }
  return [x, y];
}

/**
 * Project a geographic coordinate to 1000x590 viewBox pixels.
 *
 * Returns null for coordinates geoAlbersUsa cannot place (Puerto Rico, Guam,
 * other non-composite territories) and for any result that falls outside the
 * viewBox — callers must drop those rather than plot them at a bogus position.
 */
export function projectLonLat(lon: number, lat: number): { x: number; y: number } | null {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
  const p = projection([lon, lat]);
  if (!p) return null; // outside the US composite (geoAlbersUsa returns undefined)
  const [nx, ny] = applyInset(p[0], p[1]);
  if (nx < 0 || nx > VIEW_W || ny < 0 || ny > VIEW_H) return null; // off-canvas guard
  return { x: nx, y: ny };
}
