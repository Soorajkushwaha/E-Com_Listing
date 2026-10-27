import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import {
  INITIAL_BULK_ORDERS,
  INITIAL_CAMPAIGNS,
  INITIAL_PRODUCTS,
  INITIAL_THEMES,
} from './src/utils/seedData.ts';
import {
  calculateQuotationTotals,
  canTransitionOrderStatus,
  validateThemeSchema,
} from './src/utils/catalogLogic.ts';
import type {
  AIProvider,
  BulkOrder,
  Campaign,
  CatalogTheme,
  Product,
} from './src/types/catalog.ts';

interface PersistentStore {
  products: Product[];
  themes: CatalogTheme[];
  campaigns: Campaign[];
  bulkOrders: BulkOrder[];
  activeThemeId: string;
  previousThemeId: string;
  catalogViews: number;
}

const DATA_DIR = path.resolve('.data');
const STORE_PATH = path.join(DATA_DIR, 'catalog-store.json');

function loadStore(): PersistentStore {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as PersistentStore;
      if (Array.isArray(parsed.products) && Array.isArray(parsed.themes)) {
        // Ensure any newly seeded campaigns or campaign metadata fields are present
        const existingSlugs = new Set((parsed.campaigns || []).map((c) => c.slug));
        for (const seedCamp of INITIAL_CAMPAIGNS) {
          if (!existingSlugs.has(seedCamp.slug)) {
            parsed.campaigns.push(seedCamp);
          } else {
            const idx = parsed.campaigns.findIndex((c) => c.slug === seedCamp.slug);
            if (idx >= 0) {
              parsed.campaigns[idx] = {
                ...seedCamp,
                ...parsed.campaigns[idx],
                bannerImageUrl: parsed.campaigns[idx].bannerImageUrl || seedCamp.bannerImageUrl,
                promotionalHeadline: parsed.campaigns[idx].promotionalHeadline || seedCamp.promotionalHeadline,
                accentColor: parsed.campaigns[idx].accentColor || seedCamp.accentColor,
                productIds: parsed.campaigns[idx].productIds || seedCamp.productIds,
              };
            }
          }
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Initializing fresh catalog store:', err);
  }

  const initial: PersistentStore = {
    products: [...INITIAL_PRODUCTS],
    themes: [...INITIAL_THEMES],
    campaigns: [...INITIAL_CAMPAIGNS],
    bulkOrders: [...INITIAL_BULK_ORDERS],
    activeThemeId: 'theme-diwali-gold',
    previousThemeId: 'theme-minimal-white',
    catalogViews: 1420,
  };
  saveStore(initial);
  return initial;
}

function saveStore(store: PersistentStore): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to persist store:', err);
  }
}

/**
 * Synthesizes a structured theme from natural-language prompt keywords when
 * Local mode is selected or as a deterministic fallback if an external provider is unavailable.
 */
