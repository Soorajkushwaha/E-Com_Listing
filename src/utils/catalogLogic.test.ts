import test from 'node:test';
import assert from 'node:assert/strict';
import {
  autoDetectExcelColumnMapping,
  buildWhatsAppMessage,
  calculateDiscountPercent,
  calculateQuotationTotals,
  canRequestPaymentForOrder,
  canTransitionOrderStatus,
  doesProductBelongToCampaign,
  formatINR,
  getCampaignScheduleState,
  isCampaignPubliclyActive,
  resolveOrderCampaignAssociations,
  validateAndNormalizeExcelRows,
  validateThemeSchema,
} from './catalogLogic';
import type { BulkOrder, Campaign, Product } from '../types/catalog';

test('formatINR formats Indian currency properly', () => {
  assert.equal(formatINR(125000), '₹1,25,000');
  assert.equal(formatINR(2499), '₹2,499');
});

test('calculateDiscountPercent computes accurate percentage', () => {
  assert.equal(calculateDiscountPercent(1500, 2000), 25);
  assert.equal(calculateDiscountPercent(2000, 2000), 0);
  assert.equal(calculateDiscountPercent(2500, 2000), 0);
});

test('autoDetectExcelColumnMapping maps standard spreadsheet headers', () => {
  const headers = [
    'Product ID',
    'Product Name',
    'Title',
    'Category',
    'Brand',
    'Selling Price',
    'Original Price',
    'Image URL',
    'Amazon URL',
    'Campaign',
  ];
  const mapping = autoDetectExcelColumnMapping(headers);
  assert.equal(mapping.sku, 'Product ID');
  assert.equal(mapping.name, 'Product Name');
  assert.equal(mapping.sellingPrice, 'Selling Price');
  assert.equal(mapping.mrp, 'Original Price');
  assert.equal(mapping.amazonUrl, 'Amazon URL');
});

test('validateAndNormalizeExcelRows catches missing SKU, invalid URLs, local image filenames, and handles updates', () => {
  const headers = ['SKU', 'Product Name', 'Category', 'Brand', 'Selling Price', 'MRP', 'Image URL', 'Amazon URL'];
  const mapping = autoDetectExcelColumnMapping(headers);
  const existingSkus = new Set(['BRASS-URLI-01']);

  const rows = [
    {
      SKU: 'BRASS-URLI-01',
      'Product Name': 'Hammered Brass Urli Bowl',
      Category: 'Festive Decor',
      Brand: 'Kansa Heritage',
      'Selling Price': '1,850',
      MRP: '2,499',
      'Image URL': 'https://example.com/urli.jpg',
      'Amazon URL': 'https://amazon.in/dp/B012345',
    },
    {
      SKU: 'GIFT-BOX-02',
      'Product Name': 'Royal Dry Fruit Velvet Hamper',
      Category: 'Gourmet Hampers',
      Brand: 'Ananda Luxe',
      'Selling Price': '3200',
      MRP: '2800', // Lower than selling price -> should warn & normalize
      'Image URL': 'local_photo.png', // Bare filename -> should warn & not trust
      'Amazon URL': '',
    },
    {
      SKU: '',
      'Product Name': 'Row Without SKU',
      'Selling Price': '999',
    },
    {
      SKU: 'BAD-URL-03',
      'Product Name': 'Invalid Marketplace Link Item',
      'Selling Price': '1200',
      'Amazon URL': 'ftp://not-http-link',
    },
  ];

  const result = validateAndNormalizeExcelRows(rows, mapping, existingSkus, 'update');
  assert.equal(result.validProducts.length, 2);
  assert.equal(result.summary.updatedProducts, 1);
  assert.equal(result.summary.newProducts, 1);
  assert.equal(result.summary.errorRows, 2);
  // GIFT-BOX-02 normalized MRP to 3200 and cleared bare filename
  const giftBox = result.validProducts.find((p) => p.sku === 'GIFT-BOX-02');
  assert.ok(giftBox);
  assert.equal(giftBox.mrp, 3200);
  assert.equal(giftBox.imageUrl, '');
});

test('validateThemeSchema validates colors and rejects malformed themes', () => {
  const valid = validateThemeSchema({
    name: 'Diwali Royal Gold',
    primaryColor: '#D97706',
    secondaryColor: '#92400E',
    backgroundColor: '#1C1917',
    surfaceColor: '#292524',
    textColor: '#FAFAF9',
    accentColor: '#F59E0B',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Plus Jakarta Sans',
    cardLayout: 'editorial',
    borderRadius: 'md',
    buttonStyle: 'solid',
  });
  assert.equal(valid.valid, true);
  assert.ok(valid.theme);

  const invalid = validateThemeSchema({
    name: '',
    primaryColor: 'javascript:alert(1)',
    secondaryColor: '#000000',
    backgroundColor: '#ffffff',
    surfaceColor: '#f5f5f5',
    textColor: '#111111',
    accentColor: '#ff0000',
  });
  assert.equal(invalid.valid, false);
  assert.ok(invalid.errors.length >= 2);
});

