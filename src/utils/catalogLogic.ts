import type {
  BulkOrder,
  CatalogTheme,
  Campaign,
  ExcelColumnMapping,
  ExcelRowValidationIssue,
  ExcelValidationResult,
  OrderStatus,
  Product,
  StockStatus,
} from '../types/catalog.ts';

export const ORDER_LIFECYCLE_STAGES: OrderStatus[] = [
  'New Request',
  'Contact Customer',
  'Quote Prepared',
  'Awaiting Customer Approval',
  'Order Confirmed',
  'Awaiting Payment',
  'Paid',
  'Processing',
  'Dispatched',
  'Delivered',
  'Cancelled',
  'Rejected',
];

/**
 * Formats numbers using the Indian numbering system with ₹ symbol (e.g. ₹1,24,500).
 */
export function formatINR(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(safe);
}

/**
 * Calculates percentage discount between MRP and selling price.
 */
export function calculateDiscountPercent(sellingPrice: number, mrp: number): number {
  if (!Number.isFinite(sellingPrice) || !Number.isFinite(mrp) || mrp <= 0 || sellingPrice >= mrp) {
    return 0;
  }
  return Math.round(((mrp - sellingPrice) / mrp) * 100);
}

/**
 * Automatically maps spreadsheet column headers to Catalog Maker Pro fields.
 */
export function autoDetectExcelColumnMapping(headers: string[]): ExcelColumnMapping {
  const findMatch = (candidates: string[]): string => {
    for (const candidate of candidates) {
      const exact = headers.find((h) => h.trim().toLowerCase() === candidate.toLowerCase());
      if (exact) return exact;
    }
    for (const candidate of candidates) {
      const partial = headers.find((h) => h.trim().toLowerCase().includes(candidate.toLowerCase()));
      if (partial) return partial;
    }
    return '';
  };

  return {
    sku: findMatch(['sku', 'product id', 'item code', 'product_id', 'code']),
    name: findMatch(['product name', 'name', 'item name']),
    heading: findMatch(['title', 'heading', 'display title']),
    subtitle: findMatch(['subtitle', 'sub-heading', 'tagline']),
    description: findMatch(['product description', 'description', 'details']),
    category: findMatch(['category', 'department', 'collection']),
    brand: findMatch(['brand', 'manufacturer', 'maker']),
    imageUrl: findMatch(['image url', 'image', 'photo', 'image filename']),
    sellingPrice: findMatch(['selling price', 'price', 'offer price', 'sale price']),
    mrp: findMatch(['mrp', 'original price', 'list price', 'retail price']),
    amazonUrl: findMatch(['amazon url', 'amazon', 'amazon link']),
    flipkartUrl: findMatch(['flipkart url', 'flipkart', 'flipkart link']),
    meeshoUrl: findMatch(['meesho url', 'meesho', 'meesho link']),
    websiteUrl: findMatch(['own website url', 'website url', 'website', 'store link']),
    rating: findMatch(['rating', 'stars', 'avg rating']),
    ratingCount: findMatch(['rating count', 'reviews', 'review count']),
    badge: findMatch(['badge', 'label', 'tag', 'promo badge']),
    campaign: findMatch(['campaign', 'occasion', 'festival', 'event']),
    stockStatus: findMatch(['stock', 'availability', 'stock status', 'inventory']),
  };
}

function isValidHttpOrDataUrl(val: string): boolean {
  if (!val) return true;
  const trimmed = val.trim();
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('/')
  );
}

function normalizeStockStatus(raw: string): StockStatus {
  const lower = (raw || '').trim().toLowerCase();
  if (!lower) return 'in_stock';
  if (lower.includes('out') || lower === '0' || lower === 'unavailable') return 'out_of_stock';
  if (lower.includes('low') || lower.includes('limited')) return 'low_stock';
  if (lower.includes('order') || lower.includes('custom')) return 'made_to_order';
  return 'in_stock';
}

/**
 * Validates and normalizes parsed Excel rows against application rules.
 */
