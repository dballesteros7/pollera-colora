import { describe, it, expect } from "vitest";
import { patriotSides, teamName } from "../lib/teams";

describe("patriotSides (Easter-egg teams)", () => {
  it("detects each patriot team on the correct side", () => {
    expect(patriotSides("Colombia", "Congo DR")).toEqual([
      { team: "Colombia", side: "home" },
    ]);
    expect(patriotSides("Panama", "Switzerland")).toEqual([
      { team: "Switzerland", side: "away" },
    ]);
    expect(patriotSides("Canada", "Mexico")).toEqual([
      { team: "Canada", side: "home" },
    ]);
    expect(patriotSides("United States", "Australia")).toEqual([
      { team: "United States", side: "home" },
      { team: "Australia", side: "away" },
    ]);
  });

  it("returns nothing for matches without a patriot team", () => {
    expect(patriotSides("Portugal", "Uzbekistan")).toEqual([]);
    expect(patriotSides(null, null)).toEqual([]);
  });

  it("a patriot team only triggers as the team itself, not its country name", () => {
    // teamName is display-only; the egg keys off the raw football-data name
    expect(teamName("Switzerland", "es")).toBe("Suiza");
    expect(patriotSides("Suiza", "Canada")).toEqual([
      { team: "Canada", side: "away" },
    ]);
  });
});