test('calculateQuotationTotals computes discount, GST, and shipping accurately', () => {
  const totals = calculateQuotationTotals({
    itemsSubtotal: 100000,
    discountPercent: 10,
    taxPercent: 18,
    shippingCharges: 2500,
  });
  assert.equal(totals.discountAmount, 10000);
  assert.equal(totals.taxableAmount, 90000);
  assert.equal(totals.taxAmount, 16200);
  assert.equal(totals.finalAmount, 108700);
});

test('payment workflow and status transitions enforce confirmation before payment or dispatch', () => {
  assert.equal(canRequestPaymentForOrder('New Request'), false);
  assert.equal(canRequestPaymentForOrder('Quote Prepared'), false);
  assert.equal(canRequestPaymentForOrder('Order Confirmed'), true);
  assert.equal(canRequestPaymentForOrder('Awaiting Payment'), true);

  const prematurePaid = canTransitionOrderStatus('New Request', 'Paid');
  assert.equal(prematurePaid.allowed, false);

  const validConfirm = canTransitionOrderStatus('Awaiting Customer Approval', 'Order Confirmed');
  assert.equal(validConfirm.allowed, true);
});

test('buildWhatsAppMessage generates URL-encoded wa.me link', () => {
  const mockOrder: BulkOrder = {
    id: 'ord-1',
    orderRef: 'ORD-2026-101',
    ownerId: 'admin-1',
    customerName: 'Aarav Mehta',
    companyName: 'Mehta FinCorp',
    mobile: '9876543210',
    whatsapp: '9876543210',
    email: 'aarav@mehtafincorp.in',
    address: '12 Nariman Point',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400021',
    gstNumber: '27AABCM1234F1Z5',
    campaignSlug: 'diwali-2026',
    expectedDeliveryDate: '2026-11-05',
    preferredContact: 'whatsapp',
    requirements: 'Gold foil logo on boxes',
    items: [
      {
        productId: 'p1',
        sku: 'BRASS-URLI-01',
        productName: 'Hammered Brass Urli Bowl',
        unitPrice: 1850,
        mrp: 2499,
        requestedQuantity: 50,
      },
    ],
    itemsSummary: 'Hammered Brass Urli Bowl (50 units)',
    totalQuantity: 50,
    estimatedAmount: 92500,
    discountPercent: 5,
    discountAmount: 4625,
    taxPercent: 18,
    taxAmount: 15818,
    shippingAmount: 1500,
    finalAmount: 105193,
    quotationDate: '2026-10-25',
    quotationValidUntil: '2026-11-01',
    status: 'Quote Prepared',
    paymentStatus: 'unpaid',
    paymentLink: 'https://pay.catalogmaker.pro/ORD-2026-101',
    transactionRef: '',
    courierName: 'BlueDart Priority',
    trackingNumber: 'BD99887766',
    internalNotes: '',
    timeline: [],
    createdAt: '2026-10-25T00:00:00Z',
    updatedAt: '2026-10-25T00:00:00Z',
  };

  const msg = buildWhatsAppMessage('quotation', mockOrder);
  assert.ok(msg.text.includes('ORD-2026-101'));
  assert.ok(msg.text.includes('₹1,05,193'));
  assert.ok(msg.url.startsWith('https://wa.me/919876543210?text='));
});

test('isCampaignPubliclyActive and getCampaignScheduleState enforce active status and date range', () => {
  const baseCampaign: Campaign = {
    id: 'camp-1',
    slug: 'diwali-2026',
    name: 'Diwali Specials',
    description: 'Festive collection',
    bannerTitle: 'Diwali Specials',
    bannerSubtitle: 'Bulk deals',
    startDate: '2026-10-01',
    endDate: '2026-11-20',
    themeId: 'theme-diwali-gold',
    status: 'active',
    ownerId: 'admin',
    createdAt: '',
    updatedAt: '',
  };

  assert.equal(isCampaignPubliclyActive(baseCampaign, '2026-10-25'), true);
  assert.equal(getCampaignScheduleState(baseCampaign, '2026-10-25'), 'active');

  assert.equal(isCampaignPubliclyActive(baseCampaign, '2026-09-15'), false);
  assert.equal(getCampaignScheduleState(baseCampaign, '2026-09-15'), 'scheduled');

  assert.equal(isCampaignPubliclyActive(baseCampaign, '2026-12-01'), false);
  assert.equal(getCampaignScheduleState(baseCampaign, '2026-12-01'), 'expired');

  const inactiveCampaign: Campaign = { ...baseCampaign, status: 'inactive' };
  assert.equal(isCampaignPubliclyActive(inactiveCampaign, '2026-10-25'), false);
  assert.equal(getCampaignScheduleState(inactiveCampaign, '2026-10-25'), 'inactive');
});

