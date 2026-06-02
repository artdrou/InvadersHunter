import {
  cityOf, numOf, groupByCity, buildGroups, formatDate,
  SORT_OPTIONS_BY_GROUP, SORT_DEFAULT_DIR,
} from "../features/invaders/utils/invader-list";
import type { InvaderWithState } from "../features/invaders/types";

function makeInvader(name: string, overrides: Partial<InvaderWithState> = {}): InvaderWithState {
  return {
    id: 0,
    name,
    description: "",
    state: "Good",
    latitude: 0,
    longitude: 0,
    points: 10,
    date_pose: null,
    image_url: null,
    isCaptured: false,
    isPending: false,
    ...overrides,
  };
}

function namesIn(groups: [string, InvaderWithState[]][], groupKey: string): string[] {
  return groups.find(([k]) => k === groupKey)?.[1].map((i) => i.name) ?? [];
}

// ── cityOf ─────────────────────────────────────────────────────────────────

describe("cityOf", () => {
  it("extracts city code before underscore", () => {
    expect(cityOf("PA_10")).toBe("PA");
  });

  it("extracts multi-char city code", () => {
    expect(cityOf("LYO_3")).toBe("LYO");
  });

  it("returns uppercased result when already uppercase", () => {
    expect(cityOf("PA_10")).toBe("PA");
  });

  it("returns full name uppercased when no underscore", () => {
    expect(cityOf("paris")).toBe("PARIS");
  });

  it("handles single-char city code", () => {
    expect(cityOf("X_99")).toBe("X");
  });
});

// ── numOf ──────────────────────────────────────────────────────────────────

describe("numOf", () => {
  it("extracts number after underscore", () => {
    expect(numOf("PA_10")).toBe(10);
  });

  it("extracts large number", () => {
    expect(numOf("LYO_99")).toBe(99);
  });

  it("returns 0 when no underscore", () => {
    expect(numOf("PARIS")).toBe(0);
  });

  it("returns 0 for non-numeric suffix", () => {
    expect(numOf("PA_abc")).toBe(0);
  });

  it("parses single digit", () => {
    expect(numOf("LYO_3")).toBe(3);
  });
});

// ── groupByCity ────────────────────────────────────────────────────────────

describe("groupByCity", () => {
  it("groups invaders by city prefix", () => {
    const invaders = [makeInvader("PA_1"), makeInvader("PA_2"), makeInvader("LYO_1")];
    const groups = groupByCity(invaders);
    const cities = groups.map(([city]) => city);
    expect(cities).toContain("PA");
    expect(cities).toContain("LYO");
  });

  it("sorts cities alphabetically", () => {
    const invaders = [makeInvader("PA_1"), makeInvader("BOR_1"), makeInvader("LYO_1")];
    const cities = groupByCity(invaders).map(([city]) => city);
    expect(cities).toEqual(["BOR", "LYO", "PA"]);
  });

  it("sorts invaders within a city by number", () => {
    const invaders = [makeInvader("PA_10"), makeInvader("PA_2"), makeInvader("PA_5")];
    const [, paInvaders] = groupByCity(invaders)[0];
    expect(paInvaders.map((i) => i.name)).toEqual(["PA_2", "PA_5", "PA_10"]);
  });

  it("returns empty array for empty input", () => {
    expect(groupByCity([])).toEqual([]);
  });

  it("handles single invader", () => {
    const groups = groupByCity([makeInvader("PA_1")]);
    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toBe("PA");
  });
});

// ── SORT_OPTIONS_BY_GROUP ──────────────────────────────────────────────────

describe("SORT_OPTIONS_BY_GROUP", () => {
  it("includes 'name' as first option in every group mode", () => {
    expect(SORT_OPTIONS_BY_GROUP.city[0]).toBe("name");
    expect(SORT_OPTIONS_BY_GROUP.points[0]).toBe("name");
    expect(SORT_OPTIONS_BY_GROUP.year[0]).toBe("name");
  });

  it("does not include 'number' sentinel in any group mode", () => {
    expect(SORT_OPTIONS_BY_GROUP.city).not.toContain("number");
    expect(SORT_OPTIONS_BY_GROUP.points).not.toContain("number");
    expect(SORT_OPTIONS_BY_GROUP.year).not.toContain("number");
  });

  it("excludes the grouping dimension from each mode", () => {
    expect(SORT_OPTIONS_BY_GROUP.points).not.toContain("points");
    expect(SORT_OPTIONS_BY_GROUP.year).not.toContain("pose_date");
  });
});

// ── SORT_DEFAULT_DIR ────────────────────────────────────────────────────────

describe("SORT_DEFAULT_DIR", () => {
  it("defaults name and points to asc (low→high / A→Z)", () => {
    expect(SORT_DEFAULT_DIR.name).toBe("asc");
    expect(SORT_DEFAULT_DIR.points).toBe("asc");
  });

  it("defaults all date sorts to desc (newest first)", () => {
    expect(SORT_DEFAULT_DIR.pose_date).toBe("desc");
    expect(SORT_DEFAULT_DIR.flash_date).toBe("desc");
    expect(SORT_DEFAULT_DIR.update_date).toBe("desc");
  });
});