function synthesizePromptTheme(prompt: string): Omit<CatalogTheme, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'> {
  const lower = prompt.toLowerCase();
  if (lower.includes('diwali') || lower.includes('gold') || lower.includes('festive') || lower.includes('dark')) {
    return {
      name: 'AI Festive Sovereign Gold',
      primaryColor: '#F59E0B',
      secondaryColor: '#D97706',
      backgroundColor: '#12100E',
      surfaceColor: '#1C1917',
      textColor: '#FAFAF9',
      accentColor: '#FBBF24',
      headingFont: 'Cormorant Garamond',
      bodyFont: 'Plus Jakarta Sans',
      cardLayout: lower.includes('elevated') ? 'elevated' : 'editorial',
      borderRadius: lower.includes('rounded') ? 'lg' : 'md',
      buttonStyle: 'solid',
      isPublic: true,
    };
  }
  if (lower.includes('wedding') || lower.includes('red') || lower.includes('crimson') || lower.includes('royal')) {
    return {
      name: 'AI Royal Wedding Crimson',
      primaryColor: '#FDE68A',
      secondaryColor: '#FCA5A5',
      backgroundColor: '#2E0710',
      surfaceColor: '#450A18',
      textColor: '#FFFBEB',
      accentColor: '#F59E0B',
      headingFont: 'Cormorant Garamond',
      bodyFont: 'Plus Jakarta Sans',
      cardLayout: 'editorial',
      borderRadius: 'lg',
      buttonStyle: 'solid',
      isPublic: true,
    };
  }
  if (lower.includes('corporate') || lower.includes('blue') || lower.includes('executive') || lower.includes('b2b')) {
    return {
      name: 'AI Executive Corporate Slate',
      primaryColor: '#0F172A',
      secondaryColor: '#334155',
      backgroundColor: '#F8FAFC',
      surfaceColor: '#FFFFFF',
      textColor: '#0F172A',
      accentColor: '#0284C7',
      headingFont: 'Outfit',
      bodyFont: 'Plus Jakarta Sans',
      cardLayout: 'bordered',
      borderRadius: 'md',
      buttonStyle: 'solid',
      isPublic: true,
    };
  }
  if (lower.includes('luxury') || lower.includes('black') || lower.includes('monochrome')) {
    return {
      name: 'AI Obsidian Atelier',
      primaryColor: '#F4F4F5',
      secondaryColor: '#A1A1AA',
      backgroundColor: '#09090B',
      surfaceColor: '#18181B',
      textColor: '#FAFAFA',
      accentColor: '#D4AF37',
      headingFont: 'Cormorant Garamond',
      bodyFont: 'Plus Jakarta Sans',
      cardLayout: 'editorial',
      borderRadius: 'none',
      buttonStyle: 'outline',
      isPublic: true,
    };
  }
  return {
    name: 'AI Curated Botanical Ivory',
    primaryColor: '#1C1917',
    secondaryColor: '#57534E',
    backgroundColor: '#FAF8F5',
    surfaceColor: '#FFFFFF',
    textColor: '#1C1917',
    accentColor: '#B45309',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Plus Jakarta Sans',
    cardLayout: 'bordered',
    borderRadius: 'md',
    buttonStyle: 'solid',
    isPublic: true,
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '10mb' }));

  const store = loadStore();
  const recentOrderFingerprints = new Map<string, number>();

  // 1. Public & Admin Shared State Endpoint (strips private customer PII when public=1)
  app.get('/api/state', (req, res) => {
    if (req.query.trackView === '1') {
      store.catalogViews += 1;
      saveStore(store);
    }
    const isAdminRequest = req.headers['x-admin-session'] === 'authenticated';
    res.json({
      products: store.products,
      themes: store.themes,
      campaigns: store.campaigns,
      activeThemeId: store.activeThemeId,
      previousThemeId: store.previousThemeId,
      catalogViews: store.catalogViews,
      bulkOrders: isAdminRequest ? store.bulkOrders : [],
    });
  });

  // 2. Product Create / Update
  app.post('/api/products', (req, res) => {
    const body = req.body as Partial<Product>;
    if (!body.sku || !body.name) {
      res.status(400).json({ error: 'SKU and Product Name are required.' });
      return;
    }

    const now = new Date().toISOString();
    const cleanSku = String(body.sku).trim().replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
    const existingIdx = store.products.findIndex(
      (p) => p.id === body.id || p.sku.toUpperCase() === cleanSku
    );

    const productRecord: Product = {
      id: existingIdx >= 0 ? store.products[existingIdx].id : body.id || `prod-${Date.now()}`,
      sku: cleanSku,
      name: String(body.name).trim().slice(0, 200),
      heading: String(body.heading || body.name).trim().slice(0, 200),
      subtitle: String(body.subtitle || `${body.brand || 'Artisan'} · ${body.category || 'Gifting'}`).trim().slice(0, 300),
      description: String(body.description || '').trim().slice(0, 2000),
      category: String(body.category || 'Festive Decor').trim().slice(0, 100),
      brand: String(body.brand || 'Kansa Heritage').trim().slice(0, 100),
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
      sortOrder: Number(body.sortOrder) || store.products.length + 1,
      ownerId: String(body.ownerId || 'system-admin'),
      createdAt: existingIdx >= 0 ? store.products[existingIdx].createdAt : now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      store.products[existingIdx] = productRecord;
    } else {
      store.products.unshift(productRecord);
    }
    saveStore(store);
    res.json({ product: productRecord });
  });

  // 3. Batch Excel Import Endpoint (Processes in safe chunks <= 200 per batch)
  app.post('/api/products/batch', (req, res) => {
    const { products: incomingProducts, duplicateMode = 'update' } = req.body as {
      products: Partial<Product>[];
      duplicateMode?: 'update' | 'skip';
    };

    if (!Array.isArray(incomingProducts) || incomingProducts.length === 0) {
      res.status(400).json({ error: 'No valid product rows provided for import.' });
      return;
    }

    const now = new Date().toISOString();
    let added = 0;
    let updated = 0;
    let skipped = 0;
    const savedProducts: Product[] = [];

    for (const item of incomingProducts.slice(0, 500)) {
      if (!item.sku || !item.name) {
        skipped++;
        continue;
      }
      const cleanSku = String(item.sku).trim().replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
      const existingIdx = store.products.findIndex((p) => p.sku.toUpperCase() === cleanSku);

      if (existingIdx >= 0 && duplicateMode === 'skip') {
        skipped++;
        continue;
      }

      const record: Product = {
        id: existingIdx >= 0 ? store.products[existingIdx].id : `prod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sku: cleanSku,
        name: String(item.name).trim().slice(0, 200),
        heading: String(item.heading || item.name).trim().slice(0, 200),
        subtitle: String(item.subtitle || `${item.brand || 'Artisan'} · ${item.category || 'Gifting'}`).trim().slice(0, 300),
        description: String(item.description || '').trim().slice(0, 2000),
        category: String(item.category || 'Festive Decor').trim().slice(0, 100),
        brand: String(item.brand || 'Kansa Heritage').trim().slice(0, 100),
        imageUrl: String(item.imageUrl || (existingIdx >= 0 ? store.products[existingIdx].imageUrl : '')),
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
        sortOrder: Number(item.sortOrder) || store.products.length + 1,
        ownerId: 'system-admin',
        createdAt: existingIdx >= 0 ? store.products[existingIdx].createdAt : now,
        updatedAt: now,
      };

      if (existingIdx >= 0) {
        store.products[existingIdx] = record;
        updated++;
      } else {
        store.products.unshift(record);
        added++;
      }
      savedProducts.push(record);
    }

    saveStore(store);
    res.json({
      added,
      updated,
      skipped,
      products: store.products,
      savedProducts,
    });
  });

  // 4. Product Delete
  app.delete('/api/products/:id', (req, res) => {
    const { id } = req.params;
    store.products = store.products.filter((p) => p.id !== id);
    saveStore(store);
    res.json({ ok: true, products: store.products });
  });

  // 5. Theme Save & Activate (Does NOT touch products or orders)
  app.post('/api/themes', (req, res) => {
    const { theme, activate } = req.body as { theme: Partial<CatalogTheme>; activate?: boolean };
    const validation = validateThemeSchema(theme);
    if (!validation.valid || !validation.theme) {
      res.status(400).json({ error: validation.errors.join(' ') });
      return;
    }

    const now = new Date().toISOString();
    const existingIdx = store.themes.findIndex(
      (t) => t.id === theme.id || t.name.toLowerCase() === validation.theme!.name.toLowerCase()
    );

    const savedTheme: CatalogTheme = {
      id: existingIdx >= 0 ? store.themes[existingIdx].id : theme.id || `theme-${Date.now()}`,
      ...validation.theme,
      ownerId: 'system-admin',
      createdAt: existingIdx >= 0 ? store.themes[existingIdx].createdAt : now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      store.themes[existingIdx] = savedTheme;
    } else {
      store.themes.unshift(savedTheme);
    }

    if (activate) {
      store.previousThemeId = store.activeThemeId;
      store.activeThemeId = savedTheme.id;
    }

    saveStore(store);
    res.json({
      theme: savedTheme,
      themes: store.themes,
      activeThemeId: store.activeThemeId,
      previousThemeId: store.previousThemeId,
    });
  });

  app.post('/api/themes/activate', (req, res) => {
    const { themeId } = req.body as { themeId: string };
    const target = store.themes.find((t) => t.id === themeId);
    if (!target) {
      res.status(404).json({ error: 'Requested theme not found.' });
      return;
    }
    if (store.activeThemeId !== themeId) {
      store.previousThemeId = store.activeThemeId;
      store.activeThemeId = themeId;
      saveStore(store);
    }
    res.json({
      activeThemeId: store.activeThemeId,
      previousThemeId: store.previousThemeId,
    });
  });

  // 6. Server-Side AI Theme Generation (Gemini, OpenAI, DeepSeek, Grok, Local)
  app.post('/api/ai/generate-theme', async (req, res) => {
    const {
      prompt,
      provider = 'gemini',
      model = 'gemini-3.8-flash',
    } = req.body as {
      prompt: string;
      provider?: AIProvider;
      model?: string;
    };

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length < 4) {
      res.status(400).json({ error: 'Please enter a descriptive theme prompt (at least 4 characters).' });
      return;
    }

    if (prompt.length > 1500) {
      res.status(400).json({ error: 'Prompt exceeds maximum length of 1,500 characters.' });
      return;
    }

    const systemPrompt = `You are a B2B Product Catalog Theme Architect. Return ONLY a JSON object matching the schema with hex colors (#RRGGBB), headingFont ("Cormorant Garamond" or "Outfit"), bodyFont ("Plus Jakarta Sans" or "DM Sans"), cardLayout ("editorial", "minimal", "bordered", or "elevated"), borderRadius ("none", "sm", "md", "lg", or "xl"), and buttonStyle ("solid", "outline", or "soft"). Never return executable code, HTML, or CSS.`;

    try {
      if (provider === 'local') {
        const rawTheme = synthesizePromptTheme(prompt);
        const check = validateThemeSchema(rawTheme);
        res.json({
          theme: check.theme,
          providerUsed: 'local',
          modelUsed: 'deterministic-preset-engine',
          notice: 'Generated instantly using the built-in local theme synthesizer.',
        });
        return;
      }

      if (provider === 'gemini') {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey !== 'MY_GEMINI_API_KEY') {
          try {
            const ai = new GoogleGenAI({
              apiKey,
              httpOptions: {
                headers: {
                  'User-Agent': 'aistudio-build',
                },
              },
            });

            const validGeminiModel =
              model === 'gemini-3.1-flash-lite' || model === 'gemini-flash-latest'
                ? model
                : 'gemini-3.8-flash';

            const response = await ai.models.generateContent({
              model: validGeminiModel,
              contents: `Design a product catalog theme for: ${prompt}`,
              config: {
                systemInstruction: systemPrompt,
                responseMimeType: 'application/json',
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    primaryColor: { type: Type.STRING },
                    secondaryColor: { type: Type.STRING },
                    backgroundColor: { type: Type.STRING },
                    surfaceColor: { type: Type.STRING },
                    textColor: { type: Type.STRING },
                    accentColor: { type: Type.STRING },
                    headingFont: { type: Type.STRING },
                    bodyFont: { type: Type.STRING },
                    cardLayout: { type: Type.STRING },
                    borderRadius: { type: Type.STRING },
                    buttonStyle: { type: Type.STRING },
                  },
                  required: [
                    'name',
                    'primaryColor',
                    'secondaryColor',
                    'backgroundColor',
                    'surfaceColor',
                    'textColor',
                    'accentColor',
                    'headingFont',
                    'bodyFont',
                    'cardLayout',
                    'borderRadius',
                    'buttonStyle',
                  ],
                },
              },
            });

            const parsed = JSON.parse((response.text || '{}').trim());
            const validated = validateThemeSchema(parsed);
            if (validated.valid && validated.theme) {
              res.json({
                theme: validated.theme,
                providerUsed: 'gemini',
                modelUsed: validGeminiModel,
              });
              return;
            }
          } catch (geminiErr: any) {
            const fallback = synthesizePromptTheme(prompt);
            res.json({
              theme: fallback,
              providerUsed: 'gemini-fallback',
              modelUsed: model,
              notice: `Gemini API rate-limited or unavailable (${geminiErr?.message?.slice(0, 80) || 'quota'}); synthesized schema-validated theme from prompt.`,
            });
            return;
          }
        }
      }

      // OpenAI / DeepSeek / Grok server-side API proxy
      const providerConfig: Record<
        string,
        { url: string; envKey?: string; defaultModel: string }
      > = {
        openai: {
          url: 'https://api.openai.com/v1/chat/completions',
          envKey: process.env.OPENAI_API_KEY,
          defaultModel: 'gpt-4o-mini',
        },
        deepseek: {
          url: 'https://api.deepseek.com/chat/completions',
          envKey: process.env.DEEPSEEK_API_KEY,
          defaultModel: 'deepseek-chat',
        },
        grok: {
          url: 'https://api.x.ai/v1/chat/completions',
          envKey: process.env.XAI_API_KEY,
          defaultModel: 'grok-2-latest',
        },
      };

      const selected = providerConfig[provider];
      if (selected && selected.envKey) {
        const resp = await fetch(selected.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${selected.envKey}`,
          },
          body: JSON.stringify({
            model: model || selected.defaultModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: prompt },
            ],
            response_format: { type: 'json_object' },
          }),
        });
        if (resp.ok) {
          const data = (await resp.json()) as any;
          const content = data.choices?.[0]?.message?.content || '{}';
          const validated = validateThemeSchema(JSON.parse(content));
          if (validated.valid && validated.theme) {
            res.json({
              theme: validated.theme,
              providerUsed: provider,
              modelUsed: model || selected.defaultModel,
            });
            return;
          }
        }
      }

      // Deterministic schema-validated synthesizer when provider secret is not configured
      const synthesized = synthesizePromptTheme(prompt);
      res.json({
        theme: synthesized,
        providerUsed: provider,
        modelUsed: model,
        notice: `Synthesized schema-validated theme for "${prompt.slice(0, 50)}".`,
      });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'Failed to generate theme.',
      });
    }
  });

  // 7. Campaigns Create / Update / Delete
  app.post('/api/campaigns', (req, res) => {
    const body = req.body as Partial<Campaign>;
    if (!body.name || !body.slug) {
      res.status(400).json({ error: 'Campaign Name and URL Slug are required.' });
      return;
    }

    const now = new Date().toISOString();
    const cleanSlug = body.slug.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const existingIdx = store.campaigns.findIndex(
      (c) => c.id === body.id || c.slug === cleanSlug
    );

    const record: Campaign = {
      id: existingIdx >= 0 ? store.campaigns[existingIdx].id : body.id || `camp-${Date.now()}`,
      slug: cleanSlug,
      name: body.name.trim().slice(0, 150),
      description: String(body.description || '').trim().slice(0, 1000),
      bannerTitle: String(body.bannerTitle || body.name).trim().slice(0, 200),
      bannerSubtitle: String(body.bannerSubtitle || '').trim().slice(0, 400),
      bannerImageUrl: String(body.bannerImageUrl ?? (existingIdx >= 0 ? store.campaigns[existingIdx].bannerImageUrl || '' : '')).trim(),
      promotionalHeadline: String(body.promotionalHeadline ?? (existingIdx >= 0 ? store.campaigns[existingIdx].promotionalHeadline || '' : '')).trim().slice(0, 240),
      accentColor: String(body.accentColor ?? (existingIdx >= 0 ? store.campaigns[existingIdx].accentColor || '#F59E0B' : '#F59E0B')).trim().slice(0, 24),
      startDate: String(body.startDate || '2026-10-01'),
      endDate: String(body.endDate || '2026-12-31'),
      themeId: String(body.themeId || store.activeThemeId),
      productIds: Array.isArray(body.productIds)
        ? body.productIds.map((id) => String(id))
        : existingIdx >= 0
          ? store.campaigns[existingIdx].productIds || []
          : [],
      status: body.status === 'inactive' ? 'inactive' : 'active',
      ownerId: 'system-admin',
      createdAt: existingIdx >= 0 ? store.campaigns[existingIdx].createdAt : now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      store.campaigns[existingIdx] = record;
    } else {
      store.campaigns.unshift(record);
    }

    // If productIds were explicitly assigned to this campaign, also ensure those products include this campaign slug
    if (Array.isArray(body.productIds)) {
      const assignedSet = new Set(body.productIds);
      store.products = store.products.map((prod) => {
        const currentCampaigns = new Set(
          Array.isArray(prod.campaigns) && prod.campaigns.length > 0
            ? prod.campaigns
            : prod.campaign
              ? [prod.campaign]
              : []
        );
        if (assignedSet.has(prod.id)) {
          currentCampaigns.add(cleanSlug);
        }
        const nextList = Array.from(currentCampaigns);
        return {
          ...prod,
          campaign: prod.campaign || cleanSlug,
          campaigns: nextList,
        };
      });
    }

    saveStore(store);
    res.json({ campaign: record, campaigns: store.campaigns, products: store.products });
  });

  app.delete('/api/campaigns/:id', (req, res) => {
    const { id } = req.params;
    const target = store.campaigns.find((c) => c.id === id || c.slug === id);
    if (!target) {
      res.status(404).json({ error: 'Campaign not found.' });
      return;
    }
    // Deleting a campaign removes only the campaign record; products and bulkOrders remain intact
    store.campaigns = store.campaigns.filter((c) => c.id !== target.id);
    saveStore(store);
    res.json({ ok: true, campaigns: store.campaigns });
  });

  // 8. Public Bulk Order Request Submission (No payment collected at submission)
  app.post('/api/orders', (req, res) => {
    const body = req.body as Partial<BulkOrder>;
    if (!body.customerName || !body.mobile || !body.address || !body.city || !body.state || !body.pinCode) {
      res.status(400).json({
        error: 'Customer name, mobile number, delivery address, city, state, and PIN code are required.',
      });
      return;
    }

    if (!Array.isArray(body.items) || body.items.length === 0) {
      res.status(400).json({ error: 'Please select at least one product for your bulk order inquiry.' });
      return;
    }

    // Duplicate submission guard (within 15 seconds)
    const fingerprint = `${body.mobile.trim()}-${body.items.map((i) => `${i.sku}:${i.requestedQuantity}`).join(',')}`;
    const lastTime = recentOrderFingerprints.get(fingerprint);
    if (lastTime && Date.now() - lastTime < 15000) {
      res.status(409).json({
        error: 'This exact bulk order inquiry was just submitted moments ago. Duplicate submission prevented.',
      });
      return;
    }
    recentOrderFingerprints.set(fingerprint, Date.now());

    const now = new Date().toISOString();
    const orderNumber = 800 + store.bulkOrders.length + 1;
    const orderRef = `ORD-2026-${orderNumber}`;

    const totalQuantity = body.items.reduce(
      (sum, item) => sum + Math.max(1, Number(item.requestedQuantity) || 1),
      0
    );
    const estimatedAmount = body.items.reduce(
      (sum, item) => sum + (Number(item.unitPrice) || 0) * Math.max(1, Number(item.requestedQuantity) || 1),
      0
    );
    const itemsSummary = body.items
      .map((i) => `${i.productName} (${i.requestedQuantity})`)
      .join(', ')
      .slice(0, 2000);

    const newOrder: BulkOrder = {
      id: `ord-2026-${orderNumber}`,
      orderRef,
      ownerId: String(body.ownerId || 'customer-portal'),
      customerName: body.customerName.trim().slice(0, 150),
      companyName: String(body.companyName || '').trim().slice(0, 150),
      mobile: body.mobile.trim().slice(0, 25),
      whatsapp: String(body.whatsapp || body.mobile).trim().slice(0, 25),
      email: String(body.email || '').trim().slice(0, 254),
      address: body.address.trim().slice(0, 500),
      city: body.city.trim().slice(0, 100),
      state: body.state.trim().slice(0, 100),
      pinCode: body.pinCode.trim().slice(0, 16),
      gstNumber: String(body.gstNumber || '').trim().slice(0, 30),
      campaignId: String(body.campaignId || '').trim().slice(0, 100),
      campaignSlug: String(body.campaignSlug || 'diwali-2026').trim().slice(0, 100),
      campaignSlugs: Array.isArray(body.campaignSlugs)
        ? body.campaignSlugs.map((s) => String(s).trim()).filter(Boolean)
        : [String(body.campaignSlug || 'diwali-2026').trim()],
      expectedDeliveryDate: String(body.expectedDeliveryDate || '').trim(),
      preferredContact: body.preferredContact || 'whatsapp',
      requirements: String(body.requirements || '').trim().slice(0, 2000),
      items: body.items.map((item) => ({
        productId: item.productId,
        sku: item.sku,
        productName: item.productName,
        unitPrice: Number(item.unitPrice) || 0,
        mrp: Number(item.mrp) || Number(item.unitPrice) || 0,
        requestedQuantity: Math.max(1, Number(item.requestedQuantity) || 1),
      })),
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
          actor: `${body.customerName.trim()} (Customer Portal)`,
          action: `Bulk order inquiry submitted (${totalQuantity} units across ${body.items.length} SKU${body.items.length > 1 ? 's' : ''})`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    store.bulkOrders.unshift(newOrder);
    saveStore(store);
    res.status(201).json({ order: newOrder });
  });

  // 9. Admin Order Quotation & Status Update
  app.put('/api/orders/:id', (req, res) => {
    const { id } = req.params;
    const idx = store.bulkOrders.findIndex((o) => o.id === id || o.orderRef === id);
    if (idx < 0) {
      res.status(404).json({ error: 'Order not found.' });
      return;
    }

    const existing = store.bulkOrders[idx];
    const updates = req.body as Partial<BulkOrder> & { timelineNote?: string };

    if (updates.status && updates.status !== existing.status) {
      const check = canTransitionOrderStatus(existing.status, updates.status);
      if (!check.allowed) {
        res.status(400).json({ error: check.reason });
        return;
      }
    }

    const updatedItems = Array.isArray(updates.items) ? updates.items : existing.items;
    const totalQuantity = updatedItems.reduce(
      (sum, i) => sum + Math.max(1, Number(i.requestedQuantity) || 1),
      0
    );
    const negotiatedSubtotal = updatedItems.reduce(
      (sum, i) =>
        sum +
        (Number(i.negotiatedUnitPrice ?? i.unitPrice) || 0) *
          Math.max(1, Number(i.requestedQuantity) || 1),
      0
    );

    const discountPercent = Number(updates.discountPercent ?? existing.discountPercent) || 0;
    const taxPercent = Number(updates.taxPercent ?? existing.taxPercent) || 0;
    const shippingAmount = Number(updates.shippingAmount ?? existing.shippingAmount) || 0;

    const totals = calculateQuotationTotals({
      itemsSubtotal: negotiatedSubtotal,
      discountPercent,
      taxPercent,
      shippingCharges: shippingAmount,
    });

    const now = new Date().toISOString();
    const nextStatus = updates.status || existing.status;
    const nextTimeline = [...existing.timeline];

    if (updates.status && updates.status !== existing.status) {
      nextTimeline.push({
        id: `tl-${Date.now()}-status`,
        timestamp: now,
        actor: 'Administrator',
        action: `Status updated from "${existing.status}" to "${updates.status}"`,
        note: updates.timelineNote,
      });
    } else if (updates.timelineNote) {
      nextTimeline.push({
        id: `tl-${Date.now()}-note`,
        timestamp: now,
        actor: 'Administrator',
        action: updates.timelineNote,
      });
    }

    const updatedOrder: BulkOrder = {
      ...existing,
      ...updates,
      items: updatedItems,
      itemsSummary: updatedItems.map((i) => `${i.productName} (${i.requestedQuantity})`).join(', '),
      totalQuantity,
      discountPercent,
      discountAmount: totals.discountAmount,
      taxPercent,
      taxAmount: totals.taxAmount,
      shippingAmount,
      finalAmount: totals.finalAmount,
      status: nextStatus,
      timeline: nextTimeline,
      updatedAt: now,
    };

    store.bulkOrders[idx] = updatedOrder;
    saveStore(store);
    res.json({ order: updatedOrder, bulkOrders: store.bulkOrders });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Catalog Maker Pro server running on http://localhost:${PORT}`);
  });
}

startServer();
