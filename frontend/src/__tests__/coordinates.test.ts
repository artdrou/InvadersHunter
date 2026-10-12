import { parseCoordinates } from "../features/map/coordinates";

function expectNear(input: string, lat: number, lon: number) {
  const r = parseCoordinates(input);
  expect(r).not.toBeNull();
  expect(r!.lat).toBeCloseTo(lat, 4);
  expect(r!.lon).toBeCloseTo(lon, 4);
}

describe("parseCoordinates", () => {
  it("reads decimal pairs", () => {
    expectNear("48.8566, 2.3522", 48.8566, 2.3522);
    expectNear("48.8566 2.3522", 48.8566, 2.3522);
    expectNear("48.8566,2.3522", 48.8566, 2.3522);
    expectNear("  -33.8568;151.2153 ", -33.8568, 151.2153);
    expectNear("lat: 48.8566, lon: 2.3522", 48.8566, 2.3522);
  });

  it("reads French decimal commas", () => {
    expectNear("48,8566 2,3522", 48.8566, 2.3522);
    expectNear("48,8566, 2,3522", 48.8566, 2.3522);
    expectNear("48,8566; 2,3522", 48.8566, 2.3522);
  });

  it("swaps a lon-first pair when only that order fits", () => {
    expectNear("151.2153, -33.8568", -33.8568, 151.2153);
  });

  it("reads hemisphere letters, before or after, in any order", () => {
    expectNear("48.8566N 2.3522E", 48.8566, 2.3522);
    expectNear("N 48.8566 E 2.3522", 48.8566, 2.3522);
    expectNear("2.3522 E, 48.8566 N", 48.8566, 2.3522);
    expectNear("33.8568 S 70.6693 W", -33.8568, -70.6693);
    expectNear("48.8566 N 1.5 O", 48.8566, -1.5);
  });

  it("reads degrees / minutes / seconds", () => {
    expectNear(`48°51'24"N 2°21'08"E`, 48.856667, 2.352222);
    expectNear(`48°51'24.0"N 2°21'08.0"E`, 48.856667, 2.352222);
    expectNear("48° 51′ 24″ N, 2° 21′ 8″ E", 48.856667, 2.352222);
    expectNear("48 51 24 N 2 21 8 E", 48.856667, 2.352222);
    expectNear("48 51 24 2 21 8", 48.856667, 2.352222);
    expectNear(`-33°51'24" 151°12'55"`, -33.856667, 151.215278);
  });

  it("reads degrees / decimal minutes", () => {
    expectNear("48° 51.4' N, 2° 21.13' E", 48.856667, 2.352167);
    expectNear("N 48 51.4 E 2 21.13", 48.856667, 2.352167);
  });

  it("reads map links", () => {
    expectNear("https://www.google.com/maps/place/X/@48.8566,2.3522,17z/data=abc", 48.8566, 2.3522);
    expectNear("https://maps.google.com/?q=48.8566,2.3522", 48.8566, 2.3522);
    expectNear("https://maps.apple.com/?ll=48.8566,2.3522&q=Pin", 48.8566, 2.3522);
    expectNear("https://www.openstreetmap.org/#map=17/48.8566/2.3522", 48.8566, 2.3522);
    expectNear("https://www.openstreetmap.org/?mlat=48.8566&mlon=2.3522", 48.8566, 2.3522);
    expectNear("geo:48.8566,2.3522?z=17", 48.8566, 2.3522);
  });

  it("rejects what isn't a single position", () => {
    for (const bad of [
      "", "   ", "48.8566", "1 2 3", "Paris", "rue de Rivoli 12",
      "95.1, 200.2", "48°61'00\"N 2°00'00\"E", "48.85 N 2.35 S",
      "https://maps.app.goo.gl/abcdef",
    ]) {
      expect(parseCoordinates(bad)).toBeNull();
    }
  });
});
