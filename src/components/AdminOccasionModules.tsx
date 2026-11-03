import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  ExternalLink,
  Layers,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import type {
  DecorationAreaType,
  DecorationDesign,
  DecorationPackage,
  DecorationStyleType,
  DecorationTheme,
  DesignProductMapping,
  Occasion,
  PackageProductMapping,
  Product,
  QuantityUnitType,
} from '../types/catalog';
import { formatINR } from '../utils/catalogLogic';
import { uploadPersistentProductImage } from '../lib/firebase';
import { ProductVisual } from './ProductVisual';

// ============================================================================
// 1. OCCASION MANAGER PANEL
// ============================================================================
interface OccasionManagerPanelProps {
  occasions: Occasion[];
  decorationThemes: DecorationTheme[];
  decorationDesigns: DecorationDesign[];
  onSaveOccasion: (occasion: Partial<Occasion>) => Promise<void>;
  onDeleteOccasion: (occasionId: string) => Promise<void>;
  onOpenPublicOccasion: (slug: string) => void;
}

export const OccasionManagerPanel: React.FC<OccasionManagerPanelProps> = ({
  occasions,
  decorationThemes,
  decorationDesigns,
  onSaveOccasion,
  onDeleteOccasion,
  onOpenPublicOccasion,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [bannerImage, setBannerImage] = useState('');
  const [icon, setIcon] = useState('Sparkles');
  const [featured, setFeatured] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(occasions.length + 1);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [uploadingCover, setUploadingCover] = useState(false);

  const loadOccasion = (occ: Occasion) => {
    setEditingId(occ.id);
    setName(occ.name);
    setSlug(occ.slug);
    setDescription(occ.description);
    setCoverImage(occ.coverImage);
    setBannerImage(occ.bannerImage);
    setIcon(occ.icon);
    setFeatured(occ.featured);
    setDisplayOrder(occ.displayOrder);
    setStatus(occ.status);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSlug('');
    setDescription('');
    setCoverImage('');
    setBannerImage('');
    setIcon('Sparkles');
    setFeatured(true);
    setDisplayOrder(occasions.length + 1);
    setStatus('active');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-stone-900">
            Occasion &amp; Celebration Manager ({occasions.length} Occasions)
          </h1>
          <p className="text-xs text-stone-500">
            Add, edit, reorder, or publish event occasions (Wedding, Birthday, Corporate Events, Diwali, Engagement,
            etc.). New occasions appear dynamically in public navigation.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
          >
            <Plus className="h-4 w-4" />
            Create New Occasion
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-7 space-y-3">
          {occasions.map((occ) => {
            const themeCount = decorationThemes.filter(
              (t) => t.occasionId === occ.id || t.occasionSlug === occ.slug
            ).length;
            const designCount = decorationDesigns.filter(
              (d) => d.occasionId === occ.id || d.occasionSlug === occ.slug
            ).length;

            return (
              <div
                key={occ.id}
                className={`rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  editingId === occ.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-stone-200'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
                    <ProductVisual
                      product={{
                        name: occ.name,
                        brand: occ.slug,
                        category: 'Occasion',
                        imageUrl: occ.coverImage || occ.bannerImage,
                      }}
                      className="aspect-16/10 w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono font-semibold text-amber-800">/occasions/{occ.slug}</span>
                      <span>·</span>
                      <span
                        className={`font-bold uppercase ${
                          occ.status === 'active' ? 'text-emerald-700' : 'text-stone-400'
                        }`}
                      >
                        {occ.status}
                      </span>
                      <span>·</span>
                      <span className="text-stone-500 tabular-nums">Order #{occ.displayOrder}</span>
                    </div>
                    <h3 className="text-sm font-bold text-stone-900">{occ.name}</h3>
                    <p className="text-xs text-stone-500 line-clamp-1">{occ.description}</p>
                    <div className="text-[11px] text-stone-500 tabular-nums">
                      <strong>{themeCount}</strong> Themes · <strong>{designCount}</strong> Decoration Designs
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenPublicOccasion(occ.slug)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                  >
                    View <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => loadOccasion(occ)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteOccasion(occ.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Form */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const cleanSlug =
              slug.trim() ||
              name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-');
            await onSaveOccasion({
              id: editingId || undefined,
              name: name.trim(),
              slug: cleanSlug,
              description: description.trim(),
              coverImage: coverImage.trim(),
              bannerImage: (bannerImage || coverImage).trim(),
              icon: icon.trim() || 'Sparkles',
              featured,
              displayOrder: Number(displayOrder) || 1,
              status,
            });
            resetForm();
          }}
          className="lg:col-span-5 rounded-xl border border-stone-200 bg-white p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-stone-900">
            {editingId ? `Edit Occasion — ${name}` : 'Add New Occasion'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Occasion Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Wedding"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingId) {
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                    );
                  }
                }}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">URL Slug *</label>
              <input
                type="text"
                required
                placeholder="wedding"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Description</label>
            <textarea
              rows={2}
              placeholder="Describe the occasion and typical decoration setups..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-stone-700">Cover &amp; Banner Image</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Image URL or upload file..."
                value={coverImage}
                onChange={(e) => {
                  setCoverImage(e.target.value);
                  if (!bannerImage) setBannerImage(e.target.value);
                }}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
              <label className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100">
                <Upload className="h-3.5 w-3.5" />
                {uploadingCover ? 'Uploading...' : 'Upload'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setUploadingCover(true);
                    try {
                      const url = await uploadPersistentProductImage(file);
                      setCoverImage(url);
                      setBannerImage(url);
                    } finally {
                      setUploadingCover(false);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Display Order</label>
              <input
                type="number"
                min={1}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-stone-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={featured}
                  onChange={(e) => setFeatured(e.target.checked)}
                  className="rounded border-stone-300 accent-amber-600"
                />
                Featured
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            {editingId ? 'Save Occasion Changes' : 'Publish Occasion'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 2. DECORATION THEME MANAGER PANEL
// ============================================================================
interface ThemeManagerPanelProps {
  occasions: Occasion[];
  decorationThemes: DecorationTheme[];
  onSaveDecorationTheme: (theme: Partial<DecorationTheme>) => Promise<void>;
  onDeleteDecorationTheme: (themeId: string) => Promise<void>;
  onOpenPublicTheme: (slug: string) => void;
}

const DECORATION_STYLES: DecorationStyleType[] = [
  'Royal',
  'Floral Pastel',
  'Luxury Red',
  'Minimal White',
  'Traditional Indian',
  'Balloon & Contemporary',
  'Executive Corporate',
  'Festive Courtyard',
];

export const ThemeManagerPanel: React.FC<ThemeManagerPanelProps> = ({
  occasions,
  decorationThemes,
  onSaveDecorationTheme,
  onDeleteDecorationTheme,
  onOpenPublicTheme,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [occasionId, setOccasionId] = useState<string>(occasions[0]?.id || 'occ-wedding');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [colorPaletteInput, setColorPaletteInput] = useState('Royal Gold, Deep Crimson, Warm Ivory');
  const [style, setStyle] = useState<DecorationStyleType>('Royal');
  const [featured, setFeatured] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(decorationThemes.length + 1);
  const [status, setStatus] = useState<'published' | 'draft'>('published');

  const loadTheme = (thm: DecorationTheme) => {
    setEditingId(thm.id);
    setOccasionId(thm.occasionId);
    setTitle(thm.title);
    setSlug(thm.slug);
    setDescription(thm.description);
    setCoverImage(thm.coverImage);
    setColorPaletteInput((thm.colorPalette || []).join(', '));
    setStyle(thm.style);
    setFeatured(thm.featured);
    setDisplayOrder(thm.displayOrder);
    setStatus(thm.status);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setDescription('');
    setCoverImage('');
    setColorPaletteInput('Royal Gold, Deep Crimson, Warm Ivory');
    setStyle('Royal');
    setFeatured(true);
    setDisplayOrder(decorationThemes.length + 1);
    setStatus('published');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-stone-900">
            Occasion Decoration Themes ({decorationThemes.length} Themes)
          </h1>
          <p className="text-xs text-stone-500">
            Create decoration themes under each occasion (e.g. Royal Gold Wedding, Floral Pastel Wedding, Luxury
            Birthday, Sovereign Diwali Courtyard).
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800"
          >
            <Plus className="h-4 w-4" />
            Create New Decoration Theme
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-3">
          {decorationThemes.map((thm) => {
            const occ = occasions.find((o) => o.id === thm.occasionId || o.slug === thm.occasionSlug);
            return (
              <div
                key={thm.id}
                className={`rounded-xl border bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  editingId === thm.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-stone-200'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
                    <ProductVisual
                      product={{
                        name: thm.title,
                        brand: thm.style,
                        category: occ?.name || 'Theme',
                        imageUrl: thm.coverImage,
                      }}
                      className="aspect-16/10 w-full"
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-bold uppercase text-amber-700">{occ?.name || thm.occasionSlug}</span>
                      <span>·</span>
                      <span className="text-stone-600">{thm.style}</span>
                      <span>·</span>
                      <span
                        className={`font-semibold uppercase ${
                          thm.status === 'published' ? 'text-emerald-700' : 'text-stone-400'
                        }`}
                      >
                        {thm.status}
                      </span>
                    </div>
                    <h3 className="text-sm font-bold text-stone-900">{thm.title}</h3>
                    <p className="text-xs text-stone-500 line-clamp-1">{thm.description}</p>
                    <div className="text-[11px] text-stone-500">
                      Palette: {(thm.colorPalette || []).join(' · ')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenPublicTheme(thm.slug)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-800"
                  >
                    Preview <ExternalLink className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => loadTheme(thm)}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteDecorationTheme(thm.id)}
                    className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-medium text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const occ = occasions.find((o) => o.id === occasionId);
            const cleanSlug =
              slug.trim() ||
              title
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-');
            await onSaveDecorationTheme({
              id: editingId || undefined,
              occasionId,
              occasionSlug: occ?.slug || 'wedding',
              title: title.trim(),
              slug: cleanSlug,
              description: description.trim(),
              coverImage: coverImage.trim(),
              galleryImages: coverImage.trim() ? [coverImage.trim()] : [],
              colorPalette: colorPaletteInput
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
              style,
              featured,
              displayOrder: Number(displayOrder) || 1,
              status,
            });
            resetForm();
          }}
          className="lg:col-span-5 rounded-xl border border-stone-200 bg-white p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-stone-900">
            {editingId ? `Edit Decoration Theme — ${title}` : 'Create Decoration Theme'}
          </h2>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Parent Occasion *</label>
            <select
              value={occasionId}
              onChange={(e) => setOccasionId(e.target.value)}
              className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
            >
              {occasions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Theme Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Royal Gold Wedding"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!editingId) {
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                    );
                  }
                }}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Slug *</label>
              <input
                type="text"
                required
                placeholder="royal-gold-wedding"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Decoration Style</label>
              <select
                value={style}
                onChange={(e) => setStyle(e.target.value as DecorationStyleType)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
              >
                {DECORATION_STYLES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'published' | 'draft')}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
              >
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">
              Color Palette (Comma separated)
            </label>
            <input
              type="text"
              value={colorPaletteInput}
              onChange={(e) => setColorPaletteInput(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Theme Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Cover Image URL / Upload</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste URL or upload..."
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
              <label className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800">
                <Upload className="h-3.5 w-3.5" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadPersistentProductImage(file);
                    setCoverImage(url);
                  }}
                />
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            {editingId ? 'Save Decoration Theme' : 'Publish Decoration Theme'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 3. DECORATION DESIGN GALLERY & PRODUCT MAPPING PANEL
// ============================================================================
interface DecorationDesignManagerPanelProps {
  occasions: Occasion[];
  decorationThemes: DecorationTheme[];
  decorationDesigns: DecorationDesign[];
  designProducts: DesignProductMapping[];
  products: Product[];
  onSaveDecorationDesign: (
    design: Partial<DecorationDesign>,
    mappings: Partial<DesignProductMapping>[]
  ) => Promise<void>;
  onDeleteDecorationDesign: (designId: string) => Promise<void>;
  onOpenPublicDesign: (slug: string) => void;
}

const DECORATION_AREAS: DecorationAreaType[] = [
  'Stage / Mandap',
  'Entrance Archway',
  'Table / Dining',
  'Ceiling / Canopy',
  'Wall / Backdrop',
  'Pathway / Courtyard',
  'Complete Venue',
];

const QUANTITY_UNITS: QuantityUnitType[] = ['pcs', 'sets', 'meters', 'strings', 'pairs', 'packs'];

export const DecorationDesignManagerPanel: React.FC<DecorationDesignManagerPanelProps> = ({
  occasions,
  decorationThemes,
  decorationDesigns,
  designProducts,
  products,
  onSaveDecorationDesign,
  onDeleteDecorationDesign,
  onOpenPublicDesign,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [occasionId, setOccasionId] = useState<string>(occasions[0]?.id || 'occ-wedding');
  const [themeId, setThemeId] = useState<string>(decorationThemes[0]?.id || 'dtheme-royal-gold-wedding');
  const [mainImage, setMainImage] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [fullDescription, setFullDescription] = useState('');
  const [decorationArea, setDecorationArea] = useState<DecorationAreaType>('Stage / Mandap');
  const [recommendedGuestCount, setRecommendedGuestCount] = useState('150 - 300 Guests');
  const [indoorOutdoor, setIndoorOutdoor] = useState<'indoor' | 'outdoor' | 'both'>('both');
  const [estimatedBudgetRange, setEstimatedBudgetRange] = useState('₹35,000 – ₹90,000');
  const [status, setStatus] = useState<'published' | 'draft'>('published');

  // Product Mapping State
  const [mappings, setMappings] = useState<Partial<DesignProductMapping>[]>([]);
  const [addProdId, setAddProdId] = useState<string>('');
  const [addQty, setAddQty] = useState<number>(10);
  const [addUnit, setAddUnit] = useState<QuantityUnitType>('pcs');
  const [addRequired, setAddRequired] = useState<boolean>(true);
  const [addNotes, setAddNotes] = useState<string>('');

  const loadDesign = (d: DecorationDesign) => {
    setEditingId(d.id);
    setTitle(d.title);
    setSlug(d.slug);
    setOccasionId(d.occasionId);
    setThemeId(d.themeId);
    setMainImage(d.mainImage);
    setShortDescription(d.shortDescription);
    setFullDescription(d.fullDescription);
    setDecorationArea(d.decorationArea);
    setRecommendedGuestCount(d.recommendedGuestCount);
    setIndoorOutdoor(d.indoorOutdoor);
    setEstimatedBudgetRange(d.estimatedBudgetRange);
    setStatus(d.status);
    const existingMappings = designProducts
      .filter((m) => m.designId === d.id)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    setMappings(existingMappings);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setSlug('');
    setMainImage('');
    setShortDescription('');
    setFullDescription('');
    setDecorationArea('Stage / Mandap');
    setRecommendedGuestCount('150 - 300 Guests');
    setIndoorOutdoor('both');
    setEstimatedBudgetRange('₹35,000 – ₹90,000');
    setStatus('published');
    setMappings([]);
  };

  const handleAddProductMapping = () => {
    if (!addProdId) return;
    const prod = products.find((p) => p.id === addProdId);
    if (!prod) return;
    if (mappings.some((m) => m.productId === prod.id)) {
      setMappings((prev) =>
        prev.map((m) =>
          m.productId === prod.id
            ? {
                ...m,
                recommendedQuantity: Math.max(1, addQty),
                quantityUnit: addUnit,
                isRequired: addRequired,
                notes: addNotes,
              }
            : m
        )
      );
    } else {
      setMappings((prev) => [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          recommendedQuantity: Math.max(1, addQty),
          quantityUnit: addUnit,
          isRequired: addRequired,
          displayOrder: prev.length + 1,
          notes: addNotes.trim(),
        },
      ]);
    }
    setAddProdId('');
    setAddNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-stone-900">
            Decoration Design Gallery &amp; Product Mapping ({decorationDesigns.length} Designs)
          </h1>
          <p className="text-xs text-stone-500">
            Upload decoration inspiration scenes and map existing catalog products (without duplicating product
            records) with recommended quantities, units, and placement notes.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800"
          >
            <Plus className="h-4 w-4" />
            Create New Decoration Design
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Left List of Designs (5 cols) */}
        <div className="xl:col-span-5 space-y-3">
          {decorationDesigns.map((d) => {
            const occ = occasions.find((o) => o.id === d.occasionId || o.slug === d.occasionSlug);
            const thm = decorationThemes.find((t) => t.id === d.themeId || t.slug === d.themeSlug);
            const dMappings = designProducts.filter((m) => m.designId === d.id);

            return (
              <div
                key={d.id}
                className={`rounded-xl border bg-white p-4 space-y-3 ${
                  editingId === d.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-stone-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
                    <ProductVisual
                      product={{
                        name: d.title,
                        brand: d.decorationArea,
                        category: occ?.name || 'Design',
                        imageUrl: d.mainImage,
                      }}
                      className="aspect-16/10 w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
                      <span className="font-bold uppercase text-amber-700">{occ?.name || d.occasionSlug}</span>
                      <span>·</span>
                      <span>{thm?.title || d.themeSlug}</span>
                      <span>·</span>
                      <span className="font-semibold uppercase text-emerald-700">{d.status}</span>
                    </div>
                    <h3 className="text-sm font-bold text-stone-900">{d.title}</h3>
                    <div className="text-xs text-stone-500">
                      {d.decorationArea} · <strong>{dMappings.length} Mapped Products</strong>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                  <span className="text-xs text-stone-500 tabular-nums">{d.estimatedBudgetRange}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenPublicDesign(d.slug)}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-800"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => loadDesign(d)}
                      className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800"
                    >
                      <Edit3 className="h-3 w-3" />
                      Edit &amp; Map Products
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDecorationDesign(d.id)}
                      className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right Design Editor + Product Mapping Builder (7 cols) */}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            const occ = occasions.find((o) => o.id === occasionId);
            const thm = decorationThemes.find((t) => t.id === themeId);
            const cleanSlug =
              slug.trim() ||
              title
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-');
            await onSaveDecorationDesign(
              {
                id: editingId || undefined,
                title: title.trim(),
                slug: cleanSlug,
                occasionId,
                occasionSlug: occ?.slug || 'wedding',
                themeId,
                themeSlug: thm?.slug || 'royal-gold-wedding',
                mainImage: mainImage.trim(),
                galleryImages: mainImage.trim() ? [mainImage.trim()] : [],
                shortDescription: shortDescription.trim(),
                fullDescription: (fullDescription || shortDescription).trim(),
                decorationArea,
                recommendedGuestCount: recommendedGuestCount.trim(),
                indoorOutdoor,
                estimatedBudgetRange: estimatedBudgetRange.trim(),
                featured: true,
                status,
              },
              mappings
            );
            resetForm();
          }}
          className="xl:col-span-7 rounded-xl border border-stone-200 bg-white p-6 space-y-5"
        >
          <h2 className="text-base font-bold text-stone-900">
            {editingId ? `Edit Design & Mapped Products — ${title}` : 'Create Decoration Design & Map Products'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Design Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Royal Sabyasachi Mandap Setup"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  if (!editingId) {
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                    );
                  }
                }}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Public Slug (/designs/:slug) *</label>
              <input
                type="text"
                required
                placeholder="royal-sabyasachi-mandap-setup"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Occasion *</label>
              <select
                value={occasionId}
                onChange={(e) => setOccasionId(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
              >
                {occasions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Decoration Theme *</label>
              <select
                value={themeId}
                onChange={(e) => setThemeId(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
              >
                {decorationThemes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Decoration Area</label>
              <select
                value={decorationArea}
                onChange={(e) => setDecorationArea(e.target.value as DecorationAreaType)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
              >
                {DECORATION_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Recommended Guest Count</label>
              <input
                type="text"
                value={recommendedGuestCount}
                onChange={(e) => setRecommendedGuestCount(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Indoor / Outdoor</label>
              <select
                value={indoorOutdoor}
                onChange={(e) => setIndoorOutdoor(e.target.value as 'indoor' | 'outdoor' | 'both')}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
              >
                <option value="both">Both Indoor &amp; Outdoor</option>
                <option value="indoor">Indoor Only</option>
                <option value="outdoor">Outdoor Only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Estimated Budget Range</label>
              <input
                type="text"
                value={estimatedBudgetRange}
                onChange={(e) => setEstimatedBudgetRange(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Main Design Image URL / Upload</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Paste URL or upload decoration photo..."
                value={mainImage}
                onChange={(e) => setMainImage(e.target.value)}
                className="flex-1 rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
              <label className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800">
                <Upload className="h-3.5 w-3.5" />
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const url = await uploadPersistentProductImage(file);
                    setMainImage(url);
                  }}
                />
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Short Description</label>
            <textarea
              rows={2}
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
            />
          </div>

          {/* PRODUCT MAPPING BUILDER */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Product Mapping (Design → Products)
                </div>
                <p className="text-[11px] text-stone-600">
                  Link existing catalog products to this decoration design with recommended quantities and placement notes.
                </p>
              </div>
              <span className="text-xs font-bold text-stone-900 tabular-nums">
                {mappings.length} Products Mapped
              </span>
            </div>

            {/* Add Product Row */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end bg-white p-3 rounded-lg border border-stone-200">
              <div className="sm:col-span-5">
                <label className="block text-[11px] font-medium text-stone-700 mb-1">Select Catalog Product</label>
                <select
                  value={addProdId}
                  onChange={(e) => setAddProdId(e.target.value)}
                  className="w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="">Choose existing SKU...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({formatINR(p.sellingPrice)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-stone-700 mb-1">Rec. Qty</label>
                <input
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(Number(e.target.value))}
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-medium text-stone-700 mb-1">Unit</label>
                <select
                  value={addUnit}
                  onChange={(e) => setAddUnit(e.target.value as QuantityUnitType)}
                  className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs"
                >
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <button
                  type="button"
                  onClick={handleAddProductMapping}
                  disabled={!addProdId}
                  className="w-full inline-flex items-center justify-center gap-1 rounded bg-stone-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Map Product
                </button>
              </div>
              <div className="sm:col-span-9">
                <input
                  type="text"
                  placeholder="Placement notes (e.g. Flanking the mandap pillars or along entrance walkway)"
                  value={addNotes}
                  onChange={(e) => setAddNotes(e.target.value)}
                  className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-xs"
                />
              </div>
              <div className="sm:col-span-3 flex items-center pb-1">
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={addRequired}
                    onChange={(e) => setAddRequired(e.target.checked)}
                    className="rounded border-stone-300 accent-amber-600"
                  />
                  Required Item
                </label>
              </div>
            </div>

            {/* Mapped Products List */}
            {mappings.length > 0 && (
              <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
                {mappings.map((m, idx) => {
                  const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                  return (
                    <div key={`${m.productId}-${idx}`} className="flex items-center justify-between gap-3 p-3 text-xs">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-stone-900">
                          {prod ? prod.name : m.sku}{' '}
                          <span className="font-mono font-normal text-stone-500">({m.sku})</span>
                        </div>
                        <div className="text-[11px] text-stone-500">
                          Recommended: <strong>{m.recommendedQuantity} {m.quantityUnit}</strong> ·{' '}
                          {m.isRequired ? 'Required' : 'Optional'}
                          {m.notes ? ` · ${m.notes}` : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMappings((prev) => prev.filter((_, i) => i !== idx))}
                        className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-stone-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            {editingId ? 'Save Design & Mapped Products' : 'Publish Decoration Design'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// 4. PACKAGE MANAGER PANEL
// ============================================================================
interface PackageManagerPanelProps {
  occasions: Occasion[];
  decorationThemes: DecorationTheme[];
  packages: DecorationPackage[];
  packageProducts: PackageProductMapping[];
  products: Product[];
  onSavePackage: (
    pkg: Partial<DecorationPackage>,
    mappings: Partial<PackageProductMapping>[]
  ) => Promise<void>;
  onDeletePackage: (packageId: string) => Promise<void>;
}

export const PackageManagerPanel: React.FC<PackageManagerPanelProps> = ({
  occasions,
  decorationThemes,
  packages,
  packageProducts,
  products,
  onSavePackage,
  onDeletePackage,
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [occasionId, setOccasionId] = useState<string>(occasions[0]?.id || 'occ-wedding');
  const [themeId, setThemeId] = useState<string>('');
  const [coverImage, setCoverImage] = useState('');
  const [description, setDescription] = useState('');
  const [startingPrice, setStartingPrice] = useState<number>(45000);
  const [guestCapacity, setGuestCapacity] = useState('150 - 300 Guests');
  const [status, setStatus] = useState<'published' | 'draft'>('published');

  const [mappings, setMappings] = useState<Partial<PackageProductMapping>[]>([]);
  const [addProdId, setAddProdId] = useState('');
  const [addQty, setAddQty] = useState(10);
  const [addUnit, setAddUnit] = useState<QuantityUnitType>('pcs');
  const [addNotes, setAddNotes] = useState('');

  const loadPackage = (pkg: DecorationPackage) => {
    setEditingId(pkg.id);
    setName(pkg.name);
    setSlug(pkg.slug);
    setOccasionId(pkg.occasionId);
    setThemeId(pkg.themeId || '');
    setCoverImage(pkg.coverImage);
    setDescription(pkg.description);
    setStartingPrice(pkg.startingPrice);
    setGuestCapacity(pkg.guestCapacity);
    setStatus(pkg.status);
    setMappings(
      packageProducts
        .filter((m) => m.packageId === pkg.id)
        .sort((a, b) => a.displayOrder - b.displayOrder)
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setSlug('');
    setCoverImage('');
    setDescription('');
    setStartingPrice(45000);
    setGuestCapacity('150 - 300 Guests');
    setStatus('published');
    setMappings([]);
  };

  const handleAddPkgProduct = () => {
    if (!addProdId) return;
    const prod = products.find((p) => p.id === addProdId);
    if (!prod) return;
    setMappings((prev) => [
      ...prev.filter((m) => m.productId !== prod.id),
      {
        productId: prod.id,
        sku: prod.sku,
        recommendedQuantity: Math.max(1, addQty),
        quantityUnit: addUnit,
        isRequired: true,
        displayOrder: prev.length + 1,
        notes: addNotes.trim(),
      },
    ]);
    setAddProdId('');
    setAddNotes('');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-stone-900">
            Bulk Decoration Packages Manager ({packages.length} Packages)
          </h1>
          <p className="text-xs text-stone-500">
            Create turnkey decoration packages (e.g. Royal Mandap Package, Wedding Entrance Package, Corporate Event
            Lighting Package) with customizable product quantities.
          </p>
        </div>
        {editingId && (
          <button
            type="button"
            onClick={resetForm}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800"
          >
            <Plus className="h-4 w-4" />
            Create New Package
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        <div className="xl:col-span-5 space-y-3">
          {packages.map((pkg) => {
            const occ = occasions.find((o) => o.id === pkg.occasionId || o.slug === pkg.occasionSlug);
            const pMappings = packageProducts.filter((m) => m.packageId === pkg.id);
            return (
              <div
                key={pkg.id}
                className={`rounded-xl border bg-white p-4 space-y-3 ${
                  editingId === pkg.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-stone-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
                    <ProductVisual
                      product={{
                        name: pkg.name,
                        brand: `${pMappings.length} SKUs`,
                        category: occ?.name || 'Package',
                        imageUrl: pkg.coverImage,
                      }}
                      className="aspect-16/10 w-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="text-xs font-bold uppercase text-amber-700">
                      {occ?.name || pkg.occasionSlug} · {pkg.status}
                    </div>
                    <h3 className="text-sm font-bold text-stone-900">{pkg.name}</h3>
                    <div className="text-xs text-stone-500 tabular-nums">
                      Starting: <strong>{formatINR(pkg.startingPrice)}</strong> · {pMappings.length} Products
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => loadPackage(pkg)}
                    className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800"
                  >
                    <Edit3 className="h-3 w-3" />
                    Edit Package
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeletePackage(pkg.id)}
                    className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!name.trim()) return;
            const occ = occasions.find((o) => o.id === occasionId);
            const thm = decorationThemes.find((t) => t.id === themeId);
            const cleanSlug =
              slug.trim() ||
              name
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-');
            await onSavePackage(
              {
                id: editingId || undefined,
                name: name.trim(),
                slug: cleanSlug,
                occasionId,
                occasionSlug: occ?.slug || 'wedding',
                themeId: thm?.id,
                themeSlug: thm?.slug,
                coverImage: coverImage.trim(),
                description: description.trim(),
                startingPrice: Math.max(0, Number(startingPrice) || 0),
                guestCapacity: guestCapacity.trim(),
                featured: true,
                status,
              },
              mappings
            );
            resetForm();
          }}
          className="xl:col-span-7 rounded-xl border border-stone-200 bg-white p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-stone-900">
            {editingId ? `Edit Package — ${name}` : 'Create Bulk Decoration Package'}
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Package Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Royal Mandap Package"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editingId) {
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9]+/g, '-')
                        .replace(/^-|-$/g, '')
                    );
                  }
                }}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Occasion *</label>
              <select
                value={occasionId}
                onChange={(e) => setOccasionId(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs"
              >
                {occasions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Indicative Starting Price (₹)</label>
              <input
                type="number"
                min={0}
                value={startingPrice}
                onChange={(e) => setStartingPrice(Number(e.target.value))}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Guest Capacity</label>
              <input
                type="text"
                value={guestCapacity}
                onChange={(e) => setGuestCapacity(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
            />
          </div>

          <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 space-y-3">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-700">
              Products Included in Package ({mappings.length} SKUs)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end">
              <div className="sm:col-span-6">
                <select
                  value={addProdId}
                  onChange={(e) => setAddProdId(e.target.value)}
                  className="w-full rounded border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                >
                  <option value="">Choose product to add...</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({formatINR(p.sellingPrice)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <input
                  type="number"
                  min={1}
                  value={addQty}
                  onChange={(e) => setAddQty(Number(e.target.value))}
                  className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs tabular-nums"
                />
              </div>
              <div className="sm:col-span-2">
                <select
                  value={addUnit}
                  onChange={(e) => setAddUnit(e.target.value as QuantityUnitType)}
                  className="w-full rounded border border-stone-300 bg-white px-2 py-1.5 text-xs"
                >
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <button
                  type="button"
                  onClick={handleAddPkgProduct}
                  disabled={!addProdId}
                  className="w-full rounded bg-stone-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-40"
                >
                  + Add
                </button>
              </div>
            </div>

            {mappings.length > 0 && (
              <div className="divide-y divide-stone-200 rounded border border-stone-200 bg-white">
                {mappings.map((m, idx) => {
                  const prod = products.find((p) => p.id === m.productId || p.sku === m.sku);
                  return (
                    <div key={`${m.productId}-${idx}`} className="flex items-center justify-between p-2.5 text-xs">
                      <span>
                        <strong>{prod ? prod.name : m.sku}</strong> — {m.recommendedQuantity} {m.quantityUnit}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMappings((prev) => prev.filter((_, i) => i !== idx))}
                        className="text-red-600 hover:underline"
                      >
                        Remove
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-stone-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
          >
            {editingId ? 'Save Package Changes' : 'Publish Bulk Package'}
          </button>
        </form>
      </div>
    </div>
  );
};
