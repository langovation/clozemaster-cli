import { describe, expect, it } from "vitest";
import type { Collection } from "../src/api.js";
import { myCollections, otherCollections } from "../src/collectionSort.js";

const collection = (name: string, dashboardCollection = true) => ({ dashboardCollection, name }) as Collection;
const names = (collections: Collection[]) => collections.map((each) => each.name);

describe("myCollections", () => {
  it("keeps only the dashboard collections", () => {
    expect(names(myCollections([collection("Verbs"), collection("Beginner A1", false)]))).toEqual(["Verbs"]);
  });

  it("orders numbered names by their number, commas included", () => {
    expect(names(myCollections([collection("Top 10,000"), collection("Top 500"), collection("Top 2,000")]))).toEqual([
      "Top 500",
      "Top 2,000",
      "Top 10,000",
    ]);
  });

  it("puts an unnumbered name before numbered ones with the same prefix", () => {
    expect(names(myCollections([collection("Top 500"), collection("Top")]))).toEqual(["Top", "Top 500"]);
  });

  it("orders by prefix first", () => {
    expect(names(myCollections([collection("Verbs"), collection("500 Most Common"), collection("Core 1,000")]))).toEqual([
      "500 Most Common",
      "Core 1,000",
      "Verbs",
    ]);
  });

  it("orders the same number by what follows it", () => {
    expect(names(myCollections([collection("Top 500 verbs"), collection("Top 500 nouns")]))).toEqual(["Top 500 nouns", "Top 500 verbs"]);
  });
});

describe("otherCollections", () => {
  it("keeps only the collections not on the dashboard, in order", () => {
    expect(names(otherCollections([collection("Verbs"), collection("B", false), collection("A", false)]))).toEqual(["A", "B"]);
  });
});
