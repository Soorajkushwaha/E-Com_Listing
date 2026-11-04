/**
 * Cloudflare Workers Entry Point for DesiDiya — Lighting Up Every Celebration
 * Compatible with Cloudflare Workers + Static Assets (`[assets]` in wrangler.toml).
 */

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
} from './src/utils/seedData';
import {
  calculateQuotationTotals,
  canTransitionOrderStatus,
  validateThemeSchema,
} from './src/utils/catalogLogic';
import type {
  BulkOrder,
  CustomerProfile,
  DecorationDesign,
  DecorationPackage,
  DecorationTheme,
  DesignProductMapping,
  Occasion,
  PackageProductMapping,
  Product,
} from './src/types/catalog';

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  XAI_API_KEY?: string;
  /** Optional Cloudflare KV binding for persistent state (see wrangler.toml kv_namespaces). */
  DESIDIYA_KV?: {
    get(key: string, type: 'json'): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
  };
}

const memoryStore: {
  products: Product[];
  themes: typeof INITIAL_THEMES;
  campaigns: typeof INITIAL_CAMPAIGNS;
  occasions: Occasion[];
  decorationThemes: DecorationTheme[];
  decorationDesigns: DecorationDesign[];
  designProducts: DesignProductMapping[];
  packages: DecorationPackage[];
  packageProducts: PackageProductMapping[];
  bulkOrders: BulkOrder[];
  customers: CustomerProfile[];
  activeThemeId: string;
  previousThemeId: string;
  catalogViews: number;
} = {
  products: [...INITIAL_PRODUCTS],
  themes: [...INITIAL_THEMES],
  campaigns: [...INITIAL_CAMPAIGNS],
  occasions: [...INITIAL_OCCASIONS],
  decorationThemes: [...INITIAL_DECORATION_THEMES],
  decorationDesigns: [...INITIAL_DECORATION_DESIGNS],
  designProducts: [...INITIAL_DESIGN_PRODUCTS],
  packages: [...INITIAL_PACKAGES],
  packageProducts: [...INITIAL_PACKAGE_PRODUCTS],
  bulkOrders: [...INITIAL_BULK_ORDERS],
  customers: [],
  activeThemeId: 'theme-diwali-gold',
  previousThemeId: 'theme-minimal-white',
  catalogViews: 1420,
};

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

const KV_STATE_KEY = 'state';
// Keys that make up the persisted store (catalogViews is excluded to avoid a KV write per page view).
const PERSISTED_KEYS = [
  'products', 'themes', 'campaigns', 'occasions', 'decorationThemes', 'decorationDesigns',
  'designProducts', 'packages', 'packageProducts', 'bulkOrders', 'customers',
  'activeThemeId', 'previousThemeId',
] as const;

async function loadStateFromKv(env: Env): Promise<void> {
  if (!env.DESIDIYA_KV) return; // No binding: keep in-memory seed state
  try {
    const saved = (await env.DESIDIYA_KV.get(KV_STATE_KEY, 'json')) as Record<string, unknown> | null;
    if (!saved || typeof saved !== 'object') return; // Nothing saved yet: keep seed
    for (const key of PERSISTED_KEYS) {
      if (key in saved && saved[key] !== undefined) {
        (memoryStore as Record<string, unknown>)[key] = saved[key];
      }
    }
  } catch (err) {
    console.error('KV load failed, using in-memory state', err);
  }
}

async function saveStateToKv(env: Env): Promise<void> {
  if (!env.DESIDIYA_KV) return;
  const snapshot: Record<string, unknown> = {};
  for (const key of PERSISTED_KEYS) snapshot[key] = memoryStore[key];
  await env.DESIDIYA_KV.put(KV_STATE_KEY, JSON.stringify(snapshot));
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const isApi = url.pathname.startsWith('/api/');
    const isMutation = isApi && ['POST', 'PUT', 'DELETE'].includes(request.method);

    if (isApi && request.method !== 'OPTIONS') {
      await loadStateFromKv(env);
    }

    const response = await handleRequest(request, env, url);

    // Persist only after successful mutations (KV free tier: 1,000 writes/day)
    if (isMutation && response.ok && env.DESIDIYA_KV) {
      try {
        await saveStateToKv(env);
      } catch (err) {
        console.error('KV save failed', err);
        return jsonResponse({ error: 'Saved in memory but failed to persist. Please retry.' }, 503);
      }
    }
    return response;
  },
};

