import {
  districts_en,
  divisions_en,
  unions_en,
  upazilas_en,
  type LocationItem,
} from "bangladesh-location-data";

/**
 * Bangladesh district → upazila/thana → union tree for the checkout address
 * dropdowns. The dataset is ~450 KB, so import this module lazily
 * (`import("@/lib/bd-locations")`) rather than at the top of a page.
 *
 * The cleaning below must stay in step with the backend copy
 * (apps/backend/src/common/bd-locations.ts), which re-validates the names.
 */

export interface BdUpazila {
  name: string;
  unions: string[];
}

export interface BdDistrict {
  name: string;
  division: string;
  upazilas: BdUpazila[];
}

function cleanLocationName(title: string): string {
  return title
    .replace(/[​-‍﻿]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/Corporat$/, "Corporation")
    .replace(/(^|[\s(/-])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase());
}

/** Cleaned, de-duplicated (case-insensitive) and alphabetised names. */
function names(items: LocationItem[] | undefined): { id: number; name: string }[] {
  const seen = new Map<string, { id: number; name: string }>();
  for (const item of items ?? []) {
    const name = cleanLocationName(item.title);
    const key = name.toLowerCase();
    if (name && !seen.has(key)) seen.set(key, { id: item.value, name });
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

function buildTree(): BdDistrict[] {
  const districts: BdDistrict[] = [];
  for (const division of divisions_en) {
    for (const district of names(districts_en[division.value])) {
      districts.push({
        name: district.name,
        division: cleanLocationName(division.title),
        upazilas: names(upazilas_en[district.id]).map((u) => ({
          name: u.name,
          unions: names(unions_en[u.id]).map((x) => x.name),
        })),
      });
    }
  }
  return districts.sort((a, b) => a.name.localeCompare(b.name));
}

export const BD_DISTRICTS: BdDistrict[] = buildTree();