test('doesProductBelongToCampaign checks primary campaign, campaigns array, and campaign productIds', () => {
  const campaign: Campaign = {
    id: 'camp-corp',
    slug: 'corporate-gifting',
    name: 'Corporate Gifting',
    description: '',
    bannerTitle: '',
    bannerSubtitle: '',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    themeId: 'theme-corporate-blue',
    productIds: ['prod-explicit'],
    status: 'active',
    ownerId: 'admin',
    createdAt: '',
    updatedAt: '',
  };

  const pPrimary: Product = {
    id: 'prod-1',
    sku: 'SKU-1',
    name: 'Item 1',
    heading: 'Item 1',
    subtitle: '',
    description: '',
    category: 'Decor',
    brand: 'Brand',
    imageUrl: '',
    sellingPrice: 1000,
    mrp: 1200,
    badge: '',
    campaign: 'corporate-gifting',
    status: 'active',
    stockStatus: 'in_stock',
    rating: 4.8,
    ratingCount: 10,
    amazonUrl: '',
    flipkartUrl: '',
    meeshoUrl: '',
    websiteUrl: '',
    featured: false,
    sortOrder: 1,
    ownerId: 'admin',
    createdAt: '',
    updatedAt: '',
  };

  const pMulti: Product = {
    ...pPrimary,
    id: 'prod-2',
    campaign: 'diwali-2026',
    campaigns: ['diwali-2026', 'corporate-gifting'],
  };

  const pExplicit: Product = {
    ...pPrimary,
    id: 'prod-explicit',
    campaign: 'wedding-season',
  };

  assert.equal(doesProductBelongToCampaign(pPrimary, campaign), true);
  assert.equal(doesProductBelongToCampaign(pMulti, campaign), true);
  assert.equal(doesProductBelongToCampaign(pExplicit, campaign), true);
});

test('resolveOrderCampaignAssociations tracks single and multi-campaign bulk orders', () => {
  const campaigns: Campaign[] = [
    {
      id: 'camp-diwali',
      slug: 'diwali-2026',
      name: 'Diwali',
      description: '',
      bannerTitle: '',
      bannerSubtitle: '',
      startDate: '2026-10-01',
      endDate: '2026-11-20',
      themeId: 't1',
      status: 'active',
      ownerId: 'admin',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'camp-wedding',
      slug: 'wedding-season',
      name: 'Wedding',
      description: '',
      bannerTitle: '',
      bannerSubtitle: '',
      startDate: '2026-10-01',
      endDate: '2027-02-28',
      themeId: 't1',
      status: 'active',
      ownerId: 'admin',
      createdAt: '',
      updatedAt: '',
    },
  ];

  const products: Product[] = [
    {
      id: 'p1',
      sku: 'S1',
      name: 'P1',
      heading: 'P1',
      subtitle: '',
      description: '',
      category: 'C',
      brand: 'B',
      imageUrl: '',
      sellingPrice: 500,
      mrp: 600,
      badge: '',
      campaign: 'diwali-2026',
      status: 'active',
      stockStatus: 'in_stock',
      rating: 4.8,
      ratingCount: 10,
      amazonUrl: '',
      flipkartUrl: '',
      meeshoUrl: '',
      websiteUrl: '',
      featured: false,
      sortOrder: 1,
      ownerId: 'admin',
      createdAt: '',
      updatedAt: '',
    },
    {
      id: 'p2',
      sku: 'S2',
      name: 'P2',
      heading: 'P2',
      subtitle: '',
      description: '',
      category: 'C',
      brand: 'B',
      imageUrl: '',
      sellingPrice: 800,
      mrp: 1000,
      badge: '',
      campaign: 'wedding-season',
      status: 'active',
      stockStatus: 'in_stock',
      rating: 4.8,
      ratingCount: 10,
      amazonUrl: '',
      flipkartUrl: '',
      meeshoUrl: '',
      websiteUrl: '',
      featured: false,
      sortOrder: 2,
      ownerId: 'admin',
      createdAt: '',
      updatedAt: '',
    },
  ];

  const resolved = resolveOrderCampaignAssociations({
    explicitCampaignSlug: 'diwali-2026',
    items: [{ productId: 'p1' }, { productId: 'p2' }],
    products,
    campaigns,
  });

  assert.equal(resolved.campaignId, 'camp-diwali');
  assert.equal(resolved.campaignSlug, 'diwali-2026');
  assert.deepEqual(resolved.campaignSlugs, ['diwali-2026', 'wedding-season']);
});

test('validateAndNormalizeExcelRows warns on unknown campaign names and supports defaultCampaignSlug', () => {
  const headers = ['SKU', 'Product Name', 'Selling Price', 'Campaign'];
  const mapping = autoDetectExcelColumnMapping(headers);
  const rows = [
    {
      SKU: 'NEW-101',
      'Product Name': 'Brass Diya Stand',
      'Selling Price': '1400',
      Campaign: 'Unlisted Mystery Festival',
    },
  ];
  const knownSlugs = new Set(['diwali-2026', 'corporate-gifting']);
  const result = validateAndNormalizeExcelRows(
    rows,
    mapping,
    new Set(),
    'update',
    knownSlugs,
    'diwali-2026'
  );
  assert.equal(result.validProducts.length, 1);
  assert.ok(result.summary.warningCount >= 1);
  assert.ok(result.issues.some((i) => i.message.includes('does not match an existing campaign')));
});

