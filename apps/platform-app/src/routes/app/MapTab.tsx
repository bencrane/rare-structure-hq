import { DemoApp } from "@/demo/DemoApp";

/**
 * MapTab — the catalyst terminal mounted inside the cockpit shell.
 *
 * `embedded` drops the map's own brand header (wordmark + terminal name) — the
 * sidebar already carries the brand inside the authenticated portal, so the
 * public `/map`'s full chrome would be a duplicate here. Authors no geometry.
 */
export default function MapTab() {
  return <DemoApp embedded />;
}
