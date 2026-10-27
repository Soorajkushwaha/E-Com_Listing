export type ProductStatus = 'active' | 'draft' | 'archived';
export type StockStatus = 'in_stock' | 'low_stock' | 'made_to_order' | 'out_of_stock';

export interface Product {
  id: string;
  sku: string;
  name: string;
  heading: string;
  subtitle: string;
  description: string;
  category: string;
  brand: string;
  imageUrl: string;
  additionalImages?: string[];
  sellingPrice: number;
  mrp: number;
  badge: string;
  campaign: string;
  campaigns?: string[];
  status: ProductStatus;
  stockStatus: StockStatus;
  rating: number;
  ratingCount: number;
  amazonUrl: string;
  flipkartUrl: string;
  meeshoUrl: string;
  websiteUrl: string;
  featured: boolean;
  sortOrder: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type CardLayoutStyle = 'editorial' | 'minimal' | 'bordered' | 'elevated';
export type BorderRadiusToken = 'none' | 'sm' | 'md' | 'lg' | 'xl';
export type ButtonStyleToken = 'solid' | 'outline' | 'soft';

export interface CatalogTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
  cardLayout: CardLayoutStyle;
  borderRadius: BorderRadiusToken;
  buttonStyle: ButtonStyleToken;
  isPublic: boolean;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  slug: string;
  name: string;
  description: string;
  bannerTitle: string;
  bannerSubtitle: string;
  bannerImageUrl?: string;
  promotionalHeadline?: string;
  accentColor?: string;
  productIds?: string[];
  startDate: string;
  endDate: string;
  themeId: string;
  status: 'active' | 'inactive';
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export type OrderStatus =
  | 'New Request'
  | 'Contact Customer'
  | 'Quote Prepared'
  | 'Awaiting Customer Approval'
  | 'Order Confirmed'
  | 'Awaiting Payment'
  | 'Paid'
  | 'Processing'
  | 'Dispatched'
  | 'Delivered'
  | 'Cancelled'
  | 'Rejected';

export type PaymentStatus = 'unpaid' | 'link_sent' | 'paid' | 'refunded';

export interface BulkOrderItem {
  productId: string;
  sku: string;
  productName: string;
  unitPrice: number;
  mrp: number;
  requestedQuantity: number;
  negotiatedUnitPrice?: number;
  campaignSlug?: string;
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  note?: string;
}

export interface BulkOrder {
  id: string;
  orderRef: string;
  ownerId: string;
  customerName: string;
  companyName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  gstNumber: string;
  campaignId?: string;
  campaignSlug: string;
  campaignSlugs?: string[];
  expectedDeliveryDate: string;
  preferredContact: 'whatsapp' | 'phone' | 'email';
  requirements: string;
  items: BulkOrderItem[];
  itemsSummary: string;
  totalQuantity: number;
  estimatedAmount: number;
  discountPercent: number;
  discountAmount: number;
  taxPercent: number;
  taxAmount: number;
  shippingAmount: number;
  finalAmount: number;
  quotationDate: string;
  quotationValidUntil: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentLink: string;
  transactionRef: string;
  courierName: string;
  trackingNumber: string;
  internalNotes: string;
  timeline: ActivityLogEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface CustomerSummary {
  id: string;
  customerName: string;
  companyName: string;
  mobile: string;
  whatsapp: string;
  email: string;
  city: string;
  state: string;
  gstNumber: string;
  orderCount: number;
  confirmedValue: number;
  lastOrderDate: string;
  notes: string;
  orders: BulkOrder[];
}

export interface ExcelColumnMapping {
  sku: string;
  name: string;
  heading: string;
  subtitle: string;
  description: string;
  category: string;
  brand: string;
  imageUrl: string;
  sellingPrice: string;
  mrp: string;
  amazonUrl: string;
  flipkartUrl: string;
  meeshoUrl: string;
  websiteUrl: string;
  rating: string;
  ratingCount: string;
  badge: string;
  campaign: string;
  stockStatus: string;
}

export interface ExcelRowValidationIssue {
  rowNumber: number;
  sku: string;
  severity: 'error' | 'warning';
  message: string;
}

export interface ExcelValidationResult {
  validProducts: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>[];
  issues: ExcelRowValidationIssue[];
  summary: {
    totalRows: number;
    newProducts: number;
    updatedProducts: number;
    skippedRows: number;
    errorRows: number;
    warningCount: number;
  };
}

export type AIProvider = 'gemini' | 'openai' | 'deepseek' | 'grok' | 'local';