async function handleRequest(request: Request, env: Env, url: URL): Promise<Response> {
  {

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Admin-Session',
        },
      });
    }

    // 1. Shared Storefront & Admin State
    if (url.pathname === '/api/state' && request.method === 'GET') {
      if (url.searchParams.get('trackView') === '1') {
        memoryStore.catalogViews += 1;
      }
      const isAdmin = request.headers.get('x-admin-session') === 'authenticated';
      return jsonResponse({
        ...memoryStore,
        bulkOrders: isAdmin ? memoryStore.bulkOrders : [],
        customers: isAdmin ? memoryStore.customers : [],
      });
    }

    // 2. Single Product Create / Update
    if (url.pathname === '/api/products' && request.method === 'POST') {
      const body = (await request.json()) as Partial<Product>;
      if (!body.sku || !body.name) {
        return jsonResponse({ error: 'SKU and Product Name are required.' }, 400);
      }
      const now = new Date().toISOString();
      const cleanSku = String(body.sku).trim().replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
      const existingIdx = memoryStore.products.findIndex(
        (p) => p.id === body.id || p.sku.toUpperCase() === cleanSku
      );

      const productRecord: Product = {
        id: existingIdx >= 0 ? memoryStore.products[existingIdx].id : body.id || `prod-${cleanSku.toLowerCase()}`,
        sku: cleanSku,
        name: String(body.name).trim().slice(0, 200),
        heading: String(body.heading || body.name).trim().slice(0, 200),
        subtitle: String(body.subtitle || `${body.brand || 'DesiDiya'} · ${body.category || 'Festive Decor'}`).trim().slice(0, 300),
        description: String(body.description || '').trim().slice(0, 2000),
        category: String(body.category || 'Festive Decor').trim().slice(0, 100),
        brand: String(body.brand || 'DesiDiya').trim().slice(0, 100),
        imageUrl: String(body.imageUrl || '').trim(),
        sellingPrice: Math.max(0, Number(body.sellingPrice) || 0),
        mrp: Math.max(Number(body.sellingPrice) || 0, Number(body.mrp) || 0),
        badge: String(body.badge || '').trim().slice(0, 60),
        campaign: String(body.campaign || 'diwali-2026').trim().slice(0, 100),
        campaigns: Array.isArray(body.campaigns)
          ? body.campaigns.map((c) => String(c).trim()).filter(Boolean)
          : [String(body.campaign || 'diwali-2026').trim()],
        status: body.status || 'active',
        stockStatus: body.stockStatus || 'in_stock',
        rating: Number(body.rating) || 4.8,
        ratingCount: Number(body.ratingCount) || 24,
        amazonUrl: String(body.amazonUrl || '').trim(),
        flipkartUrl: String(body.flipkartUrl || '').trim(),
        meeshoUrl: String(body.meeshoUrl || '').trim(),
        websiteUrl: String(body.websiteUrl || '').trim(),
        featured: Boolean(body.featured),
        sortOrder: Number(body.sortOrder) || memoryStore.products.length + 1,
        ownerId: String(body.ownerId || 'system-admin'),
        createdAt: existingIdx >= 0 ? memoryStore.products[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        memoryStore.products[existingIdx] = productRecord;
      } else {
        memoryStore.products.unshift(productRecord);
      }
      return jsonResponse({ product: productRecord });
    }

    // 3. Batch Excel Product Import (/api/products/batch & /api/products/import)
    if (
      (url.pathname === '/api/products/batch' || url.pathname === '/api/products/import') &&
      request.method === 'POST'
    ) {
      const { products: incomingProducts, duplicateMode = 'update' } = (await request.json()) as {
        products: Partial<Product>[];
        duplicateMode?: 'update' | 'skip';
      };

      if (!Array.isArray(incomingProducts) || incomingProducts.length === 0) {
        return jsonResponse({ error: 'No valid product rows provided for import.' }, 400);
      }

      const now = new Date().toISOString();
      let added = 0;
      let updated = 0;
      let skipped = 0;
      const savedProducts: Product[] = [];

      for (const item of incomingProducts.slice(0, 2000)) {
        if (!item.sku || !item.name) {
          skipped++;
          continue;
        }
        const cleanSku = String(item.sku).trim().replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
        const existingIdx = memoryStore.products.findIndex((p) => p.sku.toUpperCase() === cleanSku);

        if (existingIdx >= 0 && duplicateMode === 'skip') {
          skipped++;
          continue;
        }

        const record: Product = {
          id: existingIdx >= 0 ? memoryStore.products[existingIdx].id : `prod-${cleanSku.toLowerCase()}`,
          sku: cleanSku,
          name: String(item.name).trim().slice(0, 200),
          heading: String(item.heading || item.name).trim().slice(0, 200),
          subtitle: String(item.subtitle || `${item.brand || 'DesiDiya'} · ${item.category || 'Festive Decor'}`).trim().slice(0, 300),
          description: String(item.description || '').trim().slice(0, 2000),
          category: String(item.category || 'Festive Decor').trim().slice(0, 100),
          brand: String(item.brand || 'DesiDiya').trim().slice(0, 100),
          imageUrl: String(item.imageUrl || (existingIdx >= 0 ? memoryStore.products[existingIdx].imageUrl : '')),
          sellingPrice: Math.max(0, Number(item.sellingPrice) || 0),
          mrp: Math.max(Number(item.sellingPrice) || 0, Number(item.mrp) || 0),
          badge: String(item.badge || '').trim().slice(0, 60),
          campaign: String(item.campaign || 'diwali-2026').trim().slice(0, 100),
          campaigns: Array.isArray(item.campaigns)
            ? item.campaigns.map((c) => String(c).trim()).filter(Boolean)
            : [String(item.campaign || 'diwali-2026').trim()],
          status: item.status || 'active',
          stockStatus: item.stockStatus || 'in_stock',
          rating: Number(item.rating) || 4.8,
          ratingCount: Number(item.ratingCount) || 40,
          amazonUrl: String(item.amazonUrl || '').trim(),
          flipkartUrl: String(item.flipkartUrl || '').trim(),
          meeshoUrl: String(item.meeshoUrl || '').trim(),
          websiteUrl: String(item.websiteUrl || '').trim(),
          featured: Boolean(item.featured),
          sortOrder: Number(item.sortOrder) || memoryStore.products.length + 1,
          ownerId: 'system-admin',
          createdAt: existingIdx >= 0 ? memoryStore.products[existingIdx].createdAt : now,
          updatedAt: now,
        };

        if (existingIdx >= 0) {
          memoryStore.products[existingIdx] = record;
          updated++;
        } else {
          memoryStore.products.unshift(record);
          added++;
        }
        savedProducts.push(record);
      }

      return jsonResponse({
        added,
        updated,
        skipped,
        products: memoryStore.products,
        savedProducts,
      });
    }

    // 4. Product Delete
    if (url.pathname.startsWith('/api/products/') && request.method === 'DELETE') {
      const id = url.pathname.split('/').pop()!;
      memoryStore.products = memoryStore.products.filter((p) => p.id !== id);
      return jsonResponse({ ok: true, products: memoryStore.products });
    }

    // 5. Themes
    if (url.pathname === '/api/themes/activate' && request.method === 'POST') {
      const { themeId } = (await request.json()) as { themeId: string };
      memoryStore.previousThemeId = memoryStore.activeThemeId;
      memoryStore.activeThemeId = themeId;
      return jsonResponse({
        activeThemeId: memoryStore.activeThemeId,
        previousThemeId: memoryStore.previousThemeId,
      });
    }

    if (url.pathname === '/api/themes' && request.method === 'POST') {
      const { theme, activate } = (await request.json()) as any;
      const check = validateThemeSchema(theme);
      if (!check.valid || !check.theme) {
        return jsonResponse({ error: check.errors.join(' ') }, 400);
      }
      const saved = {
        id: theme.id || `theme-${Date.now()}`,
        ...check.theme,
        ownerId: 'system-admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      memoryStore.themes.unshift(saved);
      if (activate) {
        memoryStore.previousThemeId = memoryStore.activeThemeId;
        memoryStore.activeThemeId = saved.id;
      }
      return jsonResponse({
        theme: saved,
        themes: memoryStore.themes,
        activeThemeId: memoryStore.activeThemeId,
        previousThemeId: memoryStore.previousThemeId,
      });
    }

    // 6. Bulk Orders
    if (url.pathname === '/api/orders' && request.method === 'POST') {
      const body = (await request.json()) as any;
      const now = new Date().toISOString();
      const orderRef = `ORD-2026-${800 + memoryStore.bulkOrders.length + 1}`;
      const totalQuantity = (body.items || []).reduce(
        (s: number, i: any) => s + Math.max(1, Number(i.requestedQuantity) || 1),
        0
      );
      const estimatedAmount = (body.items || []).reduce(
        (s: number, i: any) => s + (Number(i.unitPrice) || 0) * Math.max(1, Number(i.requestedQuantity) || 1),
        0
      );
      const itemsSummary = (body.items || [])
        .map((i: any) => `${i.productName} (${i.requestedQuantity}${i.quantityUnit ? ` ${i.quantityUnit}` : ''})`)
        .join(', ');
      const order: BulkOrder = {
        id: orderRef.toLowerCase(),
        orderRef,
        ownerId: String(body.ownerId || 'customer-portal'),
        customerName: String(body.customerName || '').trim(),
        companyName: String(body.companyName || '').trim(),
        mobile: String(body.mobile || '').trim(),
        whatsapp: String(body.whatsapp || body.mobile || '').trim(),
        email: String(body.email || '').trim(),
        address: String(body.address || '').trim(),
        city: String(body.city || '').trim(),
        state: String(body.state || '').trim(),
        pinCode: String(body.pinCode || '').trim(),
        gstNumber: String(body.gstNumber || '').trim(),
        campaignId: String(body.campaignId || ''),
        campaignSlug: String(body.campaignSlug || 'diwali-2026'),
        campaignSlugs: Array.isArray(body.campaignSlugs) ? body.campaignSlugs : ['diwali-2026'],
        occasionId: String(body.occasionId || ''),
        occasionSlug: String(body.occasionSlug || ''),
        occasionName: String(body.occasionName || ''),
        decorationThemeId: String(body.decorationThemeId || ''),
        decorationThemeSlug: String(body.decorationThemeSlug || ''),
        decorationThemeName: String(body.decorationThemeName || ''),
        selectedDesignIds: Array.isArray(body.selectedDesignIds) ? body.selectedDesignIds : [],
        selectedDesignNames: Array.isArray(body.selectedDesignNames) ? body.selectedDesignNames : [],
        packageId: String(body.packageId || ''),
        packageName: String(body.packageName || ''),
        eventDate: String(body.eventDate || ''),
        venueLocation: String(body.venueLocation || ''),
        guestCount: String(body.guestCount || ''),
        expectedDeliveryDate: String(body.expectedDeliveryDate || ''),
        preferredContact: body.preferredContact || 'whatsapp',
        requirements: String(body.requirements || ''),
        items: Array.isArray(body.items) ? body.items : [],
        itemsSummary,
        totalQuantity,
        estimatedAmount,
        discountPercent: 0,
        discountAmount: 0,
        taxPercent: 18,
        taxAmount: Math.round(estimatedAmount * 0.18),
        shippingAmount: 0,
        finalAmount: Math.round(estimatedAmount * 1.18),
        quotationDate: '',
        quotationValidUntil: '',
        status: 'New Request',
        paymentStatus: 'unpaid',
        paymentLink: '',
        transactionRef: '',
        courierName: '',
        trackingNumber: '',
        internalNotes: '',
        timeline: [
          {
            id: `tl-${Date.now()}`,
            timestamp: now,
            actor: `${body.customerName || 'Customer'} (Customer Portal)`,
            action: `Bulk order inquiry submitted (${totalQuantity} units)`,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.bulkOrders.unshift(order);
      return jsonResponse({ order }, 201);
    }

    if (url.pathname.startsWith('/api/orders/customer/') && request.method === 'GET') {
      const uid = url.pathname.split('/').pop()!;
      const email = (url.searchParams.get('email') || '').toLowerCase().trim();
      const phone = (url.searchParams.get('phone') || '').replace(/[^0-9]/g, '');

      const customerOrders = memoryStore.bulkOrders
        .filter((o) => {
          if (o.ownerId === uid) return true;
          if (email && o.email && o.email.toLowerCase().trim() === email) return true;
          if (phone && phone.length >= 10) {
            const ordPhone = (o.whatsapp || o.mobile || '').replace(/[^0-9]/g, '');
            if (ordPhone.endsWith(phone.slice(-10))) return true;
          }
          return false;
        })
        .map(({ internalNotes, ...safeOrder }) => safeOrder);

      return jsonResponse({ orders: customerOrders });
    }

    if (url.pathname.startsWith('/api/orders/') && request.method === 'PUT') {
      const id = url.pathname.split('/').pop()!;
      const idx = memoryStore.bulkOrders.findIndex((o) => o.id === id || o.orderRef === id);
      if (idx < 0) return jsonResponse({ error: 'Order not found' }, 404);
      const existing = memoryStore.bulkOrders[idx];
      const updates = (await request.json()) as any;
      if (updates.status && updates.status !== existing.status) {
        const check = canTransitionOrderStatus(existing.status, updates.status);
        if (!check.allowed) return jsonResponse({ error: check.reason }, 400);
      }
      const totals = calculateQuotationTotals({
        itemsSubtotal: existing.estimatedAmount,
        discountPercent: updates.discountPercent ?? existing.discountPercent,
        taxPercent: updates.taxPercent ?? existing.taxPercent,
        shippingCharges: updates.shippingAmount ?? existing.shippingAmount,
      });
      const updated = {
        ...existing,
        ...updates,
        ...totals,
        updatedAt: new Date().toISOString(),
      };
      memoryStore.bulkOrders[idx] = updated;
      return jsonResponse({ order: updated, bulkOrders: memoryStore.bulkOrders });
    }

    // 7. Customer Accounts & Admin CRM
    if (url.pathname === '/api/customers' && request.method === 'GET') {
      return jsonResponse({ customers: memoryStore.customers });
    }

    if (url.pathname === '/api/customers' && request.method === 'POST') {
      const body = (await request.json()) as Partial<CustomerProfile>;
      if (!body.uid || !body.email) {
        return jsonResponse({ error: 'Customer uid and email are required.' }, 400);
      }
      const now = new Date().toISOString();
      const existingIdx = memoryStore.customers.findIndex((c) => c.uid === body.uid);
      const existing = existingIdx >= 0 ? memoryStore.customers[existingIdx] : null;

      const record: CustomerProfile = {
        uid: String(body.uid),
        fullName: String(body.fullName ?? existing?.fullName ?? 'Valued Customer').trim().slice(0, 150),
        email: String(body.email ?? existing?.email ?? '').trim().slice(0, 254),
        photoURL: String(body.photoURL ?? existing?.photoURL ?? '').trim().slice(0, 1000),
        phoneNumber: String(body.phoneNumber ?? existing?.phoneNumber ?? '').trim().slice(0, 30),
        whatsappNumber: String(body.whatsappNumber ?? body.phoneNumber ?? existing?.whatsappNumber ?? '').trim().slice(0, 30),
        businessName: String(body.businessName ?? existing?.businessName ?? '').trim().slice(0, 200),
        accountType: body.accountType || existing?.accountType || 'Individual Customer',
        deliveryAddresses: Array.isArray(body.deliveryAddresses)
          ? body.deliveryAddresses
          : existing?.deliveryAddresses || [],
        city: String(body.city ?? existing?.city ?? '').trim().slice(0, 100),
        state: String(body.state ?? existing?.state ?? '').trim().slice(0, 100),
        pincode: String(body.pincode ?? existing?.pincode ?? '').trim().slice(0, 20),
        gstNumber: String(body.gstNumber ?? existing?.gstNumber ?? '').trim().slice(0, 30),
        accountStatus: existing?.accountStatus || 'active',
        internalNotes: existing?.internalNotes || '',
        createdAt: existing?.createdAt || body.createdAt || now,
        updatedAt: now,
        lastLoginAt: body.lastLoginAt || now,
      };

      if (existingIdx >= 0) {
        memoryStore.customers[existingIdx] = record;
      } else {
        memoryStore.customers.unshift(record);
      }
      const { internalNotes, ...customerView } = record;
      return jsonResponse({ customer: customerView, customers: memoryStore.customers });
    }

    if (url.pathname.endsWith('/admin') && url.pathname.startsWith('/api/customers/') && request.method === 'PUT') {
      const parts = url.pathname.split('/');
      const uid = parts[parts.length - 2];
      const idx = memoryStore.customers.findIndex((c) => c.uid === uid);
      if (idx < 0) return jsonResponse({ error: 'Customer profile not found.' }, 404);
      const { internalNotes, accountStatus } = (await request.json()) as any;
      memoryStore.customers[idx] = {
        ...memoryStore.customers[idx],
        internalNotes:
          internalNotes !== undefined
            ? String(internalNotes).slice(0, 2000)
            : memoryStore.customers[idx].internalNotes,
        accountStatus: accountStatus || memoryStore.customers[idx].accountStatus,
        updatedAt: new Date().toISOString(),
      };
      return jsonResponse({ customer: memoryStore.customers[idx], customers: memoryStore.customers });
    }

    // 8. Campaigns
    if (url.pathname === '/api/campaigns' && request.method === 'POST') {
      const body = (await request.json()) as any;
      if (!body.name || !body.slug) {
        return jsonResponse({ error: 'Campaign Name and URL Slug are required.' }, 400);
      }
      const now = new Date().toISOString();
      const cleanSlug = String(body.slug).trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const existingIdx = memoryStore.campaigns.findIndex(
        (c) => c.id === body.id || c.slug === cleanSlug
      );
      const record = {
        id: existingIdx >= 0 ? memoryStore.campaigns[existingIdx].id : body.id || `camp-${Date.now()}`,
        slug: cleanSlug,
        name: String(body.name).trim(),
        description: String(body.description || '').trim(),
        bannerTitle: String(body.bannerTitle || body.name).trim(),
        bannerSubtitle: String(body.bannerSubtitle || '').trim(),
        bannerImageUrl: String(body.bannerImageUrl || ''),
        promotionalHeadline: String(body.promotionalHeadline || ''),
        accentColor: String(body.accentColor || '#F59E0B'),
        startDate: String(body.startDate || '2026-10-01'),
        endDate: String(body.endDate || '2026-12-31'),
        themeId: String(body.themeId || memoryStore.activeThemeId),
        productIds: Array.isArray(body.productIds) ? body.productIds : [],
        status: body.status === 'inactive' ? ('inactive' as const) : ('active' as const),
        ownerId: 'system-admin',
        createdAt: existingIdx >= 0 ? memoryStore.campaigns[existingIdx].createdAt : now,
        updatedAt: now,
      };
      if (existingIdx >= 0) {
        memoryStore.campaigns[existingIdx] = record;
      } else {
        memoryStore.campaigns.unshift(record);
      }
      return jsonResponse({ campaign: record, campaigns: memoryStore.campaigns, products: memoryStore.products });
    }

    if (url.pathname.startsWith('/api/campaigns/') && request.method === 'DELETE') {
      const id = url.pathname.split('/').pop()!;
      memoryStore.campaigns = memoryStore.campaigns.filter((c) => c.id !== id && c.slug !== id);
      return jsonResponse({ ok: true, campaigns: memoryStore.campaigns });
    }

    if (url.pathname === '/api/occasions' && request.method === 'POST') {
      const reqBody = ((await request.json().catch(() => null)) ?? {}) as any;
      const body = reqBody as Partial<Occasion>;
      if (!body.name || !body.slug) {
        return jsonResponse({ error: 'Occasion Name and Slug are required.' }, 400);
      }
      const now = new Date().toISOString();
      const cleanSlug = body.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const existingIdx = memoryStore.occasions.findIndex(
        (o) => o.id === body.id || o.slug === cleanSlug
      );
      const record: Occasion = {
        id: existingIdx >= 0 ? memoryStore.occasions[existingIdx].id : body.id || `occ-${Date.now()}`,
        name: body.name.trim().slice(0, 150),
        slug: cleanSlug,
        description: String(body.description || '').trim().slice(0, 2000),
        coverImage: String(body.coverImage ?? (existingIdx >= 0 ? memoryStore.occasions[existingIdx].coverImage : '')).trim(),
        bannerImage: String(body.bannerImage ?? (existingIdx >= 0 ? memoryStore.occasions[existingIdx].bannerImage : '')).trim(),
        icon: String(body.icon || 'Sparkles').trim().slice(0, 60),
        featured: Boolean(body.featured),
        displayOrder: Number(body.displayOrder) || memoryStore.occasions.length + 1,
        status: body.status === 'inactive' ? 'inactive' : 'active',
        ownerId: 'system-admin',
        createdAt: existingIdx >= 0 ? memoryStore.occasions[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        memoryStore.occasions[existingIdx] = record;
      } else {
        memoryStore.occasions.push(record);
      }
      memoryStore.occasions.sort((a, b) => a.displayOrder - b.displayOrder);
      return jsonResponse({ occasion: record, occasions: memoryStore.occasions });
    }

    if (url.pathname === '/api/decoration-themes' && request.method === 'POST') {
      const reqBody = ((await request.json().catch(() => null)) ?? {}) as any;
      const body = reqBody as Partial<DecorationTheme>;
      if (!body.title || !body.slug || !body.occasionId) {
        return jsonResponse({ error: 'Theme Title, Slug, and Occasion are required.' }, 400);
      }
      const now = new Date().toISOString();
      const cleanSlug = body.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const occ = memoryStore.occasions.find((o) => o.id === body.occasionId || o.slug === body.occasionSlug);
      const existingIdx = memoryStore.decorationThemes.findIndex(
        (t) => t.id === body.id || t.slug === cleanSlug
      );
      const record: DecorationTheme = {
        id: existingIdx >= 0 ? memoryStore.decorationThemes[existingIdx].id : body.id || `dtheme-${Date.now()}`,
        occasionId: occ ? occ.id : String(body.occasionId),
        occasionSlug: occ ? occ.slug : String(body.occasionSlug || 'wedding'),
        title: body.title.trim().slice(0, 200),
        slug: cleanSlug,
        description: String(body.description || '').trim().slice(0, 2000),
        coverImage: String(body.coverImage ?? (existingIdx >= 0 ? memoryStore.decorationThemes[existingIdx].coverImage : '')).trim(),
        galleryImages: Array.isArray(body.galleryImages)
          ? body.galleryImages.map((img) => String(img).trim()).filter(Boolean)
          : existingIdx >= 0
            ? memoryStore.decorationThemes[existingIdx].galleryImages
            : [],
        colorPalette: Array.isArray(body.colorPalette)
          ? body.colorPalette.map((c) => String(c).trim()).filter(Boolean)
          : existingIdx >= 0
            ? memoryStore.decorationThemes[existingIdx].colorPalette
            : ['Warm Gold', 'Ivory'],
        style: (body.style as any) || 'Royal',
        featured: Boolean(body.featured),
        displayOrder: Number(body.displayOrder) || memoryStore.decorationThemes.length + 1,
        status: body.status === 'draft' ? 'draft' : 'published',
        ownerId: 'system-admin',
        createdAt: existingIdx >= 0 ? memoryStore.decorationThemes[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        memoryStore.decorationThemes[existingIdx] = record;
      } else {
        memoryStore.decorationThemes.push(record);
      }
      memoryStore.decorationThemes.sort((a, b) => a.displayOrder - b.displayOrder);
      return jsonResponse({ decorationTheme: record, decorationThemes: memoryStore.decorationThemes });
    }

    if (url.pathname === '/api/decoration-designs' && request.method === 'POST') {
      const reqBody = ((await request.json().catch(() => null)) ?? {}) as any;
      const { design } = reqBody as {
        design: Partial<DecorationDesign>;
        productMappings?: Partial<DesignProductMapping>[];
        mappings?: Partial<DesignProductMapping>[];
      };
      const productMappings: Partial<DesignProductMapping>[] | undefined =
        reqBody.productMappings || reqBody.mappings;
      if (!design || !design.title || !design.slug || !design.occasionId || !design.themeId) {
        return jsonResponse({ error: 'Design Title, Slug, Occasion, and Theme are required.' }, 400);
      }

      const now = new Date().toISOString();
      const cleanSlug = design.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const occ = memoryStore.occasions.find((o) => o.id === design.occasionId || o.slug === design.occasionSlug);
      const thm = memoryStore.decorationThemes.find((t) => t.id === design.themeId || t.slug === design.themeSlug);
      const existingIdx = memoryStore.decorationDesigns.findIndex(
        (d) => d.id === design.id || d.slug === cleanSlug
      );
      const designId = existingIdx >= 0 ? memoryStore.decorationDesigns[existingIdx].id : design.id || `design-${Date.now()}`;

      const record: DecorationDesign = {
        id: designId,
        title: design.title.trim().slice(0, 200),
        slug: cleanSlug,
        occasionId: occ ? occ.id : String(design.occasionId),
        occasionSlug: occ ? occ.slug : String(design.occasionSlug || 'wedding'),
        themeId: thm ? thm.id : String(design.themeId),
        themeSlug: thm ? thm.slug : String(design.themeSlug || 'royal-gold-wedding'),
        mainImage: String(design.mainImage ?? (existingIdx >= 0 ? memoryStore.decorationDesigns[existingIdx].mainImage : '')).trim(),
        galleryImages: Array.isArray(design.galleryImages)
          ? design.galleryImages.map((g) => String(g).trim()).filter(Boolean)
          : existingIdx >= 0
            ? memoryStore.decorationDesigns[existingIdx].galleryImages
            : [],
        shortDescription: String(design.shortDescription || '').trim().slice(0, 500),
        fullDescription: String(design.fullDescription || design.shortDescription || '').trim().slice(0, 3000),
        decorationArea: (design.decorationArea as any) || 'Stage / Mandap',
        recommendedGuestCount: String(design.recommendedGuestCount || '100 - 300 Guests').trim().slice(0, 100),
        indoorOutdoor: design.indoorOutdoor || 'both',
        estimatedBudgetRange: String(design.estimatedBudgetRange || '₹25,000 – ₹75,000').trim().slice(0, 120),
        tags: Array.isArray(design.tags)
          ? design.tags.map((t: string) => String(t).trim()).filter(Boolean)
          : existingIdx >= 0
            ? memoryStore.decorationDesigns[existingIdx].tags
            : [],
        featured: Boolean(design.featured),
        status: design.status === 'draft' ? 'draft' : 'published',
        ownerId: 'system-admin',
        createdAt: existingIdx >= 0 ? memoryStore.decorationDesigns[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        memoryStore.decorationDesigns[existingIdx] = record;
      } else {
        memoryStore.decorationDesigns.unshift(record);
      }

      if (Array.isArray(productMappings)) {
        memoryStore.designProducts = memoryStore.designProducts.filter((m) => m.designId !== designId);
        const savedMappings: DesignProductMapping[] = [];
        productMappings.forEach((m, index) => {
          if (!m.productId && !m.sku) return;
          const prod = memoryStore.products.find((p) => p.id === m.productId || p.sku === m.sku);
          if (!prod) return;
          savedMappings.push({
            id: m.id || `dp-${designId}-${prod.id}-${index}`,
            designId,
            productId: prod.id,
            sku: prod.sku,
            recommendedQuantity: Math.max(1, Number(m.recommendedQuantity) || 1),
            quantityUnit: (m.quantityUnit as any) || 'pcs',
            isRequired: m.isRequired !== undefined ? Boolean(m.isRequired) : true,
            displayOrder: Number(m.displayOrder) || index + 1,
            notes: String(m.notes || '').trim().slice(0, 500),
            ownerId: 'system-admin',
            createdAt: now,
            updatedAt: now,
          });
        });
        memoryStore.designProducts.push(...savedMappings);
      }

      return jsonResponse({
        decorationDesign: record,
        decorationDesigns: memoryStore.decorationDesigns,
        designProducts: memoryStore.designProducts,
      });
    }

    if (url.pathname === '/api/packages' && request.method === 'POST') {
      const reqBody = ((await request.json().catch(() => null)) ?? {}) as any;
      const { pkg } = reqBody as {
        pkg: Partial<DecorationPackage>;
        productMappings?: Partial<PackageProductMapping>[];
        mappings?: Partial<PackageProductMapping>[];
      };
      const productMappings: Partial<PackageProductMapping>[] | undefined =
        reqBody.productMappings || reqBody.mappings;
      if (!pkg || !pkg.name || !pkg.slug || !pkg.occasionId) {
        return jsonResponse({ error: 'Package Name, Slug, and Occasion are required.' }, 400);
      }

      const now = new Date().toISOString();
      const cleanSlug = pkg.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
      const occ = memoryStore.occasions.find((o) => o.id === pkg.occasionId || o.slug === pkg.occasionSlug);
      const thm = memoryStore.decorationThemes.find((t) => t.id === pkg.themeId || t.slug === pkg.themeSlug);
      const existingIdx = memoryStore.packages.findIndex(
        (p) => p.id === pkg.id || p.slug === cleanSlug
      );
      const packageId = existingIdx >= 0 ? memoryStore.packages[existingIdx].id : pkg.id || `pkg-${Date.now()}`;

      const record: DecorationPackage = {
        id: packageId,
        name: pkg.name.trim().slice(0, 200),
        slug: cleanSlug,
        occasionId: occ ? occ.id : String(pkg.occasionId),
        occasionSlug: occ ? occ.slug : String(pkg.occasionSlug || 'wedding'),
        themeId: thm ? thm.id : String(pkg.themeId || ''),
        themeSlug: thm ? thm.slug : String(pkg.themeSlug || ''),
        coverImage: String(pkg.coverImage ?? (existingIdx >= 0 ? memoryStore.packages[existingIdx].coverImage : '')).trim(),
        galleryImages: [],
        description: String(pkg.description || '').trim().slice(0, 2000),
        startingPrice: Math.max(0, Number(pkg.startingPrice) || 0),
        guestCapacity: String(pkg.guestCapacity || '100 - 300 Guests').trim().slice(0, 100),
        featured: Boolean(pkg.featured),
        status: pkg.status === 'draft' ? 'draft' : 'published',
        ownerId: 'system-admin',
        createdAt: existingIdx >= 0 ? memoryStore.packages[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        memoryStore.packages[existingIdx] = record;
      } else {
        memoryStore.packages.unshift(record);
      }

      if (Array.isArray(productMappings)) {
        memoryStore.packageProducts = memoryStore.packageProducts.filter((m) => m.packageId !== packageId);
        const savedMappings: PackageProductMapping[] = [];
        productMappings.forEach((m, index) => {
          if (!m.productId && !m.sku) return;
          const prod = memoryStore.products.find((p) => p.id === m.productId || p.sku === m.sku);
          if (!prod) return;
          savedMappings.push({
            id: m.id || `pp-${packageId}-${prod.id}-${index}`,
            packageId,
            productId: prod.id,
            sku: prod.sku,
            recommendedQuantity: Math.max(1, Number(m.recommendedQuantity) || 1),
            quantityUnit: (m.quantityUnit as any) || 'pcs',
            isRequired: m.isRequired !== undefined ? Boolean(m.isRequired) : true,
            displayOrder: Number(m.displayOrder) || index + 1,
            notes: String(m.notes || '').trim().slice(0, 500),
            ownerId: 'system-admin',
            createdAt: now,
            updatedAt: now,
          });
        });
        memoryStore.packageProducts.push(...savedMappings);
      }

      return jsonResponse({
        pkg: record,
        package: record,
        packages: memoryStore.packages,
        packageProducts: memoryStore.packageProducts,
      });
    }

    // Unmatched API routes return JSON 404 instead of falling through to the SPA/text fallback
    if (url.pathname.startsWith('/api/')) {
      return jsonResponse({ error: `No API route for ${request.method} ${url.pathname}` }, 404);
    }

    // Serve static SPA assets for all non-API routes
    if (env.ASSETS) {
      const assetResp = await env.ASSETS.fetch(request);
      if (assetResp.status !== 404) return assetResp;
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }

    return new Response('DesiDiya — Lighting Up Every Celebration Worker API Active', { status: 200 });
  }
}
