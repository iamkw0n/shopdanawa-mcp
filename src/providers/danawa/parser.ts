import * as cheerio from "cheerio";
import type {
  PartCategory,
  Product,
  SellerPrice,
} from "../../core/types.js";

export function parseSearchResults(html: string): Product[] {
  const $ = cheerio.load(html);
  const products: Product[] = [];

  $(".product_list .prod_item, .main_prodlist .prod_item").each((_, el) => {
    const $el = $(el);

    const id =
      $el.attr("id")?.replace("productItem", "").replace("productInfoEncoder_", "") ||
      $el.find("input[name='productCodeArr']").val()?.toString() ||
      $el
        .find("a[name='productName']")
        .attr("href")
        ?.match(/pcode=(\d+)/)?.[1] ||
      "";

    if (!id) {
      return;
    }

    const name =
      $el.find(".prod_name a").text().trim() ||
      $el.find("a[name='productName']").text().trim() ||
      $el.find(".prod_info .prod_name2 a").text().trim();

    if (!name) {
      return;
    }

    const priceRaw =
      $el.find(".price_sect .price_wrap .price em").first().text().trim() ||
      $el.find(".prod_pricelist .price_sect strong").first().text().trim() ||
      $el.find(".price_info .price_wrap em").first().text().trim();
    const priceMatch = priceRaw.match(/[\d,]+/);
    const price = priceMatch
      ? Number.parseInt(priceMatch[0].replaceAll(",", ""), 10)
      : 0;

    const imageUrl =
      $el.find(".thumb_image img").attr("data-original") ||
      $el.find(".thumb_image img").attr("src") ||
      undefined;

    products.push({
      id,
      source: "danawa",
      name,
      lowestPrice: price,
      prices: [],
      specs: {},
      imageUrl,
      productUrl: `https://prod.danawa.com/info/?pcode=${id}`,
    });
  });

  return products;
}

export function parseProductDetail(
  html: string,
): { specs: Record<string, string>; prices: SellerPrice[] } {
  const $ = cheerio.load(html);
  const specs: Record<string, string> = {};
  const prices: SellerPrice[] = [];

  $(".spec_tbl tbody tr, .prod_spec table tr").each((_, row) => {
    const $row = $(row);
    const key = $row.find("th, .tit").text().trim();
    const value = $row.find("td, .dsc").text().trim();

    if (key && value) {
      specs[key] = value;
    }
  });

  $(".spec_list li, .detail_summary .summary_info .spec_list li").each(
    (_, item) => {
      const text = $(item).text().trim();
      const [key, ...valueParts] = text.split(":");
      if (key && valueParts.length > 0) {
        specs[key.trim()] = valueParts.join(":").trim();
      }
    },
  );

  $(
    ".lowest_list tr, .product_list_wrap .prod_list tr, #productListArea .prod_item",
  ).each((_, row) => {
    const $row = $(row);
    const sellerName =
      $row.find(".mall_name img, .logo_over img").attr("alt") ||
      $row.find("a.mall_name").text().trim() ||
      $row.find(".mall_name a").text().trim() ||
      $row.find(".mall_name").text().trim() ||
      $row.find(".mall_txt").text().trim();

    const priceRaw = $row.find(".price_sect em, .prc_c").first().text().trim();
    const priceMatch = priceRaw.match(/[\d,]+/);
    const price = priceMatch
      ? Number.parseInt(priceMatch[0].replaceAll(",", ""), 10)
      : 0;

    const shippingText = $row.find(".ship, .ship_fee").text().trim();
    const shippingCost = shippingText.includes("무료")
      ? 0
      : Number.parseInt(shippingText.replace(/[^0-9]/g, ""), 10) || 0;

    const productUrl =
      $row.find("a.mall_name, a.logo_over").attr("href") || "";

    if (sellerName && price > 0) {
      prices.push({
        sellerName,
        price,
        shippingCost,
        totalPrice: price + shippingCost,
        productUrl,
      });
    }
  });

  return { specs, prices };
}

export const DANAWA_CATEGORIES: Record<PartCategory, string> = {
  cpu: "112747",
  gpu: "112753",
  motherboard: "112751",
  ram: "112752",
  ssd: "112760",
  hdd: "112763",
  psu: "112777",
  case: "112775",
  cooler: "11236855",
  monitor: "112757",
};