// ── buildGroups ─────────────────────────────────────────────────────────────

describe("buildGroups — number sentinel (erase state)", () => {
  it("returns natural numOf order within groups without applying sort", () => {
    const inv = [makeInvader("PA_10"), makeInvader("PA_2"), makeInvader("PA_5")];
    const groups = buildGroups(inv, "city", "number");
    expect(namesIn(groups, "PA")).toEqual(["PA_2", "PA_5", "PA_10"]);
  });
});

describe("buildGroups — sort by name (alphabetical)", () => {
  // all have same points so they land in one "10 pts" group
  const inv = [
    makeInvader("PA_1", { points: 10 }),
    makeInvader("LY_1", { points: 10 }),
    makeInvader("NY_5", { points: 10 }),
  ];

  it("asc: A→Z by full name across cities within a group", () => {
    const groups = buildGroups(inv, "points", "name", "asc");
    expect(namesIn(groups, "10 pts")).toEqual(["LY_1", "NY_5", "PA_1"]);
  });

  it("desc: Z→A by full name across cities within a group", () => {
    const groups = buildGroups(inv, "points", "name", "desc");
    expect(namesIn(groups, "10 pts")).toEqual(["PA_1", "NY_5", "LY_1"]);
  });
});

describe("buildGroups — sort by points", () => {
  const inv = [
    makeInvader("PA_1",  { points: 10 }),
    makeInvader("PA_5",  { points: 50 }),
    makeInvader("PA_10", { points: 30 }),
  ];

  it("asc: low→high", () => {
    const groups = buildGroups(inv, "city", "points", "asc");
    expect(namesIn(groups, "PA")).toEqual(["PA_1", "PA_10", "PA_5"]);
  });

  it("desc: high→low", () => {
    const groups = buildGroups(inv, "city", "points", "desc");
    expect(namesIn(groups, "PA")).toEqual(["PA_5", "PA_10", "PA_1"]);
  });
});

describe("buildGroups — sort by pose_date", () => {
  const inv = [
    makeInvader("PA_1", { date_pose: "2020-01-01" }),
    makeInvader("PA_2", { date_pose: "2018-01-01" }),
    makeInvader("PA_3", { date_pose: "2022-01-01" }),
  ];

  it("asc: oldest→newest", () => {
    const groups = buildGroups(inv, "city", "pose_date", "asc");
    expect(namesIn(groups, "PA")).toEqual(["PA_2", "PA_1", "PA_3"]);
  });

  it("desc: newest→oldest", () => {
    const groups = buildGroups(inv, "city", "pose_date", "desc");
    expect(namesIn(groups, "PA")).toEqual(["PA_3", "PA_1", "PA_2"]);
  });
});

describe("buildGroups — sort by flash_date", () => {
  const inv = [
    makeInvader("PA_1", { capturedAt: "2021-06-01" }),
    makeInvader("PA_2", { capturedAt: "2019-01-01" }),
    makeInvader("PA_3", { capturedAt: "2023-03-01" }),
  ];

  it("asc: oldest flash→newest", () => {
    const groups = buildGroups(inv, "city", "flash_date", "asc");
    expect(namesIn(groups, "PA")).toEqual(["PA_2", "PA_1", "PA_3"]);
  });

  it("desc: newest flash→oldest", () => {
    const groups = buildGroups(inv, "city", "flash_date", "desc");
    expect(namesIn(groups, "PA")).toEqual(["PA_3", "PA_1", "PA_2"]);
  });
});

describe("buildGroups — sort by update_date", () => {
  const inv = [
    makeInvader("PA_1", { updated_at: "2022-03-01" }),
    makeInvader("PA_2", { updated_at: "2021-01-01" }),
    makeInvader("PA_3", { updated_at: "2023-12-01" }),
  ];

  it("asc: oldest update→newest", () => {
    const groups = buildGroups(inv, "city", "update_date", "asc");
    expect(namesIn(groups, "PA")).toEqual(["PA_2", "PA_1", "PA_3"]);
  });

  it("desc: newest update→oldest", () => {
    const groups = buildGroups(inv, "city", "update_date", "desc");
    expect(namesIn(groups, "PA")).toEqual(["PA_3", "PA_1", "PA_2"]);
  });
});

// ── formatDate ─────────────────────────────────────────────────────────────

describe("formatDate", () => {
  it("returns -- for null", () => {
    expect(formatDate(null)).toBe("--");
  });

  it("returns -- for undefined", () => {
    expect(formatDate(undefined)).toBe("--");
  });

  it("formats a valid ISO date string in French locale", () => {
    const result = formatDate("2024-06-15T00:00:00.000Z");
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("includes the correct year", () => {
    const result = formatDate("2024-06-15T00:00:00.000Z");
    expect(result).toContain("2024");
  });
});