export function validateAndNormalizeExcelRows(
  rows: Record<string, any>[],
  mapping: ExcelColumnMapping,
  existingSkus: Set<string>,
  duplicateMode: 'update' | 'skip' | 'error' = 'update',
  knownCampaignSlugs?: Set<string>,
  defaultCampaignSlug = 'diwali-2026'
): ExcelValidationResult {
  const validProducts: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>[] = [];
  const issues: ExcelRowValidationIssue[] = [];
  const seenInFile = new Set<string>();

  let newProducts = 0;
  let updatedProducts = 0;
  let skippedRows = 0;
  let errorRows = 0;
  let warningCount = 0;

  rows.forEach((row, index) => {
    const rowNumber = index + 2; // 1-based + header row
    const getVal = (colName: string): string => {
      if (!colName || !(colName in row) || row[colName] === undefined || row[colName] === null) {
        return '';
      }
      return String(row[colName]).trim();
    };

    const rawSku = getVal(mapping.sku);
    const sku = rawSku.replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase();
    const name = getVal(mapping.name);
    const category = getVal(mapping.category) || 'General Gifting';
    const brand = getVal(mapping.brand) || 'House of Artisan';

    if (!sku) {
      issues.push({
        rowNumber,
        sku: '(Missing SKU)',
        severity: 'error',
        message: 'Row is missing a valid SKU / Product ID.',
      });
      errorRows++;
      return;
    }

    if (!name) {
      issues.push({
        rowNumber,
        sku,
        severity: 'error',
        message: `Product "${sku}" is missing a required Product Name.`,
      });
      errorRows++;
      return;
    }

    if (seenInFile.has(sku)) {
      if (duplicateMode === 'error') {
        issues.push({
          rowNumber,
          sku,
          severity: 'error',
          message: `Duplicate SKU "${sku}" found within the same Excel worksheet.`,
        });
        errorRows++;
        return;
      } else {
        issues.push({
          rowNumber,
          sku,
          severity: 'warning',
          message: `Duplicate SKU "${sku}" in worksheet; skipping duplicate row.`,
        });
        warningCount++;
        skippedRows++;
        return;
      }
    }
    seenInFile.add(sku);

    const existsInDb = existingSkus.has(sku);
    if (existsInDb) {
      if (duplicateMode === 'skip') {
        issues.push({
          rowNumber,
          sku,
          severity: 'warning',
          message: `SKU "${sku}" already exists in catalog and duplicate mode is set to Skip.`,
        });
        warningCount++;
        skippedRows++;
        return;
      }
      if (duplicateMode === 'error') {
        issues.push({
          rowNumber,
          sku,
          severity: 'error',
          message: `SKU "${sku}" already exists in catalog.`,
        });
        errorRows++;
        return;
      }
    }

    const rawSelling = getVal(mapping.sellingPrice).replace(/[₹,\s]/g, '');
    const rawMrp = getVal(mapping.mrp).replace(/[₹,\s]/g, '');
    const sellingPrice = Number(rawSelling);
    const mrp = rawMrp ? Number(rawMrp) : sellingPrice;

    if (!rawSelling || !Number.isFinite(sellingPrice) || sellingPrice <= 0) {
      issues.push({
        rowNumber,
        sku,
        severity: 'error',
        message: `Invalid Selling Price "${getVal(mapping.sellingPrice)}" for SKU "${sku}". Must be a positive number.`,
      });
      errorRows++;
      return;
    }

    if (!Number.isFinite(mrp) || mrp < sellingPrice) {
      issues.push({
        rowNumber,
        sku,
        severity: 'warning',
        message: `MRP (${rawMrp || 'empty'}) was less than Selling Price; normalized MRP to match Selling Price.`,
      });
      warningCount++;
    }

    const rawImage = getVal(mapping.imageUrl);
    let imageUrl = '';
    if (!rawImage) {
      issues.push({
        rowNumber,
        sku,
        severity: 'warning',
        message: `No image URL provided for "${sku}". A studio placeholder will be used until an image is uploaded.`,
      });
      warningCount++;
    } else if (!isValidHttpOrDataUrl(rawImage)) {
      // Bare filename like "urli.jpg" — never assume a local filename is publicly accessible
      issues.push({
        rowNumber,
        sku,
        severity: 'warning',
        message: `Image cell "${rawImage}" is a local filename rather than a public URL. Flagged for manual upload.`,
      });
      warningCount++;
    } else {
      imageUrl = rawImage;
    }

    const amazonUrl = getVal(mapping.amazonUrl);
    const flipkartUrl = getVal(mapping.flipkartUrl);
    const meeshoUrl = getVal(mapping.meeshoUrl);
    const websiteUrl = getVal(mapping.websiteUrl);

    for (const [label, urlVal] of [
      ['Amazon URL', amazonUrl],
      ['Flipkart URL', flipkartUrl],
      ['Meesho URL', meeshoUrl],
      ['Website URL', websiteUrl],
    ] as const) {
      if (urlVal && !urlVal.startsWith('http://') && !urlVal.startsWith('https://')) {
        issues.push({
          rowNumber,
          sku,
          severity: 'error',
          message: `Invalid ${label} "${urlVal}" on row ${rowNumber}. Must start with http:// or https://.`,
        });
        errorRows++;
        return;
      }
    }

    const rawRating = Number(getVal(mapping.rating));
    const rating = Number.isFinite(rawRating) && rawRating > 0 ? Math.min(5, Math.max(1, rawRating)) : 4.8;
    const rawRatingCount = Number(getVal(mapping.ratingCount));
    const ratingCount = Number.isFinite(rawRatingCount) && rawRatingCount >= 0 ? Math.round(rawRatingCount) : 42;

    const rawCampaignCell = getVal(mapping.campaign);
    const parsedCampaignSlugs = rawCampaignCell
      ? rawCampaignCell
          .split(/[,;|]+/)
          .map((s) => s.trim().toLowerCase().replace(/\s+/g, '-'))
          .filter(Boolean)
      : [defaultCampaignSlug];

    if (knownCampaignSlugs && knownCampaignSlugs.size > 0 && rawCampaignCell) {
      for (const slug of parsedCampaignSlugs) {
        if (!knownCampaignSlugs.has(slug)) {
          issues.push({
            rowNumber,
            sku,
            severity: 'warning',
            message: `Campaign "${slug}" on row ${rowNumber} does not match an existing campaign. You can create this campaign or reassign the product after import.`,
          });
          warningCount++;
        }
      }
    }

    const primaryCampaign = (parsedCampaignSlugs[0] || defaultCampaignSlug).slice(0, 100);

    if (existsInDb) {
      updatedProducts++;
    } else {
      newProducts++;
    }

    validProducts.push({
      sku,
      name: name.slice(0, 200),
      heading: (getVal(mapping.heading) || name).slice(0, 200),
      subtitle: (getVal(mapping.subtitle) || `${brand} · ${category}`).slice(0, 300),
      description: (
        getVal(mapping.description) ||
        `Premium ${name} crafted by ${brand} for bulk gifting and wholesale orders.`
      ).slice(0, 2000),
      category: category.slice(0, 100),
      brand: brand.slice(0, 100),
      imageUrl,
      sellingPrice: Math.round(sellingPrice),
      mrp: Math.round(Math.max(mrp, sellingPrice)),
      badge: getVal(mapping.badge).slice(0, 60),
      campaign: primaryCampaign,
      campaigns: parsedCampaignSlugs,
      status: 'active',
      stockStatus: normalizeStockStatus(getVal(mapping.stockStatus)),
      rating,
      ratingCount,
      amazonUrl: amazonUrl.slice(0, 500),
      flipkartUrl: flipkartUrl.slice(0, 500),
      meeshoUrl: meeshoUrl.slice(0, 500),
      websiteUrl: websiteUrl.slice(0, 500),
      featured: false,
      sortOrder: index + 1,
    });
  });

  return {
    validProducts,
    issues,
    summary: {
      totalRows: rows.length,
      newProducts,
      updatedProducts,
      skippedRows,
      errorRows,
      warningCount,
    },
  };
}

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/**
 * Strictly validates an AI-generated or user-edited theme object against the CatalogTheme schema.
 */
