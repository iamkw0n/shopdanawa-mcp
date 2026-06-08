import { buildCacheKey, getCached, setCached } from "../../core/cache.js";
import type { PartCategory, Product } from "../../core/types.js";
import { fetchHtml } from "../../utils/http.js";
import { fetchProductListHtml } from "./estimate-api.js";
import {
  ESTIMATE_CATEGORY_SEQ,
  ESTIMATE_SEARCH_CATEGORY_SEQ,
  ESTIMATE_SERVICE_SECTION_SEQ,
} from "./estimate-constants.js";
import { parseEstimateProductList } from "./estimate-parser.js";
import { DANAWA_CATEGORIES, parseSearchResults } from "./parser.js";

export async function searchDanawa(
  query: string,
  options?: { category?: PartCategory; limit?: number },
): Promise<Product[]> {
  const cacheKey = buildCacheKey(
    "danawa",
    "search",
    query,
    options?.category,
    String(options?.limit ?? 20),
  );
  const cached = getCached<Product[]>(cacheKey);
  if (cached) {
    return cached;
  }

  const limit = options?.limit ?? 20;

  if (options?.category) {
    const collected: Product[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; collected.length < limit; page += 1) {
      const html = await fetchProductListHtml(
        ESTIMATE_SEARCH_CATEGORY_SEQ,
        page,
        query,
        ESTIMATE_SERVICE_SECTION_SEQ[options.category],
      );
      const items = parseEstimateProductList(html);

      if (items.length === 0) {
        break;
      }

      let newItems = 0;
      for (const item of items) {
        if (seenIds.has(item.id)) {
          continue;
        }

        newItems += 1;
        seenIds.add(item.id);
        collected.push({
          id: item.id,
          source: "danawa",
          name: item.name,
          category: options.category,
          lowestPrice: item.price,
          prices: [],
          specs: {},
          imageUrl: item.imageUrl,
          productUrl: item.productUrl,
        });

        if (collected.length >= limit) {
          break;
        }
      }

      if (newItems === 0) {
        break;
      }
    }

    if (collected.length > 0) {
      setCached(cacheKey, collected, "search");
      return collected;
    }
  }

  const url = `https://search.danawa.com/dsearch.php?query=${encodeURIComponent(query)}&tab=goods`;
  const html = await fetchHtml(url, "danawa");
  let products = parseSearchResults(html);

  if (options?.category) {
    products = products.map((product) => ({
      ...product,
      category: options.category,
    }));
  }

  products = products.slice(0, limit);
  setCached(cacheKey, products, "search");
  return products;
}

export async function listByCategory(
  category: PartCategory,
  options?: { sortBy?: "price" | "popularity"; limit?: number },
): Promise<Product[]> {
  const sortBy = options?.sortBy ?? "popularity";
  const limit = options?.limit ?? 20;
  const cacheKey = buildCacheKey(
    "danawa",
    "category",
    category,
    sortBy,
    String(limit),
  );
  const cached = getCached<Product[]>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const collected: Product[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; collected.length < limit && page <= 5; page += 1) {
      const html = await fetchProductListHtml(ESTIMATE_CATEGORY_SEQ[category], page);
      const items = parseEstimateProductList(html);

      if (items.length === 0) {
        break;
      }

      let newItems = 0;
      for (const item of items) {
        if (seenIds.has(item.id)) {
          continue;
        }

        newItems += 1;
        seenIds.add(item.id);
        collected.push({
          id: item.id,
          source: "danawa",
          name: item.name,
          category,
          lowestPrice: item.price,
          prices: [],
          specs: {},
          imageUrl: item.imageUrl,
          productUrl: item.productUrl,
        });

        if (collected.length >= limit) {
          break;
        }
      }

      if (newItems === 0) {
        break;
      }
    }

    if (collected.length > 0) {
      setCached(cacheKey, collected, "category");
      return collected;
    }
  } catch {
    // estimate API가 비어 있거나 구조가 달라질 때 일반 목록으로 폴백한다.
  }

  const sortParam = sortBy === "price" ? "lowprice" : "bestsell";
  const url = `https://prod.danawa.com/list/?cate=${DANAWA_CATEGORIES[category]}&sort=${sortParam}`;
  const html = await fetchHtml(url, "danawa");
  const products = parseSearchResults(html)
    .map((product) => ({ ...product, category }))
    .slice(0, limit);

  setCached(cacheKey, products, "category");
  return products;
}
