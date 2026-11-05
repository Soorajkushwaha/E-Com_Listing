import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { LogIn, Package, Search, User } from 'lucide-react';
import type {
  BulkOrder,
  BulkOrderItem,
  Campaign,
  CatalogTheme,
  CustomerProfile,
  DecorationDesign,
  DecorationPackage,
  DecorationTheme,
  DesignProductMapping,
  Occasion,
  PackageProductMapping,
  Product,
} from './types/catalog';
import {
  INITIAL_BULK_ORDERS,
  INITIAL_CAMPAIGNS,
  INITIAL_DECORATION_DESIGNS,
  INITIAL_DECORATION_THEMES,
  INITIAL_DESIGN_PRODUCTS,
  INITIAL_OCCASIONS,
  INITIAL_PACKAGES,
  INITIAL_PACKAGE_PRODUCTS,
  INITIAL_PRODUCTS,
  INITIAL_THEMES,
} from './utils/seedData';
import { formatINR, isCampaignPubliclyActive } from './utils/catalogLogic';
import {
  auth,
  batchImportProductsToFirestore,
  deleteCampaignFromFirestore,
  deleteDecorationDesignFromFirestore,
  deleteDecorationThemeFromFirestore,
  deleteOccasionFromFirestore,
  deletePackageFromFirestore,
  deleteProductFromFirestore,
  ensureCustomerProfileInFirestore,
  fetchActiveProductsFromFirestore,
  fetchAllCustomersFromFirestore,
  fetchCustomerOrdersFromFirestore,
  onAuthStateChanged,
  signInAdminWithGoogle,
  signOutAdmin,
  signOutCustomer,
  syncBulkOrderToFirestore,
  syncCampaignToFirestore,
  syncDecorationDesignToFirestore,
  syncDecorationThemeToFirestore,
  syncOccasionToFirestore,
  syncPackageToFirestore,
  syncProductToFirestore,
  syncThemeToFirestore,
  updateCustomerProfileInFirestore,
} from './lib/firebase';
import { ShopView, type StorefrontViewMode } from './components/ShopView';
import { AdminDashboardView, type AdminSection } from './components/AdminDashboardView';
import { BulkOrderModal, type BulkInquiryContext } from './components/BulkOrderModal';
import { ProductDetailModal } from './components/ProductDetailModal';
import { ProductEditorModal } from './components/ProductEditorModal';
import { CustomerAuthModal } from './components/CustomerAuthModal';
import {
  CustomerAccountDashboard,
  type CustomerAccountTab,
} from './components/CustomerAccountDashboard';
import type { BatchImportResult } from './components/ExcelImportPanel';

type AppMode = 'shop' | 'admin' | 'account';

const ADMIN_BOOTSTRAPPED_EMAIL = 'simple.sooraj@gmail.com';

