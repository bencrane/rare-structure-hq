import { DemoApp } from "@/demo/DemoApp";

/**
 * MapTab — the catalyst terminal mounted inside the cockpit shell.
 *
 * Reuses the self-contained `DemoApp` surface (full-viewport, owns its own
 * chrome) verbatim; the sidebar sits alongside it. Authors no geometry.
 */
export default function MapTab() {
  return <DemoApp />;
}