export function validateThemeSchema(raw: unknown): {
  valid: boolean;
  theme?: Omit<CatalogTheme, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>;
  errors: string[];
} {
  const errors: string[] = [];
  if (!raw || typeof raw !== 'object') {
    return { valid: false, errors: ['Theme payload must be a JSON object.'] };
  }

  const obj = raw as Record<string, any>;
  const name = typeof obj.name === 'string' ? obj.name.trim() : '';
  if (!name || name.length > 100) {
    errors.push('Theme "name" must be a non-empty string up to 100 characters.');
  }

  const colorFields = [
    'primaryColor',
    'secondaryColor',
    'backgroundColor',
    'surfaceColor',
    'textColor',
    'accentColor',
  ] as const;

  for (const field of colorFields) {
    const val = typeof obj[field] === 'string' ? obj[field].trim() : '';
    if (!HEX_COLOR_REGEX.test(val)) {
      errors.push(`Field "${field}" must be a valid hex color (e.g. #D97706), received "${val}".`);
    }
  }

  const headingFont = typeof obj.headingFont === 'string' ? obj.headingFont.trim() : 'Cormorant Garamond';
  const bodyFont = typeof obj.bodyFont === 'string' ? obj.bodyFont.trim() : 'Plus Jakarta Sans';

  const allowedLayouts = ['editorial', 'minimal', 'bordered', 'elevated'] as const;
  const cardLayout = allowedLayouts.includes(obj.cardLayout) ? obj.cardLayout : 'bordered';

  const allowedRadii = ['none', 'sm', 'md', 'lg', 'xl'] as const;
  const borderRadius = allowedRadii.includes(obj.borderRadius) ? obj.borderRadius : 'md';

  const allowedButtons = ['solid', 'outline', 'soft'] as const;
  const buttonStyle = allowedButtons.includes(obj.buttonStyle) ? obj.buttonStyle : 'solid';

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    theme: {
      name,
      primaryColor: obj.primaryColor.trim(),
      secondaryColor: obj.secondaryColor.trim(),
      backgroundColor: obj.backgroundColor.trim(),
      surfaceColor: obj.surfaceColor.trim(),
      textColor: obj.textColor.trim(),
      accentColor: obj.accentColor.trim(),
      headingFont,
      bodyFont,
      cardLayout,
      borderRadius,
      buttonStyle,
      isPublic: true,
    },
  };
}

