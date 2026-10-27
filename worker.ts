/**
 * Cloudflare Workers Entry Point for Catalog Maker Pro
 * Compatible with Cloudflare Workers + Static Assets (`[assets]` in wrangler.toml).
 */

import {
  INITIAL_BULK_ORDERS,
  INITIAL_CAMPAIGNS,
  INITIAL_PRODUCTS,
  INITIAL_THEMES,
} from './src/utils/seedData';
import {
  calculateQuotationTotals,
  canTransitionOrderStatus,
  validateThemeSchema,
} from './src/utils/catalogLogic';

export interface Env {
  ASSETS: { fetch: (req: Request) => Promise<Response> };
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  XAI_API_KEY?: string;
}

const memoryStore = {
  products: [...INITIAL_PRODUCTS],
  themes: [...INITIAL_THEMES],
  campaigns: [...INITIAL_CAMPAIGNS],
  bulkOrders: [...INITIAL_BULK_ORDERS],
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

    if (url.pathname === '/api/state' && request.method === 'GET') {
      if (url.searchParams.get('trackView') === '1') {
        memoryStore.catalogViews += 1;
      }
      const isAdmin = request.headers.get('x-admin-session') === 'authenticated';
      return jsonResponse({
        ...memoryStore,
        bulkOrders: isAdmin ? memoryStore.bulkOrders : [],
      });
    }

    if (url.pathname === '/api/themes/activate' && request.method === 'POST') {
      const { themeId } = (await request.json()) as { themeId: string };
      memoryStore.previousThemeId = memoryStore.activeThemeId;
      memoryStore.activeThemeId = themeId;
      return jsonResponse({
        activeThemeId: memoryStore.activeThemeId,
        previousThemeId: memoryStore.previousThemeId,
      });
    }

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
      const order = {
        id: orderRef.toLowerCase(),
        orderRef,
        ...body,
        totalQuantity,
        estimatedAmount,
        finalAmount: Math.round(estimatedAmount * 1.18),
        status: 'New Request',
        paymentStatus: 'unpaid',
        timeline: [
          {
            id: `tl-${Date.now()}`,
            timestamp: now,
            actor: 'Customer Portal',
            action: `Bulk order inquiry submitted (${totalQuantity} units)`,
          },
        ],
        createdAt: now,
        updatedAt: now,
      };
      memoryStore.bulkOrders.unshift(order);
      return jsonResponse({ order }, 201);
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

    return new Response('Catalog Maker Pro Worker API Active', { status: 200 });
  },
};
