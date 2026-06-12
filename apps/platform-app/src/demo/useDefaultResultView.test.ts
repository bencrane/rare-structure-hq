/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";

import { DEFAULT_VIEW_STORAGE_KEY, parseResultView } from "./useDefaultResultView";

/**
 * Guards the persistence contract for the global default result view. The hook
 * itself is thin React state; the load-bearing logic is the narrowing of stored
 * strings (anything unexpected must fall back to the seed, never crash a render)
 * and the storage key (changing it silently wipes every operator's saved default).
 */
describe("parseResultView", () => {
  it("accepts the two valid views verbatim", () => {
    expect(parseResultView("map")).toBe("map");
    expect(parseResultView("table")).toBe("table");
  });

  it("rejects absent / garbage values to null so the caller seeds its fallback", () => {
    expect(parseResultView(null)).toBeNull();
    expect(parseResultView("")).toBeNull();
    expect(parseResultView("MAP")).toBeNull(); // case-sensitive on purpose
    expect(parseResultView("chart")).toBeNull();
    expect(parseResultView("aggregate")).toBeNull();
  });
});

describe("DEFAULT_VIEW_STORAGE_KEY", () => {
  it("is pinned — renaming it resets every operator's persisted default", () => {
    expect(DEFAULT_VIEW_STORAGE_KEY).toBe("rs.cockpit.defaultResultView");
  });
});
