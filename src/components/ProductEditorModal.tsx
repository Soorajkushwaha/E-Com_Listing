import React, { useState } from 'react';
import { Copy, Trash2, Upload, X } from 'lucide-react';
import type { Campaign, Product, ProductStatus, StockStatus } from '../types/catalog';
import { calculateDiscountPercent, formatINR } from '../utils/catalogLogic';
import { uploadPersistentProductImage } from '../lib/firebase';
import { ProductVisual } from './ProductVisual';

interface ProductEditorModalProps {
  isOpen: boolean;
  productToEdit: Product | null;
  campaigns: Campaign[];
  onClose: () => void;
  onSaveProduct: (product: Partial<Product>) => Promise<void>;
  onDeleteProduct?: (productId: string) => Promise<void>;
}

export const ProductEditorModal: React.FC<ProductEditorModalProps> = ({
  isOpen,
  productToEdit,
  campaigns,
  onClose,
  onSaveProduct,
  onDeleteProduct,
}) => {
  const [sku, setSku] = useState(productToEdit?.sku || '');
  const [name, setName] = useState(productToEdit?.name || '');
  const [heading, setHeading] = useState(productToEdit?.heading || '');
  const [subtitle, setSubtitle] = useState(productToEdit?.subtitle || '');
  const [description, setDescription] = useState(productToEdit?.description || '');
  const [category, setCategory] = useState(productToEdit?.category || 'Festive Decor');
  const [brand, setBrand] = useState(productToEdit?.brand || 'Kansa Heritage');
  const [imageUrl, setImageUrl] = useState(productToEdit?.imageUrl || '');
  const [sellingPrice, setSellingPrice] = useState<number>(productToEdit?.sellingPrice ?? 1850);
  const [mrp, setMrp] = useState<number>(productToEdit?.mrp ?? 2499);
  const [badge, setBadge] = useState(productToEdit?.badge || '');
  const [campaign, setCampaign] = useState(productToEdit?.campaign || 'diwali-2026');
  const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(
    productToEdit?.campaigns && productToEdit.campaigns.length > 0
      ? productToEdit.campaigns
      : [productToEdit?.campaign || 'diwali-2026']
  );
  const [status, setStatus] = useState<ProductStatus>(productToEdit?.status || 'active');
  const [stockStatus, setStockStatus] = useState<StockStatus>(productToEdit?.stockStatus || 'in_stock');
  const [rating, setRating] = useState<number>(productToEdit?.rating ?? 4.9);
  const [ratingCount, setRatingCount] = useState<number>(productToEdit?.ratingCount ?? 120);
  const [amazonUrl, setAmazonUrl] = useState(productToEdit?.amazonUrl || '');
  const [flipkartUrl, setFlipkartUrl] = useState(productToEdit?.flipkartUrl || '');
  const [meeshoUrl, setMeeshoUrl] = useState(productToEdit?.meeshoUrl || '');
  const [websiteUrl, setWebsiteUrl] = useState(productToEdit?.websiteUrl || '');
  const [featured, setFeatured] = useState<boolean>(productToEdit?.featured ?? false);
  const [sortOrder, setSortOrder] = useState<number>(productToEdit?.sortOrder ?? 1);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  React.useEffect(() => {
    setSku(productToEdit?.sku || `KH-ITEM-${Math.floor(100 + Math.random() * 899)}`);
    setName(productToEdit?.name || '');
    setHeading(productToEdit?.heading || '');
    setSubtitle(productToEdit?.subtitle || '');
    setDescription(productToEdit?.description || '');
    setCategory(productToEdit?.category || 'Festive Decor');
    setBrand(productToEdit?.brand || 'Kansa Heritage');
    setImageUrl(productToEdit?.imageUrl || '');
    setSellingPrice(productToEdit?.sellingPrice ?? 1850);
    setMrp(productToEdit?.mrp ?? 2499);
    setBadge(productToEdit?.badge || '');
    const primaryCamp = productToEdit?.campaign || 'diwali-2026';
    setCampaign(primaryCamp);
    setSelectedCampaigns(
      productToEdit?.campaigns && productToEdit.campaigns.length > 0
        ? productToEdit.campaigns
        : [primaryCamp]
    );
    setStatus(productToEdit?.status || 'active');
    setStockStatus(productToEdit?.stockStatus || 'in_stock');
    setRating(productToEdit?.rating ?? 4.9);
    setRatingCount(productToEdit?.ratingCount ?? 120);
    setAmazonUrl(productToEdit?.amazonUrl || '');
    setFlipkartUrl(productToEdit?.flipkartUrl || '');
    setMeeshoUrl(productToEdit?.meeshoUrl || '');
    setWebsiteUrl(productToEdit?.websiteUrl || '');
    setFeatured(productToEdit?.featured ?? false);
    setSortOrder(productToEdit?.sortOrder ?? 1);
    setConfirmDelete(false);
    setErrorMsg('');
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const discount = calculateDiscountPercent(sellingPrice, mrp);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    setErrorMsg('');
    try {
      const persistentUrl = await uploadPersistentProductImage(file);
      setImageUrl(persistentUrl);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent, asDuplicate = false) => {
    e.preventDefault();
    setErrorMsg('');

    if (!sku.trim() || !name.trim()) {
      setErrorMsg('SKU and Product Name are required fields.');
      return;
    }
    if (sellingPrice <= 0) {
      setErrorMsg('Selling price must be greater than ₹0.');
      return;
    }

    setSaving(true);
    try {
      const finalSku = asDuplicate ? `${sku.trim()}-COPY` : sku.trim();
      const finalCampaigns = Array.from(new Set([campaign, ...selectedCampaigns])).filter(Boolean);
      await onSaveProduct({
        id: asDuplicate ? undefined : productToEdit?.id,
        sku: finalSku,
        name: name.trim(),
        heading: heading.trim() || name.trim(),
        subtitle: subtitle.trim() || `${brand.trim()} · ${category.trim()}`,
        description: description.trim(),
        category: category.trim(),
        brand: brand.trim(),
        imageUrl: imageUrl.trim(),
        sellingPrice: Number(sellingPrice),
        mrp: Math.max(Number(sellingPrice), Number(mrp)),
        badge: badge.trim(),
        campaign,
        campaigns: finalCampaigns,
        status,
        stockStatus,
        rating: Number(rating),
        ratingCount: Number(ratingCount),
        amazonUrl: amazonUrl.trim(),
        flipkartUrl: flipkartUrl.trim(),
        meeshoUrl: meeshoUrl.trim(),
        websiteUrl: websiteUrl.trim(),
        featured,
        sortOrder: Number(sortOrder),
      });
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to save product.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-editor-title"
    >
      <div className="relative my-8 w-full max-w-4xl rounded-xl border border-stone-200 bg-white text-stone-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-900 px-6 py-4 text-white">
          <div>
            <h2 id="product-editor-title" className="text-lg font-semibold">
              {productToEdit ? `Edit Product — ${productToEdit.sku}` : 'Add New Storefront Product'}
            </h2>
            <p className="text-xs text-stone-300">
              Changes sync immediately to all assigned Campaign Pages and the Public Storefront
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close product editor"
            className="rounded-lg p-2 text-stone-300 hover:bg-stone-800 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={(e) => handleSave(e, false)} className="max-h-[82vh] overflow-y-auto p-6 space-y-6">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800">
              {errorMsg}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Image Preview & Upload */}
            <div className="space-y-4">
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                Product Visual &amp; Storage
              </div>
              <div className="overflow-hidden rounded-xl border border-stone-200">
                <ProductVisual
                  product={{
                    name: name || 'New Product Preview',
                    brand: brand || 'Brand',
                    category: category || 'Category',
                    imageUrl,
                  }}
                  className="aspect-4/3 w-full"
                />
              </div>

              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors">
                <Upload className="h-4 w-4 text-amber-600" />
                <span>{uploadingImage ? 'Uploading Image...' : 'Upload Image File (Firebase Storage)'}</span>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>

              <div>
                <label htmlFor="prod-image-url" className="block text-xs font-medium text-stone-600 mb-1">
                  Or Direct Image URL / Data URI
                </label>
                <input
                  id="prod-image-url"
                  type="text"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-800"
                />
              </div>

              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2 text-xs">
                <div className="font-semibold text-stone-800">Live Pricing Preview (INR)</div>
                <div className="flex items-baseline gap-2 tabular-nums">
                  <span className="text-lg font-bold text-stone-900">{formatINR(sellingPrice)}</span>
                  <span className="text-stone-400 line-through">{formatINR(mrp)}</span>
                  {discount > 0 && <span className="font-semibold text-amber-700">{discount}% OFF</span>}
                </div>
              </div>
            </div>

            {/* Right 2 Columns: Core Fields */}
            <div className="lg:col-span-2 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="prod-sku" className="block text-xs font-medium text-stone-700 mb-1">
                    SKU / Product ID *
                  </label>
                  <input
                    id="prod-sku"
                    type="text"
                    required
                    value={sku}
                    onChange={(e) => setSku(e.target.value.toUpperCase())}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-mono text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-name" className="block text-xs font-medium text-stone-700 mb-1">
                    Product Name *
                  </label>
                  <input
                    id="prod-name"
                    type="text"
                    required
                    placeholder="e.g. Hammered Brass Lotus Urli"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-heading" className="block text-xs font-medium text-stone-700 mb-1">
                    Catalog Heading / Display Title
                  </label>
                  <input
                    id="prod-heading"
                    type="text"
                    placeholder="14-Inch Hand-Hammered Pure Brass Urli"
                    value={heading}
                    onChange={(e) => setHeading(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-subtitle" className="block text-xs font-medium text-stone-700 mb-1">
                    Subtitle
                  </label>
                  <input
                    id="prod-subtitle"
                    type="text"
                    placeholder="Handcrafted in Moradabad"
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-category" className="block text-xs font-medium text-stone-700 mb-1">
                    Category *
                  </label>
                  <input
                    id="prod-category"
                    type="text"
                    required
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-brand" className="block text-xs font-medium text-stone-700 mb-1">
                    Brand *
                  </label>
                  <input
                    id="prod-brand"
                    type="text"
                    required
                    value={brand}
                    onChange={(e) => setBrand(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="prod-desc" className="block text-xs font-medium text-stone-700 mb-1">
                  Product Description
                </label>
                <textarea
                  id="prod-desc"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                />
              </div>

              {/* Pricing, Badge & Campaign */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="prod-selling-price" className="block text-xs font-medium text-stone-700 mb-1">
                    Selling Price (₹) *
                  </label>
                  <input
                    id="prod-selling-price"
                    type="number"
                    min={1}
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-semibold tabular-nums text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-mrp" className="block text-xs font-medium text-stone-700 mb-1">
                    MRP / Original (₹) *
                  </label>
                  <input
                    id="prod-mrp"
                    type="number"
                    min={1}
                    required
                    value={mrp}
                    onChange={(e) => setMrp(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm tabular-nums text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-badge" className="block text-xs font-medium text-stone-700 mb-1">
                    Promotional Badge
                  </label>
                  <input
                    id="prod-badge"
                    type="text"
                    placeholder="e.g. Diwali Bestseller"
                    value={badge}
                    onChange={(e) => setBadge(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-campaign" className="block text-xs font-medium text-stone-700 mb-1">
                    Primary Campaign
                  </label>
                  <select
                    id="prod-campaign"
                    value={campaign}
                    onChange={(e) => {
                      const val = e.target.value;
                      setCampaign(val);
                      if (!selectedCampaigns.includes(val)) {
                        setSelectedCampaigns((prev) => [...prev, val]);
                      }
                    }}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900"
                  >
                    {campaigns.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Multi-Campaign Checkboxes */}
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
                <div className="text-xs font-semibold text-stone-700">
                  Assign Product to Multiple Campaigns
                </div>
                <div className="flex flex-wrap gap-3">
                  {campaigns.map((c) => {
                    const checked = selectedCampaigns.includes(c.slug) || campaign === c.slug;
                    return (
                      <label key={c.slug} className="inline-flex items-center gap-1.5 text-xs text-stone-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedCampaigns((prev) => Array.from(new Set([...prev, c.slug])));
                            } else if (c.slug !== campaign) {
                              setSelectedCampaigns((prev) => prev.filter((slug) => slug !== c.slug));
                            }
                          }}
                          className="rounded border-stone-300 text-amber-600 focus:ring-amber-600"
                        />
                        <span>{c.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Status, Stock, Rating, Sort */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div>
                  <label htmlFor="prod-status" className="block text-xs font-medium text-stone-700 mb-1">
                    Product Status
                  </label>
                  <select
                    id="prod-status"
                    value={status}
                    onChange={(e) => setStatus(e.target.value as ProductStatus)}
                    className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-900"
                  >
                    <option value="active">Active (Public)</option>
                    <option value="draft">Draft</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-stock" className="block text-xs font-medium text-stone-700 mb-1">
                    Stock Status
                  </label>
                  <select
                    id="prod-stock"
                    value={stockStatus}
                    onChange={(e) => setStockStatus(e.target.value as StockStatus)}
                    className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-2 text-xs text-stone-900"
                  >
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="made_to_order">Made to Order</option>
                    <option value="out_of_stock">Out of Stock</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="prod-rating" className="block text-xs font-medium text-stone-700 mb-1">
                    Rating (1–5)
                  </label>
                  <input
                    id="prod-rating"
                    type="number"
                    step="0.1"
                    min={1}
                    max={5}
                    value={rating}
                    onChange={(e) => setRating(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-xs tabular-nums text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-reviews" className="block text-xs font-medium text-stone-700 mb-1">
                    Review Count
                  </label>
                  <input
                    id="prod-reviews"
                    type="number"
                    min={0}
                    value={ratingCount}
                    onChange={(e) => setRatingCount(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-xs tabular-nums text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-sort" className="block text-xs font-medium text-stone-700 mb-1">
                    Sort Order
                  </label>
                  <input
                    id="prod-sort"
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-xs tabular-nums text-stone-900"
                  />
                </div>
              </div>

              {/* Marketplace URLs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label htmlFor="prod-amazon" className="block text-xs font-medium text-stone-700 mb-1">
                    Amazon Purchase URL
                  </label>
                  <input
                    id="prod-amazon"
                    type="url"
                    placeholder="https://www.amazon.in/dp/..."
                    value={amazonUrl}
                    onChange={(e) => setAmazonUrl(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-flipkart" className="block text-xs font-medium text-stone-700 mb-1">
                    Flipkart Purchase URL
                  </label>
                  <input
                    id="prod-flipkart"
                    type="url"
                    placeholder="https://www.flipkart.com/..."
                    value={flipkartUrl}
                    onChange={(e) => setFlipkartUrl(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-meesho" className="block text-xs font-medium text-stone-700 mb-1">
                    Meesho Purchase URL
                  </label>
                  <input
                    id="prod-meesho"
                    type="url"
                    placeholder="https://www.meesho.com/..."
                    value={meeshoUrl}
                    onChange={(e) => setMeeshoUrl(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900"
                  />
                </div>
                <div>
                  <label htmlFor="prod-website" className="block text-xs font-medium text-stone-700 mb-1">
                    Own Website / Direct Store URL
                  </label>
                  <input
                    id="prod-website"
                    type="url"
                    placeholder="https://yourstore.in/products/..."
                    value={websiteUrl}
                    onChange={(e) => setWebsiteUrl(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-900"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 pt-1 text-xs font-medium text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="rounded border-stone-300 text-amber-600 focus:ring-amber-600"
                />
                Feature this product in catalog spotlight sections
              </label>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-200 pt-4">
            <div className="flex items-center gap-2">
              {productToEdit && onDeleteProduct && (
                <>
                  {!confirmDelete ? (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Delete Product
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteProduct(productToEdit.id);
                        onClose();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      Confirm Permanent Delete
                    </button>
                  )}
                </>
              )}
              {productToEdit && (
                <button
                  type="button"
                  onClick={(e) => handleSave(e, true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate as New SKU
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-stone-300 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-stone-900 px-5 py-2 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
