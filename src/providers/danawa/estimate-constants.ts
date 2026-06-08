import type { PartCategory } from "../../core/types.js";

export const ESTIMATE_CATEGORY_SEQ: Record<PartCategory, number> = {
  cpu: 873,
  ram: 874,
  motherboard: 875,
  gpu: 876,
  hdd: 877,
  case: 879,
  psu: 880,
  cooler: 887,
  ssd: 32617,
  monitor: 13735,
};

export const ESTIMATE_SERVICE_SECTION_SEQ: Record<PartCategory, number> = {
  cpu: 266,
  motherboard: 267,
  ram: 268,
  gpu: 269,
  hdd: 270,
  ssd: 272,
  case: 273,
  psu: 274,
  monitor: 276,
  cooler: 280,
};

export const ESTIMATE_SEARCH_CATEGORY_SEQ = 887;
export const ESTIMATE_MARKETPLACE_SEQ = 16;
export const ESTIMATE_BASE_URL = "https://shop.danawa.com/virtualestimate/";
