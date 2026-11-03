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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

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

    // Serve static SPA assets for all non-API routes
    if (env.ASSETS) {
      const assetResp = await env.ASSETS.fetch(request);
      if (assetResp.status !== 404) return assetResp;
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
    }

    return new Response('DesiDiya — Lighting Up Every Celebration Worker API Active', { status: 200 });
  },
};
