import * as cheerio from "cheerio";

export interface EstimateProduct {
  id: string;
  name: string;
  price: number;
  productUrl: string;
  imageUrl?: string;
}

export function parseEstimateProductList(html: string): EstimateProduct[] {
  const $ = cheerio.load(html);
  const products: EstimateProduct[] = [];
  const seenIds = new Set<string>();

  $("tr[class*='productList_']").each((_, row) => {
    const $row = $(row);
    const onclick = $row.find("p.subject a").first().attr("onclick") ?? "";
    const idMatch = onclick.match(/productInfoPopup\((\d+)/);
    if (!idMatch) {
      return;
    }

    const id = idMatch[1];
    if (!id) {
      return;
    }
    if (seenIds.has(id)) {
      return;
    }
    seenIds.add(id);

    const name = $row.find("p.subject a").first().text().trim();
    if (!name) {
      return;
    }

    const priceText = $row
      .find("p.low_price span.prod_price")
      .first()
      .text()
      .trim();
    const priceMatch = priceText.match(/[\d,]+/);
    const price = priceMatch
      ? Number.parseInt(priceMatch[0].replaceAll(",", ""), 10)
      : 0;

    const imageUrl = $row.find("td.goods_img img").attr("src") || undefined;

    products.push({
      id,
      name,
      price,
      productUrl: `https://prod.danawa.com/info/?pcode=${id}`,
      imageUrl,
    });
  });

  return products;
}
