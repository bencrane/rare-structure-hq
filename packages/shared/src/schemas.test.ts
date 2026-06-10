/// <reference types="bun-types" />
import { describe, expect, it } from "bun:test";
import {
  catalystEventCreateSchema,
  catalystEventSchema,
  catalystKindSchema,
  catalystSeveritySchema,
  federalEntityListSchema,
  federalEntityQuerySchema,
  federalEntitySchema,
  federalIndustryChartSchema,
  federalStateChartSchema,
} from "./index";

describe("@rare-structure-hq/shared — catalyst-event schema", () => {
  const wellFormed = {
    id: "00000000-0000-0000-0000-000000000001",
    kind: "regulatory" as const,
    severity: "high" as const,
    headline: "EU adopts revised battery-materials directive",
    occurred_at: "2026-05-19T09:00:00Z",
    ingested_at: "2026-05-19T11:30:00Z",
    source: "regulatory-feed",
  };

  it("validates a well-formed catalyst event and applies defaults", () => {
    const parsed = catalystEventSchema.parse(wellFormed);
    expect(parsed.status).toBe("ingested");
    expect(parsed.tags).toEqual([]);
    expect(parsed.confidence).toBeNull();
  });

  it("rejects an unknown kind / severity", () => {
    expect(() => catalystKindSchema.parse("vibes")).toThrow();
    expect(() => catalystSeveritySchema.parse("apocalyptic")).toThrow();
  });

  it("rejects an empty headline and an out-of-range confidence", () => {
    expect(() => catalystEventSchema.parse({ ...wellFormed, headline: "" })).toThrow();
    expect(() => catalystEventSchema.parse({ ...wellFormed, confidence: 1.5 })).toThrow();
  });

  it("create schema omits server-assigned id + ingested_at", () => {
    const { id, ingested_at, ...rest } = wellFormed;
    void id;
    void ingested_at;
    expect(() => catalystEventCreateSchema.parse(rest)).not.toThrow();
  });

  it("location is optional and additive — absent by default", () => {
    const parsed = catalystEventSchema.parse(wellFormed);
    expect(parsed.location).toBeUndefined();
  });

  it("accepts a well-formed location and rejects out-of-range coordinates", () => {
    const located = {
      ...wellFormed,
      location: { lon: -97.7431, lat: 30.2672, region: "Texas" },
    };
    const parsed = catalystEventSchema.parse(located);
    expect(parsed.location?.region).toBe("Texas");
    expect(() =>
      catalystEventSchema.parse({ ...wellFormed, location: { lon: 200, lat: 0, region: "x" } }),
    ).toThrow();
    expect(() =>
      catalystEventSchema.parse({ ...wellFormed, location: { lon: 0, lat: 0, region: "" } }),
    ).toThrow();
  });
});

describe("@rare-structure-hq/shared — federal schema", () => {
  const provenance = {
    materializedAt: "2026-06-10T21:46:44.142828+00:00",
    profileAsOfDate: "2026-06-10",
  };

  it("validates an industry chart envelope", () => {
    const parsed = federalIndustryChartSchema.parse({
      ...provenance,
      groupCount: 1146,
      rows: [
        {
          naics: "923120",
          spend_lifetime: 2486548847867.98,
          spend_active: 365408987411.71,
          firms: 719,
        },
      ],
    });
    expect(parsed.groupCount).toBe(1146);
    expect(parsed.rows[0].naics).toBe("923120");
  });

  it("allows a null profileAsOfDate", () => {
    const parsed = federalStateChartSchema.parse({
      materializedAt: provenance.materializedAt,
      profileAsOfDate: null,
      groupCount: 1,
      rows: [{ state: "CA", spend_lifetime: 1, spend_active: 0, firms: 1 }],
    });
    expect(parsed.profileAsOfDate).toBeNull();
  });

  it("validates an entity row and a paginated list envelope", () => {
    const entity = federalEntitySchema.parse({
      uei: "GRC4XK29M7PT",
      legalNameBase: "GRANITE RIDGE CONSTRUCTORS",
      city: "DENVER",
      state: "CO",
      naics: "237310",
      totalLifetimeObligations: 184000000,
      totalActiveObligations: 12000000,
      activeAwardCount: 3,
      hasFederalAwards: true,
    });
    expect(entity.uei).toBe("GRC4XK29M7PT");

    const list = federalEntityListSchema.parse({
      ...provenance,
      total: 1,
      returned: 1,
      offset: 0,
      limit: 500,
      truncated: false,
      minLifetimeBound: 1000000,
      fullUniverse: 354543,
      rows: [entity],
    });
    expect(list.fullUniverse).toBe(354543);
    expect(list.truncated).toBe(false);
  });

  it("coerces query params from URL strings", () => {
    const q = federalEntityQuerySchema.parse({
      naics: "336",
      minObligation: "5000000",
      state: "tx",
      activeOnly: "true",
      limit: "100",
      offset: "0",
    });
    expect(q.minObligation).toBe(5000000);
    expect(q.activeOnly).toBe(true);
    expect(q.limit).toBe(100);
  });

  it("rejects a limit above the 2000 cap", () => {
    expect(() => federalEntityQuerySchema.parse({ limit: "5000" })).toThrow();
  });
});