export default function App() {
  const [mode, setMode] = useState<AppMode>('shop');
  const [storefrontMode, setStorefrontMode] = useState<StorefrontViewMode>('home');
  const [adminSection, setAdminSection] = useState<AdminSection>('overview');
  const [accountTab, setAccountTab] = useState<CustomerAccountTab>('overview');
  const [selectedCampaignSlug, setSelectedCampaignSlug] = useState<string>('all');
  const [selectedOccasionSlug, setSelectedOccasionSlug] = useState<string>('wedding');
  const [selectedDecorationThemeSlug, setSelectedDecorationThemeSlug] =
    useState<string>('royal-gold-wedding');
  const [selectedDesignSlug, setSelectedDesignSlug] = useState<string>(
    'royal-rajwada-mandap-brass-urli-ensemble'
  );
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');

  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [themes, setThemes] = useState<CatalogTheme[]>(INITIAL_THEMES);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);
  const [occasions, setOccasions] = useState<Occasion[]>(INITIAL_OCCASIONS);
  const [decorationThemes, setDecorationThemes] =
    useState<DecorationTheme[]>(INITIAL_DECORATION_THEMES);
  const [decorationDesigns, setDecorationDesigns] =
    useState<DecorationDesign[]>(INITIAL_DECORATION_DESIGNS);
  const [designProducts, setDesignProducts] =
    useState<DesignProductMapping[]>(INITIAL_DESIGN_PRODUCTS);
  const [packages, setPackages] = useState<DecorationPackage[]>(INITIAL_PACKAGES);
  const [packageProducts, setPackageProducts] =
    useState<PackageProductMapping[]>(INITIAL_PACKAGE_PRODUCTS);
  const [bulkOrders, setBulkOrders] = useState<BulkOrder[]>(INITIAL_BULK_ORDERS);
  const [registeredCustomers, setRegisteredCustomers] = useState<CustomerProfile[]>([]);
  const [activeThemeId, setActiveThemeId] = useState<string>('theme-diwali-gold');
  const [previousThemeId, setPreviousThemeId] = useState<string>('theme-minimal-white');
  const [catalogViews, setCatalogViews] = useState<number>(1420);

  // Customer Authentication & Profile State
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [customerOrders, setCustomerOrders] = useState<BulkOrder[]>([]);
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [pendingBulkOrderAfterAuth, setPendingBulkOrderAfterAuth] = useState<boolean>(false);

  // Admin Authentication State
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(() => {
    return sessionStorage.getItem('cmp_admin_auth') === '1';
  });
  const [adminEmail, setAdminEmail] = useState<string | null>(() => {
    return sessionStorage.getItem('cmp_admin_email');
  });

  // Modals & Unified Bulk Inquiry Basket State
  const [detailProduct, setDetailProduct] = useState<Product | null>(null);
  const [notFoundSku, setNotFoundSku] = useState<string | null>(null);
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkInitialItems, setBulkInitialItems] = useState<BulkOrderItem[]>([]);
  const [bulkModalCampaignSlug, setBulkModalCampaignSlug] = useState<string>('diwali-2026');
  const [inquiryContext, setInquiryContext] = useState<BulkInquiryContext>({});
  const [editorModalOpen, setEditorModalOpen] = useState<boolean>(false);
  const [productToEdit, setProductToEdit] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string>('');

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? '' : prev));
    }, 3500);
  }, []);

  // Attach the admin key (entered at /admin login, kept in sessionStorage) to API writes and the
  // admin state read, and surface 401s as a toast instead of failing silently.
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
      const path = new URL(urlStr, window.location.origin);
      const isOwnApi = path.origin === window.location.origin && path.pathname.startsWith('/api/');
      const adminKey = sessionStorage.getItem('cmp_admin_key');
      if (isOwnApi && adminKey && (method !== 'GET' || path.pathname === '/api/state')) {
        const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
        if (!headers.has('X-Admin-Key')) headers.set('X-Admin-Key', adminKey);
        init = { ...init, headers };
      }
      const resp = await originalFetch(input, init);
      if (isOwnApi && method !== 'GET' && resp.status === 401 && path.pathname !== '/api/admin/verify') {
        showToast('Not authorized: sign in to /admin with the admin access key to save changes.');
      } else if (isOwnApi && method !== 'GET' && resp.status === 503) {
        resp.clone().json().then((d) => d?.error && showToast(String(d.error))).catch(() => {});
      }
      return resp;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [showToast]);

  // Merge Firestore products with API products without losing any imported SKUs
  const mergeProductCatalogs = useCallback((baseProducts: Product[], extraProducts: Product[]): Product[] => {
    const bySku = new Map<string, Product>();
    for (const p of baseProducts) {
      if (p?.sku) bySku.set(p.sku.toUpperCase(), p);
    }
    for (const p of extraProducts) {
      if (p?.sku) {
        const key = p.sku.toUpperCase();
        const existing = bySku.get(key);
        if (!existing || (p.updatedAt && existing.updatedAt && p.updatedAt >= existing.updatedAt)) {
          bySku.set(key, p);
        }
      }
    }
    return Array.from(bySku.values());
  }, []);

  // Load state from backend API + Cloud Firestore persistent products
  const fetchAppState = useCallback(
    async (trackView = false, adminAuth = isAdminAuthenticated) => {
      let apiProducts: Product[] = [];
      try {
        const resp = await fetch(`/api/state${trackView ? '?trackView=1' : ''}`, {
          headers: {},
        });
        if (resp.ok) {
          const data = await resp.json();
          if (Array.isArray(data.products) && data.products.length > 0) {
            apiProducts = data.products;
            setProducts(data.products);
          }
          if (Array.isArray(data.themes) && data.themes.length > 0) setThemes(data.themes);
          if (Array.isArray(data.campaigns) && data.campaigns.length > 0) setCampaigns(data.campaigns);
          if (Array.isArray(data.occasions) && data.occasions.length > 0) setOccasions(data.occasions);
          if (Array.isArray(data.decorationThemes) && data.decorationThemes.length > 0) {
            setDecorationThemes(data.decorationThemes);
          }
          if (Array.isArray(data.decorationDesigns) && data.decorationDesigns.length > 0) {
            setDecorationDesigns(data.decorationDesigns);
          }
          if (Array.isArray(data.designProducts) && data.designProducts.length > 0) {
            setDesignProducts(data.designProducts);
          }
          if (Array.isArray(data.packages) && data.packages.length > 0) setPackages(data.packages);
          if (Array.isArray(data.packageProducts) && data.packageProducts.length > 0) {
            setPackageProducts(data.packageProducts);
          }
          if (data.activeThemeId) setActiveThemeId(data.activeThemeId);
          if (data.previousThemeId) setPreviousThemeId(data.previousThemeId);
          if (typeof data.catalogViews === 'number') setCatalogViews(data.catalogViews);
          if (adminAuth && Array.isArray(data.bulkOrders)) {
            setBulkOrders(data.bulkOrders);
          }
          if (adminAuth && Array.isArray(data.customers)) {
            setRegisteredCustomers(data.customers);
          }
        }
      } catch {
        // Fallback to initial seed state if offline
      }

      // Hydrate persistent products from Cloud Firestore (ensures Excel imports persist on Cloudflare)
      try {
        const firestoreProducts = await fetchActiveProductsFromFirestore();
        if (firestoreProducts.length > 0) {
          setProducts((prev) =>
            mergeProductCatalogs(apiProducts.length > 0 ? apiProducts : prev, firestoreProducts)
          );
        }
      } catch {
        // Ignore Firestore offline errors
      }

      if (adminAuth) {
        try {
          const fsCustomers = await fetchAllCustomersFromFirestore();
          if (fsCustomers.length > 0) {
            setRegisteredCustomers((prev) => {
              const map = new Map<string, CustomerProfile>();
              prev.forEach((c) => map.set(c.uid, c));
              fsCustomers.forEach((c) => map.set(c.uid, c));
              return Array.from(map.values());
            });
          }
        } catch {
          // Ignore if admin not signed in with Firebase Auth
        }
      }
    },
    [isAdminAuthenticated, mergeProductCatalogs]
  );

  // Load customer's own orders from API and Firestore
  const refreshCustomerOrders = useCallback(async (profile: CustomerProfile) => {
    const mergedMap = new Map<string, BulkOrder>();
    try {
      const params = new URLSearchParams({
        email: profile.email || '',
        phone: profile.whatsappNumber || profile.phoneNumber || '',
      });
      const resp = await fetch(`/api/orders/customer/${encodeURIComponent(profile.uid)}?${params.toString()}`);
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data.orders)) {
          data.orders.forEach((o: BulkOrder) => mergedMap.set(o.orderRef || o.id, o));
        }
      }
    } catch {
      // Ignore API error
    }

    try {
      const fsOrders = await fetchCustomerOrdersFromFirestore(profile.uid);
      fsOrders.forEach((o) => mergedMap.set(o.orderRef || o.id, o));
    } catch {
      // Ignore Firestore error
    }

    setCustomerOrders(
      Array.from(mergedMap.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    );
  }, []);

  const applyRouteFromPath = useCallback(
    (path: string, currentProducts: Product[]) => {
      setNotFoundSku(null);
      if (path === '/login' || path === '/register') {
        setAuthModalOpen(true);
        setMode('shop');
        return;
      }
      if (path === '/account' || path.startsWith('/account/')) {
        const sub = path.replace('/account', '').replace(/^\//, '').split('/')[0];
        if (sub === 'profile') setAccountTab('profile');
        else if (sub === 'orders') setAccountTab('orders');
        else if (sub === 'addresses') setAccountTab('addresses');
        else setAccountTab('overview');
        setMode('account');
        return;
      }
      if (path === '/occasions') {
        setStorefrontMode('occasions');
        setMode('shop');
        return;
      }
      const OCCASION_ALIASES: Record<string, string> = {
        birthday: 'birthday-parties',
        diwali: 'festivals',
        '/festivals': 'festivals',
        '/corporate-events': 'corporate-events',
      };
      if (OCCASION_ALIASES[path]) {
        window.history.replaceState({}, '', `/occasions/${OCCASION_ALIASES[path]}`);
        path = `/occasions/${OCCASION_ALIASES[path]}`;
      }
      if (path.startsWith('/occasions/')) {
        const rawSlug = path.replace('/occasions/', '').split('/')[0].trim();
        const slug = OCCASION_ALIASES[rawSlug] || rawSlug;
        if (slug) {
          setSelectedOccasionSlug(slug);
          setStorefrontMode('occasion-detail');
          setMode('shop');
          return;
        }
      }
      if (path.startsWith('/themes/')) {
        const slug = path.replace('/themes/', '').split('/')[0].trim();
        if (slug) {
          setSelectedDecorationThemeSlug(slug);
          setStorefrontMode('theme-detail');
          setMode('shop');
          return;
        }
      }
      if (path === '/designs' || path === '/decoration-ideas') {
        setStorefrontMode('designs');
        setMode('shop');
        return;
      }
      if (path.startsWith('/designs/')) {
        const slug = path.replace('/designs/', '').split('/')[0].trim();
        if (slug) {
          setSelectedDesignSlug(slug);
          setStorefrontMode('design-detail');
          setMode('shop');
          return;
        }
      }
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
        if (sub === 'occasions') setAdminSection('occasions');
        else if (sub === 'decoration-themes') setAdminSection('decoration-themes');
        else if (sub === 'decoration-designs') setAdminSection('decoration-designs');
        else if (sub === 'packages') setAdminSection('packages');
        else if (sub === 'products') setAdminSection('products');
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
      // Default: Homepage (/)
      setSelectedCampaignSlug('all');
      setStorefrontMode('home');
      setMode('shop');
    },
    []
  );

  // Product deep links (/product/SKU) are parsed before /api/state loads; resolve once products arrive
  useEffect(() => {
    if (!notFoundSku) return;
    const found = products.find((p) => p.sku.toUpperCase() === notFoundSku && p.status === 'active');
    if (found) {
      setDetailProduct(found);
      setNotFoundSku(null);
    }
  }, [products, notFoundSku]);

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

  // Listen to Firebase Auth state for both Customer and Admin sessions
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const profile = await ensureCustomerProfileInFirestore(user);
          setCustomerProfile(profile);
          // Sync customer profile to backend store as well
          await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile),
          }).catch(() => {});
          await refreshCustomerOrders(profile);
        } catch {
          // Ignore transient profile sync error
        }

        if (
          user.emailVerified &&
          user.email &&
          user.email.toLowerCase() === ADMIN_BOOTSTRAPPED_EMAIL.toLowerCase()
        ) {
          setIsAdminAuthenticated(true);
          setAdminEmail(user.email);
          sessionStorage.setItem('cmp_admin_auth', '1');
          sessionStorage.setItem('cmp_admin_email', user.email);
          fetchAppState(false, true);
        }
      } else {
        setCustomerProfile(null);
        setCustomerOrders([]);
      }
    });
    return () => unsub();
  }, [fetchAppState, refreshCustomerOrders]);

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
    if (mode === 'account') {
      document.title = 'My Account — DesiDiya | Lighting Up Every Celebration';
      return;
    }
    if (mode === 'shop' && storefrontMode === 'occasion-detail') {
      const occ = occasions.find((o) => o.slug === selectedOccasionSlug);
      if (occ) {
        document.title = `${occ.name} Decoration Themes & Bulk Shopping — DesiDiya`;
        return;
      }
    }
    if (mode === 'shop' && storefrontMode === 'theme-detail') {
      const thm = decorationThemes.find((t) => t.slug === selectedDecorationThemeSlug);
      if (thm) {
        document.title = `${thm.title} — Decoration Ideas & Bulk Inquiry — DesiDiya`;
        return;
      }
    }
    if (mode === 'shop' && storefrontMode === 'design-detail') {
      const d = decorationDesigns.find((item) => item.slug === selectedDesignSlug);
      if (d) {
        document.title = `${d.title} — Complete Product Bill of Materials — DesiDiya`;
        return;
      }
    }
    if (mode === 'shop' && storefrontMode === 'campaign' && selectedCampaignSlug !== 'all') {
      const camp = campaigns.find((c) => c.slug === selectedCampaignSlug);
      if (camp) {
        document.title = `${camp.name} — DesiDiya Bulk Shopping & Wholesale Storefront`;
        return;
      }
    }
    if (mode === 'admin') {
      document.title = 'Admin Console — DesiDiya | Lighting Up Every Celebration';
    } else if (storefrontMode === 'all-products') {
      document.title = 'Shop All Products — DesiDiya | Lighting Up Every Celebration';
    } else {
      document.title = 'DesiDiya — Lighting Up Every Celebration | Occasion Decoration & Bulk Shopping';
    }
  }, [
    mode,
    storefrontMode,
    selectedCampaignSlug,
    selectedOccasionSlug,
    selectedDecorationThemeSlug,
    selectedDesignSlug,
    campaigns,
    occasions,
    decorationThemes,
    decorationDesigns,
  ]);

  const navigateHome = () => {
    setMode('shop');
    setStorefrontMode('home');
    setSelectedCampaignSlug('all');
    window.history.pushState({}, '', '/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateAllProducts = () => {
    setMode('shop');
    setStorefrontMode('all-products');
    setSelectedCampaignSlug('all');
    window.history.pushState({}, '', '/shop');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateOccasions = () => {
    setMode('shop');
    setStorefrontMode('occasions');
    window.history.pushState({}, '', '/occasions');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateOccasionSlug = (slug: string) => {
    setMode('shop');
    setSelectedOccasionSlug(slug);
    setStorefrontMode('occasion-detail');
    window.history.pushState({}, '', `/occasions/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateDecorationThemeSlug = (slug: string) => {
    setMode('shop');
    setSelectedDecorationThemeSlug(slug);
    setStorefrontMode('theme-detail');
    window.history.pushState({}, '', `/themes/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateDesigns = () => {
    setMode('shop');
    setStorefrontMode('designs');
    window.history.pushState({}, '', '/designs');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateDesignSlug = (slug: string) => {
    setMode('shop');
    setSelectedDesignSlug(slug);
    setStorefrontMode('design-detail');
    window.history.pushState({}, '', `/designs/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateCampaign = (slug: string) => {
    setMode('shop');
    setStorefrontMode('campaign');
    setSelectedCampaignSlug(slug);
    window.history.pushState({}, '', `/campaigns/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateAccount = (tab: CustomerAccountTab = 'overview') => {
    if (!customerProfile) {
      setPendingBulkOrderAfterAuth(false);
      setAuthModalOpen(true);
      return;
    }
    setMode('account');
    setAccountTab(tab);
    const subPath = tab === 'overview' ? '/account' : `/account/${tab}`;
    window.history.pushState({}, '', subPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const navigateAdmin = (sec: AdminSection = 'overview') => {
    setMode('admin');
    setAdminSection(sec);
    const subPath = sec === 'overview' ? '/admin' : sec === 'excel' ? '/admin/import' : `/admin/${sec}`;
    window.history.pushState({}, '', subPath);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Unified Basket Handler: combines products from Shop, Designs, Occasions, Themes, and Packages
  const handleAddItemsToBasket = useCallback(
    (
      newItems: BulkOrderItem[],
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
    ) => {
      setBulkInitialItems((prev) => {
        const merged = [...prev];
        for (const incoming of newItems) {
          const existingIdx = merged.findIndex((i) => i.sku === incoming.sku);
          if (existingIdx >= 0) {
            merged[existingIdx] = {
              ...merged[existingIdx],
              requestedQuantity: merged[existingIdx].requestedQuantity + incoming.requestedQuantity,
              sourceLabel: incoming.sourceLabel || merged[existingIdx].sourceLabel,
            };
          } else {
            merged.push(incoming);
          }
        }
        return merged;
      });

      if (context) {
        setInquiryContext((prev) => {
          const nextDesignIds = context.designId
            ? Array.from(new Set([...(prev.selectedDesignIds || []), context.designId]))
            : prev.selectedDesignIds;
          const nextDesignNames = context.designTitle
            ? Array.from(new Set([...(prev.selectedDesignNames || []), context.designTitle]))
            : prev.selectedDesignNames;
          return {
            ...prev,
            occasionSlug: context.occasionSlug || prev.occasionSlug,
            occasionName: context.occasionName || prev.occasionName,
            decorationThemeSlug: context.decorationThemeSlug || prev.decorationThemeSlug,
            decorationThemeName: context.decorationThemeName || prev.decorationThemeName,
            selectedDesignIds: nextDesignIds,
            selectedDesignNames: nextDesignNames,
            packageId: context.packageId || prev.packageId,
            packageName: context.packageName || prev.packageName,
          };
        });
      }

      if (context?.openModalImmediately) {
        setBulkModalOpen(true);
      } else {
        showToast(
          `Added ${newItems.length} product${newItems.length === 1 ? '' : 's'} to Bulk Inquiry Basket!`
        );
      }
    },
    [showToast]
  );

  const handleOpenBulkOrderForProduct = (product: Product, quantity = 25, campaignSlug?: string) => {
    handleAddItemsToBasket(
      [
        {
          productId: product.id,
          sku: product.sku,
          productName: product.name,
          unitPrice: product.sellingPrice,
          mrp: product.mrp,
          requestedQuantity: quantity,
          quantityUnit: 'pcs',
          sourceLabel: 'Direct Shop Selection',
        },
      ],
      { openModalImmediately: true }
    );
    setBulkModalCampaignSlug(
      campaignSlug ||
        (selectedCampaignSlug !== 'all' ? selectedCampaignSlug : product.campaign || 'diwali-2026')
    );
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
          quantityUnit: 'pcs',
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
    const enrichedPayload: Partial<BulkOrder> = {
      ...payload,
      ownerId: customerProfile?.uid || payload.ownerId || 'customer-portal',
      email: payload.email || customerProfile?.email || '',
    };

    const resp = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(enrichedPayload),
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(data.error || 'Failed to submit bulk order request.');
    }
    const created: BulkOrder = data.order;
    setBulkOrders((prev) => [created, ...prev]);
    setCustomerOrders((prev) => [created, ...prev]);
    await syncBulkOrderToFirestore(created).catch(() => {});
    showToast(`Bulk Order Request ${created.orderRef} submitted!`);
    return created;
  };

  // Update Customer Profile in Firestore & Backend API
  const handleUpdateCustomerProfile = async (
    updates: Partial<CustomerProfile>
  ): Promise<CustomerProfile> => {
    if (!customerProfile) {
      throw new Error('Customer session not found.');
    }
    const updated = await updateCustomerProfileInFirestore(customerProfile.uid, updates);
    setCustomerProfile(updated);
    await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated),
    }).catch(() => {});
    showToast('Your DesiDiya account profile has been updated.');
    return updated;
  };

  // Admin Update Customer Notes & Account Status
  const handleUpdateCustomerAdminNotes = async (
    uid: string,
    updates: { internalNotes: string; accountStatus: 'active' | 'suspended' }
  ) => {
    const existing = registeredCustomers.find((c) => c.uid === uid);
    if (existing) {
      const updated = await updateCustomerProfileInFirestore(uid, updates);
      setRegisteredCustomers((prev) => prev.map((c) => (c.uid === uid ? updated : c)));
    }
    const resp = await fetch(`/api/customers/${encodeURIComponent(uid)}/admin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data.customers)) {
        setRegisteredCustomers(data.customers);
      }
    }
    showToast('Saved customer CRM notes & status.');
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
    const resp = await fetch(`/api/products/${encodeURIComponent(productId)}`, { method: 'DELETE' });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      showToast(`Failed to delete product: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      if (Array.isArray(data.designProducts)) setDesignProducts(data.designProducts);
      if (Array.isArray(data.packageProducts)) setPackageProducts(data.packageProducts);
      await deleteProductFromFirestore(productId).catch(() => {});
      showToast('Product deleted from storefront.');
    }
  };

  // Phase 2: Full Excel Batch Import to API AND Cloud Firestore with Live Progress
  const handleBatchImportProducts = async (
    validProducts: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
    duplicateMode: 'update' | 'skip',
    onProgress?: (completed: number, total: number) => void
  ): Promise<BatchImportResult> => {
    const resp = await fetch('/api/products/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: validProducts, duplicateMode }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Batch import failed.');

    const savedProducts: Product[] = Array.isArray(data.savedProducts) ? data.savedProducts : [];
    if (Array.isArray(data.products)) {
      setProducts((prev) => mergeProductCatalogs(prev, data.products));
    }

    // Write all imported products to Cloud Firestore in safe batches
    const fsResult = await batchImportProductsToFirestore(savedProducts, onProgress);

    showToast(
      `Imported ${data.added} new and updated ${data.updated} products (${fsResult.firestoreSynced} synced to database)!`
    );

    return {
      added: data.added,
      updated: data.updated,
      skipped: data.skipped,
      firestoreSynced: fsResult.firestoreSynced,
      firestoreError: fsResult.firestoreError,
    };
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
    if (data.order) {
      await syncBulkOrderToFirestore(data.order).catch(() => {});
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

  // Occasion, Theme, Design & Package Admin Handlers
  const handleSaveOccasion = async (occInput: Partial<Occasion>) => {
    const resp = await fetch('/api/occasions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(occInput),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !(Array.isArray(data.occasions))) {
      showToast(`Failed to save occasion: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    if (resp.ok && Array.isArray(data.occasions)) {
      setOccasions(data.occasions);
      if (data.occasion) {
        await syncOccasionToFirestore(data.occasion).catch(() => {});
      }
      showToast(`Saved occasion "${data.occasion?.name}" (/occasions/${data.occasion?.slug})`);
    }
  };

  const handleDeleteOccasion = async (occasionId: string) => {
    const resp = await fetch(`/api/occasions/${occasionId}`, { method: 'DELETE' });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      showToast(`Failed to delete occasion: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    if (resp.ok && Array.isArray(data.occasions)) {
      setOccasions(data.occasions);
      await deleteOccasionFromFirestore(occasionId).catch(() => {});
      showToast('Occasion deleted.');
    }
  };

  const handleSaveDecorationTheme = async (themeInput: Partial<DecorationTheme>) => {
    const resp = await fetch('/api/decoration-themes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(themeInput),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !(Array.isArray(data.decorationThemes))) {
      showToast(`Failed to save decoration theme: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    if (resp.ok && Array.isArray(data.decorationThemes)) {
      setDecorationThemes(data.decorationThemes);
      if (data.decorationTheme) {
        await syncDecorationThemeToFirestore(data.decorationTheme).catch(() => {});
      }
      showToast(`Saved decoration theme "${data.decorationTheme?.title}"`);
    }
  };

  const handleDeleteDecorationTheme = async (themeId: string) => {
    const resp = await fetch(`/api/decoration-themes/${themeId}`, { method: 'DELETE' });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      showToast(`Failed to delete decoration theme: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    if (resp.ok && Array.isArray(data.decorationThemes)) {
      setDecorationThemes(data.decorationThemes);
      await deleteDecorationThemeFromFirestore(themeId).catch(() => {});
      showToast('Decoration theme deleted.');
    }
  };

  const handleSaveDecorationDesign = async (
    designInput: Partial<DecorationDesign>,
    mappings: Partial<DesignProductMapping>[]
  ) => {
    const resp = await fetch('/api/decoration-designs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ design: designInput, mappings }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !(data.decorationDesign)) {
      showToast(`Failed to save design: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    if (resp.ok) {
      if (Array.isArray(data.decorationDesigns)) setDecorationDesigns(data.decorationDesigns);
      if (Array.isArray(data.designProducts)) setDesignProducts(data.designProducts);
      if (data.decorationDesign) {
        const savedMappings = (data.designProducts || []).filter(
          (m: DesignProductMapping) => m.designId === data.decorationDesign.id
        );
        await syncDecorationDesignToFirestore(data.decorationDesign, savedMappings).catch(() => {});
      }
      showToast(`Saved design "${data.decorationDesign?.title}" & product mappings!`);
    }
  };

  const handleDeleteDecorationDesign = async (designId: string) => {
    const resp = await fetch(`/api/decoration-designs/${designId}`, { method: 'DELETE' });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      showToast(`Failed to delete design: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    if (resp.ok) {
      if (Array.isArray(data.decorationDesigns)) setDecorationDesigns(data.decorationDesigns);
      if (Array.isArray(data.designProducts)) setDesignProducts(data.designProducts);
      await deleteDecorationDesignFromFirestore(designId).catch(() => {});
      showToast('Decoration design deleted.');
    }
  };

  const handleSavePackage = async (
    pkgInput: Partial<DecorationPackage>,
    mappings: Partial<PackageProductMapping>[]
  ) => {
    const resp = await fetch('/api/packages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pkg: pkgInput, mappings }),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !(data.package)) {
      showToast(`Failed to save package: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    if (resp.ok) {
      if (Array.isArray(data.packages)) setPackages(data.packages);
      if (Array.isArray(data.packageProducts)) setPackageProducts(data.packageProducts);
      if (data.package) {
        const savedMappings = (data.packageProducts || []).filter(
          (m: PackageProductMapping) => m.packageId === data.package.id
        );
        await syncPackageToFirestore(data.package, savedMappings).catch(() => {});
      }
      showToast(`Saved package "${data.package?.name}"!`);
    }
  };

  const handleDeletePackage = async (packageId: string) => {
    const resp = await fetch(`/api/packages/${packageId}`, { method: 'DELETE' });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data) {
      showToast(`Failed to delete package: ${data?.error || `server returned ${resp.status}`}`);
      return;
    }
    if (resp.ok) {
      if (Array.isArray(data.packages)) setPackages(data.packages);
      if (Array.isArray(data.packageProducts)) setPackageProducts(data.packageProducts);
      await deletePackageFromFirestore(packageId).catch(() => {});
      showToast('Bulk package deleted.');
    }
  };

  const totalBasketUnits = useMemo(
    () => bulkInitialItems.reduce((sum, item) => sum + item.requestedQuantity, 0),
    [bulkInitialItems]
  );

  const totalBasketValue = useMemo(
    () =>
      bulkInitialItems.reduce(
        (sum, item) => sum + item.unitPrice * Math.max(1, item.requestedQuantity),
        0
      ),
    [bulkInitialItems]
  );

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 text-stone-900">
      {/* 1. Official DesiDiya Brand Header with Logo, Search, Navigation & Customer Account */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto max-w-7xl flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 py-2.5">
          {/* Official Uploaded DesiDiya Logo & Tagline */}
          <div className="flex items-center gap-3 shrink-0">
            <a
              href="/"
              onClick={(e) => {
                e.preventDefault();
                navigateHome();
              }}
              className="flex items-center gap-2.5 shrink-0"
              aria-label="DesiDiya — Lighting Up Every Celebration"
            >
              <img
                src="/assets/aistudio/logo_3e12495b.png"
                alt="DesiDiya — Lighting Up Every Celebration"
                className="h-10 sm:h-11 w-auto object-contain"
              />
            </a>
            <span className="hidden xl:inline-block text-[11px] font-semibold text-amber-800 border-l border-stone-200 pl-3">
              Lighting Up Every Celebration
            </span>
          </div>

          {/* Global Header Search */}
          <div className="hidden lg:block relative flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
            <input
              type="search"
              aria-label="Global product search"
              placeholder="Search urlis, diyas, backdrops, SKUs..."
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
            className="hidden md:flex items-center gap-3.5 text-xs font-semibold text-stone-600"
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
              Home
            </a>

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
              Shop All
            </a>

            <a
              href="/occasions"
              onClick={(e) => {
                e.preventDefault();
                navigateOccasions();
              }}
              className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'shop' && storefrontMode === 'occasions'
                  ? 'text-amber-700 underline underline-offset-4'
                  : ''
              }`}
            >
              Occasions
            </a>

            <a
              href="/occasions/wedding"
              onClick={(e) => {
                e.preventDefault();
                navigateOccasionSlug('wedding');
              }}
              className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'shop' &&
                storefrontMode === 'occasion-detail' &&
                selectedOccasionSlug === 'wedding'
                  ? 'text-amber-700 underline underline-offset-4'
                  : ''
              }`}
            >
              Wedding
            </a>

            <a
              href="/occasions/birthday"
              onClick={(e) => {
                e.preventDefault();
                navigateOccasionSlug('birthday-parties');
              }}
              className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'shop' &&
                storefrontMode === 'occasion-detail' &&
                selectedOccasionSlug === 'birthday-parties'
                  ? 'text-amber-700 underline underline-offset-4'
                  : ''
              }`}
            >
              Birthday &amp; Parties
            </a>

            <a
              href="/occasions/corporate-events"
              onClick={(e) => {
                e.preventDefault();
                navigateOccasionSlug('corporate-events');
              }}
              className={`hidden 2xl:inline hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'shop' &&
                storefrontMode === 'occasion-detail' &&
                selectedOccasionSlug === 'corporate-events'
                  ? 'text-amber-700 underline underline-offset-4'
                  : ''
              }`}
            >
              Corporate Events
            </a>

            <a
              href="/occasions/diwali"
              onClick={(e) => {
                e.preventDefault();
                navigateOccasionSlug('festivals');
              }}
              className={`hidden xl:inline hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'shop' &&
                storefrontMode === 'occasion-detail' &&
                selectedOccasionSlug === 'festivals'
                  ? 'text-amber-700 underline underline-offset-4'
                  : ''
              }`}
            >
              Festivals
            </a>

            <a
              href="/designs"
              onClick={(e) => {
                e.preventDefault();
                navigateDesigns();
              }}
              className={`hover:text-stone-950 transition-colors whitespace-nowrap shrink-0 ${
                mode === 'shop' &&
                (storefrontMode === 'designs' || storefrontMode === 'design-detail')
                  ? 'text-amber-700 underline underline-offset-4'
                  : ''
              }`}
            >
              Decoration Ideas
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
              Admin
            </a>
          </nav>

          {/* Customer Account + Bulk Orders Basket Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {customerProfile ? (
              <button
                type="button"
                onClick={() => navigateAccount('overview')}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  mode === 'account'
                    ? 'border-amber-600 bg-amber-50 text-amber-900'
                    : 'border-stone-200 bg-white text-stone-800 hover:bg-stone-50'
                }`}
              >
                {customerProfile.photoURL ? (
                  <img
                    src={customerProfile.photoURL}
                    alt={customerProfile.fullName}
                    className="h-4 w-4 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="h-3.5 w-3.5 text-amber-700" />
                )}
                <span className="max-w-[100px] truncate">
                  {customerProfile.fullName.split(' ')[0] || 'Account'}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setPendingBulkOrderAfterAuth(false);
                  setAuthModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors whitespace-nowrap"
              >
                <LogIn className="h-3.5 w-3.5 text-amber-700" />
                <span>Sign In</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenMultiBulkOrder()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors whitespace-nowrap shrink-0"
            >
              <Package className="h-3.5 w-3.5 text-amber-400" />
              <span>Bulk Orders</span>
              {bulkInitialItems.length > 0 && (
                <span className="ml-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-stone-950 tabular-nums">
                  {bulkInitialItems.length}
                </span>
              )}
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
            Home
          </button>
          <button
            type="button"
            onClick={navigateAllProducts}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' && storefrontMode === 'all-products' ? 'bg-stone-900 text-white' : ''
            }`}
          >
            Shop All
          </button>
          <button
            type="button"
            onClick={navigateOccasions}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' && storefrontMode === 'occasions' ? 'bg-amber-600 text-white' : ''
            }`}
          >
            Occasions
          </button>
          <button
            type="button"
            onClick={() => navigateOccasionSlug('wedding')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' &&
              storefrontMode === 'occasion-detail' &&
              selectedOccasionSlug === 'wedding'
                ? 'bg-amber-600 text-white'
                : ''
            }`}
          >
            Wedding
          </button>
          <button
            type="button"
            onClick={() => navigateOccasionSlug('birthday-parties')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' &&
              storefrontMode === 'occasion-detail' &&
              selectedOccasionSlug === 'birthday-parties'
                ? 'bg-amber-600 text-white'
                : ''
            }`}
          >
            Birthday &amp; Parties
          </button>
          <button
            type="button"
            onClick={() => navigateOccasionSlug('corporate-events')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' &&
              storefrontMode === 'occasion-detail' &&
              selectedOccasionSlug === 'corporate-events'
                ? 'bg-amber-600 text-white'
                : ''
            }`}
          >
            Corporate Events
          </button>
          <button
            type="button"
            onClick={() => navigateOccasionSlug('festivals')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' &&
              storefrontMode === 'occasion-detail' &&
              selectedOccasionSlug === 'festivals'
                ? 'bg-amber-600 text-white'
                : ''
            }`}
          >
            Festivals
          </button>
          <button
            type="button"
            onClick={navigateDesigns}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'shop' &&
              (storefrontMode === 'designs' || storefrontMode === 'design-detail')
                ? 'bg-amber-600 text-white'
                : ''
            }`}
          >
            Decoration Ideas
          </button>
          <button
            type="button"
            onClick={() => navigateAccount('overview')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'account' ? 'bg-amber-600 text-white' : ''
            }`}
          >
            {customerProfile ? 'My Account' : 'Sign In'}
          </button>
          <button
            type="button"
            onClick={() => navigateAdmin('overview')}
            className={`px-3 py-1 rounded-md whitespace-nowrap ${
              mode === 'admin' ? 'bg-stone-900 text-white' : ''
            }`}
          >
            Admin
          </button>
        </div>
      </header>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-16 right-5 z-50 rounded-xl border border-stone-700 bg-stone-900 px-4 py-3 text-xs font-semibold text-white shadow-xl"
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
            occasions={occasions}
            decorationThemes={decorationThemes}
            decorationDesigns={decorationDesigns}
            designProducts={designProducts}
            packages={packages}
            packageProducts={packageProducts}
            selectedCampaignSlug={selectedCampaignSlug}
            selectedOccasionSlug={selectedOccasionSlug}
            selectedDecorationThemeSlug={selectedDecorationThemeSlug}
            selectedDesignSlug={selectedDesignSlug}
            globalSearchQuery={globalSearchQuery}
            onNavigateHome={navigateHome}
            onNavigateAllProducts={navigateAllProducts}
            onNavigateOccasions={navigateOccasions}
            onSelectOccasionSlug={navigateOccasionSlug}
            onSelectDecorationThemeSlug={navigateDecorationThemeSlug}
            onNavigateDesigns={navigateDesigns}
            onSelectDesignSlug={navigateDesignSlug}
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
            onAddItemsToBasket={handleAddItemsToBasket}
          />
        )}

        {mode === 'account' &&
          (customerProfile ? (
            <CustomerAccountDashboard
              customer={customerProfile}
              customerOrders={customerOrders}
              activeTab={accountTab}
              onSelectTab={(tab) => navigateAccount(tab)}
              onUpdateProfile={handleUpdateCustomerProfile}
              onSignOut={async () => {
                await signOutCustomer().catch(() => {});
                setCustomerProfile(null);
                setCustomerOrders([]);
                navigateHome();
                showToast('Signed out of your DesiDiya account.');
              }}
              onNavigateShop={navigateHome}
              onOpenSignInModal={() => setAuthModalOpen(true)}
            />
          ) : (
            <div className="mx-auto max-w-md px-4 py-16 text-center space-y-4">
              <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm space-y-4">
                <img
                  src="/assets/aistudio/logo_3e12495b.png"
                  alt="DesiDiya — Lighting Up Every Celebration"
                  className="mx-auto h-14 w-auto object-contain"
                />
                <h1 className="text-xl font-bold text-stone-900">Sign In to Your DesiDiya Account</h1>
                <p className="text-xs text-stone-500">
                  Access your saved profile, delivery addresses, bulk order inquiries, and official GST quotations.
                </p>
                <button
                  type="button"
                  onClick={() => setAuthModalOpen(true)}
                  className="w-full rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                >
                  Sign In or Create Account
                </button>
              </div>
            </div>
          ))}

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
            onSignInDemoAdmin={async (passcode) => {
              const key = passcode.trim();
              if (!key) return false;
              // Verified server-side against the ADMIN_KEY worker secret; never checked in the bundle
              const resp = await fetch('/api/admin/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-Admin-Key': key },
                body: '{}',
              }).catch(() => null);
              if (!resp || !resp.ok) return false;
              sessionStorage.setItem('cmp_admin_key', key);
              setIsAdminAuthenticated(true);
              setAdminEmail(ADMIN_BOOTSTRAPPED_EMAIL);
              sessionStorage.setItem('cmp_admin_auth', '1');
              sessionStorage.setItem('cmp_admin_email', ADMIN_BOOTSTRAPPED_EMAIL);
              fetchAppState(false, true);
              return true;
            }}
            onSignOut={async () => {
              await signOutAdmin().catch(() => {});
              setIsAdminAuthenticated(false);
              setAdminEmail(null);
              sessionStorage.removeItem('cmp_admin_auth');
              sessionStorage.removeItem('cmp_admin_key');
              sessionStorage.removeItem('cmp_admin_email');
            }}
            activeSection={adminSection}
            onSelectSection={(sec) => navigateAdmin(sec)}
            products={products}
            themes={themes}
            activeTheme={activeTheme}
            previousThemeId={previousThemeId}
            campaigns={campaigns}
            occasions={occasions}
            decorationThemes={decorationThemes}
            decorationDesigns={decorationDesigns}
            designProducts={designProducts}
            packages={packages}
            packageProducts={packageProducts}
            bulkOrders={bulkOrders}
            registeredCustomers={registeredCustomers}
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
            onUpdateCustomerAdminNotes={handleUpdateCustomerAdminNotes}
            onSaveCampaign={handleSaveCampaign}
            onDeleteCampaign={handleDeleteCampaign}
            onSaveOccasion={handleSaveOccasion}
            onDeleteOccasion={handleDeleteOccasion}
            onSaveDecorationTheme={handleSaveDecorationTheme}
            onDeleteDecorationTheme={handleDeleteDecorationTheme}
            onSaveDecorationDesign={handleSaveDecorationDesign}
            onDeleteDecorationDesign={handleDeleteDecorationDesign}
            onSavePackage={handleSavePackage}
            onDeletePackage={handleDeletePackage}
            onOpenPublicCatalog={(slug) => navigateCampaign(slug)}
            onOpenPublicOccasion={(slug) => navigateOccasionSlug(slug)}
            onOpenPublicTheme={(slug) => navigateDecorationThemeSlug(slug)}
            onOpenPublicDesign={(slug) => navigateDesignSlug(slug)}
            onOpenBulkOrderModal={(prod, qty) => handleOpenBulkOrderForProduct(prod, qty)}
          />
        )}
      </main>

      {/* Sticky Bulk Inquiry Basket Bar when customer has added products from designs/packages/shop */}
      {mode === 'shop' && bulkInitialItems.length > 0 && !bulkModalOpen && (
        <div className="sticky bottom-0 z-30 border-t border-stone-800 bg-stone-950/95 text-white px-4 py-2.5 shadow-xl backdrop-blur-xs">
          <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs tabular-nums">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500 text-stone-950 font-bold">
                {bulkInitialItems.length}
              </span>
              <div>
                <div className="font-bold text-white">
                  DesiDiya Bulk Inquiry Basket · {totalBasketUnits} Total Units
                </div>
                <div className="text-[11px] text-stone-400">
                  Indicative Estimate: <strong className="text-amber-300">{formatINR(totalBasketValue)}</strong>
                  {inquiryContext.occasionName ? ` · ${inquiryContext.occasionName}` : ''}
                  {inquiryContext.decorationThemeName ? ` (${inquiryContext.decorationThemeName})` : ''}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setBulkInitialItems([])}
                className="rounded-lg border border-stone-700 px-3 py-1.5 text-xs font-medium text-stone-300 hover:bg-stone-800"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setBulkModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-1.5 text-xs font-bold text-stone-950 hover:bg-amber-400 transition-colors"
              >
                <Package className="h-3.5 w-3.5" />
                Review &amp; Request Bulk Quote
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official DesiDiya Footer with Uploaded Logo, Occasion Links, Campaign Links & Account Links */}
      <footer className="border-t border-stone-200 bg-white px-6 py-10 text-xs text-stone-600">
        <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-2.5 md:col-span-1">
            <img
              src="/assets/aistudio/logo_3e12495b.png"
              alt="DesiDiya — Lighting Up Every Celebration"
              className="h-11 w-auto object-contain"
            />
            <div className="font-serif text-base font-bold text-stone-900">
              DesiDiya — Lighting Up Every Celebration
            </div>
            <p className="text-stone-500 leading-relaxed">
              Explore curated decoration themes for Weddings, Birthdays, Corporate Events, and Diwali. Discover every
              brass urli, diya, and backdrop product used in each setup and submit a unified bulk inquiry for GST
              quotations.
            </p>
            <div className="pt-1 text-stone-700 font-medium tabular-nums">
              B2B Wholesale Desk: +91 98201 12233 · support@desidiya.in
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-bold uppercase tracking-wider text-stone-900">Shop by Occasion</div>
            <ul className="space-y-1.5">
              {occasions
                .filter((o) => o.status === 'active')
                .slice(0, 6)
                .map((occ) => (
                  <li key={occ.id}>
                    <a
                      href={`/occasions/${occ.slug}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigateOccasionSlug(occ.slug);
                      }}
                      className="hover:text-amber-700 hover:underline"
                    >
                      {occ.name}
                    </a>
                  </li>
                ))}
            </ul>
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
            <div className="font-bold uppercase tracking-wider text-stone-900">Customer &amp; Admin Portal</div>
            <ul className="space-y-1.5">
              <li>
                <button
                  type="button"
                  onClick={() => navigateAccount('overview')}
                  className="hover:text-stone-900 hover:underline text-left font-semibold text-amber-800"
                >
                  {customerProfile ? `My Account (${customerProfile.fullName})` : 'Customer Sign In / Register'}
                </button>
              </li>
              <li>
                <a
                  href="/designs"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateDesigns();
                  }}
                  className="hover:text-stone-900 hover:underline"
                >
                  Decoration Ideas Gallery
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
                  Unified Bulk Inquiry Basket
                </button>
              </li>
              <li>
                <a
                  href="/admin"
                  onClick={(e) => {
                    e.preventDefault();
                    navigateAdmin('overview');
                  }}
                  className="hover:text-stone-900 hover:underline"
                >
                  DesiDiya Admin Console
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
        onChangeBasketItems={(nextItems) => setBulkInitialItems(nextItems)}
        allProducts={products}
        campaigns={campaigns}
        occasions={occasions}
        decorationThemes={decorationThemes}
        decorationDesigns={decorationDesigns}
        activeCampaignSlug={bulkModalCampaignSlug}
        inquiryContext={inquiryContext}
        customerProfile={customerProfile}
        onRequireAuth={() => {
          setBulkModalOpen(false);
          setPendingBulkOrderAfterAuth(true);
          setAuthModalOpen(true);
        }}
        onSubmitOrder={handleSubmitBulkOrder}
      />

      <CustomerAuthModal
        isOpen={authModalOpen}
        onClose={() => {
          setAuthModalOpen(false);
          setPendingBulkOrderAfterAuth(false);
        }}
        pendingBulkOrderNotice={pendingBulkOrderAfterAuth}
        onAuthenticated={async (profile) => {
          setCustomerProfile(profile);
          setAuthModalOpen(false);
          await fetch('/api/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(profile),
          }).catch(() => {});
          await refreshCustomerOrders(profile);
          showToast(`Welcome to DesiDiya, ${profile.fullName}!`);
          if (pendingBulkOrderAfterAuth) {
            setPendingBulkOrderAfterAuth(false);
            setBulkModalOpen(true);
          }
        }}
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
