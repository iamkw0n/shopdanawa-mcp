import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearCache } from "../src/core/cache.js";
import { getPriceHistory } from "../src/providers/danawa/price-history.js";

describe("price history provider", () => {
  beforeEach(() => {
    clearCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("maps ajax response to price history entries", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            data: {
              priceList: [
                { date: "2026-06-01", minPrice: 100000, maxPrice: 110000 },
                { date: "2026-06-02", minPrice: 99000, maxPrice: 109000 },
              ],
            },
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        ),
      ),
    );

    const history = await getPriceHistory("123456", 3);

    expect(history).toMatchObject({
      productCode: "123456",
      period: 3,
    });
    expect(history.data).toEqual([
      { date: "2026-06-01", minPrice: 100000, maxPrice: 110000 },
      { date: "2026-06-02", minPrice: 99000, maxPrice: 109000 },
    ]);
  });
});
