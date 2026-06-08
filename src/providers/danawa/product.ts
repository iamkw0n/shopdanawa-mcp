import { buildCacheKey, getCached, setCached } from "../../core/cache.js";
import type { SellerPrice } from "../../core/types.js";
import { fetchHtml } from "../../utils/http.js";
import { parseProductDetail } from "./parser.js";

export async function getProductDetail(
  productCode: string,
): Promise<{ specs: Record<string, string>; prices: SellerPrice[] }> {
  const cacheKey = buildCacheKey("danawa", "product", productCode);
  const cached = getCached<{ specs: Record<string, string>; prices: SellerPrice[] }>(
    cacheKey,
  );

  if (cached) {
    return cached;
  }

  const url = `https://prod.danawa.com/info/?pcode=${productCode}`;
  const html = await fetchHtml(url, "danawa");
  const result = parseProductDetail(html);

  setCached(cacheKey, result, "product");
  return result;
}
