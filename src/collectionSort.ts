import type { Collection } from "./api.js";

type NameParts = { number?: number; prefix: string; rest: string };

// Port of the web dashboard's collectionNameSort (app/javascript/helpers.js) so the order matches.
export function compareCollectionNames(first: Collection, second: Collection): number {
  const a = nameParts(first.name);
  const b = nameParts(second.name);
  if (a.prefix !== b.prefix) return a.prefix.localeCompare(b.prefix);
  if (a.number === undefined && b.number === undefined) return first.name.localeCompare(second.name);
  if (a.number === undefined) return -1;
  if (b.number === undefined) return 1;
  return a.number !== b.number ? a.number - b.number : a.rest.localeCompare(b.rest);
}

export function myCollections(collections: Collection[]): Collection[] {
  return collections.filter((collection) => collection.dashboardCollection).sort(compareCollectionNames);
}

export function otherCollections(collections: Collection[]): Collection[] {
  return collections.filter((collection) => !collection.dashboardCollection).sort(compareCollectionNames);
}

function nameParts(name: string): NameParts {
  const [, prefix = "", numberText, rest = ""] = name.match(/^(\D*)(\d[\d,.]*)?(.*)$/) || [];
  return { number: numberText ? parseInt(numberText.replace(/[^\d]/g, ""), 10) : undefined, prefix, rest };
}
