export type PartCategory =
  | "cpu"
  | "gpu"
  | "motherboard"
  | "ram"
  | "ssd"
  | "hdd"
  | "psu"
  | "case"
  | "cooler"
  | "monitor";

export type Source = "danawa";

export interface SellerPrice {
  sellerName: string;
  price: number;
  shippingCost: number;
  totalPrice: number;
  productUrl: string;
}

export interface Product {
  id: string;
  source: Source;
  name: string;
  category?: PartCategory;
  lowestPrice: number;
  prices: SellerPrice[];
  specs: Record<string, string>;
  imageUrl?: string;
  productUrl: string;
  reviewCount?: number;
}

export interface PriceHistoryEntry {
  date: string;
  minPrice: number;
  maxPrice: number;
}

export interface PriceHistory {
  productCode: string;
  period: number;
  data: PriceHistoryEntry[];
}

export const CATEGORY_LABELS: Record<PartCategory, string> = {
  cpu: "CPU",
  gpu: "그래픽카드",
  motherboard: "메인보드",
  ram: "메모리",
  ssd: "SSD",
  hdd: "HDD",
  psu: "파워서플라이",
  case: "케이스",
  cooler: "CPU 쿨러",
  monitor: "모니터",
};
