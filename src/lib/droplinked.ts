const API_BASE = "https://apiv3.droplinked.com";

export const PRODUCT_ID = process.env.NEXT_PUBLIC_DROPLINKED_PRODUCT_ID || "69a08e00b7618f1bcaeaf335";
export const SHOP_ID = process.env.NEXT_PUBLIC_DROPLINKED_SHOP_ID || "69a083eab7618f1bcaeaf330";

// ── Types ──

export interface ProductImage {
  original: string;
  thumbnail: string;
  alt: string;
}

export interface SKUAttribute {
  key: string;
  value: string;
  caption: string;
}

export interface ProductSKU {
  id: string;
  price: number;
  attributes: SKUAttribute[];
}

export interface ProductProperty {
  value: string;
  title: string;
  items: Array<{ value: string; caption: string }>;
}

export interface Product {
  id: string;
  title: string;
  description: string;
  images: ProductImage[];
  skus: ProductSKU[];
  properties: ProductProperty[];
  defaultImageIndex: number;
}

export interface CartItem {
  productId: string;
  skuId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  title: string;
  thumbnail: string;
  sku: { variantKey: string; attributes: SKUAttribute[] };
}

export interface Cart {
  id: string;
  items: CartItem[];
  financialDetails: {
    amounts: {
      productTotal: number;
      totalAmount: number;
    };
  };
  checkoutUrl: string;
}

// ── API Functions ──

export async function getProduct(productId: string = PRODUCT_ID): Promise<Product> {
  const res = await fetch(`${API_BASE}/product-v2/public/${productId}`);
  if (!res.ok) throw new Error(`Failed to fetch product: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function createCart(returnUrl?: string): Promise<Cart> {
  const res = await fetch(`${API_BASE}/v2/carts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shopId: SHOP_ID, returnUrl }),
  });
  if (!res.ok) throw new Error(`Failed to create cart: ${res.status}`);
  const json = await res.json();
  return json.data;
}

export async function addToCart(cartId: string, skuId: string, quantity: number = 1): Promise<Cart> {
  const res = await fetch(`${API_BASE}/v2/carts/${cartId}/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skuId, quantity }),
  });
  if (!res.ok) throw new Error(`Failed to add to cart: ${res.status}`);
  const json = await res.json();
  return json.data;
}

/** Find the SKU matching a set of selected attributes (e.g. { Color: "Black", Size: "M" }) */
export function findSKU(
  skus: ProductSKU[],
  selections: Record<string, string>
): ProductSKU | undefined {
  return skus.find((sku) =>
    Object.entries(selections).every(([key, caption]) =>
      sku.attributes.some((attr) => attr.key === key && attr.caption === caption)
    )
  );
}

/** Get the ordered size list for proper display */
const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
export function sortSizes(items: Array<{ value: string; caption: string }>) {
  return [...items].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.caption);
    const ib = SIZE_ORDER.indexOf(b.caption);
    if (ia === -1 && ib === -1) return a.caption.localeCompare(b.caption);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
}