/**
 * Calculates quotation totals with discount, GST, and shipping charges.
 */
export function calculateQuotationTotals(input: {
  itemsSubtotal: number;
  discountPercent: number;
  taxPercent: number;
  shippingCharges: number;
}): {
  discountAmount: number;
  taxableAmount: number;
  taxAmount: number;
  finalAmount: number;
} {
  const subtotal = Math.max(0, Number(input.itemsSubtotal) || 0);
  const discPct = Math.min(100, Math.max(0, Number(input.discountPercent) || 0));
  const taxPct = Math.min(50, Math.max(0, Number(input.taxPercent) || 0));
  const shipping = Math.max(0, Number(input.shippingCharges) || 0);

  const discountAmount = Math.round((subtotal * discPct) / 100);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round((taxableAmount * taxPct) / 100);
  const finalAmount = Math.round(taxableAmount + taxAmount + shipping);

  return {
    discountAmount,
    taxableAmount,
    taxAmount,
    finalAmount,
  };
}

/**
 * Enforces payment workflow rule: Payment is only requested AFTER order confirmation.
 */
export function canRequestPaymentForOrder(status: OrderStatus): boolean {
  const confirmedOrLater: OrderStatus[] = [
    'Order Confirmed',
    'Awaiting Payment',
    'Paid',
    'Processing',
    'Dispatched',
    'Delivered',
  ];
  return confirmedOrLater.includes(status);
}

