import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ScrapingError } from "../core/errors.js";
import { CATEGORY_LABELS, type PartCategory } from "../core/types.js";
import {
  getPriceHistory,
  getProductDetail,
  listByCategory,
  searchDanawa,
} from "../providers/danawa/index.js";
import { formatPrice } from "../utils/format.js";

const PART_CATEGORIES = [
  "cpu",
  "gpu",
  "motherboard",
  "ram",
  "ssd",
  "hdd",
  "psu",
  "case",
  "cooler",
  "monitor",
] as const;

function textResult(text: string) {
  return {
    content: [{ type: "text" as const, text }],
  };
}

function errorToText(error: unknown): string {
  if (error instanceof ScrapingError) {
    if (error.statusCode === 403 || error.statusCode === 429) {
      return `⚠️ 다나와 요청이 일시적으로 차단되었습니다. 잠시 후 다시 시도해주세요.\n${error.message}`;
    }

    return `❌ ${error.message}`;
  }

  return `❌ 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`;
}

export function applySearchTools(server: McpServer): void {
  server.tool(
    "search_parts",
    "다나와에서 PC 부품을 키워드로 검색합니다.",
    {
      query: z.string().describe("검색 키워드"),
      category: z.enum(PART_CATEGORIES).optional().describe("부품 카테고리"),
      limit: z.number().min(1).max(50).default(10).describe("최대 결과 수"),
    },
    async ({ query, category, limit }) => {
      try {
        const products = await searchDanawa(query, {
          category: category as PartCategory | undefined,
          limit,
        });

        if (products.length === 0) {
          return textResult(`"${query}" 검색 결과가 없습니다.`);
        }

        const lines = products.map(
          (product, index) =>
            `${index + 1}. ${product.name}\n` +
            `카테고리: ${product.category ? CATEGORY_LABELS[product.category] : "미분류"}\n` +
            `가격: ${product.lowestPrice > 0 ? formatPrice(product.lowestPrice) : "가격 미정"}\n` +
            `제품 코드: ${product.id}\n` +
            `링크: ${product.productUrl}`,
        );

        return textResult(
          `🔍 "${query}" 검색 결과 (${products.length}건)\n\n${lines.join("\n\n")}`,
        );
      } catch (error) {
        return textResult(errorToText(error));
      }
    },
  );

  server.tool(
    "list_by_category",
    "다나와 PC 견적 카테고리별 부품 목록을 조회합니다.",
    {
      category: z.enum(PART_CATEGORIES).describe("부품 카테고리"),
      sortBy: z
        .enum(["price", "popularity"])
        .default("popularity")
        .describe("정렬 기준"),
      limit: z.number().min(1).max(30).default(10).describe("최대 결과 수"),
    },
    async ({ category, sortBy, limit }) => {
      try {
        const products = await listByCategory(category as PartCategory, {
          sortBy,
          limit,
        });

        if (products.length === 0) {
          return textResult(
            `${CATEGORY_LABELS[category as PartCategory]} 카테고리에서 제품을 찾지 못했습니다.`,
          );
        }

        const sortLabel = sortBy === "price" ? "최저가순" : "인기순";
        const lines = products.map(
          (product, index) =>
            `${index + 1}. ${product.name}\n` +
            `가격: ${product.lowestPrice > 0 ? formatPrice(product.lowestPrice) : "가격 미정"}\n` +
            `제품 코드: ${product.id}\n` +
            `링크: ${product.productUrl}`,
        );

        return textResult(
          `📋 ${CATEGORY_LABELS[category as PartCategory]} ${sortLabel} (${products.length}건)\n\n${lines.join("\n\n")}`,
        );
      } catch (error) {
        return textResult(errorToText(error));
      }
    },
  );

  server.tool(
    "get_product_detail",
    "다나와 상품의 스펙과 판매처별 가격을 조회합니다.",
    {
      productCode: z.string().describe("다나와 제품 코드"),
    },
    async ({ productCode }) => {
      try {
        const detail = await getProductDetail(productCode);

        const specs = Object.entries(detail.specs)
          .map(([key, value]) => `• ${key}: ${value}`)
          .join("\n");

        const prices = detail.prices
          .sort((left, right) => left.totalPrice - right.totalPrice)
          .slice(0, 10)
          .map(
            (price) =>
              `• ${price.sellerName}: ${formatPrice(price.totalPrice)} (배송비 ${formatPrice(price.shippingCost)})`,
          )
          .join("\n");

        return textResult(
          `📦 제품 상세 (${productCode})\n\n` +
            `【스펙】\n${specs || "스펙 정보가 없습니다."}\n\n` +
            `【판매처별 가격】\n${prices || "가격 정보가 없습니다."}`,
        );
      } catch (error) {
        return textResult(errorToText(error));
      }
    },
  );

  server.tool(
    "get_price_history",
    "다나와 상품의 가격 변동 이력을 조회합니다.",
    {
      productCode: z.string().describe("다나와 제품 코드"),
      period: z
        .enum(["1", "3", "6", "12"])
        .default("3")
        .describe("조회 개월 수"),
    },
    async ({ productCode, period }) => {
      try {
        const history = await getPriceHistory(
          productCode,
          Number.parseInt(period, 10) as 1 | 3 | 6 | 12,
        );

        if (history.data.length === 0) {
          return textResult(`제품 ${productCode}의 가격 이력을 조회하지 못했습니다.`);
        }

        const lines = history.data.map(
          (entry) =>
            `${entry.date}: 최저 ${formatPrice(entry.minPrice)} / 최고 ${formatPrice(entry.maxPrice)}`,
        );

        return textResult(
          `📈 최근 ${period}개월 가격 변동\n\n${lines.join("\n")}`,
        );
      } catch (error) {
        return textResult(errorToText(error));
      }
    },
  );
}
