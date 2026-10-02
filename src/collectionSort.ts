import type { Collection } from "./api.js";

type NameParts = { number: number; prefix: string; rest: string };

function nameParts(name: string): NameParts {
  const match = name.match(/^(\D*)(\d[\d,.]*)?(.*)$/);
  const numberText = match?.[2] || "";
  return {
    number: numberText ? parseInt(numberText.replace(/[^\d]/g, ""), 10) : NaN,
    prefix: match?.[1] || "",
    rest: match?.[3] || "",
  };
}

// Port of the web dashboard's collectionNameSort (app/javascript/helpers.js) so the order matches.
export function compareCollectionNames(first: Collection, second: Collection): number {
  const a = nameParts(first.name);
  const b = nameParts(second.name);
  if (a.prefix !== b.prefix) return a.prefix.localeCompare(b.prefix);
  if (isNaN(a.number) && !isNaN(b.number)) return -1;
  if (!isNaN(a.number) && isNaN(b.number)) return 1;
  if (!isNaN(a.number) && !isNaN(b.number)) {
    return a.number !== b.number ? a.number - b.number : a.rest.localeCompare(b.rest);
  }
  return first.name.localeCompare(second.name);
}

// The web dashboard's "my collections": the ones pinned to the dashboard, custom ones included.
export function myCollections(collections: Collection[]): Collection[] {
  return collections.filter((collection) => collection.dashboardCollection).sort(compareCollectionNames);
}

// Everything else the pairing offers, for browsing to start something new.
export function otherCollections(collections: Collection[]): Collection[] {
  return collections.filter((collection) => !collection.dashboardCollection).sort(compareCollectionNames);
}
