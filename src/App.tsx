import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import type {
  BulkOrder,
  BulkOrderItem,
  Campaign,
  CatalogTheme,
  Product,
} from './types/catalog';
import {
  INITIAL_BULK_ORDERS,
  INITIAL_CAMPAIGNS,
  INITIAL_PRODUCTS,
  INITIAL_THEMES,
} from './utils/seedData';
import { isCampaignPubliclyActive } from './utils/catalogLogic';
import {
  auth,
  deleteCampaignFromFirestore,
  deleteProductFromFirestore,
  onAuthStateChanged,
  signInAdminWithGoogle,
  signOutAdmin,
  syncBulkOrderToFirestore,
  syncCampaignToFirestore,
  syncProductToFirestore,
  syncThemeToFirestore,
} from './lib/firebase';
import { ShopView, type StorefrontViewMode } from './components/ShopView';
import { AdminDashboardView, type AdminSection } from './components/AdminDashboardView';
import { BulkOrderModal } from './components/BulkOrderModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ProductEditorModal } from './components/ProductEditorModal';

type AppMode = 'shop' | 'admin';

export default function App() {
  const [mode, setMode] = useState<AppMode>('shop');
  const [storefrontMode, setStorefrontMode] = useState<StorefrontViewMode>('home');
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
  const [selectedCampaignSlug, setSelectedCampaignSlug] = useState<string>('all');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [themes, setThemes] = useState<CatalogTheme[]>(INITIAL_THEMES);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [bulkOrders, setBulkOrders] = useState<BulkOrder[]>(INITIAL_BULK_ORDERS);
  const [activeThemeId, setActiveThemeId] = useState<string>('theme-diwali-gold');
  const [previousThemeId, setPreviousThemeId] = useState<string>('theme-minimal-white');
  const [catalogViews, setCatalogViews] = useState<number>(1420);

  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('cmp_admin_auth') === '1';
  });
  const [adminEmail, setAdminEmail] = useState<string | null>(() => {
    return sessionStorage.getItem('cmp_admin_email');
  });

  // Modals State
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [notFoundSku, setNotFoundSku] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkInitialItems, setBulkInitialItems] = useState<BulkOrderItem[]>([]);
  const [bulkModalCampaignSlug, setBulkModalCampaignSlug] = useState<string>('diwali-2026');
  const [editorModalOpen, setEditorModalOpen] = useState<boolean>(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3500);
  }, []);

  // Load state from backend API
  const fetchAppState = useCallback(
    async (trackView = false, adminAuth = isAdminAuthenticated) => {
      try {
        const resp = await fetch(`/api/state${trackView ? '?trackView=1' : ''}`, {
          headers: adminAuth ? { 'X-Admin-Session': 'authenticated' } : {},
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (Array.isArray(data.products) && data.products.length > 0) setProducts(data.products);
        if (Array.isArray(data.themes) && data.themes.length > 0) setThemes(data.themes);
        if (Array.isArray(data.campaigns) && data.campaigns.length > 0) setCampaigns(data.campaigns);
        if (data.activeThemeId) setActiveThemeId(data.activeThemeId);
        if (data.previousThemeId) setPreviousThemeId(data.previousThemeId);
        if (typeof data.catalogViews === 'number') setCatalogViews(data.catalogViews);
        if (adminAuth && Array.isArray(data.bulkOrders)) {
          setBulkOrders(data.bulkOrders);
        }
      } catch {
        // Fallback to initial seed state if offline
      }
    },
    [isAdminAuthenticated]
  );

  const applyRouteFromPath = useCallback(
    (path: string, currentProducts: Product[]) => {
      setNotFoundSku(null);
      if (path.startsWith('/campaigns/') || path.startsWith('/catalog/')) {
        const slug = path
          .replace(/^\/(campaigns|catalog)\//, '')
          .split('/')[0]
          .trim();
        if (slug) {
          setSelectedCampaignSlug(slug);
          setStorefrontMode('campaign');
          setMode('shop');
          return;
        }
      }
      if (path === '/shop' || path === '/products') {
        setSelectedCampaignSlug('all');
        setStorefrontMode('all-products');
        setMode('shop');
        return;
      }
      if (path.startsWith('/product/')) {
        const sku = decodeURIComponent(path.replace('/product/', '').split('/')[0]).toUpperCase();
        const found = currentProducts.find((p) => p.sku.toUpperCase() === sku);
        setStorefrontMode('home');
        setMode('shop');
        if (found) {
          setDetailProduct(found);
        } else {
          setDetailProduct(null);
          setNotFoundSku(sku);
        }
        return;
      }
      if (path.startsWith('/admin')) {
        setMode('admin');
        const sub = path.replace('/admin', '').replace(/^\//, '').split('/')[0];
        if (sub === 'products') setAdminSection('products');
        else if (sub === 'import' || sub === 'excel') setAdminSection('excel');
        else if (sub === 'campaigns') setAdminSection('campaigns');
        else if (sub === 'orders') setAdminSection('orders');
        else if (sub === 'themes') setAdminSection('themes');
        else if (sub === 'customers') setAdminSection('customers');
        else if (sub === 'reports') setAdminSection('reports');
        else if (sub === 'settings') setAdminSection('settings');
        else setAdminSection('overview');
        return;
      }
      // Default: Campaign-based Homepage (/)
      setSelectedCampaignSlug('all');
      setStorefrontMode('home');
      setMode('shop');
    },
    []
  );

  // Parse initial URL path and listen to browser back/forward navigation
  useEffect(() => {
    fetchAppState(true, isAdminAuthenticated);
    applyRouteFromPath(window.location.pathname, products);

    const onPopState = () => {
      applyRouteFromPath(window.location.pathname, products);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchAppState, isAdminAuthenticated]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      if (user && user.emailVerified) {
        setIsAdminAuthenticated(true);
        setAdminEmail(user.email);
        sessionStorage.setItem('cmp_admin_auth', '1');
        if (user.email) sessionStorage.setItem('cmp_admin_email', user.email);
        fetchAppState(false, true);
      }
    });
    return () => unsub();
  }, [fetchAppState]);

  const activeTheme = useMemo(
    () => themes.find((t) => t.id === activeThemeId) || themes[0] || INITIAL_THEMES[0],
    [themes, activeThemeId]
  );

  const publiclyActiveCampaigns = useMemo(
    () => campaigns.filter((c) => isCampaignPubliclyActive(c)),
    [campaigns]
  );

  // Update SEO document title based on active view
  useEffect(() => {
    if (mode === 'shop' && storefrontMode === 'campaign' && selectedCampaignSlug !== 'all') {
      const camp = campaigns.find((c) => c.slug === selectedCampaignSlug);
      if (camp) {
        document.title = `${camp.name} — Bulk Shopping & Wholesale Storefront`;
        return;
      }
    }
    if (mode === 'admin') {
      document.title = 'Admin Console — Campaign & Bulk Order Management';
    } else if (storefrontMode === 'all-products') {
      document.title = 'All Products — Campaign & Bulk Shopping Storefront';
    } else {
      document.title = 'Catalog Maker Pro — Campaign-Based Bulk Shopping & Wholesale Storefront';
    }
  }, [mode, storefrontMode, selectedCampaignSlug, campaigns]);

  const navigateHome = () => {
    setMode('shop');
    setStorefrontMode('home');
    setSelectedCampaignSlug('all');
    window.history.pushState({}, '', '/');
  };

  const navigateAllProducts = () => {
    setMode('shop');
    setStorefrontMode('all-products');
    setSelectedCampaignSlug('all');
    window.history.pushState({}, '', '/shop');
  };

  const navigateCampaign = (slug: string) => {
    setMode('shop');
    setStorefrontMode('campaign');
    setSelectedCampaignSlug(slug);
    window.history.pushState({}, '', `/campaigns/${slug}`);
  };

  const navigateAdmin = (sec: AdminSection = 'overview') => {
    setMode('admin');
    setAdminSection(sec);
    const subPath = sec === 'overview' ? '/admin' : sec === 'excel' ? '/admin/import' : `/admin/${sec}`;
    window.history.pushState({}, '', subPath);
  };

  const handleOpenBulkOrderForProduct = (product: Product, quantity = 25, campaignSlug?: string) => {
    setBulkInitialItems([
      {
        productId: product.id,
        sku: product.sku,
        productName: product.name,
        unitPrice: product.sellingPrice,
        mrp: product.mrp,
        requestedQuantity: quantity,
      },
    ]);
    setBulkModalCampaignSlug(
      campaignSlug ||
        (selectedCampaignSlug !== 'all' ? selectedCampaignSlug : product.campaign || 'diwali-2026')
    );
    setBulkModalOpen(true);
  };

  const handleOpenMultiBulkOrder = (campaignSlug?: string) => {
    if (bulkInitialItems.length === 0 && products.length > 0) {
      const first = products[0];
      setBulkInitialItems([
        {
          productId: first.id,
          sku: first.sku,
          productName: first.name,
          unitPrice: first.sellingPrice,
          mrp: first.mrp,
          requestedQuantity: 25,
        },
      ]);
    }
    if (campaignSlug) {
      setBulkModalCampaignSlug(campaignSlug);
    } else if (selectedCampaignSlug !== 'all') {
      setBulkModalCampaignSlug(selectedCampaignSlug);
    }
    setBulkModalOpen(true);
  };

  const handleSubmitBulkOrder = async (payload: Partial<BulkOrder>): Promise<BulkOrder> => {
    const resp = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Failed to submit bulk order request.');
    }
    const created: BulkOrder = data.order;
    setBulkOrders((prev) => [created, ...prev]);
    await syncBulkOrderToFirestore(created).catch(() => {});
    showToast(`Bulk Order Request ${created.orderRef} submitted!`);
    return created;
  };

  const handleSaveProduct = async (productInput: Partial<Product>) => {
    const resp = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(productInput),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to save product.');
    const saved: Product = data.product;
    setProducts((prev) => {
      const idx = prev.findIndex((p) => p.id === saved.id || p.sku === saved.sku);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = saved;
        return copy;
      }
      return [saved, ...prev];
    });
    await syncProductToFirestore(saved).catch(() => {});
    showToast(`Saved product ${saved.sku} (${saved.name})`);
  };

  const handleDeleteProduct = async (productId: string) => {
    const resp = await fetch(`/api/products/${productId}`, { method: 'DELETE' });
    if (resp.ok) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      await deleteProductFromFirestore(productId).catch(() => {});
      showToast('Product deleted from storefront.');
    }
  };

  const handleBatchImportProducts = async (
    validProducts: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
    duplicateMode: 'update' | 'skip'
  ) => {
    const resp = await fetch('/api/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: validProducts, duplicateMode }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Batch import failed.');
    if (Array.isArray(data.products)) {
      setProducts(data.products);
    }
    if (Array.isArray(data.savedProducts)) {
      for (const p of data.savedProducts.slice(0, 25)) {
        await syncProductToFirestore(p).catch(() => {});
      }
    }
    showToast(`Imported ${data.added} new and updated ${data.updated} products from Excel!`);
    return { added: data.added, updated: data.updated, skipped: data.skipped };
  };

  const handleSaveAndActivateTheme = async (themeInput: Partial<CatalogTheme>, activate: boolean) => {
    const resp = await fetch('/api/themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ theme: themeInput, activate }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to save theme.');
    if (Array.isArray(data.themes)) setThemes(data.themes);
    if (data.activeThemeId) setActiveThemeId(data.activeThemeId);
    if (data.previousThemeId) setPreviousThemeId(data.previousThemeId);
    if (data.theme) {
      await syncThemeToFirestore(data.theme).catch(() => {});
    }
    showToast(`Theme "${data.theme?.name}" saved and applied!`);
  };

  const handleActivateExistingTheme = async (themeId: string) => {
    const resp = await fetch('/api/themes/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ themeId }),
    });
    const data = await resp.json();
    if (resp.ok) {
      setActiveThemeId(data.activeThemeId);
      setPreviousThemeId(data.previousThemeId);
      const found = themes.find((t) => t.id === themeId);
      if (found) showToast(`Activated theme "${found.name}"`);
    }
  };

  const handleUpdateOrder = async (
    orderId: string,
    updates: Partial<BulkOrder> & { timelineNote?: string }
  ) => {
    const resp = await fetch(`/api/orders/${orderId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Failed to update order.');
    if (Array.isArray(data.bulkOrders)) {
      setBulkOrders(data.bulkOrders);
    }
    showToast(`Updated order ${data.order?.orderRef}`);
  };

  const handleSaveCampaign = async (campInput: Partial<Campaign>) => {
    const resp = await fetch('/api/campaigns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(campInput),
    });
    const data = await resp.json();
    if (resp.ok && Array.isArray(data.campaigns)) {
      setCampaigns(data.campaigns);
      if (Array.isArray(data.products)) {
        setProducts(data.products);
      }
      if (data.campaign) {
        await syncCampaignToFirestore(data.campaign).catch(() => {});
      }
      showToast(`Saved campaign /campaigns/${data.campaign?.slug}`);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    const resp = await fetch(`/api/campaigns/${campaignId}`, { method: 'DELETE' });
    const data = await resp.json();
    if (resp.ok && Array.isArray(data.campaigns)) {
      setCampaigns(data.campaigns);
      await deleteCampaignFromFirestore(campaignId).catch(() => {});
      showToast('Campaign removed. Products and bulk orders were preserved.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      {/* 1. Brand Header with Logo, Search & Responsive Navigation */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-3.5">
          {/* Brand Logo & Wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              navigateHome();
            }}
            className="font-serif text-xl font-bold tracking-tight text-stone-950 whitespace-nowrap shrink-0"
          >
            Catalog Maker Pro
          </a>

          {/* Global Header Search */}
          <div className="hidden lg:block relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              type="search"
              aria-label="Global product search"
              placeholder="Search products or SKUs..."
              value={globalSearchQuery}
              onChange={(e) => {
                setGlobalSearchQuery(e.target.value);
                if (mode !== 'shop') {
                  setMode('shop');
                  setStorefrontMode('home');
                }
              }}
              className="w-full rounded-lg border border-stone-200 bg-stone-50 pl-9 pr-3 py-1.5 text-xs text-stone-900 placeholder:text-stone-400 focus:border-amber-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Primary Navigation Links */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-5 text-xs font-semibold text-stone-600"
          >
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateHome();
              }}
              className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'shop' && storefrontMode === 'home'
                  ? 'text-stone-950 underline underline-offset-4'
                  : ''
              }`}
            >
              Campaigns Home
            </a>

            {publiclyActiveCampaigns.slice(0, 3).map((camp) => (
              <a
                key={camp.slug}
                href={`/campaigns/${camp.slug}`}
                onClick={(e) => {
                  e.preventDefault();
                  navigateCampaign(camp.slug);
                }}
                className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'shop' && storefrontMode === 'campaign' && selectedCampaignSlug === camp.slug
                    ? 'text-amber-700 underline underline-offset-4'
                    : ''
                }`}
              >
                {camp.name.split(' ')[0]} {camp.name.split(' ')[1] || ''}
              </a>
            ))}

            <a
              href="/shop"
              onClick={(e) => {
                e.preventDefault();
                navigateAllProducts();
              }}
              className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'shop' && storefrontMode === 'all-products'
                  ? 'text-stone-950 underline underline-offset-4'
                  : ''
              }`}
            >
              All Products
            </a>

            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                navigateAdmin('overview');
              }}
              className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'admin' ? 'text-stone-950 underline underline-offset-4' : ''
              }`}
            >
              Admin Console
            </a>
          </nav>

          {/* Primary Bulk Order Action */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => handleOpenMultiBulkOrder()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors whitespace-nowrap shrink-0"
            >
              <Package className="h-3.5 w-3.5" />
              Request Bulk Quote
            </button>
          </div>
        </div>

        {/* Mobile Navigation Strip */}
        <div className="flex md:hidden items-center gap-2 overflow-x-auto border-t border-stone-100 bg-white px-4 py-2 text-xs font-semibold text-stone-700">
          <button
            type="button"
            onClick={navigateHome}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' && storefrontMode === 'home' ? 'bg-stone-900 text-white' : ''
            }`}
          >
            Campaigns Home
          </button>
          {publiclyActiveCampaigns.map((camp) => (
            <button
              key={camp.slug}
              type="button"
              onClick={() => navigateCampaign(camp.slug)}
              className={`px-3 py-1 rounded-md whitespace-nowrap ${
                mode === 'shop' && storefrontMode === 'campaign' && selectedCampaignSlug === camp.slug
                  ? 'bg-amber-600 text-white'
                  : ''
              }`}
            >
              {camp.name.split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
          <button
            type="button"
            onClick={navigateAllProducts}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' && storefrontMode === 'all-products' ? 'bg-stone-900 text-white' : ''
            }`}
          >
            All Products
          </button>
          <button
            type="button"
            onClick={() => navigateAdmin('overview')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'admin' ? 'bg-stone-900 text-white' : ''
            }`}
          >
            Admin Console
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 right-5 z-50 rounded-xl border border-stone-700 bg-stone-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"
        >
          {toastMessage}
        </div>
      )}

      {/* Main View Content */}
      <main className="flex-1">
        {mode === 'shop' && (
          <ShopView
            storefrontMode={storefrontMode}
            products={products}
            campaigns={campaigns}
            themes={themes}
            activeTheme={activeTheme}
            selectedCampaignSlug={selectedCampaignSlug}
            globalSearchQuery={globalSearchQuery}
            onNavigateHome={navigateHome}
            onNavigateAllProducts={navigateAllProducts}
            onSelectCampaignSlug={(slug) => {
              if (slug === 'all') {
                navigateHome();
              } else {
                navigateCampaign(slug);
              }
            }}
            onOpenProductDetail={(prod) => {
              setDetailProduct(prod);
              window.history.pushState({}, '', `/product/${prod.sku}`);
            }}
            onOpenBulkOrder={(prod, qty, campSlug) => handleOpenBulkOrderForProduct(prod, qty, campSlug)}
            onOpenMultiBulkOrder={(campSlug) => handleOpenMultiBulkOrder(campSlug)}
          />
        )}

        {mode === 'admin' && (
          <AdminDashboardView
            isAuthenticated={isAdminAuthenticated}
            adminEmail={adminEmail}
            onSignInGoogle={async () => {
              const user = await signInAdminWithGoogle();
              setIsAdminAuthenticated(true);
              setAdminEmail(user.email);
              sessionStorage.setItem('cmp_admin_auth', '1');
              if (user.email) sessionStorage.setItem('cmp_admin_email', user.email);
              await fetchAppState(false, true);
            }}
            onSignInDemoAdmin={(passcode) => {
              if (passcode.trim() === 'ADMIN-2026') {
                setIsAdminAuthenticated(true);
                setAdminEmail('simple.sooraj@gmail.com');
                sessionStorage.setItem('cmp_admin_auth', '1');
                sessionStorage.setItem('cmp_admin_email', 'simple.sooraj@gmail.com');
                fetchAppState(false, true);
                return true;
              }
              return false;
            }}
            onSignOut={async () => {
              await signOutAdmin().catch(() => {});
              setIsAdminAuthenticated(false);
              setAdminEmail(null);
              sessionStorage.removeItem('cmp_admin_auth');
              sessionStorage.removeItem('cmp_admin_email');
            }}
            activeSection={adminSection}
            onSelectSection={(sec) => navigateAdmin(sec)}
            products={products}
            themes={themes}
            activeTheme={activeTheme}
            previousThemeId={previousThemeId}
            campaigns={campaigns}
            bulkOrders={bulkOrders}
            catalogViews={catalogViews}
            onOpenAddProduct={() => {
              setProductToEdit(null);
              setEditorModalOpen(true);
            }}
            onOpenEditProduct={(prod) => {
              setProductToEdit(prod);
              setEditorModalOpen(true);
            }}
            onDeleteProduct={handleDeleteProduct}
            onBatchImportProducts={handleBatchImportProducts}
            onSaveAndActivateTheme={handleSaveAndActivateTheme}
            onActivateExistingTheme={handleActivateExistingTheme}
            onUpdateOrder={handleUpdateOrder}
            onSaveCampaign={handleSaveCampaign}
            onDeleteCampaign={handleDeleteCampaign}
            onOpenPublicCatalog={(slug) => navigateCampaign(slug)}
            onOpenBulkOrderModal={(prod, qty) => handleOpenBulkOrderForProduct(prod, qty)}
          />
        )}
      </main>

      {/* 9. Footer with Contact Details & Campaign Links */}
      <footer className="border-t border-stone-200 bg-white px-6 py-10 text-xs text-stone-600">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2 md:col-span-2">
            <div className="font-serif text-lg font-bold text-stone-900">
              Catalog Maker Pro — Campaign &amp; Bulk Commerce Storefront
            </div>
            <p className="text-stone-500 max-w-md leading-relaxed">
              Direct Moradabad artisanal brassware, luxury dry-fruit velvet trunks, and handloom silk gifting. Browse
              seasonal campaigns, shop individual units on verified marketplaces, or request custom B2B bulk quotes
              with full GST input tax credit.
            </p>
            <div className="pt-1 text-stone-700 font-medium tabular-nums">
              B2B Wholesale Desk: +91 98201 12233 · procurement@kansaheritage.in · Mumbai &amp; Moradabad
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-bold uppercase tracking-wider text-stone-900">Active Campaigns</div>
            <ul className="space-y-1.5">
              {publiclyActiveCampaigns.map((camp) => (
                <li key={camp.slug}>
                  <a
                    href={`/campaigns/${camp.slug}`}
                    onClick={(e) => {
                      e.preventDefault();
                      navigateCampaign(camp.slug);
                    }}
                    className="hover:text-amber-700 hover:underline"
                  >
                    {camp.name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <div className="font-bold uppercase tracking-wider text-stone-900">Quick Links</div>
            <ul className="space-y-1.5">
              <li>
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateHome();
                  }}
                  className="hover:text-stone-900 hover:underline"
                >
                  Storefront Homepage
                </a>
              </li>
              <li>
                <a
                  href="/shop"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateAllProducts();
                  }}
                  className="hover:text-stone-900 hover:underline"
                >
                  All Products Directory
                </a>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleOpenMultiBulkOrder()}
                  className="hover:text-stone-900 hover:underline text-left"
                >
                  Multi-SKU Bulk Order Form
                </button>
              </li>
              <li>
                <a
                  href="/admin/campaigns"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateAdmin('campaigns');
                  }}
                  className="hover:text-stone-900 hover:underline"
                >
                  Admin Campaign Manager
                </a>
              </li>
            </ul>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ProductDetailModal
        product={detailProduct}
        notFoundSku={notFoundSku}
        campaigns={campaigns}
        onClose={() => {
          setDetailProduct(null);
          setNotFoundSku(null);
          if (window.location.pathname.startsWith('/product/')) {
            window.history.pushState({}, '', '/');
          }
        }}
        onSelectCampaignSlug={(slug) => navigateCampaign(slug)}
        onBuyInBulk={(prod, qty, campSlug) => handleOpenBulkOrderForProduct(prod, qty, campSlug)}
      />

      <BulkOrderModal
        isOpen={bulkModalOpen}
        onClose={() => setBulkModalOpen(false)}
        initialItems={bulkInitialItems}
        allProducts={products}
        campaigns={campaigns}
        activeCampaignSlug={bulkModalCampaignSlug}
        onSubmitOrder={handleSubmitBulkOrder}
      />

      <ProductEditorModal
        isOpen={editorModalOpen}
        productToEdit={productToEdit}
        campaigns={campaigns}
        onClose={() => setEditorModalOpen(false)}
        onSaveProduct={handleSaveProduct}
        onDeleteProduct={handleDeleteProduct}
      />
    </div>
  );
}
