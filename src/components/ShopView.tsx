import React, { useMemo, useState } from 'react';
import {
  ArrowRight,
  Calendar,
  Copy,
  ExternalLink,
  Flame,
  LayoutGrid,
  List,
  MessageSquare,
  Package,
  Search,
  Sparkles,
  Star,
  Tag,
} from 'lucide-react';
import type { Campaign, CatalogTheme, Product } from '../types/catalog';
import {
  calculateDiscountPercent,
  doesProductBelongToCampaign,
  formatINR,
  getCampaignScheduleState,
  isCampaignPubliclyActive,
} from '../utils/catalogLogic';
import { ProductVisual } from './ProductVisual';

export type StorefrontViewMode = 'home' | 'campaign' | 'all-products';

interface ShopViewProps {
  storefrontMode: StorefrontViewMode;
  products: Product[];
  campaigns: Campaign[];
  themes: CatalogTheme[];
  activeTheme: CatalogTheme;
  selectedCampaignSlug: string;
  globalSearchQuery?: string;
  onNavigateHome: () => void;
  onNavigateAllProducts: () => void;
  onSelectCampaignSlug: (slug: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onOpenBulkOrder: (product: Product, quantity?: number, campaignSlug?: string) => void;
  onOpenMultiBulkOrder: (campaignSlug?: string) => void;
}

export const ShopView: React.FC<ShopViewProps> = ({
  storefrontMode,
  products,
  campaigns,
  themes,
  activeTheme,
  selectedCampaignSlug,
  globalSearchQuery = '',
  onNavigateHome,
  onNavigateAllProducts,
  onSelectCampaignSlug,
  onOpenProductDetail,
  onOpenBulkOrder,
  onOpenMultiBulkOrder,
}) => {
  const [localSearch, setLocalSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'in_stock'>('all');
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating'>('featured');
  const [maxPrice, setMaxPrice] = useState<number>(10000);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);

  const effectiveSearch = (localSearch || globalSearchQuery).trim();

  // Publicly active campaigns (status === 'active' and within date range)
  const publiclyActiveCampaigns = useMemo(
    () => campaigns.filter((c) => isCampaignPubliclyActive(c)),
    [campaigns]
  );

  // Requested campaign when in 'campaign' mode
  const requestedCampaign = useMemo(
    () => campaigns.find((c) => c.slug === selectedCampaignSlug) || null,
    [campaigns, selectedCampaignSlug]
  );

  const requestedCampaignState = useMemo(
    () => (requestedCampaign ? getCampaignScheduleState(requestedCampaign) : null),
    [requestedCampaign]
  );

  // Primary hero campaign for Homepage
  const heroCampaign = useMemo(
    () => publiclyActiveCampaigns[0] || campaigns[0] || null,
    [publiclyActiveCampaigns, campaigns]
  );

  const effectiveTheme = useMemo(() => {
    const targetCamp = storefrontMode === 'campaign' ? requestedCampaign : heroCampaign;
    if (targetCamp) {
      const found = themes.find((t) => t.id === targetCamp.themeId);
      if (found) return found;
    }
    return activeTheme;
  }, [storefrontMode, requestedCampaign, heroCampaign, themes, activeTheme]);

  const activeProducts = useMemo(
    () => products.filter((p) => p.status === 'active'),
    [products]
  );

  // Helper to get active campaign objects for any product
  const getProductCampaigns = (product: Product): Campaign[] => {
    return publiclyActiveCampaigns.filter((camp) => doesProductBelongToCampaign(product, camp));
  };

  const categories = useMemo(() => {
    const set = new Set<string>(['All']);
    activeProducts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [activeProducts]);

  const filteredProducts = useMemo(() => {
    return activeProducts
      .filter((p) => {
        if (storefrontMode === 'campaign' && requestedCampaign) {
          if (!doesProductBelongToCampaign(p, requestedCampaign)) return false;
        } else if (
          storefrontMode === 'all-products' &&
          selectedCampaignSlug &&
          selectedCampaignSlug !== 'all'
        ) {
          const targetCamp = campaigns.find((c) => c.slug === selectedCampaignSlug);
          if (targetCamp) {
            if (!doesProductBelongToCampaign(p, targetCamp)) return false;
          } else if (p.campaign !== selectedCampaignSlug && !(p.campaigns || []).includes(selectedCampaignSlug)) {
            return false;
          }
        }
        if (selectedCategory !== 'All' && p.category !== selectedCategory) {
          return false;
        }
        if (availabilityFilter === 'in_stock' && p.stockStatus === 'out_of_stock') {
          return false;
        }
        if (p.sellingPrice > maxPrice) {
          return false;
        }
        if (effectiveSearch) {
          const q = effectiveSearch.toLowerCase();
          return (
            p.name.toLowerCase().includes(q) ||
            p.heading.toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.brand.toLowerCase().includes(q) ||
            p.category.toLowerCase().includes(q) ||
            p.description.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.sellingPrice - b.sellingPrice;
        if (sortBy === 'price_desc') return b.sellingPrice - a.sellingPrice;
        if (sortBy === 'rating') return b.rating - a.rating;
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return a.sortOrder - b.sortOrder;
      });
  }, [
    activeProducts,
    storefrontMode,
    requestedCampaign,
    selectedCampaignSlug,
    campaigns,
    selectedCategory,
    availabilityFilter,
    maxPrice,
    effectiveSearch,
    sortBy,
  ]);

  // Curated Homepage Sections
  const featuredProducts = useMemo(
    () => activeProducts.filter((p) => p.featured).slice(0, 3),
    [activeProducts]
  );

  const bestSellingProducts = useMemo(
    () => [...activeProducts].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 3),
    [activeProducts]
  );

  const newArrivalProducts = useMemo(
    () => [...activeProducts].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
    [activeProducts]
  );

  const specialBulkOfferProducts = useMemo(
    () =>
      [...activeProducts]
        .filter((p) => calculateDiscountPercent(p.sellingPrice, p.mrp) >= 20)
        .slice(0, 3),
    [activeProducts]
  );

  const handleCopyCampaignUrl = (slug: string) => {
    const url = `${window.location.origin}/campaigns/${slug}`;
    navigator.clipboard?.writeText(url);
    setCopiedSlug(slug);
    setTimeout(() => setCopiedSlug(null), 2200);
  };

  const radiusClass =
    effectiveTheme.borderRadius === 'none'
      ? 'rounded-none'
      : effectiveTheme.borderRadius === 'sm'
        ? 'rounded-md'
        : effectiveTheme.borderRadius === 'md'
          ? 'rounded-xl'
          : effectiveTheme.borderRadius === 'lg'
            ? 'rounded-2xl'
            : 'rounded-3xl';

  const renderProductCard = (product: Product, campaignContextSlug?: string) => {
    const discount = calculateDiscountPercent(product.sellingPrice, product.mrp);
    const productCamps = getProductCampaigns(product);
    const targetBulkCampaign =
      campaignContextSlug || productCamps[0]?.slug || product.campaign || 'diwali-2026';

    return (
      <article
        key={product.id}
        className={`group flex flex-col overflow-hidden border border-stone-200 bg-white transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md ${radiusClass}`}
      >
        {/* 4:3 Studio Product Imagery */}
        <div onClick={() => onOpenProductDetail(product)} className="cursor-pointer relative">
          <ProductVisual product={product} className="aspect-4/3 w-full" />
        </div>

        {/* Card Content */}
        <div className="flex flex-1 flex-col justify-between p-5 space-y-4">
          <div className="space-y-2">
            {/* Clean Unboxed Metadata per Zero-Pill Rule */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
              <span className="font-semibold uppercase tracking-wider text-stone-700">
                {product.brand}
              </span>
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

            <h3 className="text-base font-semibold text-stone-900 leading-snug">
              <button
                type="button"
                onClick={() => onOpenProductDetail(product)}
                className="text-left hover:text-amber-700 transition-colors"
              >
                {product.heading || product.name}
              </button>
            </h3>

            <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
              {product.description}
            </p>

            {/* Associated Campaign Links */}
            {productCamps.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[11px] text-stone-500">
                <Tag className="h-3 w-3 text-amber-600 shrink-0" />
                {productCamps.map((c, idx) => (
                  <React.Fragment key={c.slug}>
                    {idx > 0 && <span aria-hidden="true">·</span>}
                    <button
                      type="button"
                      onClick={() => onSelectCampaignSlug(c.slug)}
                      className="font-medium text-amber-800 hover:underline"
                    >
                      {c.name}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2 border-t border-stone-100">
            {/* Rating & Availability */}
            <div className="flex items-center justify-between text-xs text-stone-500 tabular-nums">
              <span className="inline-flex items-center gap-1 font-medium text-stone-700">
                <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                {product.rating.toFixed(1)} ({product.ratingCount})
              </span>
              <span
                className={`font-medium ${
                  product.stockStatus === 'out_of_stock'
                    ? 'text-red-600'
                    : product.stockStatus === 'low_stock'
                      ? 'text-amber-700'
                      : 'text-emerald-700'
                }`}
              >
                {product.stockStatus === 'in_stock'
                  ? 'In Stock'
                  : product.stockStatus === 'low_stock'
                    ? 'Low Stock'
                    : product.stockStatus === 'made_to_order'
                      ? 'Made to Order'
                      : 'Out of Stock'}
              </span>
            </div>

            {/* Tabular Price Baseline */}
            <div className="flex items-baseline justify-between gap-2 tabular-nums">
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-stone-900">
                  {formatINR(product.sellingPrice)}
                </span>
                {product.mrp > product.sellingPrice && (
                  <span className="text-xs text-stone-400 line-through">
                    {formatINR(product.mrp)}
                  </span>
                )}
              </div>
              {discount > 0 && (
                <span className="text-xs font-semibold text-amber-700">
                  {discount}% OFF
                </span>
              )}
            </div>

            {/* Marketplace Links */}
            {(product.amazonUrl || product.flipkartUrl || product.meeshoUrl || product.websiteUrl) && (
              <div className="flex flex-wrap items-center gap-2.5 text-xs text-stone-500">
                <span>Single unit:</span>
                {product.amazonUrl && (
                  <a
                    href={product.amazonUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-stone-700 underline hover:text-amber-700"
                  >
                    Amazon
                  </a>
                )}
                {product.flipkartUrl && (
                  <a
                    href={product.flipkartUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-stone-700 underline hover:text-amber-700"
                  >
                    Flipkart
                  </a>
                )}
                {product.meeshoUrl && (
                  <a
                    href={product.meeshoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-stone-700 underline hover:text-amber-700"
                  >
                    Meesho
                  </a>
                )}
                {product.websiteUrl && (
                  <a
                    href={product.websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-stone-700 underline hover:text-amber-700"
                  >
                    Website
                  </a>
                )}
              </div>
            )}

            {/* Primary CTAs: Buy in Bulk + View Details */}
            <div className="grid grid-cols-5 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onOpenBulkOrder(product, 25, targetBulkCampaign)}
                className="col-span-3 inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors whitespace-nowrap"
              >
                <Package className="h-3.5 w-3.5" />
                Buy in Bulk
              </button>
              <button
                type="button"
                onClick={() => onOpenProductDetail(product)}
                className="col-span-2 inline-flex items-center justify-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors whitespace-nowrap"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </article>
    );
  };

  // ============================================================================
  // MODE A: DEDICATED CAMPAIGN PAGE (/campaigns/:slug)
  // ============================================================================
  if (storefrontMode === 'campaign') {
    if (!requestedCampaign || requestedCampaignState !== 'active') {
      return (
        <div className="mx-auto max-w-4xl px-4 sm:px-6 py-16">
          <div className="rounded-2xl border border-stone-200 bg-white p-8 sm:p-12 text-center space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
              {requestedCampaignState === 'scheduled'
                ? 'Upcoming Scheduled Campaign'
                : requestedCampaignState === 'expired'
                  ? 'Campaign Ended'
                  : requestedCampaignState === 'inactive'
                    ? 'Campaign Currently Inactive'
                    : 'Campaign Not Found'}
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
              {requestedCampaign
                ? `${requestedCampaign.name} is currently ${requestedCampaignState}`
                : `Campaign "/campaigns/${selectedCampaignSlug}" was not found`}
            </h1>
            <p className="text-sm text-stone-600 max-w-lg mx-auto">
              {requestedCampaign
                ? `This campaign window is configured for ${requestedCampaign.startDate} to ${requestedCampaign.endDate}. Explore our currently active seasonal and bulk-shopping campaigns below.`
                : 'The campaign link you followed may have been renamed or removed. Browse all active seasonal campaigns on our storefront.'}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={onNavigateHome}
                className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
              >
                Explore Active Campaigns
              </button>
              <button
                type="button"
                onClick={onNavigateAllProducts}
                className="inline-flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-5 py-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors"
              >
                Browse All Products
              </button>
            </div>
          </div>
        </div>
      );
    }

    const campaignUrl = `${window.location.origin}/campaigns/${requestedCampaign.slug}`;

    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-stone-500">
          <button type="button" onClick={onNavigateHome} className="hover:text-stone-900 underline">
            All Campaigns
          </button>
          <span>/</span>
          <span className="font-semibold text-stone-900">{requestedCampaign.name}</span>
        </nav>

        {/* Dedicated Campaign Banner */}
        <section
          className={`relative overflow-hidden border border-stone-800 bg-stone-950 text-stone-50 p-6 sm:p-10 ${radiusClass}`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              {requestedCampaign.promotionalHeadline && (
                <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
                  {requestedCampaign.promotionalHeadline}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2 text-xs text-stone-300 tabular-nums">
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  Active Campaign: {requestedCampaign.startDate} to {requestedCampaign.endDate}
                </span>
                <span aria-hidden="true">·</span>
                <span>{filteredProducts.length} Curated SKUs</span>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                {requestedCampaign.bannerTitle || requestedCampaign.name}
              </h1>

              <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-2xl">
                {requestedCampaign.bannerSubtitle || requestedCampaign.description}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenMultiBulkOrder(requestedCampaign.slug)}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-xs font-bold text-stone-950 hover:bg-amber-400 transition-colors"
                >
                  <Package className="h-4 w-4" />
                  Request Campaign Bulk Quotation
                </button>
                <button
                  type="button"
                  onClick={() => handleCopyCampaignUrl(requestedCampaign.slug)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-700 bg-stone-900 px-4 py-3 text-xs font-semibold text-stone-200 hover:bg-stone-800 transition-colors"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copiedSlug === requestedCampaign.slug ? 'Campaign Link Copied!' : 'Share Campaign Link'}
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(
                    `Explore ${requestedCampaign.name} (${requestedCampaign.bannerTitle}) for bulk orders: ${campaignUrl}`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-800/80 bg-emerald-950/60 px-4 py-3 text-xs font-semibold text-emerald-300 hover:bg-emerald-900/60 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp Share
                </a>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
                <ProductVisual
                  product={{
                    name: requestedCampaign.name,
                    brand: 'Campaign Showcase',
                    category: requestedCampaign.slug,
                    imageUrl: requestedCampaign.bannerImageUrl || activeProducts[0]?.imageUrl || '',
                  }}
                  className="aspect-16/10 w-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Campaign Filter & Search Controls */}
        <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="search"
                aria-label={`Search within ${requestedCampaign.name}`}
                placeholder={`Search within ${requestedCampaign.name} by name, SKU, or brand...`}
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-stone-50 pl-10 pr-4 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-stone-600">
                <label htmlFor="camp-max-price" className="font-medium whitespace-nowrap">
                  Max Price: <strong className="tabular-nums text-stone-900">{formatINR(maxPrice)}</strong>
                </label>
                <input
                  id="camp-max-price"
                  type="range"
                  min={500}
                  max={10000}
                  step={250}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-28 accent-amber-600"
                />
              </div>

              <select
                aria-label="Availability filter"
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value as 'all' | 'in_stock')}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800"
              >
                <option value="all">All Availability</option>
                <option value="in_stock">In Stock Ready</option>
              </select>

              <select
                aria-label="Sort campaign products"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800"
              >
                <option value="featured">Sort: Featured First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Customer Rating</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="text-xs text-stone-500 tabular-nums">
              Showing <strong>{filteredProducts.length}</strong> campaign products
            </div>
          </div>
        </section>

        {/* Campaign Products Grid */}
        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-12 text-center space-y-3">
            <p className="text-base font-semibold text-stone-900">
              No matching products in {requestedCampaign.name}
            </p>
            <p className="text-xs text-stone-500 max-w-md mx-auto">
              Try clearing your search or category filter, or explore other active campaigns.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setLocalSearch('');
                  setSelectedCategory('All');
                  setAvailabilityFilter('all');
                  setMaxPrice(10000);
                }}
                className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
              >
                Reset Campaign Filters
              </button>
              <button
                type="button"
                onClick={onNavigateHome}
                className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
              >
                Back to All Campaigns
              </button>
            </div>
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredProducts.map((product) => renderProductCard(product, requestedCampaign.slug))}
          </section>
        )}
      </div>
    );
  }

  // ============================================================================
  // MODE B: FULL PRODUCT DIRECTORY (/shop)
  // ============================================================================
  if (storefrontMode === 'all-products') {
    return (
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6">
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
              Complete B2B &amp; Wholesale Directory
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-1">
              All Products &amp; Campaign Collections ({activeProducts.length} SKUs)
            </h1>
          </div>
          <button
            type="button"
            onClick={() => onOpenMultiBulkOrder()}
            className="inline-flex items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors shrink-0"
          >
            <Package className="h-4 w-4" />
            Multi-Product Bulk Order
          </button>
        </div>

        {/* Filter Bar */}
        <section className="rounded-xl border border-stone-200 bg-white p-4 sm:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
              <input
                type="search"
                aria-label="Search products by name, SKU, brand, or category"
                placeholder="Search by product name, SKU (e.g. KH-URLI-101), or brand..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-stone-50 pl-10 pr-4 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-stone-600">
                <label htmlFor="shop-max-price" className="font-medium whitespace-nowrap">
                  Max Price: <strong className="tabular-nums text-stone-900">{formatINR(maxPrice)}</strong>
                </label>
                <input
                  id="shop-max-price"
                  type="range"
                  min={500}
                  max={10000}
                  step={250}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-28 accent-amber-600"
                />
              </div>

              <select
                aria-label="Sort products"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-800"
              >
                <option value="featured">Sort: Featured First</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Customer Rating</option>
              </select>

              <div className="inline-flex items-center rounded-lg border border-stone-200 bg-stone-100 p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  aria-label="Grid view"
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === 'grid' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  aria-label="List view"
                  className={`rounded-md p-1.5 transition-colors ${
                    viewMode === 'list' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-500 hover:text-stone-900'
                  }`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100">
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-stone-900 text-white'
                      : 'bg-stone-100 text-stone-600 hover:bg-stone-200 hover:text-stone-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="text-xs text-stone-500 tabular-nums">
              Showing <strong>{filteredProducts.length}</strong> of <strong>{activeProducts.length}</strong> products
            </div>
          </div>
        </section>

        {filteredProducts.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-12 text-center space-y-3">
            <p className="text-base font-semibold text-stone-900">No matching products found</p>
            <button
              type="button"
              onClick={() => {
                setLocalSearch('');
                setSelectedCategory('All');
                setMaxPrice(10000);
              }}
              className="inline-flex items-center rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
            >
              Reset All Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {filteredProducts.map((product) => renderProductCard(product))}
          </section>
        ) : (
          <section className="space-y-4">
            {filteredProducts.map((product) => {
              const discount = calculateDiscountPercent(product.sellingPrice, product.mrp);
              return (
                <article
                  key={product.id}
                  className="flex flex-col sm:flex-row items-stretch overflow-hidden rounded-xl border border-stone-200 bg-white"
                >
                  <div className="sm:w-64 shrink-0">
                    <ProductVisual product={product} className="h-48 sm:h-full w-full" />
                  </div>
                  <div className="flex flex-1 flex-col justify-between p-5 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className="font-semibold uppercase text-stone-700">{product.brand}</span>
                        <span>·</span>
                        <span>{product.category}</span>
                        <span>·</span>
                        <span className="font-mono">SKU: {product.sku}</span>
                      </div>
                      <h2 className="text-lg font-bold text-stone-900">{product.heading || product.name}</h2>
                      <p className="text-xs text-stone-600 leading-relaxed max-w-3xl">{product.description}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-stone-100">
                      <div className="flex items-baseline gap-2.5 tabular-nums">
                        <span className="text-xl font-bold text-stone-900">{formatINR(product.sellingPrice)}</span>
                        {product.mrp > product.sellingPrice && (
                          <span className="text-xs text-stone-400 line-through">{formatINR(product.mrp)}</span>
                        )}
                        {discount > 0 && (
                          <span className="text-xs font-semibold text-amber-700">{discount}% OFF</span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onOpenProductDetail(product)}
                          className="rounded-lg border border-stone-300 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                        >
                          View Details
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenBulkOrder(product, 25)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                        >
                          <Package className="h-3.5 w-3.5" />
                          Buy in Bulk
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </div>
    );
  }

  // ============================================================================
  // MODE C: CAMPAIGN-BASED PUBLIC HOMEPAGE (/)
  // ============================================================================
  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-14">
      {/* If globalSearchQuery is active on homepage, show immediate search results */}
      {effectiveSearch && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-stone-900">
              Search Results for &ldquo;{effectiveSearch}&rdquo; ({filteredProducts.length} matches)
            </h2>
            {localSearch && (
              <button
                type="button"
                onClick={() => setLocalSearch('')}
                className="text-xs font-semibold text-amber-700 underline"
              >
                Clear Search
              </button>
            )}
          </div>
          {filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-500">
              No products matched your search query. Try searching by SKU (e.g. KH-URLI-101) or category.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
              {filteredProducts.map((p) => renderProductCard(p))}
            </div>
          )}
        </section>
      )}

      {/* 3. Hero Banner Highlighting the Active Campaign */}
      {heroCampaign && (
        <section
          className={`relative overflow-hidden border border-stone-800 bg-stone-950 text-stone-50 p-6 sm:p-10 lg:p-12 ${radiusClass}`}
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-7 space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-amber-400">
                <span className="font-bold uppercase tracking-widest">
                  {heroCampaign.promotionalHeadline || `Featured Campaign · ${heroCampaign.name}`}
                </span>
              </div>

              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                {heroCampaign.bannerTitle || heroCampaign.name}
              </h1>

              <p className="text-sm sm:text-base text-stone-300 max-w-2xl leading-relaxed">
                {heroCampaign.bannerSubtitle || heroCampaign.description}
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => onSelectCampaignSlug(heroCampaign.slug)}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-5 py-3 text-xs font-bold text-stone-950 hover:bg-amber-400 transition-colors"
                >
                  Explore {heroCampaign.name}
                  <ArrowRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onOpenMultiBulkOrder(heroCampaign.slug)}
                  className="inline-flex items-center gap-2 rounded-lg border border-stone-700 bg-stone-900 px-5 py-3 text-xs font-semibold text-white hover:bg-stone-800 transition-colors"
                >
                  <Package className="h-4 w-4 text-amber-400" />
                  Request Custom Bulk Quote
                </button>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div
                onClick={() => onSelectCampaignSlug(heroCampaign.slug)}
                className="cursor-pointer overflow-hidden rounded-xl border border-stone-800 bg-stone-900 group"
              >
                <ProductVisual
                  product={{
                    name: heroCampaign.name,
                    brand: 'Active Campaign',
                    category: heroCampaign.slug,
                    imageUrl: heroCampaign.bannerImageUrl || activeProducts[0]?.imageUrl || '',
                  }}
                  className="aspect-16/10 w-full transition-transform duration-300 group-hover:scale-102"
                />
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 4. Horizontal Campaign Cards / Responsive Campaign Grid */}
      {publiclyActiveCampaigns.length > 0 && (
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
                Shop by Occasion &amp; Wholesale Event
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5">
                Active Bulk Shopping Campaigns
              </h2>
            </div>
            <button
              type="button"
              onClick={onNavigateAllProducts}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-amber-700"
            >
              View All {activeProducts.length} Products <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {publiclyActiveCampaigns.map((camp) => {
              const campProducts = activeProducts.filter((p) => doesProductBelongToCampaign(p, camp));
              return (
                <div
                  key={camp.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    <div
                      onClick={() => onSelectCampaignSlug(camp.slug)}
                      className="cursor-pointer overflow-hidden border-b border-stone-100"
                    >
                      <ProductVisual
                        product={{
                          name: camp.name,
                          brand: `${campProducts.length} SKUs`,
                          category: 'Campaign',
                          imageUrl: camp.bannerImageUrl || campProducts[0]?.imageUrl || '',
                        }}
                        className="aspect-16/10 w-full"
                      />
                    </div>
                    <div className="p-5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-stone-500 tabular-nums">
                        <span className="font-semibold uppercase tracking-wider text-amber-700">
                          {campProducts.length} Products
                        </span>
                        <span>Ends {camp.endDate}</span>
                      </div>
                      <h3 className="font-serif text-lg font-bold text-stone-900 leading-snug">
                        <button
                          type="button"
                          onClick={() => onSelectCampaignSlug(camp.slug)}
                          className="text-left hover:text-amber-700 transition-colors"
                        >
                          {camp.name}
                        </button>
                      </h3>
                      <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                        {camp.description}
                      </p>
                    </div>
                  </div>

                  <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() => onSelectCampaignSlug(camp.slug)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-900 hover:text-amber-700"
                    >
                      Explore Campaign <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyCampaignUrl(camp.slug)}
                      className="text-[11px] font-medium text-stone-500 hover:text-stone-900"
                    >
                      {copiedSlug === camp.slug ? 'Link Copied' : 'Share'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 5. Featured Products */}
      {featuredProducts.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                Curated Spotlight
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5">
                Featured Campaign Products
              </h2>
            </div>
            <button
              type="button"
              onClick={onNavigateAllProducts}
              className="text-xs font-semibold text-stone-700 hover:text-amber-700"
            >
              Browse All →
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {featuredProducts.map((p) => renderProductCard(p))}
          </div>
        </section>
      )}

      {/* 6. Best-Selling or Popular Products */}
      {bestSellingProducts.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-amber-700">
                <Flame className="h-3.5 w-3.5" />
                Most Requested by Corporate &amp; Wholesale Buyers
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5">
                Best-Selling Bulk Favorites
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {bestSellingProducts.map((p) => renderProductCard(p))}
          </div>
        </section>
      )}

      {/* 7. New Arrivals */}
      {newArrivalProducts.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
                Fresh Foundry &amp; Atelier Releases
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5">
                New Season Arrivals
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {newArrivalProducts.map((p) => renderProductCard(p))}
          </div>
        </section>
      )}

      {/* 8. Special Bulk-Order Offers */}
      {specialBulkOfferProducts.length > 0 && (
        <section className="rounded-3xl border border-amber-200 bg-amber-50/50 p-6 sm:p-8 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="text-xs font-bold uppercase tracking-widest text-amber-800">
                Special Bulk-Order Tier Offers · 20%+ Below MRP
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
                High-Margin Wholesale &amp; Corporate Packs
              </h2>
              <p className="text-xs sm:text-sm text-stone-600 max-w-2xl">
                Unlock additional 8%–15% volume slab discounts on orders of 25+ units with complimentary company logo
                branding and GST input tax credit billing.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onOpenMultiBulkOrder()}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-xs font-bold text-white hover:bg-amber-600 transition-colors shrink-0"
            >
              <Package className="h-4 w-4" />
              Start Multi-SKU Bulk Order Request
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
            {specialBulkOfferProducts.map((p) => renderProductCard(p))}
          </div>
        </section>
      )}
    </div>
  );
};
