import { describe, expect, it } from "vitest";
import {
  parseProductDetail,
  parseSearchResults,
} from "../src/providers/danawa/parser.js";
import { parseEstimateProductList } from "../src/providers/danawa/estimate-parser.js";

describe("danawa parser", () => {
  it("parses estimate product rows", () => {
    const html = `
      <table>
        <tr class="productList_1">
          <td class="goods_img"><img src="https://example.com/cpu.jpg" /></td>
          <td>
            <p class="subject">
              <a onclick="productInfoPopup(12345678, '', '')">AMD 라이젠 7800X3D</a>
            </p>
            <p class="low_price"><span class="prod_price">499,000</span></p>
          </td>
        </tr>
      </table>
    `;

    const products = parseEstimateProductList(html);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: "12345678",
      name: "AMD 라이젠 7800X3D",
      price: 499000,
      productUrl: "https://prod.danawa.com/info/?pcode=12345678",
    });
  });

  it("parses general search results", () => {
    const html = `
      <div class="product_list">
        <div class="prod_item" id="productItem87654321">
          <div class="thumb_image"><img src="https://example.com/gpu.jpg" /></div>
          <p class="prod_name"><a>RTX 5070 SUPER</a></p>
          <div class="price_sect">
            <div class="price_wrap"><div class="price"><em>899,000</em></div></div>
          </div>
        </div>
      </div>
    `;

    const products = parseSearchResults(html);

    expect(products).toHaveLength(1);
    expect(products[0]).toMatchObject({
      id: "87654321",
      name: "RTX 5070 SUPER",
      lowestPrice: 899000,
      productUrl: "https://prod.danawa.com/info/?pcode=87654321",
    });
  });

  it("parses product specs and seller prices", () => {
    const html = `
      <table class="spec_tbl">
        <tbody>
          <tr><th>소켓</th><td>AM5</td></tr>
          <tr><th>코어 수</th><td>8코어</td></tr>
        </tbody>
      </table>
      <ul class="spec_list">
        <li>기본 클럭: 4.2GHz</li>
      </ul>
      <table class="lowest_list">
        <tr>
          <td><a class="mall_name" href="https://seller.example.com/item">공식몰</a></td>
          <td><span class="price_sect"><em>510,000</em></span></td>
          <td><span class="ship">무료</span></td>
        </tr>
      </table>
    `;

    const detail = parseProductDetail(html);

    expect(detail.specs).toMatchObject({
      소켓: "AM5",
      "코어 수": "8코어",
      "기본 클럭": "4.2GHz",
    });
    expect(detail.prices).toHaveLength(1);
    expect(detail.prices[0]).toMatchObject({
      sellerName: "공식몰",
      price: 510000,
      shippingCost: 0,
      totalPrice: 510000,
    });
  });
});
