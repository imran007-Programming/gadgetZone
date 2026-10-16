import { BadRequestException } from '@nestjs/common';
import {
  districts_en,
  divisions_en,
  unions_en,
  upazilas_en,
  type LocationItem,
} from 'bangladesh-location-data';

/**
 * Bangladesh district → upazila/thana → union tree, built once from the
 * `bangladesh-location-data` package. The raw titles are inconsistent
 * (lowercase, truncated "City Corporat", stray zero-width chars), so they are
 * cleaned here. The frontend runs the same cleaning (lib/bd-locations.ts), so
 * the names it sends match these exactly.
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

export function cleanLocationName(title: string): string {
  return title
    .replace(/[​-‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/Corporat$/, 'Corporation')
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

const eq = (a: string, b: string) => a.toLowerCase() === b.trim().toLowerCase();

export interface ResolvedBdLocation {
  division: string;
  district: string;
  upazila: string;
  union?: string;
}

/**
 * Checks that the upazila belongs to the district and the union (if given)
 * belongs to the upazila, returning the canonical spellings.
 */
export function resolveBdLocation(input: {
  district: string;
  upazila: string;
  union?: string;
}): ResolvedBdLocation {
  const district = BD_DISTRICTS.find((d) => eq(d.name, input.district));
  if (!district) {
    throw new BadRequestException(`Unknown district "${input.district}"`);
  }
  const upazila = district.upazilas.find((u) => eq(u.name, input.upazila));
  if (!upazila) {
    throw new BadRequestException(
      `"${input.upazila}" is not an upazila/thana of ${district.name}`,
    );
  }
  let union: string | undefined;
  if (input.union?.trim()) {
    union = upazila.unions.find((n) => eq(n, input.union!));
    if (!union) {
      throw new BadRequestException(
        `"${input.union}" is not a union/area of ${upazila.name}`,
      );
    }
  }
  return {
    division: district.division,
    district: district.name,
    upazila: upazila.name,
    union,
  };
}
