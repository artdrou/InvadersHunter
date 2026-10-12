import { missingLocationGroups } from "../features/map/missing-location";
import type { InvaderWithState } from "../features/invaders/types";

function inv(id: number, name: string, located = false): InvaderWithState {
  return {
    id, name, description: "", state: "Good",
    latitude: located ? 48.8 : null, longitude: located ? 2.3 : null,
    points: 10, date_pose: null, image_url: null,
    isCaptured: false, isPending: false,
  };
}

const all = [
  inv(1, "PA_1234"), inv(2, "PA_05"), inv(3, "LDN_12"), inv(4, "PA_7", true), inv(5, "SPACE2ISS"),
];

describe("missingLocationGroups", () => {
  it("keeps only invaders without a position, grouped by city", () => {
    expect(missingLocationGroups(all, "")).toEqual([
      ["LDN", [all[2]]],
      ["PA", [all[1], all[0]]],
    ]);
  });

  it("searches names whatever the case, separators and zero padding", () => {
    expect(missingLocationGroups(all, "pa 5")).toEqual([["PA", [all[1]]]]);
    expect(missingLocationGroups(all, "pa_005")).toEqual([["PA", [all[1]]]]);
    expect(missingLocationGroups(all, "ldn")).toEqual([["LDN", [all[2]]]]);
    expect(missingLocationGroups(all, "PA_7")).toEqual([]);
  });
});
