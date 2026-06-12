/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import { projectLonLat } from "./projection";
import { STATE_PATHS } from "./us-geo";

/**
 * Regression guard: projection.ts carries a reverse-engineered Albers-USA
 * scale/translate (1242.586 / [502.185, 287.336]) that must stay consistent with
 * the OFFLINE-projected outlines committed in us-geo.ts. Nothing else links the
 * two — if us-geo.ts is ever regenerated with a different projection, or the
 * constants in projection.ts are edited, the dots silently drift off the map.
 * These tests fail loud in that case: each known city must project INSIDE its own
 * committed state outline, and two anchors pin the exact recovered params.
 */

// MapView.tsx INSET_TRANSFORM — the AK/HI OUTLINE transforms, used here only to
// compute where each inset outline actually renders (the dot layer applies its own,
// in projection.ts). [translateX, translateY, scale]: screen = scale*native + t.
const OUTLINE_INSET: Record<string, [number, number, number]> = {
  "02": [-3.1, 193.4, 0.65], // Alaska
  "15": [-15.4, 176.7, 0.65], // Hawaii
};

function bbox(d: string) {
  const n = (d.match(/-?\d+\.?\d*/g) ?? []).map(Number);
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (let i = 0; i + 1 < n.length; i += 2) {
    const x = n[i];
    const y = n[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}

const byId = new Map(STATE_PATHS.map((s) => [s.id, s]));

function renderedBbox(id: string) {
  const s = byId.get(id);
  if (!s) throw new Error(`no STATE_PATH for FIPS ${id}`);
  let b = bbox(s.d);
  const t = OUTLINE_INSET[id];
  if (t) {
    const [tx, ty, sc] = t;
    b = {
      minX: sc * b.minX + tx,
      maxX: sc * b.maxX + tx,
      minY: sc * b.minY + ty,
      maxY: sc * b.maxY + ty,
    };
  }
  return b;
}

// FIPS id, label, interior lon, lat — a canonical interior point per state.
const CITIES: [string, string, number, number][] = [
  ["48", "Austin TX", -97.7431, 30.2672],
  ["06", "Fresno CA", -119.7726, 36.7468],
  ["12", "Orlando FL", -81.3792, 28.5383],
  ["36", "Syracuse NY", -76.1474, 43.0481],
  ["53", "Yakima WA", -120.5059, 46.6021],
  ["08", "Denver CO", -104.9903, 39.7392],
  ["23", "Bangor ME", -68.7712, 44.8016],
  ["26", "Lansing MI", -84.5555, 42.7325],
  ["17", "Springfield IL", -89.6501, 39.7817],
  ["13", "Macon GA", -83.6324, 32.8407],
  ["11", "Washington DC", -77.0369, 38.9072],
  ["30", "Helena MT", -112.0391, 46.5891],
  ["02", "Anchorage AK", -149.9003, 61.2181],
  ["15", "Honolulu HI", -157.8583, 21.3069],
];

describe("projectLonLat ↔ us-geo.ts STATE_PATHS consistency", () => {
  const MARGIN = 3; // px — Douglas-Peucker simplification noise floor of us-geo.ts

  for (const [id, label, lon, lat] of CITIES) {
    it(`${label} projects inside its rendered state outline`, () => {
      const p = projectLonLat(lon, lat);
      expect(p).not.toBeNull();
      const b = renderedBbox(id);
      expect(p!.x).toBeGreaterThanOrEqual(b.minX - MARGIN);
      expect(p!.x).toBeLessThanOrEqual(b.maxX + MARGIN);
      expect(p!.y).toBeGreaterThanOrEqual(b.minY - MARGIN);
      expect(p!.y).toBeLessThanOrEqual(b.maxY + MARGIN);
    });
  }

  it("drops coordinates outside the US composite (Puerto Rico → null)", () => {
    expect(projectLonLat(-66.1057, 18.4655)).toBeNull();
  });

  it("pins the recovered scale/translate via known anchors (DC, Boston)", () => {
    // If projection.ts's ALBERS_SCALE/ALBERS_TRANSLATE drift, these move.
    const dc = projectLonLat(-77.0369, 38.9072)!;
    expect(Math.abs(dc.x - 827)).toBeLessThan(2);
    expect(Math.abs(dc.y - 251)).toBeLessThan(2);
    const boston = projectLonLat(-71.0589, 42.3601)!;
    expect(Math.abs(boston.x - 905)).toBeLessThan(2);
    expect(Math.abs(boston.y - 156)).toBeLessThan(2);
  });
});
