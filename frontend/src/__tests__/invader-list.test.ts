import { cityOf, numOf, groupByCity, formatDate } from "../features/invaders/utils/invader-list";
import type { InvaderWithState } from "../features/invaders/types";

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

function makeInvader(name: string, id = 0): InvaderWithState {
  return {
    id,
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
  };
}

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
    const names = paInvaders.map((i) => i.name);
    expect(names).toEqual(["PA_2", "PA_5", "PA_10"]);
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
    // fr-FR format: DD/MM/YYYY
    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("includes the correct year", () => {
    const result = formatDate("2024-06-15T00:00:00.000Z");
    expect(result).toContain("2024");
  });
});
