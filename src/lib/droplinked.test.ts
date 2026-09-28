import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addToCart,
  createCart,
  findSKU,
  getProduct,
  PRODUCT_ID,
  sortSizes,
  type ProductSKU,
} from "./droplinked";

function mockFetch(body: unknown, ok = true, status = 200) {
  const fn = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("getProduct", () => {
  it("fetches the default product and unwraps data", async () => {
    const fetchMock = mockFetch({ data: { id: "p1" } });
    await expect(getProduct()).resolves.toEqual({ id: "p1" });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://apiv3.droplinked.com/product-v2/public/${PRODUCT_ID}`,
    );
  });

  it("throws on a non-OK response", async () => {
    mockFetch({}, false, 404);
    await expect(getProduct("x")).rejects.toThrow(
      "Failed to fetch product: 404",
    );
  });
});

describe("createCart", () => {
  it("posts the shop id and return URL", async () => {
    const fetchMock = mockFetch({ data: { id: "c1" } });
    await expect(createCart("https://example.com/back")).resolves.toEqual({
      id: "c1",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://apiv3.droplinked.com/v2/carts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toMatchObject({
      returnUrl: "https://example.com/back",
    });
  });

  it("throws on a non-OK response", async () => {
    mockFetch({}, false, 500);
    await expect(createCart()).rejects.toThrow("Failed to create cart: 500");
  });
});

describe("addToCart", () => {
  it("posts the sku and default quantity", async () => {
    const fetchMock = mockFetch({ data: { id: "c1" } });
    await expect(addToCart("c1", "sku1")).resolves.toEqual({ id: "c1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://apiv3.droplinked.com/v2/carts/c1/products");
    expect(JSON.parse(init.body)).toEqual({ skuId: "sku1", quantity: 1 });
  });

  it("throws on a non-OK response", async () => {
    mockFetch({}, false, 400);
    await expect(addToCart("c1", "sku1", 2)).rejects.toThrow(
      "Failed to add to cart: 400",
    );
  });
});

describe("findSKU", () => {
  const skus: ProductSKU[] = [
    {
      id: "a",
      price: 1,
      attributes: [
        { key: "Color", value: "b", caption: "Black" },
        { key: "Size", value: "m", caption: "M" },
      ],
    },
    {
      id: "b",
      price: 1,
      attributes: [
        { key: "Color", value: "w", caption: "White" },
        { key: "Size", value: "m", caption: "M" },
      ],
    },
  ];

  it("returns the SKU matching every selection", () => {
    expect(findSKU(skus, { Color: "White", Size: "M" })?.id).toBe("b");
  });

  it("returns undefined when nothing matches", () => {
    expect(findSKU(skus, { Color: "Red" })).toBeUndefined();
  });
});

describe("sortSizes", () => {
  it("orders known sizes and puts unknown ones last, alphabetically", () => {
    const items = ["XL", "Zed", "S", "Alpha", "M"].map((caption) => ({
      value: caption,
      caption,
    }));
    expect(sortSizes(items).map((i) => i.caption)).toEqual([
      "S",
      "M",
      "XL",
      "Alpha",
      "Zed",
    ]);
  });

  it("does not mutate its input", () => {
    const items = [
      { value: "L", caption: "L" },
      { value: "S", caption: "S" },
    ];
    sortSizes(items);
    expect(items[0].caption).toBe("L");
  });
});
