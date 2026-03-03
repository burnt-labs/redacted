"use client";
import Image from "next/image";
import { useState, useEffect, useCallback } from "react";
import {
  getProduct,
  createCart,
  addToCart,
  findSKU,
  sortSizes,
  type Product,
} from "@/lib/droplinked";

export default function ProductCard({ badgeId }: { badgeId: string | null }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState(0);
  const [addingToCart, setAddingToCart] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getProduct()
      .then((p) => {
        setProduct(p);
        const sizeProp = p.properties.find((pr) => pr.title === "Size");
        if (sizeProp) {
          const hasM = sizeProp.items.some((i) => i.caption === "M");
          setSelectedSize(hasM ? "M" : sizeProp.items[0]?.caption || null);
        }
      })
      .catch((e) => {
        console.error("Failed to load product:", e);
        setError("Failed to load product data.");
      })
      .finally(() => setLoadingProduct(false));
  }, []);

  const handleCheckout = useCallback(async () => {
    if (!product || !selectedSize) return;
    setAddingToCart(true);
    setError(null);

    try {
      const sku = findSKU(product.skus, { Size: selectedSize });
      if (!sku) {
        setError("Selected variant not available.");
        return;
      }

      const cart = await createCart(window.location.origin);
      const updatedCart = await addToCart(cart.id, sku.id, 1);

      // Validate checkout URL points to a trusted domain
      if (!updatedCart.checkoutUrl) {
        console.error("No checkout URL returned:", updatedCart);
        setError("Checkout unavailable. Please try again.");
        return;
      }
      const checkoutHost = new URL(updatedCart.checkoutUrl).hostname;
      if (
        checkoutHost !== "droplinked.com" &&
        !checkoutHost.endsWith(".droplinked.com") &&
        !checkoutHost.endsWith(".droplinked.io") &&
        checkoutHost !== "checkout.stripe.com"
      ) {
        console.error("Unexpected checkout domain:", checkoutHost, updatedCart.checkoutUrl);
        setError("Invalid checkout URL. Please try again.");
        return;
      }
      window.location.href = updatedCart.checkoutUrl;
    } catch (e) {
      console.error("Checkout error:", e);
      setError("Something went wrong. Please try again.");
    } finally {
      setAddingToCart(false);
    }
  }, [product, selectedSize]);

  if (loadingProduct) {
    return (
      <div className="space-y-4 w-full max-w-xs text-center">
        <div className="text-fg-muted text-sm uppercase tracking-wider">
          Loading inventory
        </div>
        <div className="loading-bar">
          <div className="loading-bar-inner" />
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-fg-muted text-sm text-center">
        {error || "Product unavailable."}
      </div>
    );
  }

  const sizeProp = product.properties.find((p) => p.title === "Size");
  const sizes = sizeProp ? sortSizes(sizeProp.items) : [];
  const selectedSku = selectedSize
    ? findSKU(product.skus, { Size: selectedSize })
    : null;
  const price = selectedSku?.price ?? product.skus[0]?.price ?? 35;

  return (
    <div className="w-full space-y-6">
      <div className="border border-border p-0 overflow-hidden">
        <div className="relative aspect-square bg-bg-paper">
          {product.images.length > 0 && (
            <Image
              src={product.images[selectedImage]?.original || product.images[0].original}
              alt={product.images[selectedImage]?.alt || product.title}
              fill
              className="object-contain"
              sizes="(max-width: 640px) 100vw, 512px"
              priority
            />
          )}
        </div>

        {product.images.length > 1 && (
          <div className="flex gap-1 p-2 overflow-x-auto bg-bg">
            {product.images.map((img, i) => (
              <button
                key={i}
                onClick={() => setSelectedImage(i)}
                className={`relative w-14 h-14 flex-shrink-0 border transition-colors ${
                  i === selectedImage
                    ? "border-fg"
                    : "border-border hover:border-border-dark"
                }`}
              >
                <Image
                  src={img.thumbnail}
                  alt={img.alt}
                  fill
                  className="object-cover"
                  sizes="56px"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-serif text-lg text-fg">
          The [Redacted] T-shirt
        </h2>
        <p className="text-fg-muted text-sm">
          Wrap yourself in comfort, knowing you aren&apos;t in the Epstein Files.
        </p>

        <div className="text-2xl font-bold text-fg">${price.toFixed(2)}</div>

        {sizes.length > 0 && (
          <div className="space-y-2">
            <div className="font-mono text-[10px] tracking-[0.15em] uppercase text-fg-light">
              Size
            </div>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => (
                <button
                  key={size.caption}
                  onClick={() => setSelectedSize(size.caption)}
                  className={`min-w-[48px] min-h-[48px] px-3 py-2 border font-mono text-sm uppercase tracking-wider transition-colors ${
                    selectedSize === size.caption
                      ? "border-fg bg-fg text-bg"
                      : "border-border text-fg-muted hover:border-border-dark hover:text-fg"
                  }`}
                >
                  {size.caption}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="text-accent text-sm">{error}</div>
        )}

        <button
          onClick={handleCheckout}
          disabled={addingToCart || !selectedSize}
          className="w-full font-mono text-[12px] font-bold tracking-[0.15em] uppercase py-4 bg-fg text-bg transition-all hover:bg-accent hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addingToCart ? "Processing..." : "Buy Now"}
        </button>

        <p className="text-xs text-fg-muted text-center">
          All proceeds go directly to supporting victims of trafficking and abuse.
        </p>

        {badgeId && (
          <p className="text-xs text-fg-muted text-center">
            Your clearance badge #{badgeId} verified.
          </p>
        )}
      </div>
    </div>
  );
}
