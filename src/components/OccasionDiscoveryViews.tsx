import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckSquare,
  Compass,
  Eye,
  Layers,
  MapPin,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Sparkles,
  Square,
  Users,
} from 'lucide-react';
import type {
  BulkOrderItem,
  DecorationDesign,
  DecorationPackage,
  DecorationTheme,
  DesignProductMapping,
  Occasion,
  PackageProductMapping,
  Product,
} from '../types/catalog';
import { formatINR } from '../utils/catalogLogic';
import { ProductVisual } from './ProductVisual';

export interface ResolvedDesignProduct {
  mapping: DesignProductMapping;
  product: Product;
}

export interface ResolvedPackageProduct {
  mapping: PackageProductMapping;
  product: Product;
}

interface OccasionsDirectorySectionProps {
  occasions: Occasion[];
  decorationThemes: DecorationTheme[];
  decorationDesigns: DecorationDesign[];
  packages: DecorationPackage[];
  onSelectOccasion: (slug: string) => void;
  onSelectDesign: (slug: string) => void;
}

export const OccasionsDirectorySection: React.FC<OccasionsDirectorySectionProps> = ({
  occasions,
  decorationThemes,
  decorationDesigns,
  packages,
  onSelectOccasion,
}) => {
  const activeOccasions = useMemo(
    () =>
      occasions
        .filter((o) => o.status === 'active')
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [occasions]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-10 space-y-3">
        <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
          DesiDiya Event &amp; Celebration Architecture
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
          Shop Decoration by Occasion &amp; Celebration Type
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl leading-relaxed">
          Select your upcoming event or celebration to explore curated decoration themes, full-scale stage and venue
          design inspirations, and complete bill-of-materials product kits ready for bulk quotation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {activeOccasions.map((occ) => {
          const occThemes = decorationThemes.filter(
            (t) => t.status === 'published' && (t.occasionId === occ.id || t.occasionSlug === occ.slug)
          );
          const occDesigns = decorationDesigns.filter(
            (d) => d.status === 'published' && (d.occasionId === occ.id || d.occasionSlug === occ.slug)
          );
          const occPackages = packages.filter(
            (p) => p.status === 'published' && (p.occasionId === occ.id || p.occasionSlug === occ.slug)
          );

          return (
            <article
              key={occ.id}
              onClick={() => onSelectOccasion(occ.slug)}
              className="group cursor-pointer flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <div>
                <div className="overflow-hidden border-b border-stone-100 bg-stone-900">
                  <ProductVisual
                    product={{
                      name: occ.name,
                      brand: `${occThemes.length} Themes · ${occDesigns.length} Designs`,
                      category: 'Occasion',
                      imageUrl: occ.coverImage || occ.bannerImage,
                    }}
                    className="aspect-16/10 w-full transition-transform duration-300 group-hover:scale-102"
                  />
                </div>
                <div className="p-5 space-y-2">
                  <div className="flex items-center justify-between text-xs text-stone-500 tabular-nums">
                    <span className="font-semibold uppercase tracking-wider text-amber-700">
                      {occThemes.length} Themes
                    </span>
                    <span>
                      {occDesigns.length} Designs · {occPackages.length} Kits
                    </span>
                  </div>
                  <h2 className="font-serif text-xl font-bold text-stone-900 group-hover:text-amber-700 transition-colors">
                    {occ.name}
                  </h2>
                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    {occ.description}
                  </p>
                </div>
              </div>
              <div className="px-5 pb-5 pt-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-900 group-hover:text-amber-700">
                  Explore {occ.name} Themes &amp; Designs
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};

interface OccasionDetailSectionProps {
  occasion: Occasion;
  decorationThemes: DecorationTheme[];
  decorationDesigns: DecorationDesign[];
  designProducts: DesignProductMapping[];
  packages: DecorationPackage[];
  packageProducts: PackageProductMapping[];
  products: Product[];
  onNavigateOccasions: () => void;
  onSelectTheme: (slug: string) => void;
  onSelectDesign: (slug: string) => void;
  onAddItemsToBasket: (
    items: BulkOrderItem[],
    context?: {
      occasionSlug?: string;
      occasionName?: string;
      decorationThemeSlug?: string;
      decorationThemeName?: string;
      designId?: string;
      designTitle?: string;
      packageId?: string;
      packageName?: string;
      openModalImmediately?: boolean;
    }
  ) => void;
  onOpenProductDetail: (product: Product) => void;
}

export const OccasionDetailSection: React.FC<OccasionDetailSectionProps> = ({
  occasion,
  decorationThemes,
  decorationDesigns,
  designProducts,
  packages,
  packageProducts,
  products,
  onNavigateOccasions,
  onSelectTheme,
  onSelectDesign,
  onAddItemsToBasket,
}) => {
  const [selectedThemeFilter, setSelectedThemeFilter] = useState<string>('all');
  const [selectedAreaFilter, setSelectedAreaFilter] = useState<string>('all');
  const [customizingPackage, setCustomizingPackage] = useState<DecorationPackage | null>(null);
  const [packageQtyMap, setPackageQtyMap] = useState<Record<string, number>>({});

  const occThemes = useMemo(
    () =>
      decorationThemes
        .filter(
          (t) =>
            t.status === 'published' &&
            (t.occasionId === occasion.id || t.occasionSlug === occasion.slug)
        )
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [decorationThemes, occasion]
  );

  const occDesigns = useMemo(
    () =>
      decorationDesigns.filter(
        (d) =>
          d.status === 'published' &&
          (d.occasionId === occasion.id || d.occasionSlug === occasion.slug)
      ),
    [decorationDesigns, occasion]
  );

  const filteredDesigns = useMemo(() => {
    return occDesigns.filter((d) => {
      if (selectedThemeFilter !== 'all' && d.themeSlug !== selectedThemeFilter && d.themeId !== selectedThemeFilter) {
        return false;
      }
      if (selectedAreaFilter !== 'all' && d.decorationArea !== selectedAreaFilter) {
        return false;
      }
      return true;
    });
  }, [occDesigns, selectedThemeFilter, selectedAreaFilter]);

  const occPackages = useMemo(
    () =>
      packages.filter(
        (p) =>
          p.status === 'published' &&
          (p.occasionId === occasion.id || p.occasionSlug === occasion.slug)
      ),
    [packages, occasion]
  );

  const areas = useMemo(() => {
    const s = new Set<string>();
    occDesigns.forEach((d) => {
      if (d.decorationArea) s.add(d.decorationArea);
    });
    return Array.from(s);
  }, [occDesigns]);

  const openPackageCustomizer = (pkg: DecorationPackage) => {
    const mappings = packageProducts
      .filter((m) => m.packageId === pkg.id)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const initialQtys: Record<string, number> = {};
    mappings.forEach((m) => {
      initialQtys[m.productId] = m.recommendedQuantity;
    });
    setPackageQtyMap(initialQtys);
    setCustomizingPackage(pkg);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-stone-500">
        <button type="button" onClick={onNavigateOccasions} className="hover:text-stone-900 underline">
          All Occasions
        </button>
        <span>/</span>
        <span className="font-semibold text-stone-900">{occasion.name}</span>
      </nav>

      {/* Occasion Hero Banner */}
      <section className="relative overflow-hidden rounded-2xl border border-stone-800 bg-stone-950 text-stone-50 p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
              DesiDiya Occasion Showcase · {occasion.name}
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
              {occasion.name} Decoration Themes &amp; Bulk Kits
            </h1>
            <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-2xl">
              {occasion.description}
            </p>
            <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-stone-300 tabular-nums">
              <span>
                <strong className="text-white">{occThemes.length}</strong> Curated Themes
              </span>
              <span>·</span>
              <span>
                <strong className="text-white">{occDesigns.length}</strong> Shoppable Designs
              </span>
              <span>·</span>
              <span>
                <strong className="text-white">{occPackages.length}</strong> Ready Bulk Packages
              </span>
            </div>
          </div>
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
              <ProductVisual
                product={{
                  name: occasion.name,
                  brand: 'Occasion Showcase',
                  category: occasion.slug,
                  imageUrl: occasion.bannerImage || occasion.coverImage,
                }}
                className="aspect-16/10 w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* STEP 1: DECORATION THEMES UNDER THIS OCCASION */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
              Step 1 · Select a Decoration Aesthetic
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5">
              {occasion.name} Decoration Themes
            </h2>
          </div>
          {selectedThemeFilter !== 'all' && (
            <button
              type="button"
              onClick={() => setSelectedThemeFilter('all')}
              className="text-xs font-semibold text-amber-700 underline"
            >
              Show All {occasion.name} Themes
            </button>
          )}
        </div>

        {occThemes.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-xs text-stone-500">
            No decoration themes published for {occasion.name} yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {occThemes.map((thm) => {
              const thmDesigns = occDesigns.filter(
                (d) => d.themeId === thm.id || d.themeSlug === thm.slug
              );
              const isSelected = selectedThemeFilter === thm.slug;
              return (
                <div
                  key={thm.id}
                  className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white transition-all hover:shadow-md ${
                    isSelected ? 'border-amber-600 ring-2 ring-amber-500/30' : 'border-stone-200'
                  }`}
                >
                  <div>
                    <div
                      onClick={() => onSelectTheme(thm.slug)}
                      className="cursor-pointer overflow-hidden border-b border-stone-100 bg-stone-900"
                    >
                      <ProductVisual
                        product={{
                          name: thm.title,
                          brand: thm.style,
                          category: occasion.name,
                          imageUrl: thm.coverImage,
                        }}
                        className="aspect-16/10 w-full"
                      />
                    </div>
                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-stone-500">
                        <span className="font-semibold uppercase tracking-wider text-amber-700">
                          {thm.style} Style
                        </span>
                        <span className="tabular-nums">{thmDesigns.length} Designs</span>
                      </div>
                      <h3 className="font-serif text-xl font-bold text-stone-900">
                        <button
                          type="button"
                          onClick={() => onSelectTheme(thm.slug)}
                          className="text-left hover:text-amber-700"
                        >
                          {thm.title}
                        </button>
                      </h3>
                      <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                        {thm.description}
                      </p>
                      {thm.colorPalette && thm.colorPalette.length > 0 && (
                        <div className="text-[11px] text-stone-500 pt-1">
                          Palette: <strong className="text-stone-700">{thm.colorPalette.join(' · ')}</strong>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-5 pb-5 pt-2 flex items-center justify-between gap-2 border-t border-stone-100">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedThemeFilter(isSelected ? 'all' : thm.slug)
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-amber-600 text-white'
                          : 'border border-stone-300 bg-stone-50 text-stone-800 hover:bg-stone-100'
                      }`}
                    >
                      {isSelected ? 'Filtering Designs Below' : 'Filter Designs by Theme'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectTheme(thm.slug)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-stone-900 hover:text-amber-700"
                    >
                      Open Theme <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* STEP 2: DECORATION DESIGNS GALLERY FOR THIS OCCASION */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
              Step 2 · Select a Decoration Design to See All Products Used
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5">
              {occasion.name} Decoration Designs ({filteredDesigns.length})
            </h2>
          </div>

          {areas.length > 1 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedAreaFilter('all')}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  selectedAreaFilter === 'all'
                    ? 'bg-stone-900 text-white'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                All Areas
              </button>
              {areas.map((area) => (
                <button
                  key={area}
                  type="button"
                  onClick={() => setSelectedAreaFilter(area)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    selectedAreaFilter === area
                      ? 'bg-stone-900 text-white'
                      : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                  }`}
                >
                  {area}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredDesigns.length === 0 ? (
          <div className="rounded-xl border border-stone-200 bg-white p-10 text-center space-y-3">
            <p className="text-sm font-semibold text-stone-900">
              No decoration designs match your current filter.
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedThemeFilter('all');
                setSelectedAreaFilter('all');
              }}
              className="rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white"
            >
              Show All {occasion.name} Designs
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
            {filteredDesigns.map((design) => {
              const mappings = designProducts.filter((m) => m.designId === design.id);
              const estimatedTotal = mappings.reduce((sum, m) => {
                const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                return sum + (prod ? prod.sellingPrice * m.recommendedQuantity : 0);
              }, 0);

              return (
                <article
                  key={design.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white transition-all hover:shadow-md"
                >
                  <div>
                    <div
                      onClick={() => onSelectDesign(design.slug)}
                      className="cursor-pointer overflow-hidden border-b border-stone-100 bg-stone-900"
                    >
                      <ProductVisual
                        product={{
                          name: design.title,
                          brand: design.decorationArea,
                          category: occasion.name,
                          imageUrl: design.mainImage,
                        }}
                        className="aspect-16/10 w-full transition-transform duration-300 group-hover:scale-102"
                      />
                    </div>
                    <div className="p-6 space-y-3">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                        <span className="font-semibold uppercase tracking-wider text-amber-700">
                          {design.decorationArea}
                        </span>
                        <span>·</span>
                        <span>{design.recommendedGuestCount}</span>
                        <span>·</span>
                        <span className="capitalize">{design.indoorOutdoor} Setup</span>
                      </div>

                      <h3 className="font-serif text-2xl font-bold text-stone-900">
                        <button
                          type="button"
                          onClick={() => onSelectDesign(design.slug)}
                          className="text-left hover:text-amber-700 transition-colors"
                        >
                          {design.title}
                        </button>
                      </h3>

                      <p className="text-xs text-stone-600 leading-relaxed">
                        {design.shortDescription}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-xs tabular-nums">
                        <span className="text-stone-600">
                          Products Mapped: <strong className="text-stone-900">{mappings.length} SKUs</strong>
                        </span>
                        <span className="font-semibold text-stone-900">
                          Kit Estimate: {formatINR(estimatedTotal)} ({design.estimatedBudgetRange})
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 pb-6 pt-1 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => onSelectDesign(design.slug)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Design &amp; {mappings.length} Products
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const bulkItems: BulkOrderItem[] = [];
                        mappings.forEach((m) => {
                          const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                          if (prod) {
                            bulkItems.push({
                              productId: prod.id,
                              sku: prod.sku,
                              productName: prod.name,
                              unitPrice: prod.sellingPrice,
                              mrp: prod.mrp,
                              requestedQuantity: m.recommendedQuantity,
                              quantityUnit: m.quantityUnit,
                              sourceLabel: `Design: ${design.title}`,
                            });
                          }
                        });
                        onAddItemsToBasket(bulkItems, {
                          occasionSlug: occasion.slug,
                          occasionName: occasion.name,
                          decorationThemeSlug: design.themeSlug,
                          DesignId: design.id,
                          designTitle: design.title,
                          openModalImmediately: true,
                        } as any);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors"
                    >
                      <Package className="h-3.5 w-3.5 text-amber-700" />
                      Add Full Design to Inquiry
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* STEP 3: BULK DECORATION PACKAGES FOR THIS OCCASION */}
      {occPackages.length > 0 && (
        <section className="space-y-5">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
              Step 3 · Turnkey Wholesale Kits
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5">
              Customizable {occasion.name} Bulk Packages
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Starting prices are indicative based on recommended quantities; customize any SKU count before submitting
              for your formal B2B quotation.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {occPackages.map((pkg) => {
              const pkgMappings = packageProducts.filter((m) => m.packageId === pkg.id);
              return (
                <div
                  key={pkg.id}
                  className="flex flex-col justify-between rounded-2xl border border-stone-200 bg-white overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-12">
                    <div className="sm:col-span-5 bg-stone-900">
                      <ProductVisual
                        product={{
                          name: pkg.name,
                          brand: `${pkgMappings.length} Mapped SKUs`,
                          category: 'Package',
                          imageUrl: pkg.coverImage,
                        }}
                        className="h-48 sm:h-full w-full"
                      />
                    </div>
                    <div className="sm:col-span-7 p-5 flex flex-col justify-between space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-stone-500 tabular-nums">
                          <span className="font-semibold uppercase text-amber-700">
                            {pkgMappings.length} Products Included
                          </span>
                          <span>{pkg.guestCapacity}</span>
                        </div>
                        <h3 className="font-serif text-xl font-bold text-stone-900">{pkg.name}</h3>
                        <p className="text-xs text-stone-600 leading-relaxed">{pkg.description}</p>
                      </div>

                      <div className="space-y-3 pt-2 border-t border-stone-100">
                        <div className="flex items-baseline justify-between tabular-nums">
                          <span className="text-xs text-stone-500">Indicative Starting Price:</span>
                          <span className="text-lg font-bold text-stone-900">
                            {formatINR(pkg.startingPrice)}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openPackageCustomizer(pkg)}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            Customize Quantities &amp; Inquire
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Package Customizer Modal */}
      {customizingPackage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto"
          role="dialog"
          aria-modal="true"
        >
          <div className="my-8 w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-stone-200 pb-4">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-700">
                  Customize Bulk Decoration Package
                </div>
                <h3 className="font-serif text-2xl font-bold text-stone-900">
                  {customizingPackage.name}
                </h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Adjust product quantities below to match your venue dimensions. Final quotation is customized by our B2B desk.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCustomizingPackage(null)}
                className="rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100"
              >
                Close
              </button>
            </div>

            <div className="divide-y divide-stone-200 rounded-xl border border-stone-200 bg-stone-50/60 max-h-80 overflow-y-auto">
              {packageProducts
                .filter((m) => m.packageId === customizingPackage.id)
                .map((m) => {
                  const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                  if (!prod) return null;
                  const qty = packageQtyMap[prod.id] ?? m.recommendedQuantity;
                  return (
                    <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 p-3.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-stone-900">{prod.name}</div>
                        <div className="text-[11px] text-stone-500 tabular-nums">
                          SKU: {prod.sku} · {formatINR(prod.sellingPrice)} / {m.quantityUnit}
                          {m.notes ? ` · ${m.notes}` : ''}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 tabular-nums">
                        <input
                          type="number"
                          min={0}
                          max={10000}
                          value={qty}
                          onChange={(e) =>
                            setPackageQtyMap((prev) => ({
                              ...prev,
                              [prod.id]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-20 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-bold text-stone-900"
                        />
                        <span className="text-xs text-stone-500 w-12">{m.quantityUnit}</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
              <div className="text-xs text-stone-600 tabular-nums">
                Customized Package Estimate:{' '}
                <strong className="text-base text-stone-900">
                  {formatINR(
                    packageProducts
                      .filter((m) => m.packageId === customizingPackage.id)
                      .reduce((sum, m) => {
                        const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                        const q = packageQtyMap[m.productId] ?? m.recommendedQuantity;
                        return sum + (prod ? prod.sellingPrice * q : 0);
                      }, 0)
                  )}
                </strong>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setCustomizingPackage(null)}
                  className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const items: BulkOrderItem[] = [];
                    packageProducts
                      .filter((m) => m.packageId === customizingPackage.id)
                      .forEach((m) => {
                        const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                        const q = packageQtyMap[m.productId] ?? m.recommendedQuantity;
                        if (prod && q > 0) {
                          items.push({
                            productId: prod.id,
                            sku: prod.sku,
                            productName: prod.name,
                            unitPrice: prod.sellingPrice,
                            mrp: prod.mrp,
                            requestedQuantity: q,
                            quantityUnit: m.quantityUnit,
                            sourceLabel: `Package: ${customizingPackage.name}`,
                          });
                        }
                      });
                    const pkgRef = customizingPackage;
                    setCustomizingPackage(null);
                    onAddItemsToBasket(items, {
                      occasionSlug: occasion.slug,
                      occasionName: occasion.name,
                      packageId: pkgRef.id,
                      packageName: pkgRef.name,
                      openModalImmediately: true,
                    });
                  }}
                  className="rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-700"
                >
                  Add Package to Bulk Inquiry &amp; Request Quote
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface DecorationThemeDetailSectionProps {
  theme: DecorationTheme;
  occasion: Occasion | null;
  decorationDesigns: DecorationDesign[];
  designProducts: DesignProductMapping[];
  packages: DecorationPackage[];
  products: Product[];
  onSelectOccasion: (slug: string) => void;
  onSelectDesign: (slug: string) => void;
  onAddItemsToBasket: (
    items: BulkOrderItem[],
    context?: {
      occasionSlug?: string;
      occasionName?: string;
      decorationThemeSlug?: string;
      decorationThemeName?: string;
      designId?: string;
      designTitle?: string;
      openModalImmediately?: boolean;
    }
  ) => void;
}

export const DecorationThemeDetailSection: React.FC<DecorationThemeDetailSectionProps> = ({
  theme,
  occasion,
  decorationDesigns,
  designProducts,
  products,
  onSelectOccasion,
  onSelectDesign,
  onAddItemsToBasket,
}) => {
  const themeDesigns = useMemo(
    () =>
      decorationDesigns.filter(
        (d) => d.status === 'published' && (d.themeId === theme.id || d.themeSlug === theme.slug)
      ),
    [decorationDesigns, theme]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-10">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-stone-500">
        {occasion && (
          <>
            <button
              type="button"
              onClick={() => onSelectOccasion(occasion.slug)}
              className="hover:text-stone-900 underline"
            >
              {occasion.name}
            </button>
            <span>/</span>
          </>
        )}
        <span className="font-semibold text-stone-900">{theme.title}</span>
      </nav>

      <section className="rounded-2xl border border-stone-800 bg-stone-950 text-stone-50 p-6 sm:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="text-xs font-bold uppercase tracking-widest text-amber-400">
              {occasion?.name || 'Occasion'} Theme · {theme.style} Aesthetic
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold text-white">
              {theme.title}
            </h1>
            <p className="text-sm sm:text-base text-stone-300 leading-relaxed max-w-2xl">
              {theme.description}
            </p>
            {theme.colorPalette && theme.colorPalette.length > 0 && (
              <div className="text-xs text-stone-300">
                Signature Color Palette:{' '}
                <strong className="text-amber-300">{theme.colorPalette.join(' · ')}</strong>
              </div>
            )}
          </div>
          <div className="lg:col-span-5">
            <div className="overflow-hidden rounded-xl border border-stone-800 bg-stone-900">
              <ProductVisual
                product={{
                  name: theme.title,
                  brand: theme.style,
                  category: occasion?.name || 'Theme',
                  imageUrl: theme.coverImage,
                }}
                className="aspect-16/10 w-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-5">
        <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
          Decoration Designs in {theme.title} ({themeDesigns.length})
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-7">
          {themeDesigns.map((design) => {
            const mappings = designProducts.filter((m) => m.designId === design.id);
            const estimatedTotal = mappings.reduce((sum, m) => {
              const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
              return sum + (prod ? prod.sellingPrice * m.recommendedQuantity : 0);
            }, 0);

            return (
              <article
                key={design.id}
                className="flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white hover:shadow-md transition-all"
              >
                <div>
                  <div
                    onClick={() => onSelectDesign(design.slug)}
                    className="cursor-pointer overflow-hidden border-b border-stone-100 bg-stone-900"
                  >
                    <ProductVisual
                      product={{
                        name: design.title,
                        brand: design.decorationArea,
                        category: theme.title,
                        imageUrl: design.mainImage,
                      }}
                      className="aspect-16/10 w-full"
                    />
                  </div>
                  <div className="p-6 space-y-3">
                    <div className="text-xs text-stone-500">
                      <strong className="text-amber-700 uppercase">{design.decorationArea}</strong> ·{' '}
                      {design.recommendedGuestCount} · {design.estimatedBudgetRange}
                    </div>
                    <h3 className="font-serif text-2xl font-bold text-stone-900">{design.title}</h3>
                    <p className="text-xs text-stone-600 leading-relaxed">{design.shortDescription}</p>
                    <div className="text-xs text-stone-700 tabular-nums pt-1">
                      Includes <strong>{mappings.length} Mapped Products</strong> · Kit Estimate:{' '}
                      <strong>{formatINR(estimatedTotal)}</strong>
                    </div>
                  </div>
                </div>
                <div className="px-6 pb-6 pt-2 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => onSelectDesign(design.slug)}
                    className="flex-1 rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                  >
                    Inspect Design &amp; Select Products
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const items: BulkOrderItem[] = [];
                      mappings.forEach((m) => {
                        const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                        if (prod) {
                          items.push({
                            productId: prod.id,
                            sku: prod.sku,
                            productName: prod.name,
                            unitPrice: prod.sellingPrice,
                            mrp: prod.mrp,
                            requestedQuantity: m.recommendedQuantity,
                            quantityUnit: m.quantityUnit,
                            sourceLabel: `Design: ${design.title}`,
                          });
                        }
                      });
                      onAddItemsToBasket(items, {
                        occasionSlug: occasion?.slug || design.occasionSlug,
                        occasionName: occasion?.name || design.occasionSlug,
                        decorationThemeSlug: theme.slug,
                        decorationThemeName: theme.title,
                        designId: design.id,
                        designTitle: design.title,
                        openModalImmediately: true,
                      });
                    }}
                    className="rounded-lg border border-stone-300 bg-white px-4 py-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                  >
                    Inquire Full Design
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
};

interface DecorationDesignDetailSectionProps {
  design: DecorationDesign;
  occasion: Occasion | null;
  theme: DecorationTheme | null;
  allDesigns: DecorationDesign[];
  designProducts: DesignProductMapping[];
  products: Product[];
  onSelectOccasion: (slug: string) => void;
  onSelectTheme: (slug: string) => void;
  onSelectDesign: (slug: string) => void;
  onOpenProductDetail: (product: Product) => void;
  onAddItemsToBasket: (
    items: BulkOrderItem[],
    context?: {
      occasionSlug?: string;
      occasionName?: string;
      decorationThemeSlug?: string;
      decorationThemeName?: string;
      designId?: string;
      designTitle?: string;
      openModalImmediately?: boolean;
    }
  ) => void;
}

export const DecorationDesignDetailSection: React.FC<DecorationDesignDetailSectionProps> = ({
  design,
  occasion,
  theme,
  allDesigns,
  designProducts,
  products,
  onSelectOccasion,
  onSelectTheme,
  onSelectDesign,
  onOpenProductDetail,
  onAddItemsToBasket,
}) => {
  const gallery = useMemo(() => {
    const imgs = [design.mainImage, ...(design.galleryImages || [])].filter(Boolean);
    return Array.from(new Set(imgs));
  }, [design]);

  const [activeImage, setActiveImage] = useState<string>(gallery[0] || '');

  React.useEffect(() => {
    setActiveImage(gallery[0] || '');
  }, [gallery]);

  // Resolve mapped products without duplicating product records
  const resolvedProducts = useMemo<ResolvedDesignProduct[]>(() => {
    return designProducts
      .filter((m) => m.designId === design.id)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((mapping) => {
        const product = products.find((p) => p.id === mapping.productId || p.sku === mapping.sku);
        return product ? { mapping, product } : null;
      })
      .filter((item): item is ResolvedDesignProduct => item !== null);
  }, [designProducts, design.id, products]);

  // Interactive product selection & quantity customization state
  const [selectedProductIds, setSelectedProductIds] = useState<Record<string, boolean>>({});
  const [customQuantities, setCustomQuantities] = useState<Record<string, number>>({});

  React.useEffect(() => {
    const sel: Record<string, boolean> = {};
    const qtys: Record<string, number> = {};
    resolvedProducts.forEach(({ mapping, product }) => {
      sel[product.id] = true;
      qtys[product.id] = mapping.recommendedQuantity;
    });
    setSelectedProductIds(sel);
    setCustomQuantities(qtys);
  }, [resolvedProducts]);

  const selectedCount = useMemo(
    () => resolvedProducts.filter(({ product }) => selectedProductIds[product.id]).length,
    [resolvedProducts, selectedProductIds]
  );

  const selectedSubtotal = useMemo(
    () =>
      resolvedProducts.reduce((sum, { mapping, product }) => {
        if (!selectedProductIds[product.id]) return sum;
        const qty = customQuantities[product.id] ?? mapping.recommendedQuantity;
        return sum + product.sellingPrice * qty;
      }, 0),
    [resolvedProducts, selectedProductIds, customQuantities]
  );

  const buildSelectedBulkItems = (): BulkOrderItem[] => {
    const items: BulkOrderItem[] = [];
    resolvedProducts.forEach(({ mapping, product }) => {
      if (!selectedProductIds[product.id]) return;
      const qty = Math.max(1, customQuantities[product.id] ?? mapping.recommendedQuantity);
      items.push({
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        unitPrice: product.sellingPrice,
        mrp: product.mrp,
        requestedQuantity: qty,
        quantityUnit: mapping.quantityUnit,
        sourceLabel: `Design: ${design.title}`,
      });
    });
    return items;
  };

  const relatedDesigns = useMemo(
    () =>
      allDesigns
        .filter(
          (d) =>
            d.id !== design.id &&
            d.status === 'published' &&
            (d.occasionSlug === design.occasionSlug || d.themeSlug === design.themeSlug)
        )
        .slice(0, 3),
    [allDesigns, design]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
        {occasion && (
          <>
            <button
              type="button"
              onClick={() => onSelectOccasion(occasion.slug)}
              className="hover:text-stone-900 underline"
            >
              {occasion.name}
            </button>
            <span>/</span>
          </>
        )}
        {theme && (
          <>
            <button
              type="button"
              onClick={() => onSelectTheme(theme.slug)}
              className="hover:text-stone-900 underline"
            >
              {theme.title}
            </button>
            <span>/</span>
          </>
        )}
        <span className="font-semibold text-stone-900">{design.title}</span>
      </nav>

      {/* Top Split: Left Image Gallery (7 cols) + Right Design Specs & Quick Summary (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-7 space-y-3">
          <div className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-950">
            <ProductVisual
              product={{
                name: design.title,
                brand: design.decorationArea,
                category: occasion?.name || 'Decoration Design',
                imageUrl: activeImage || design.mainImage,
              }}
              className="aspect-16/10 w-full"
            />
          </div>
          {gallery.length > 1 && (
            <div className="flex items-center gap-3 overflow-x-auto pb-1">
              {gallery.map((img, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveImage(img)}
                  className={`w-28 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                    activeImage === img ? 'border-amber-600' : 'border-stone-200 opacity-75 hover:opacity-100'
                  }`}
                >
                  <ProductVisual
                    product={{
                      name: `${design.title} View ${idx + 1}`,
                      brand: design.decorationArea,
                      category: 'Gallery',
                      imageUrl: img,
                    }}
                    className="aspect-16/10 w-full"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-5 rounded-2xl border border-stone-200 bg-white p-6 space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
              <span className="font-bold uppercase tracking-wider text-amber-700">
                {occasion?.name || design.occasionSlug}
              </span>
              {theme && (
                <>
                  <span>·</span>
                  <span className="font-semibold text-stone-700">{theme.title}</span>
                </>
              )}
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900">
              {design.title}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 leading-relaxed">
              {design.fullDescription || design.shortDescription}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-xl border border-stone-100 bg-stone-50 p-4 text-xs">
            <div>
              <div className="text-stone-400">Decoration Area</div>
              <div className="font-bold text-stone-900 mt-0.5">{design.decorationArea}</div>
            </div>
            <div>
              <div className="text-stone-400">Guest Suitability</div>
              <div className="font-bold text-stone-900 mt-0.5">{design.recommendedGuestCount}</div>
            </div>
            <div>
              <div className="text-stone-400">Venue Setting</div>
              <div className="font-bold text-stone-900 capitalize mt-0.5">{design.indoorOutdoor}</div>
            </div>
            <div>
              <div className="text-stone-400">Estimated Kit Range</div>
              <div className="font-bold text-amber-700 tabular-nums mt-0.5">
                {design.estimatedBudgetRange}
              </div>
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-stone-100">
            <div className="flex items-baseline justify-between tabular-nums">
              <span className="text-xs text-stone-600">
                Selected Design Products ({selectedCount} of {resolvedProducts.length} SKUs):
              </span>
              <span className="text-xl font-bold text-stone-900">{formatINR(selectedSubtotal)}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => {
                  const items = buildSelectedBulkItems();
                  onAddItemsToBasket(items, {
                    occasionSlug: occasion?.slug || design.occasionSlug,
                    occasionName: occasion?.name || design.occasionSlug,
                    decorationThemeSlug: theme?.slug || design.themeSlug,
                    decorationThemeName: theme?.title || design.themeSlug,
                    designId: design.id,
                    designTitle: design.title,
                    openModalImmediately: false,
                  });
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-stone-300 bg-white px-4 py-3 text-xs font-bold text-stone-900 hover:bg-stone-50 disabled:opacity-40 transition-colors"
              >
                <ShoppingBag className="h-4 w-4 text-amber-700" />
                Add Selected to Inquiry Basket
              </button>

              <button
                type="button"
                disabled={selectedCount === 0}
                onClick={() => {
                  const items = buildSelectedBulkItems();
                  onAddItemsToBasket(items, {
                    occasionSlug: occasion?.slug || design.occasionSlug,
                    occasionName: occasion?.name || design.occasionSlug,
                    decorationThemeSlug: theme?.slug || design.themeSlug,
                    decorationThemeName: theme?.title || design.themeSlug,
                    designId: design.id,
                    designTitle: design.title,
                    openModalImmediately: true,
                  });
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 px-4 py-3 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40 transition-colors"
              >
                <Package className="h-4 w-4" />
                Request Bulk Quote Now
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CORE FEATURE: PRODUCTS USED IN THIS DECORATION DESIGN */}
      <section className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
              Shoppable Bill of Materials
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl font-bold text-stone-900 mt-0.5">
              Products Used in This Decoration Design ({resolvedProducts.length} SKUs)
            </h2>
            <p className="text-xs text-stone-500 mt-1">
              Select or deselect individual products and customize quantities to match your event scale.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => {
                const allSelected = selectedCount === resolvedProducts.length;
                const next: Record<string, boolean> = {};
                resolvedProducts.forEach(({ product }) => {
                  next[product.id] = !allSelected;
                });
                setSelectedProductIds(next);
              }}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100"
            >
              {selectedCount === resolvedProducts.length ? 'Deselect All' : 'Select All Products'}
            </button>
            <button
              type="button"
              onClick={() => {
                const resetQtys: Record<string, number> = {};
                resolvedProducts.forEach(({ mapping, product }) => {
                  resetQtys[product.id] = mapping.recommendedQuantity;
                });
                setCustomQuantities(resetQtys);
              }}
              className="rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-50"
            >
              Reset Recommended Quantities
            </button>
          </div>
        </div>

        <div className="divide-y divide-stone-200">
          {resolvedProducts.map(({ mapping, product }) => {
            const isChecked = Boolean(selectedProductIds[product.id]);
            const qty = customQuantities[product.id] ?? mapping.recommendedQuantity;
            const lineTotal = product.sellingPrice * qty;

            return (
              <div
                key={mapping.id}
                className={`py-5 flex flex-col lg:flex-row lg:items-center justify-between gap-5 transition-opacity ${
                  isChecked ? 'opacity-100' : 'opacity-60'
                }`}
              >
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedProductIds((prev) => ({
                        ...prev,
                        [product.id]: !prev[product.id],
                      }))
                    }
                    aria-label={`Toggle ${product.name}`}
                    className="mt-1 text-stone-800 hover:text-amber-600 shrink-0"
                  >
                    {isChecked ? (
                      <CheckSquare className="h-5 w-5 text-amber-600" />
                    ) : (
                      <Square className="h-5 w-5 text-stone-400" />
                    )}
                  </button>

                  <div
                    onClick={() => onOpenProductDetail(product)}
                    className="w-24 sm:w-28 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
                  >
                    <ProductVisual product={product} className="aspect-4/3 w-full" />
                  </div>

                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500">
                      <span className="font-mono font-semibold text-stone-700">SKU: {product.sku}</span>
                      <span>·</span>
                      <span>{product.category}</span>
                      <span>·</span>
                      <span
                        className={`font-semibold ${
                          mapping.isRequired ? 'text-amber-700' : 'text-stone-500'
                        }`}
                      >
                        {mapping.isRequired ? 'Core Design Element' : 'Optional Accent'}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-stone-900">
                      <button
                        type="button"
                        onClick={() => onOpenProductDetail(product)}
                        className="text-left hover:text-amber-700 transition-colors"
                      >
                        {product.name}
                      </button>
                    </h3>

                    {mapping.notes && (
                      <p className="text-xs text-stone-600">
                        <strong>Placement in Design:</strong> {mapping.notes}
                      </p>
                    )}

                    <div className="text-xs text-stone-500 tabular-nums">
                      Recommended Quantity:{' '}
                      <strong className="text-stone-800">
                        {mapping.recommendedQuantity} {mapping.quantityUnit}
                      </strong>{' '}
                      · Unit Price: <strong className="text-stone-900">{formatINR(product.sellingPrice)}</strong>
                    </div>
                  </div>
                </div>

                {/* Quantity Stepper & Line Action */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-4 pl-9 lg:pl-0 shrink-0 tabular-nums">
                  <div className="flex items-center gap-2">
                    <label htmlFor={`design-qty-${product.id}`} className="text-xs font-medium text-stone-600">
                      Qty ({mapping.quantityUnit}):
                    </label>
                    <input
                      id={`design-qty-${product.id}`}
                      type="number"
                      min={1}
                      max={100000}
                      value={qty}
                      onChange={(e) => {
                        const val = Math.max(1, Number(e.target.value) || 1);
                        setCustomQuantities((prev) => ({ ...prev, [product.id]: val }));
                        if (!isChecked) {
                          setSelectedProductIds((prev) => ({ ...prev, [product.id]: true }));
                        }
                      }}
                      className="w-20 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-bold text-stone-900"
                    />
                  </div>

                  <div className="text-right min-w-[100px]">
                    <div className="text-sm font-bold text-stone-900">{formatINR(lineTotal)}</div>
                    <div className="text-[11px] text-stone-400">
                      {qty} × {formatINR(product.sellingPrice)}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      onAddItemsToBasket(
                        [
                          {
                            productId: product.id,
                            sku: product.sku,
                            productName: product.name,
                            unitPrice: product.sellingPrice,
                            mrp: product.mrp,
                            requestedQuantity: qty,
                            quantityUnit: mapping.quantityUnit,
                            sourceLabel: `Design: ${design.title}`,
                          },
                        ],
                        {
                          occasionSlug: occasion?.slug || design.occasionSlug,
                          occasionName: occasion?.name || design.occasionSlug,
                          decorationThemeSlug: theme?.slug || design.themeSlug,
                          decorationThemeName: theme?.title || design.themeSlug,
                          designId: design.id,
                          designTitle: design.title,
                          openModalImmediately: false,
                        }
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-900 hover:text-white transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Item
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom Sticky Summary Bar inside Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50/70 p-5">
          <div className="space-y-0.5 tabular-nums">
            <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
              Complete Design Selection Summary
            </div>
            <div className="text-sm text-stone-800">
              <strong>{selectedCount}</strong> of {resolvedProducts.length} products selected · Estimated Total:{' '}
              <strong className="text-lg text-stone-950">{formatINR(selectedSubtotal)}</strong>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                const items = buildSelectedBulkItems();
                onAddItemsToBasket(items, {
                  occasionSlug: occasion?.slug || design.occasionSlug,
                  occasionName: occasion?.name || design.occasionSlug,
                  decorationThemeSlug: theme?.slug || design.themeSlug,
                  decorationThemeName: theme?.title || design.themeSlug,
                  designId: design.id,
                  designTitle: design.title,
                  openModalImmediately: false,
                });
              }}
              className="rounded-lg border border-stone-800 bg-white px-4 py-2.5 text-xs font-bold text-stone-900 hover:bg-stone-100 disabled:opacity-40"
            >
              Add All {selectedCount} Products to Inquiry Basket
            </button>
            <button
              type="button"
              disabled={selectedCount === 0}
              onClick={() => {
                const items = buildSelectedBulkItems();
                onAddItemsToBasket(items, {
                  occasionSlug: occasion?.slug || design.occasionSlug,
                  occasionName: occasion?.name || design.occasionSlug,
                  decorationThemeSlug: theme?.slug || design.themeSlug,
                  decorationThemeName: theme?.title || design.themeSlug,
                  designId: design.id,
                  designTitle: design.title,
                  openModalImmediately: true,
                });
              }}
              className="rounded-lg bg-stone-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
            >
              Submit Design Requirement for Quotation
            </button>
          </div>
        </div>
      </section>

      {/* Related Decoration Designs */}
      {relatedDesigns.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-serif text-2xl font-bold text-stone-900">
            Related Decoration Designs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {relatedDesigns.map((rel) => (
              <div
                key={rel.id}
                onClick={() => onSelectDesign(rel.slug)}
                className="cursor-pointer group rounded-2xl border border-stone-200 bg-white overflow-hidden hover:shadow-md transition-all"
              >
                <div className="bg-stone-900">
                  <ProductVisual
                    product={{
                      name: rel.title,
                      brand: rel.decorationArea,
                      category: rel.occasionSlug,
                      imageUrl: rel.mainImage,
                    }}
                    className="aspect-16/10 w-full"
                  />
                </div>
                <div className="p-4 space-y-1.5">
                  <div className="text-xs font-semibold text-amber-700">{rel.decorationArea}</div>
                  <h3 className="font-serif text-lg font-bold text-stone-900 group-hover:text-amber-700">
                    {rel.title}
                  </h3>
                  <p className="text-xs text-stone-500 line-clamp-2">{rel.shortDescription}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

interface DecorationIdeasGallerySectionProps {
  occasions: Occasion[];
  decorationThemes: DecorationTheme[];
  decorationDesigns: DecorationDesign[];
  designProducts: DesignProductMapping[];
  products: Product[];
  onSelectDesign: (slug: string) => void;
  onAddItemsToBasket: (
    items: BulkOrderItem[],
    context?: {
      occasionSlug?: string;
      occasionName?: string;
      decorationThemeSlug?: string;
      decorationThemeName?: string;
      designId?: string;
      designTitle?: string;
      openModalImmediately?: boolean;
    }
  ) => void;
}

export const DecorationIdeasGallerySection: React.FC<DecorationIdeasGallerySectionProps> = ({
  occasions,
  decorationThemes,
  decorationDesigns,
  designProducts,
  products,
  onSelectDesign,
  onAddItemsToBasket,
}) => {
  const [occFilter, setOccFilter] = useState<string>('all');
  const [areaFilter, setAreaFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const publishedDesigns = useMemo(
    () => decorationDesigns.filter((d) => d.status === 'published'),
    [decorationDesigns]
  );

  const filtered = useMemo(() => {
    return publishedDesigns.filter((d) => {
      if (occFilter !== 'all' && d.occasionSlug !== occFilter) return false;
      if (areaFilter !== 'all' && d.decorationArea !== areaFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          d.title.toLowerCase().includes(q) ||
          d.shortDescription.toLowerCase().includes(q) ||
          d.decorationArea.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [publishedDesigns, occFilter, areaFilter, searchQuery]);

  const areas = useMemo(
    () => Array.from(new Set(publishedDesigns.map((d) => d.decorationArea))),
    [publishedDesigns]
  );

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 sm:p-8 space-y-3">
        <div className="text-xs font-bold uppercase tracking-widest text-amber-700">
          Shoppable Event Inspiration Gallery
        </div>
        <h1 className="font-serif text-3xl sm:text-4xl font-bold text-stone-900">
          Decoration Ideas &amp; Venue Setups ({publishedDesigns.length} Designs)
        </h1>
        <p className="text-sm text-stone-600 max-w-3xl">
          Browse real stage mandaps, floral archways, corporate gala setups, and festive courtyards. Click any design
          to inspect the exact products and quantities used.
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3">
          <div className="relative flex-1 max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
            <input
              type="search"
              placeholder="Search decoration designs by stage, mandap, archway, diwali..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-stone-50 pl-9 pr-3 py-2 text-xs text-stone-900"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Filter by Occasion"
              value={occFilter}
              onChange={(e) => setOccFilter(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
            >
              <option value="all">All Occasions</option>
              {occasions
                .filter((o) => o.status === 'active')
                .map((o) => (
                  <option key={o.id} value={o.slug}>
                    {o.name}
                  </option>
                ))}
            </select>
            <select
              aria-label="Filter by Decoration Area"
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-800"
            >
              <option value="all">All Venue Areas</option>
              {areas.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-7">
        {filtered.map((design) => {
          const mappings = designProducts.filter((m) => m.designId === design.id);
          const occ = occasions.find((o) => o.slug === design.occasionSlug || o.id === design.occasionId);
          const thm = decorationThemes.find((t) => t.slug === design.themeSlug || t.id === design.themeId);

          return (
            <article
              key={design.id}
              className="flex flex-col justify-between overflow-hidden rounded-2xl border border-stone-200 bg-white hover:shadow-md transition-all"
            >
              <div>
                <div
                  onClick={() => onSelectDesign(design.slug)}
                  className="cursor-pointer overflow-hidden border-b border-stone-100 bg-stone-900"
                >
                  <ProductVisual
                    product={{
                      name: design.title,
                      brand: design.decorationArea,
                      category: occ?.name || 'Decoration',
                      imageUrl: design.mainImage,
                    }}
                    className="aspect-16/10 w-full"
                  />
                </div>
                <div className="p-5 space-y-2.5">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
                    <span className="font-bold uppercase text-amber-700">{occ?.name || design.occasionSlug}</span>
                    {thm && (
                      <>
                        <span>·</span>
                        <span>{thm.title}</span>
                      </>
                    )}
                  </div>
                  <h2 className="font-serif text-xl font-bold text-stone-900">
                    <button
                      type="button"
                      onClick={() => onSelectDesign(design.slug)}
                      className="text-left hover:text-amber-700"
                    >
                      {design.title}
                    </button>
                  </h2>
                  <p className="text-xs text-stone-600 line-clamp-2 leading-relaxed">
                    {design.shortDescription}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-stone-100 text-xs text-stone-500 tabular-nums">
                    <span>
                      <strong className="text-stone-900">{mappings.length}</strong> Products Used
                    </span>
                    <span className="font-semibold text-stone-800">{design.estimatedBudgetRange}</span>
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 pt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => onSelectDesign(design.slug)}
                  className="flex-1 rounded-lg bg-stone-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                >
                  Explore Design &amp; Products
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const items: BulkOrderItem[] = [];
                    mappings.forEach((m) => {
                      const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                      if (prod) {
                        items.push({
                          productId: prod.id,
                          sku: prod.sku,
                          productName: prod.name,
                          unitPrice: prod.sellingPrice,
                          mrp: prod.mrp,
                          requestedQuantity: m.recommendedQuantity,
                          quantityUnit: m.quantityUnit,
                          sourceLabel: `Design: ${design.title}`,
                        });
                      }
                    });
                    onAddItemsToBasket(items, {
                      occasionSlug: design.occasionSlug,
                      occasionName: occ?.name || design.occasionSlug,
                      decorationThemeSlug: design.themeSlug,
                      decorationThemeName: thm?.title || design.themeSlug,
                      designId: design.id,
                      designTitle: design.title,
                      openModalImmediately: true,
                    });
                  }}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                >
                  Quick Quote
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