/**
 * Validates order lifecycle status transitions.
 */
export function canTransitionOrderStatus(
  current: OrderStatus,
  next: OrderStatus
): { allowed: boolean; reason?: string } {
  if (current === next) return { allowed: true };
  if (next === 'Cancelled' || next === 'Rejected') {
    if (current === 'Delivered') {
      return { allowed: false, reason: 'Delivered orders cannot be marked Cancelled or Rejected.' };
    }
    return { allowed: true };
  }

  const preConfirmStates: OrderStatus[] = [
    'New Request',
    'Contact Customer',
    'Quote Prepared',
    'Awaiting Customer Approval',
  ];

  if (preConfirmStates.includes(current) && (next === 'Paid' || next === 'Dispatched' || next === 'Delivered')) {
    return {
      allowed: false,
      reason: `Order must be marked "Order Confirmed" before transitioning to "${next}".`,
    };
  }

  return { allowed: true };
}

/**
 * Builds prefilled manual WhatsApp communication message and wa.me URL with proper URL encoding.
 */
export function buildWhatsAppMessage(
  templateType: 'initial' | 'quotation' | 'confirmation' | 'payment' | 'dispatch',
  order: BulkOrder
): { text: string; url: string } {
  const cleanPhone = (order.whatsapp || order.mobile || '').replace(/[^0-9]/g, '');
  const normalizedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  const primaryProduct =
    order.items && order.items.length > 0
      ? order.items.length === 1
        ? order.items[0].productName
        : `${order.items[0].productName} (+${order.items.length - 1} more)`
      : order.itemsSummary;

  const amountStr = (order.finalAmount || order.estimatedAmount || 0).toLocaleString('en-IN');

  let text = '';
  switch (templateType) {
    case 'initial':
      text = `Hello ${order.customerName}, thank you for your bulk order inquiry for ${primaryProduct}. We have received your request ${order.orderRef}. We will review your requirements and contact you shortly.`;
      break;
    case 'quotation':
      text = `Hello ${order.customerName}, your quotation ${order.orderRef} is ready. Requested quantity: ${order.totalQuantity}. Final quoted amount: ₹${amountStr}. Please review and confirm so we can proceed.`;
      break;
    case 'confirmation':
      text = `Hello ${order.customerName}, your bulk order ${order.orderRef} has been confirmed. The final amount is ₹${amountStr}. We will share the payment details after confirmation of the order.`;
      break;
    case 'payment':
      text = `Hello ${order.customerName}, your order ${order.orderRef} is ready for payment. Amount due: ₹${amountStr}. Payment link: ${order.paymentLink || '[Payment Link Pending]'}. Please let us know once payment is completed.`;
      break;
    case 'dispatch':
      text = `Hello ${order.customerName}, your order ${order.orderRef} has been dispatched. Courier: ${order.courierName || 'Express Logistics'}. Tracking details: ${order.trackingNumber || 'Shared via SMS'}.`;
      break;
  }

  const url = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(text)}`;
  return { text, url };
}

/**
 * Determines whether a campaign is active, inactive, scheduled for the future, or expired.
 */
export function getCampaignScheduleState(
  campaign: Campaign,
  referenceDateStr = '2026-10-25'
): 'active' | 'inactive' | 'scheduled' | 'expired' {
  if (campaign.status !== 'active') {
    return 'inactive';
  }
  const ref = referenceDateStr.slice(0, 10);
  if (campaign.startDate && campaign.startDate.slice(0, 10) > ref) {
    return 'scheduled';
  }
  if (campaign.endDate && campaign.endDate.slice(0, 10) < ref) {
    return 'expired';
  }
  return 'active';
}

/**
 * Returns true only if a campaign is marked active AND within its start/end date window.
 */
export function isCampaignPubliclyActive(
  campaign: Campaign,
  referenceDateStr = '2026-10-25'
): boolean {
  return getCampaignScheduleState(campaign, referenceDateStr) === 'active';
}

/**
 * Checks whether a product belongs to a campaign via:
 * 1. Explicit campaign.productIds assignment
 * 2. product.campaigns array
 * 3. product.campaign string (supports single slug or comma-separated slugs)
 */
export function doesProductBelongToCampaign(
  product: Product,
  campaignOrSlug: Campaign | string,
  optionalCampaign?: Campaign
): boolean {
  const campaignObj = typeof campaignOrSlug === 'object' ? campaignOrSlug : optionalCampaign;
  const campaignSlug = typeof campaignOrSlug === 'string' ? campaignOrSlug : campaignOrSlug?.slug || '';

  if (!campaignSlug || campaignSlug === 'all') return true;
  const target = campaignSlug.trim().toLowerCase();

  if (campaignObj?.productIds && Array.isArray(campaignObj.productIds)) {
    if (campaignObj.productIds.includes(product.id) || campaignObj.productIds.includes(product.sku)) {
      return true;
    }
  }

  if (Array.isArray(product.campaigns)) {
    if (product.campaigns.some((c) => c.trim().toLowerCase() === target)) {
      return true;
    }
  }

  if (product.campaign) {
    const tokens = product.campaign
      .split(/[,;|]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);
    if (tokens.includes(target)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves all campaign associations for a single or multi-product bulk order request
 * without duplicating the order.
 */
export function resolveOrderCampaignAssociations(
  itemsOrOptions:
    | { productId?: string; sku?: string; campaignSlug?: string }[]
    | {
        explicitCampaignSlug?: string;
        items: { productId?: string; sku?: string; campaignSlug?: string }[];
        products: Product[];
        campaigns: Campaign[];
      },
  allProductsArg?: Product[],
  selectedCampaignSlugArg?: string,
  campaignsArg?: Campaign[]
): { campaignId: string; campaignSlug: string; campaignSlugs: string[] } {
  const isObj = !Array.isArray(itemsOrOptions);
  const items = isObj ? itemsOrOptions.items : itemsOrOptions;
  const allProducts = isObj ? itemsOrOptions.products : allProductsArg || [];
  const selectedCampaignSlug = isObj
    ? itemsOrOptions.explicitCampaignSlug || ''
    : selectedCampaignSlugArg || '';
  const campaigns = isObj ? itemsOrOptions.campaigns : campaignsArg || [];

  const slugSet = new Set<string>();
  if (selectedCampaignSlug && selectedCampaignSlug !== 'all') {
    slugSet.add(selectedCampaignSlug);
  }

  items.forEach((item) => {
    if (item.campaignSlug && item.campaignSlug !== 'all') {
      slugSet.add(item.campaignSlug);
    }
    const prod = allProducts.find(
      (p) =>
        p.id === item.productId ||
        (item.sku && p.sku.toUpperCase() === item.sku.toUpperCase())
    );
    if (prod) {
      if (prod.campaign) {
        prod.campaign
          .split(/[,;|]+/)
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean)
          .forEach((s) => slugSet.add(s));
      }
      if (Array.isArray(prod.campaigns)) {
        prod.campaigns.forEach((s) => {
          if (s.trim()) slugSet.add(s.trim().toLowerCase());
        });
      }
      campaigns.forEach((c) => {
        if (c.productIds?.includes(prod.id)) {
          slugSet.add(c.slug);
        }
      });
    }
  });

  const campaignSlugs = Array.from(slugSet);
  const primarySlug =
    selectedCampaignSlug && selectedCampaignSlug !== 'all'
      ? selectedCampaignSlug
      : campaignSlugs[0] || 'diwali-2026';
  const matchedCamp = campaigns.find((c) => c.slug === primarySlug);

  return {
    campaignId: matchedCamp?.id || `camp-${primarySlug}`,
    campaignSlug: primarySlug,
    campaignSlugs: campaignSlugs.length > 0 ? campaignSlugs : [primarySlug],
  };
}


