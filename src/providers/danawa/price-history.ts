import { buildCacheKey, getCached, setCached } from "../../core/cache.js";
import type { PriceHistory, PriceHistoryEntry } from "../../core/types.js";
import { fetchJson } from "../../utils/http.js";

interface DanawaPriceHistoryResponse {
  data?: {
    priceList?: Array<{
      date: string;
      minPrice: number;
      maxPrice: number;
    }>;
  };
}

export async function getPriceHistory(
  productCode: string,
  period: 1 | 3 | 6 | 12 = 3,
): Promise<PriceHistory> {
  const cacheKey = buildCacheKey(
    "danawa",
    "price-history",
    productCode,
    String(period),
  );
  const cached = getCached<PriceHistory>(cacheKey);
  if (cached) {
    return cached;
  }

  const url = `https://prod.danawa.com/info/ajax/getProductPriceList.ajax.php?productCode=${productCode}&period=${period}`;

  try {
    const response = await fetchJson<DanawaPriceHistoryResponse>(url, "danawa", {
      headers: {
        Referer: `https://prod.danawa.com/info/?pcode=${productCode}`,
      },
    });

    const data: PriceHistoryEntry[] = (response.data?.priceList ?? []).map(
      (item) => ({
        date: item.date,
        minPrice: item.minPrice,
        maxPrice: item.maxPrice,
      }),
    );

    const result: PriceHistory = {
      productCode,
      period,
      data,
    };

    setCached(cacheKey, result, "priceHistory");
    return result;
  } catch {
    return {
      productCode,
      period,
      data: [],
    };
  }
}
