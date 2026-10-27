import React, { useState } from 'react';
import { ExternalLink, Package, Share2, ShoppingBag, Star, Tag, X } from 'lucide-react';
import type { Campaign, Product } from '../types/catalog';
import {
  calculateDiscountPercent,
  doesProductBelongToCampaign,
  formatINR,
  isCampaignPubliclyActive,
} from '../utils/catalogLogic';
import { ProductVisual } from './ProductVisual';

interface ProductDetailModalProps {
  product: Product | null;
  notFoundSku?: string | null;
  campaigns?: Campaign[];
  onClose: () => void;
  onSelectCampaignSlug?: (slug: string) => void;
  onBuyInBulk: (product: Product, quantity: number, campaignSlug?: string) => void;
}

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  notFoundSku,
  campaigns = [],
  onClose,
  onSelectCampaignSlug,
  onBuyInBulk,
}) => {
  const [bulkQty, setBulkQty] = useState(25);
  const [copied, setCopied] = useState(false);

  if (notFoundSku && !product) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pdp-not-found-title"
      >
        <div className="relative my-8 w-full max-w-lg rounded-2xl border border-stone-200 bg-white p-8 text-center text-stone-900 shadow-2xl space-y-4">
          <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
            Product Not Found
          </div>
          <h2 id="pdp-not-found-title" className="font-serif text-2xl font-bold text-stone-900">
            SKU &ldquo;{notFoundSku}&rdquo; is not available
          </h2>
          <p className="text-xs text-stone-600 leading-relaxed">
            The product SKU you requested could not be found or is no longer active. Explore our active campaigns or
            browse the full wholesale directory.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-lg bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
          >
            Return to Active Campaigns
          </button>
        </div>
      </div>
    );
  }

  if (!product) return null;

  const discount = calculateDiscountPercent(product.sellingPrice, product.mrp);
  const shareUrl = `${window.location.origin}/product/${product.sku}`;
  const associatedCampaigns = campaigns.filter(
    (c) => isCampaignPubliclyActive(c) && doesProductBelongToCampaign(product, c)
  );

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pdp-title"
    >
      <div className="relative my-8 w-full max-w-4xl rounded-xl border border-stone-200 bg-white text-stone-900 shadow-2xl overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close product details"
          className="absolute right-4 top-4 z-10 rounded-lg bg-white/90 p-2 text-stone-700 shadow-sm hover:bg-stone-100 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 items-stretch">
          {/* Left Gallery */}
          <div className="bg-stone-900 flex flex-col justify-between">
            <ProductVisual product={product} className="aspect-4/3 md:h-full w-full" />
          </div>

          {/* Right Contiguous Purchase Module */}
          <div className="p-6 md:p-8 flex flex-col justify-between space-y-6">
            <div className="space-y-3">
              {/* Unboxed clean metadata per Zero-Pill rule */}
              <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                <span className="font-semibold uppercase tracking-wider text-stone-700">{product.brand}</span>
                <span aria-hidden="true">·</span>
                <span>{product.category}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">SKU: {product.sku}</span>
                {product.badge && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-amber-700">{product.badge}</span>
                  </>
                )}
              </div>

              <h2 id="pdp-title" className="text-2xl font-bold tracking-tight text-stone-900">
                {product.heading || product.name}
              </h2>

              <div className="flex items-center gap-3 text-xs text-stone-600 tabular-nums">
                <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                  <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                  {product.rating.toFixed(1)}
                </span>
                <span>({product.ratingCount} verified reviews)</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-emerald-700">
                  {product.stockStatus === 'in_stock'
                    ? 'In Stock for Bulk Dispatch'
                    : product.stockStatus === 'low_stock'
                      ? 'Limited Seasonal Stock'
                      : 'Made to Order'}
                </span>
              </div>

              {/* Associated Campaign Badges */}
              {associatedCampaigns.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  <span className="inline-flex items-center gap-1 text-stone-500">
                    <Tag className="h-3.5 w-3.5 text-amber-600" />
                    Campaigns:
                  </span>
                  {associatedCampaigns.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => {
                        onClose();
                        onSelectCampaignSlug?.(c.slug);
                      }}
                      className="font-semibold text-amber-800 underline hover:text-amber-600"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Price block */}
              <div className="pt-2 flex items-baseline gap-3 tabular-nums">
                <span className="text-3xl font-bold text-stone-900">{formatINR(product.sellingPrice)}</span>
                {product.mrp > product.sellingPrice && (
                  <span className="text-sm text-stone-400 line-through">{formatINR(product.mrp)}</span>
                )}
                {discount > 0 && (
                  <span className="text-xs font-semibold text-amber-700">{discount}% Below MRP</span>
                )}
              </div>

              <p className="text-sm leading-relaxed text-stone-600 pt-2">{product.description}</p>
            </div>

            {/* Bulk Order Action Box */}
            <div className="space-y-4 pt-4 border-t border-stone-200">
              <div className="flex items-center gap-3">
                <div>
                  <label htmlFor="pdp-bulk-qty" className="block text-xs font-medium text-stone-600 mb-1">
                    Bulk Quantity
                  </label>
                  <input
                    id="pdp-bulk-qty"
                    type="number"
                    min={5}
                    max={50000}
                    value={bulkQty}
                    onChange={(e) => setBulkQty(Math.max(1, Number(e.target.value) || 25))}
                    className="w-24 rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold tabular-nums text-stone-900"
                  />
                </div>
                <div className="flex-1 pt-5">
                  <button
                    type="button"
                    onClick={() => {
                      const primaryCamp = associatedCampaigns[0]?.slug || product.campaign;
                      onClose();
                      onBuyInBulk(product, bulkQty, primaryCamp);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 transition-colors"
                  >
                    <Package className="h-4 w-4" />
                    Buy in Bulk ({formatINR(product.sellingPrice * bulkQty)} Est.)
                  </button>
                </div>
              </div>

              {/* Individual Marketplace Shopping Links */}
              <div className="space-y-2">
                <div className="text-xs font-medium text-stone-500">
                  Or buy individual units online via verified marketplaces:
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {product.amazonUrl && (
                    <a
                      href={product.amazonUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100 transition-colors"
                    >
                      <ShoppingBag className="h-3.5 w-3.5 text-amber-600" />
                      Amazon
                      <ExternalLink className="h-3 w-3 text-stone-400" />
                    </a>
                  )}
                  {product.flipkartUrl && (
                    <a
                      href={product.flipkartUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100 transition-colors"
                    >
                      Flipkart
                      <ExternalLink className="h-3 w-3 text-stone-400" />
                    </a>
                  )}
                  {product.meeshoUrl && (
                    <a
                      href={product.meeshoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100 transition-colors"
                    >
                      Meesho
                      <ExternalLink className="h-3 w-3 text-stone-400" />
                    </a>
                  )}
                  {product.websiteUrl && (
                    <a
                      href={product.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-800 hover:bg-stone-100 transition-colors"
                    >
                      Own Website
                      <ExternalLink className="h-3 w-3 text-stone-400" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {copied ? 'Product Link Copied' : 'Share Product'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
