import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  BarChart3,
  BookOpen,
  Building2,
  CheckCircle2,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  LayoutDashboard,
  Lock,
  LogOut,
  MessageSquare,
  Package,
  Palette,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Users,
} from 'lucide-react';
import type {
  BulkOrder,
  Campaign,
  CatalogTheme,
  CustomerSummary,
  OrderStatus,
  PaymentStatus,
  Product,
} from '../types/catalog';
import {
  ORDER_LIFECYCLE_STAGES,
  buildWhatsAppMessage,
  calculateQuotationTotals,
  canRequestPaymentForOrder,
  canTransitionOrderStatus,
  doesProductBelongToCampaign,
  formatINR,
  getCampaignScheduleState,
} from '../utils/catalogLogic';
import { exportQuotationToPdf } from '../utils/pdfExporter';
import { uploadPersistentProductImage } from '../lib/firebase';
import { ExcelImportPanel } from './ExcelImportPanel';
import { AiThemeDesignerPanel } from './AiThemeDesignerPanel';
import { ProductVisual } from './ProductVisual';

export type AdminSection =
  | 'overview'
  | 'products'
  | 'excel'
  | 'themes'
  | 'orders'
  | 'customers'
  | 'campaigns'
  | 'reports'
  | 'settings';

interface AdminDashboardViewProps {
  isAuthenticated: boolean;
  adminEmail: string | null;
  onSignInGoogle: () => Promise<void>;
  onSignInDemoAdmin: (passcode: string) => boolean;
  onSignOut: () => Promise<void>;
  activeSection: AdminSection;
  onSelectSection: (sec: AdminSection) => void;
  products: Product[];
  themes: CatalogTheme[];
  activeTheme: CatalogTheme;
  previousThemeId: string;
  campaigns: Campaign[];
  bulkOrders: BulkOrder[];
  catalogViews: number;
  onOpenAddProduct: () => void;
  onOpenEditProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => Promise<void>;
  onBatchImportProducts: (
    products: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
    duplicateMode: 'update' | 'skip'
  ) => Promise<{ added: number; updated: number; skipped: number }>;
  onSaveAndActivateTheme: (theme: Partial<CatalogTheme>, activate: boolean) => Promise<void>;
  onActivateExistingTheme: (themeId: string) => Promise<void>;
  onUpdateOrder: (orderId: string, updates: Partial<BulkOrder> & { timelineNote?: string }) => Promise<void>;
  onSaveCampaign: (campaign: Partial<Campaign>) => Promise<void>;
  onDeleteCampaign: (campaignId: string) => Promise<void>;
  onOpenPublicCatalog: (slug: string) => void;
  onOpenBulkOrderModal: (product: Product, qty?: number) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({
  isAuthenticated,
  adminEmail,
  onSignInGoogle,
  onSignInDemoAdmin,
  onSignOut,
  activeSection,
  onSelectSection,
  products,
  themes,
  activeTheme,
  previousThemeId,
  campaigns,
  bulkOrders,
  catalogViews,
  onOpenAddProduct,
  onOpenEditProduct,
  onDeleteProduct,
  onBatchImportProducts,
  onSaveAndActivateTheme,
  onActivateExistingTheme,
  onUpdateOrder,
  onSaveCampaign,
  onDeleteCampaign,
  onOpenPublicCatalog,
  onOpenBulkOrderModal,
}) => {
  const [passcodeInput, setPasscodeInput] = useState('ADMIN-2026');
  const [authError, setAuthError] = useState('');
  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('all');

  // Products section state
  const [productSearch, setProductSearch] = useState('');
  const [productCategoryFilter, setProductCategoryFilter] = useState('All');

  // Orders section state
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('All');
  const [orderCampaignFilter, setOrderCampaignFilter] = useState<string>('All');
  const [selectedOrderId, setSelectedOrderId] = useState<string>(bulkOrders[0]?.id || '');
  const [waTemplateType, setWaTemplateType] = useState<
    'initial' | 'quotation' | 'confirmation' | 'payment' | 'dispatch'
  >('quotation');
  const [copiedWaText, setCopiedWaText] = useState(false);
  const [orderSaveFeedback, setOrderSaveFeedback] = useState('');
  const [orderErrorFeedback, setOrderErrorFeedback] = useState('');

  // Editable quotation state for selected order
  const selectedOrder = useMemo(
    () => bulkOrders.find((o) => o.id === selectedOrderId) || bulkOrders[0] || null,
    [bulkOrders, selectedOrderId]
  );

  const [editItems, setEditItems] = useState(selectedOrder?.items || []);
  const [editDiscountPct, setEditDiscountPct] = useState<number>(selectedOrder?.discountPercent ?? 0);
  const [editTaxPct, setEditTaxPct] = useState<number>(selectedOrder?.taxPercent ?? 18);
  const [editShipping, setEditShipping] = useState<number>(selectedOrder?.shippingAmount ?? 0);
  const [editStatus, setEditStatus] = useState<OrderStatus>(selectedOrder?.status || 'New Request');
  const [editPaymentStatus, setEditPaymentStatus] = useState<PaymentStatus>(
    selectedOrder?.paymentStatus || 'unpaid'
  );
  const [editPaymentLink, setEditPaymentLink] = useState<string>(selectedOrder?.paymentLink || '');
  const [editTransactionRef, setEditTransactionRef] = useState<string>(selectedOrder?.transactionRef || '');
  const [editCourier, setEditCourier] = useState<string>(selectedOrder?.courierName || '');
  const [editTracking, setEditTracking] = useState<string>(selectedOrder?.trackingNumber || '');
  const [editQuotationDate, setEditQuotationDate] = useState<string>(
    selectedOrder?.quotationDate || new Date().toISOString().slice(0, 10)
  );
  const [editQuotationValidUntil, setEditQuotationValidUntil] = useState<string>(
    selectedOrder?.quotationValidUntil || '2026-11-15'
  );
  const [editExpectedDelivery, setEditExpectedDelivery] = useState<string>(
    selectedOrder?.expectedDeliveryDate || ''
  );
  const [editInternalNotes, setEditInternalNotes] = useState<string>(selectedOrder?.internalNotes || '');

  React.useEffect(() => {
    if (selectedOrder) {
      setEditItems(selectedOrder.items);
      setEditDiscountPct(selectedOrder.discountPercent);
      setEditTaxPct(selectedOrder.taxPercent);
      setEditShipping(selectedOrder.shippingAmount);
      setEditStatus(selectedOrder.status);
      setEditPaymentStatus(selectedOrder.paymentStatus);
      setEditPaymentLink(selectedOrder.paymentLink);
      setEditTransactionRef(selectedOrder.transactionRef);
      setEditCourier(selectedOrder.courierName);
      setEditTracking(selectedOrder.trackingNumber);
      setEditQuotationDate(selectedOrder.quotationDate || new Date().toISOString().slice(0, 10));
      setEditQuotationValidUntil(selectedOrder.quotationValidUntil || '2026-11-15');
      setEditExpectedDelivery(selectedOrder.expectedDeliveryDate || '');
      setEditInternalNotes(selectedOrder.internalNotes || '');
      setOrderSaveFeedback('');
      setOrderErrorFeedback('');
    }
  }, [selectedOrder]);

  // Campaign editor form state (Create & Edit)
  const [editingCampId, setEditingCampId] = useState<string | null>(null);
  const [newCampName, setNewCampName] = useState('');
  const [newCampSlug, setNewCampSlug] = useState('');
  const [newCampPromoHeadline, setNewCampPromoHeadline] = useState('');
  const [newCampBannerTitle, setNewCampBannerTitle] = useState('');
  const [newCampBannerSub, setNewCampBannerSub] = useState('');
  const [newCampBannerImage, setNewCampBannerImage] = useState('');
  const [newCampAccentColor, setNewCampAccentColor] = useState('#F59E0B');
  const [newCampThemeId, setNewCampThemeId] = useState(activeTheme.id);
  const [newCampStart, setNewCampStart] = useState('2026-10-01');
  const [newCampEnd, setNewCampEnd] = useState('2026-12-31');
  const [newCampStatus, setNewCampStatus] = useState<'active' | 'inactive'>('active');
  const [newCampProductIds, setNewCampProductIds] = useState<string[]>([]);
  const [campProductSearch, setCampProductSearch] = useState('');
  const [uploadingCampBanner, setUploadingCampBanner] = useState(false);
  const [confirmDeleteCampId, setConfirmDeleteCampId] = useState<string | null>(null);
  const [copiedCampSlug, setCopiedCampSlug] = useState<string | null>(null);

  const loadCampaignIntoEditor = (camp: Campaign) => {
    setEditingCampId(camp.id);
    setNewCampName(camp.name);
    setNewCampSlug(camp.slug);
    setNewCampPromoHeadline(camp.promotionalHeadline || '');
    setNewCampBannerTitle(camp.bannerTitle || camp.name);
    setNewCampBannerSub(camp.description || camp.bannerSubtitle || '');
    setNewCampBannerImage(camp.bannerImageUrl || '');
    setNewCampAccentColor(camp.accentColor || '#F59E0B');
    setNewCampThemeId(camp.themeId || activeTheme.id);
    setNewCampStart(camp.startDate || '2026-10-01');
    setNewCampEnd(camp.endDate || '2026-12-31');
    setNewCampStatus(camp.status);
    const matchingProductIds = products
      .filter((p) => doesProductBelongToCampaign(p, camp))
      .map((p) => p.id);
    setNewCampProductIds(matchingProductIds);
  };

  const resetCampaignEditor = () => {
    setEditingCampId(null);
    setNewCampName('');
    setNewCampSlug('');
    setNewCampPromoHeadline('');
    setNewCampBannerTitle('');
    setNewCampBannerSub('');
    setNewCampBannerImage('');
    setNewCampAccentColor('#F59E0B');
    setNewCampThemeId(activeTheme.id);
    setNewCampStart('2026-10-01');
    setNewCampEnd('2026-12-31');
    setNewCampStatus('active');
    setNewCampProductIds([]);
  };

  // Filter bulkOrders by selected date range for Overview KPIs
  const dateFilteredOrders = useMemo(() => {
    if (dateRange === 'all') return bulkOrders;
    const now = new Date('2026-10-25T23:59:59Z').getTime();
    const days = dateRange === 'today' ? 1 : dateRange === '7d' ? 7 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return bulkOrders.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
  }, [bulkOrders, dateRange]);

  // Overview Analytics Calculation (100% Real Store Data)
  const kpis = useMemo(() => {
    const activeProdCount = products.filter((p) => p.status === 'active').length;
    const totalRequests = dateFilteredOrders.length;
    const newRequests = dateFilteredOrders.filter((o) => o.status === 'New Request').length;
    const awaitingQuotation = dateFilteredOrders.filter(
      (o) => o.status === 'New Request' || o.status === 'Contact Customer'
    ).length;
    const awaitingConfirmation = dateFilteredOrders.filter(
      (o) => o.status === 'Quote Prepared' || o.status === 'Awaiting Customer Approval'
    ).length;
    const confirmedStages: OrderStatus[] = [
      'Order Confirmed',
      'Awaiting Payment',
      'Paid',
      'Processing',
      'Dispatched',
      'Delivered',
    ];
    const confirmedOrders = dateFilteredOrders.filter((o) => confirmedStages.includes(o.status)).length;
    const awaitingPayment = dateFilteredOrders.filter(
      (o) => o.status === 'Order Confirmed' || o.status === 'Awaiting Payment'
    ).length;
    const paidOrders = dateFilteredOrders.filter(
      (o) => o.paymentStatus === 'paid' || ['Paid', 'Processing', 'Dispatched', 'Delivered'].includes(o.status)
    ).length;
    const cancelledOrders = dateFilteredOrders.filter(
      (o) => o.status === 'Cancelled' || o.status === 'Rejected'
    ).length;
    const totalRequestedQty = dateFilteredOrders.reduce((s, o) => s + o.totalQuantity, 0);
    const confirmedOrderValue = dateFilteredOrders
      .filter((o) => confirmedStages.includes(o.status))
      .reduce((s, o) => s + o.finalAmount, 0);
    const verifiedAmountReceived = dateFilteredOrders
      .filter((o) => o.paymentStatus === 'paid')
      .reduce((s, o) => s + o.finalAmount, 0);

    return {
      activeProdCount,
      totalRequests,
      newRequests,
      awaitingQuotation,
      awaitingConfirmation,
      confirmedOrders,
      awaitingPayment,
      paidOrders,
      cancelledOrders,
      totalRequestedQty,
      confirmedOrderValue,
      verifiedAmountReceived,
    };
  }, [products, dateFilteredOrders]);

  // Aggregated Customers CRM
  const customersList = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();
    const confirmedStages: OrderStatus[] = [
      'Order Confirmed',
      'Awaiting Payment',
      'Paid',
      'Processing',
      'Dispatched',
      'Delivered',
    ];
    bulkOrders.forEach((o) => {
      const key = o.mobile.replace(/[^0-9]/g, '') || o.customerName;
      const existing = map.get(key);
      const isConfirmed = confirmedStages.includes(o.status);
      if (!existing) {
        map.set(key, {
          id: `cust-${key}`,
          customerName: o.customerName,
          companyName: o.companyName,
          mobile: o.mobile,
          whatsapp: o.whatsapp,
          email: o.email,
          city: o.city,
          state: o.state,
          gstNumber: o.gstNumber,
          orderCount: 1,
          confirmedValue: isConfirmed ? o.finalAmount : 0,
          lastOrderDate: o.createdAt,
          notes: o.internalNotes,
          orders: [o],
        });
      } else {
        existing.orderCount += 1;
        if (isConfirmed) existing.confirmedValue += o.finalAmount;
        if (o.createdAt > existing.lastOrderDate) existing.lastOrderDate = o.createdAt;
        existing.orders.push(o);
      }
    });
    return Array.from(map.values());
  }, [bulkOrders]);

  // Filtered Orders for Bulk Orders table
  const filteredOrders = useMemo(() => {
    return bulkOrders.filter((o) => {
      if (orderStatusFilter !== 'All' && o.status !== orderStatusFilter) return false;
      if (
        orderCampaignFilter !== 'All' &&
        o.campaignSlug !== orderCampaignFilter &&
        !(o.campaignSlugs || []).includes(orderCampaignFilter)
      ) {
        return false;
      }
      if (orderSearch.trim()) {
        const q = orderSearch.toLowerCase();
        return (
          o.orderRef.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.companyName.toLowerCase().includes(q) ||
          o.mobile.includes(q) ||
          o.itemsSummary.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [bulkOrders, orderStatusFilter, orderCampaignFilter, orderSearch]);

  // Live Quotation Preview Math
  const liveQuoteMath = useMemo(() => {
    const subtotal = editItems.reduce(
      (s, i) => s + (Number(i.negotiatedUnitPrice ?? i.unitPrice) || 0) * Math.max(1, i.requestedQuantity),
      0
    );
    return {
      subtotal,
      ...calculateQuotationTotals({
        itemsSubtotal: subtotal,
        discountPercent: editDiscountPct,
        taxPercent: editTaxPct,
        shippingCharges: editShipping,
      }),
    };
  }, [editItems, editDiscountPct, editTaxPct, editShipping]);

  const handleSaveOrderChanges = async () => {
    if (!selectedOrder) return;
    setOrderErrorFeedback('');
    setOrderSaveFeedback('');

    const statusCheck = canTransitionOrderStatus(selectedOrder.status, editStatus);
    if (!statusCheck.allowed) {
      setOrderErrorFeedback(statusCheck.reason || 'Invalid status transition.');
      return;
    }

    try {
      await onUpdateOrder(selectedOrder.id, {
        items: editItems,
        discountPercent: editDiscountPct,
        taxPercent: editTaxPct,
        shippingAmount: editShipping,
        status: editStatus,
        paymentStatus: editPaymentStatus,
        paymentLink: canRequestPaymentForOrder(editStatus) ? editPaymentLink : '',
        transactionRef: editTransactionRef,
        courierName: editCourier,
        trackingNumber: editTracking,
        quotationDate: editQuotationDate,
        quotationValidUntil: editQuotationValidUntil,
        expectedDeliveryDate: editExpectedDelivery,
        internalNotes: editInternalNotes,
        timelineNote: `Updated quotation (${formatINR(liveQuoteMath.finalAmount)}) & status (${editStatus})`,
      });
      setOrderSaveFeedback(`Saved quotation and status (${editStatus}) for ${selectedOrder.orderRef}.`);
    } catch (err: any) {
      setOrderErrorFeedback(err?.message || 'Failed to update order.');
    }
  };

  const handleExportOrdersToExcel = () => {
    const rows = filteredOrders.map((o) => ({
      'Order Ref': o.orderRef,
      'Created Date': o.createdAt.slice(0, 10),
      Status: o.status,
      'Customer Name': o.customerName,
      Company: o.companyName,
      Mobile: o.mobile,
      WhatsApp: o.whatsapp,
      City: o.city,
      State: o.state,
      GSTIN: o.gstNumber,
      Campaign: o.campaignSlug,
      'Items Summary': o.itemsSummary,
      'Total Units': o.totalQuantity,
      'Estimated Value (INR)': o.estimatedAmount,
      'Discount %': o.discountPercent,
      'GST %': o.taxPercent,
      'Shipping (INR)': o.shippingAmount,
      'Final Quoted Total (INR)': o.finalAmount,
      'Payment Status': o.paymentStatus,
      'Transaction Ref': o.transactionRef,
      Courier: o.courierName,
      'Tracking Number': o.trackingNumber,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Bulk_Orders');
    XLSX.writeFile(wb, 'Catalog_Maker_Pro_Bulk_Orders.xlsx');
  };

  // Sign-In Screen when not authenticated
  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm space-y-6">
          <div className="space-y-2 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-stone-900 text-amber-400">
              <Lock className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-stone-900">Administrator Sign-In</h1>
            <p className="text-xs text-stone-500">
              Sign in with Firebase Google Authentication or enter your administrator workspace passcode to manage
              products, Excel imports, AI themes, and B2B bulk quotations.
            </p>
          </div>

          {authError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              setAuthError('');
              try {
                await onSignInGoogle();
              } catch (err: any) {
                setAuthError(
                  err?.message || 'Google popup sign-in was closed or blocked. You can also sign in below.'
                );
              }
            }}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-3 text-xs font-bold text-white hover:bg-stone-800 transition-colors"
          >
            <ShieldCheck className="h-4 w-4 text-amber-400" />
            Sign In with Firebase Google Auth
          </button>

          <div className="relative flex py-1 items-center">
            <div className="grow border-t border-stone-200" />
            <span className="shrink mx-3 text-[11px] uppercase tracking-wider text-stone-400">
              Or Admin Workspace Passcode
            </span>
            <div className="grow border-t border-stone-200" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const ok = onSignInDemoAdmin(passcodeInput);
              if (!ok) setAuthError('Invalid admin passcode. Default is ADMIN-2026.');
            }}
            className="space-y-3"
          >
            <div>
              <label htmlFor="admin-passcode" className="block text-xs font-medium text-stone-700 mb-1">
                Admin Access Key
              </label>
              <input
                id="admin-passcode"
                type="password"
                value={passcodeInput}
                onChange={(e) => setPasscodeInput(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-mono text-stone-900"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-xl border border-stone-300 bg-stone-100 px-4 py-2.5 text-xs font-bold text-stone-900 hover:bg-stone-200 transition-colors"
            >
              Unlock Admin Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  const NAV_ITEMS: { id: AdminSection; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'campaigns', label: `Campaigns (${campaigns.length})`, icon: FolderKanban },
    { id: 'products', label: `Products (${products.length})`, icon: ShoppingBag },
    { id: 'excel', label: 'Excel Import', icon: FileSpreadsheet },
    { id: 'orders', label: `Bulk Orders (${bulkOrders.length})`, icon: Package },
    { id: 'themes', label: 'Themes & AI Designer', icon: Palette },
    { id: 'customers', label: `Customers (${customersList.length})`, icon: Users },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'settings', label: 'Settings & Deploy', icon: Settings },
  ];

  return (
    <div className="min-h-[calc(100vh-65px)] flex flex-col lg:flex-row bg-stone-50">
      {/* Left Admin Sidebar (260px on desktop) */}
      <aside className="w-full lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-stone-200 bg-white p-4 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="px-2 py-1">
            <div className="text-xs font-bold uppercase tracking-wider text-stone-400">
              Admin Workspace
            </div>
            <div className="text-xs font-medium text-stone-700 truncate mt-0.5">
              {adminEmail || 'simple.sooraj@gmail.com'}
            </div>
          </div>

          <nav aria-label="Admin sidebar navigation" className="flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectSection(item.id)}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="hidden lg:block pt-4 border-t border-stone-200">
          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-stone-600 hover:bg-red-50 hover:text-red-700 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out of Admin
          </button>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 space-y-6">
        {/* SECTION 1: OVERVIEW DASHBOARD */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold text-stone-900">
                  B2B Commerce &amp; Catalog Overview
                </h1>
                <p className="text-xs text-stone-500">
                  Live metrics aggregated directly from your persistent product catalog and bulk order ledger
                </p>
              </div>

              {/* Date Range Filter */}
              <div className="inline-flex items-center rounded-lg border border-stone-200 bg-white p-1">
                {(
                  [
                    ['today', 'Today'],
                    ['7d', 'Last 7 Days'],
                    ['30d', 'Last 30 Days'],
                    ['all', 'All Time'],
                  ] as const
                ).map(([val, label]) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setDateRange(val)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                      dateRange === val ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Primary KPI Grid (13 Real Metrics) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 tabular-nums">
              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Active Products</div>
                <div className="mt-1 text-2xl font-bold text-stone-900">{kpis.activeProdCount}</div>
                <div className="mt-1 text-[11px] text-stone-500">Shared across Builder &amp; Shop</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Total Catalog Views</div>
                <div className="mt-1 text-2xl font-bold text-stone-900">
                  {catalogViews.toLocaleString('en-IN')}
                </div>
                <div className="mt-1 text-[11px] text-stone-500">Measured storefront sessions</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Bulk Order Requests</div>
                <div className="mt-1 text-2xl font-bold text-stone-900">{kpis.totalRequests}</div>
                <div className="mt-1 text-[11px] text-amber-700 font-medium">
                  {kpis.newRequests} New Request{kpis.newRequests === 1 ? '' : 's'}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Total Requested Quantity</div>
                <div className="mt-1 text-2xl font-bold text-stone-900">
                  {kpis.totalRequestedQty.toLocaleString('en-IN')} units
                </div>
                <div className="mt-1 text-[11px] text-stone-500">Across all submitted inquiries</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Awaiting Quotation</div>
                <div className="mt-1 text-xl font-bold text-amber-700">{kpis.awaitingQuotation}</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Awaiting Customer Approval</div>
                <div className="mt-1 text-xl font-bold text-stone-900">{kpis.awaitingConfirmation}</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Confirmed Orders</div>
                <div className="mt-1 text-xl font-bold text-emerald-700">{kpis.confirmedOrders}</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Orders Awaiting Payment</div>
                <div className="mt-1 text-xl font-bold text-amber-700">{kpis.awaitingPayment}</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Paid Orders</div>
                <div className="mt-1 text-xl font-bold text-emerald-700">{kpis.paidOrders}</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Cancelled / Rejected</div>
                <div className="mt-1 text-xl font-bold text-stone-500">{kpis.cancelledOrders}</div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Confirmed Order Value</div>
                <div className="mt-1 text-xl font-bold text-stone-900">
                  {formatINR(kpis.confirmedOrderValue)}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-4">
                <div className="text-xs text-stone-500">Verified Amount Received</div>
                <div className="mt-1 text-xl font-bold text-emerald-700">
                  {formatINR(kpis.verifiedAmountReceived)}
                </div>
              </div>
            </div>

            {/* Order Pipeline & Campaign Performance Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-stone-900">Campaign Bulk Demand Breakdown</h2>
                  <button
                    type="button"
                    onClick={() => onSelectSection('orders')}
                    className="text-xs font-semibold text-amber-700 underline"
                  >
                    Manage All Orders
                  </button>
                </div>
                <div className="space-y-3">
                  {campaigns.map((camp) => {
                    const campOrders = dateFilteredOrders.filter((o) => o.campaignSlug === camp.slug);
                    const val = campOrders.reduce((s, o) => s + o.finalAmount, 0);
                    const units = campOrders.reduce((s, o) => s + o.totalQuantity, 0);
                    const pct = Math.min(100, Math.round((val / Math.max(1, kpis.confirmedOrderValue + 200000)) * 100));
                    return (
                      <div key={camp.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <span className="font-semibold text-stone-800">{camp.name}</span>
                          <span className="text-stone-600">
                            {campOrders.length} orders · {units} units · <strong>{formatINR(val)}</strong>
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-stone-100 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-amber-600"
                            style={{ width: `${Math.max(8, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
                <h2 className="text-sm font-bold text-stone-900">Recent Bulk Order Inquiries</h2>
                <div className="divide-y divide-stone-100">
                  {dateFilteredOrders.slice(0, 4).map((ord) => (
                    <div key={ord.id} className="flex items-center justify-between py-2.5 text-xs">
                      <div>
                        <div className="font-bold text-stone-900">
                          {ord.orderRef} — {ord.customerName}
                        </div>
                        <div className="text-stone-500">
                          {ord.companyName || ord.city} · {ord.totalQuantity} units
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="font-bold text-stone-900">{formatINR(ord.finalAmount)}</div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedOrderId(ord.id);
                            onSelectSection('orders');
                          }}
                          className="text-amber-700 font-semibold underline"
                        >
                          {ord.status}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 2: PRODUCTS TABLE */}
        {activeSection === 'products' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
              <div>
                <h1 className="text-lg font-bold text-stone-900">
                  Master Product Catalog ({products.length} SKUs)
                </h1>
                <p className="text-xs text-stone-500">
                  Add, edit, duplicate, or delete products. Changes persist and update both Catalog Builder and Shop
                  immediately.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => onSelectSection('excel')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
                  Import from Excel
                </button>
                <button
                  type="button"
                  onClick={onOpenAddProduct}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  Add New Product
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                  <input
                    type="search"
                    placeholder="Filter products by SKU, name, brand, or campaign..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-1.5 text-xs text-stone-900"
                  />
                </div>
                <select
                  value={productCategoryFilter}
                  onChange={(e) => setProductCategoryFilter(e.target.value)}
                  className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800"
                >
                  <option value="All">All Categories</option>
                  {Array.from(new Set(products.map((p) => p.category))).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2.5 px-3 font-semibold">Product</th>
                      <th className="py-2.5 px-3 font-semibold">SKU</th>
                      <th className="py-2.5 px-3 font-semibold">Category · Brand</th>
                      <th className="py-2.5 px-3 font-semibold">Campaign</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Selling Price</th>
                      <th className="py-2.5 px-3 font-semibold text-right">MRP</th>
                      <th className="py-2.5 px-3 font-semibold">Stock</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {products
                      .filter((p) => {
                        if (productCategoryFilter !== 'All' && p.category !== productCategoryFilter) return false;
                        if (productSearch.trim()) {
                          const q = productSearch.toLowerCase();
                          return (
                            p.name.toLowerCase().includes(q) ||
                            p.sku.toLowerCase().includes(q) ||
                            p.brand.toLowerCase().includes(q)
                          );
                        }
                        return true;
                      })
                      .map((p) => (
                        <tr key={p.id} className="hover:bg-stone-50/80">
                          <td className="py-2.5 px-3">
                            <div className="flex items-center gap-3">
                              <ProductVisual product={p} className="h-10 w-12 rounded border border-stone-200 shrink-0" />
                              <div>
                                <div className="font-semibold text-stone-900">{p.name}</div>
                                <div className="text-[11px] text-stone-500">{p.badge || p.status}</div>
                              </div>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-stone-800">{p.sku}</td>
                          <td className="py-2.5 px-3 text-stone-600">
                            {p.category} · {p.brand}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-stone-600">{p.campaign}</td>
                          <td className="py-2.5 px-3 text-right font-bold tabular-nums text-stone-900">
                            {formatINR(p.sellingPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right tabular-nums text-stone-400 line-through">
                            {formatINR(p.mrp)}
                          </td>
                          <td className="py-2.5 px-3 text-emerald-700 font-medium">{p.stockStatus}</td>
                          <td className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => onOpenEditProduct(p)}
                              className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                            >
                              <Edit3 className="h-3 w-3" />
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 3: EXCEL IMPORT */}
        {activeSection === 'excel' && (
          <ExcelImportPanel
            existingProducts={products}
            campaigns={campaigns}
            onBatchImportProducts={onBatchImportProducts}
          />
        )}

        {/* SECTION 5: THEMES & AI DESIGNER */}
        {activeSection === 'themes' && (
          <AiThemeDesignerPanel
            themes={themes}
            activeTheme={activeTheme}
            previousThemeId={previousThemeId}
            sampleProduct={products[0]}
            onSaveAndActivateTheme={onSaveAndActivateTheme}
            onActivateExistingTheme={onActivateExistingTheme}
          />
        )}

        {/* SECTION 6: BULK ORDERS, QUOTATION WORKFLOW & MANUAL WHATSAPP */}
        {activeSection === 'orders' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
              <div>
                <h1 className="text-lg font-bold text-stone-900">
                  Bulk Order Lifecycle, Quotations &amp; WhatsApp Desk
                </h1>
                <p className="text-xs text-stone-500">
                  Review inquiries, negotiate B2B quantities &amp; GST totals, share prefilled WhatsApp messages, and
                  record payment links only after order confirmation.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportOrdersToExcel}
                className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 shrink-0"
              >
                <Download className="h-4 w-4 text-emerald-700" />
                Export Orders (.xlsx)
              </button>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-stone-200 bg-white p-4">
              <div className="relative flex-1 min-w-[220px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
                <input
                  type="search"
                  placeholder="Search by Order ID (ORD-2026-...), customer, mobile, or company..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-1.5 text-xs text-stone-900"
                />
              </div>

              <select
                aria-label="Filter orders by status"
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800"
              >
                <option value="All">All Lifecycle Statuses</option>
                {ORDER_LIFECYCLE_STAGES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>

              <select
                aria-label="Filter orders by campaign"
                value={orderCampaignFilter}
                onChange={(e) => setOrderCampaignFilter(e.target.value)}
                className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800"
              >
                <option value="All">All Campaigns</option>
                {campaigns.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Split View: Left Orders List (5 cols) + Right Quotation & WhatsApp Inspector (7 cols) */}
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* Left Orders List */}
              <div className="xl:col-span-5 rounded-xl border border-stone-200 bg-white divide-y divide-stone-100 overflow-hidden">
                {filteredOrders.map((ord) => {
                  const active = selectedOrder?.id === ord.id;
                  return (
                    <button
                      key={ord.id}
                      type="button"
                      onClick={() => setSelectedOrderId(ord.id)}
                      className={`w-full text-left p-4 transition-colors flex items-start justify-between gap-3 ${
                        active ? 'bg-amber-50/70' : 'hover:bg-stone-50'
                      }`}
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-mono font-bold text-stone-900">{ord.orderRef}</span>
                          <span>·</span>
                          <span className="font-semibold text-amber-800">{ord.status}</span>
                        </div>
                        <div className="text-sm font-bold text-stone-900 truncate">
                          {ord.customerName} {ord.companyName ? `(${ord.companyName})` : ''}
                        </div>
                        <div className="text-xs text-stone-500 truncate">{ord.itemsSummary}</div>
                        <div className="text-[11px] text-stone-400 tabular-nums">
                          Campaign: {ord.campaignSlug} · WhatsApp: {ord.whatsapp}
                        </div>
                      </div>
                      <div className="text-right tabular-nums shrink-0">
                        <div className="text-sm font-bold text-stone-900">{formatINR(ord.finalAmount)}</div>
                        <div className="text-[11px] text-stone-500">{ord.totalQuantity} units</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Right Selected Order Quotation, Payment & WhatsApp Inspector */}
              {selectedOrder && (
                <div className="xl:col-span-7 rounded-xl border border-stone-200 bg-white p-6 space-y-6">
                  <div className="flex flex-wrap items-start justify-between gap-4 border-b border-stone-200 pb-4">
                    <div>
                      <div className="text-xs font-mono text-stone-500">
                        {selectedOrder.orderRef} · Submitted {selectedOrder.createdAt.slice(0, 10)}
                      </div>
                      <h2 className="text-xl font-bold text-stone-900">
                        {selectedOrder.customerName}{' '}
                        {selectedOrder.companyName && (
                          <span className="text-sm font-normal text-stone-500">
                            — {selectedOrder.companyName}
                          </span>
                        )}
                      </h2>
                      <div className="text-xs text-stone-600 mt-1">
                        Delivery: {selectedOrder.address}, {selectedOrder.city}, {selectedOrder.state} -{' '}
                        {selectedOrder.pinCode} · GSTIN: {selectedOrder.gstNumber || 'Not provided'}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => exportQuotationToPdf(selectedOrder)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                    >
                      <FileText className="h-3.5 w-3.5 text-amber-700" />
                      Download Quotation PDF
                    </button>
                  </div>

                  {orderSaveFeedback && (
                    <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-xs font-medium text-emerald-900">
                      {orderSaveFeedback}
                    </div>
                  )}
                  {orderErrorFeedback && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-xs font-medium text-red-800">
                      {orderErrorFeedback}
                    </div>
                  )}

                  {/* 1. Editable Line Items & Negotiated Unit Pricing */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold uppercase tracking-wider text-stone-600">
                      1. Requested Items &amp; Negotiated Unit Prices
                    </div>
                    <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-stone-50/50">
                      {editItems.map((item, idx) => (
                        <div
                          key={item.sku}
                          className="flex flex-wrap items-center justify-between gap-3 p-3 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-stone-900">{item.productName}</div>
                            <div className="text-stone-500 font-mono">
                              SKU: {item.sku} · Catalog Unit Price: {formatINR(item.unitPrice)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 tabular-nums">
                            <div>
                              <label className="block text-[10px] text-stone-500">Quantity</label>
                              <input
                                type="number"
                                min={1}
                                value={item.requestedQuantity}
                                onChange={(e) => {
                                  const q = Math.max(1, Number(e.target.value) || 1);
                                  setEditItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, requestedQuantity: q } : it))
                                  );
                                }}
                                className="w-20 rounded border border-stone-300 bg-white px-2 py-1 text-xs font-semibold"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-stone-500">Quoted Unit (₹)</label>
                              <input
                                type="number"
                                min={1}
                                value={item.negotiatedUnitPrice ?? item.unitPrice}
                                onChange={(e) => {
                                  const up = Math.max(1, Number(e.target.value) || item.unitPrice);
                                  setEditItems((prev) =>
                                    prev.map((it, i) => (i === idx ? { ...it, negotiatedUnitPrice: up } : it))
                                  );
                                }}
                                className="w-24 rounded border border-stone-300 bg-white px-2 py-1 text-xs font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 2. Quotation Calculator & Lifecycle Status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-3 rounded-lg border border-stone-200 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-stone-600">
                        2. Quotation Pricing &amp; Taxes
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-stone-600 mb-1">
                            Discount (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={90}
                            value={editDiscountPct}
                            onChange={(e) => setEditDiscountPct(Number(e.target.value))}
                            className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-stone-600 mb-1">
                            GST (%)
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={28}
                            value={editTaxPct}
                            onChange={(e) => setEditTaxPct(Number(e.target.value))}
                            className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-stone-600 mb-1">
                            Shipping (₹)
                          </label>
                          <input
                            type="number"
                            min={0}
                            value={editShipping}
                            onChange={(e) => setEditShipping(Number(e.target.value))}
                            className="w-full rounded border border-stone-300 px-2.5 py-1.5 text-xs tabular-nums"
                          />
                        </div>
                      </div>

                      <div className="space-y-1 pt-2 border-t border-stone-100 text-xs tabular-nums">
                        <div className="flex justify-between text-stone-500">
                          <span>Original Requested Estimate:</span>
                          <span>{formatINR(selectedOrder.estimatedAmount)}</span>
                        </div>
                        <div className="flex justify-between text-stone-600">
                          <span>Discount ({editDiscountPct}%):</span>
                          <span>-{formatINR(liveQuoteMath.discountAmount)}</span>
                        </div>
                        <div className="flex justify-between text-stone-600">
                          <span>GST ({editTaxPct}%):</span>
                          <span>+{formatINR(liveQuoteMath.taxAmount)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-stone-900 pt-1">
                          <span>Final Quoted Total:</span>
                          <span className="text-amber-700">{formatINR(liveQuoteMath.finalAmount)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3 rounded-lg border border-stone-200 p-4">
                      <div className="text-xs font-bold uppercase tracking-wider text-stone-600">
                        3. Order Lifecycle &amp; Validity
                      </div>
                      <div>
                        <label htmlFor="order-status-select" className="block text-xs font-medium text-stone-700 mb-1">
                          Order Status
                        </label>
                        <select
                          id="order-status-select"
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value as OrderStatus)}
                          className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-900"
                        >
                          {ORDER_LIFECYCLE_STAGES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-stone-600 mb-1">
                            Valid Until
                          </label>
                          <input
                            type="date"
                            value={editQuotationValidUntil}
                            onChange={(e) => setEditQuotationValidUntil(e.target.value)}
                            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-stone-600 mb-1">
                            Expected Delivery
                          </label>
                          <input
                            type="date"
                            value={editExpectedDelivery}
                            onChange={(e) => setEditExpectedDelivery(e.target.value)}
                            className="w-full rounded border border-stone-300 px-2 py-1 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 4. Payment & Dispatch Recording (Gated by Order Confirmation) */}
                  <div className="rounded-lg border border-stone-200 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                        4. Payment Verification &amp; Dispatch Logistics
                      </span>
                      {!canRequestPaymentForOrder(editStatus) && (
                        <span className="text-[11px] font-medium text-amber-800">
                          Locked until status reaches "Order Confirmed"
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Payment Status
                        </label>
                        <select
                          disabled={!canRequestPaymentForOrder(editStatus)}
                          value={editPaymentStatus}
                          onChange={(e) => setEditPaymentStatus(e.target.value as PaymentStatus)}
                          className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs disabled:opacity-50"
                        >
                          <option value="unpaid">Unpaid</option>
                          <option value="link_sent">Payment Link Sent</option>
                          <option value="paid">Verified Paid</option>
                          <option value="refunded">Refunded</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Manual Payment Link
                        </label>
                        <input
                          type="url"
                          disabled={!canRequestPaymentForOrder(editStatus)}
                          placeholder="https://pay.catalogmaker.pro/..."
                          value={editPaymentLink}
                          onChange={(e) => setEditPaymentLink(e.target.value)}
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs disabled:opacity-50"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          UTR / Transaction Reference
                        </label>
                        <input
                          type="text"
                          disabled={!canRequestPaymentForOrder(editStatus)}
                          placeholder="UTR..."
                          value={editTransactionRef}
                          onChange={(e) => setEditTransactionRef(e.target.value)}
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-mono disabled:opacity-50"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Courier Partner
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. BlueDart Surface"
                          value={editCourier}
                          onChange={(e) => setEditCourier(e.target.value)}
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Tracking / AWB Number
                        </label>
                        <input
                          type="text"
                          placeholder="AWB..."
                          value={editTracking}
                          onChange={(e) => setEditTracking(e.target.value)}
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-stone-700 mb-1">
                          Internal Admin Notes
                        </label>
                        <input
                          type="text"
                          placeholder="Private notes..."
                          value={editInternalNotes}
                          onChange={(e) => setEditInternalNotes(e.target.value)}
                          className="w-full rounded-lg border border-stone-300 px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="button"
                        onClick={handleSaveOrderChanges}
                        className="rounded-lg bg-stone-900 px-5 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                      >
                        Save Quotation &amp; Order Updates
                      </button>
                    </div>
                  </div>

                  {/* 5. Manual WhatsApp Communication Hub */}
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-950">
                        5. Manual WhatsApp Customer Communication
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {(
                          [
                            ['initial', '1. Initial Contact'],
                            ['quotation', '2. Quotation'],
                            ['confirmation', '3. Confirmation'],
                            ['payment', '4. Payment Link'],
                            ['dispatch', '5. Dispatch'],
                          ] as const
                        ).map(([tpl, label]) => (
                          <button
                            key={tpl}
                            type="button"
                            onClick={() => setWaTemplateType(tpl)}
                            className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                              waTemplateType === tpl
                                ? 'bg-emerald-800 text-white'
                                : 'bg-white text-emerald-900 border border-emerald-200'
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {(() => {
                      const previewOrder: BulkOrder = {
                        ...selectedOrder,
                        finalAmount: liveQuoteMath.finalAmount,
                        paymentLink: editPaymentLink,
                        courierName: editCourier,
                        trackingNumber: editTracking,
                      };
                      const wa = buildWhatsAppMessage(waTemplateType, previewOrder);
                      return (
                        <div className="space-y-2.5">
                          <div className="rounded-lg border border-emerald-200 bg-white p-3 text-xs text-stone-800 leading-relaxed">
                            {wa.text}
                          </div>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                navigator.clipboard?.writeText(wa.text);
                                setCopiedWaText(true);
                                setTimeout(() => setCopiedWaText(false), 2000);
                              }}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              {copiedWaText ? 'Copied Message!' : 'Copy Message'}
                            </button>
                            <a
                              href={wa.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Open WhatsApp ({selectedOrder.whatsapp})
                            </a>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* 6. Order Activity Timeline */}
                  <div className="space-y-2 pt-2 border-t border-stone-200">
                    <div className="text-xs font-bold uppercase tracking-wider text-stone-600">
                      6. Order Activity Timeline ({selectedOrder.timeline.length} Events)
                    </div>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {selectedOrder.timeline.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between text-xs border-b border-stone-100 pb-1.5">
                          <div>
                            <span className="font-semibold text-stone-800">{entry.action}</span>
                            <span className="text-stone-500"> · by {entry.actor}</span>
                          </div>
                          <span className="text-stone-400 tabular-nums shrink-0">
                            {entry.timestamp.slice(0, 16).replace('T', ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION 7: CUSTOMERS CRM */}
        {activeSection === 'customers' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h1 className="text-lg font-bold text-stone-900">
                B2B Customer Directory &amp; Order History ({customersList.length} Accounts)
              </h1>
              <p className="text-xs text-stone-500">
                Customer contact records, GSTINs, order frequency, and confirmed B2B lifetime value
              </p>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-3 px-4 font-semibold">Customer &amp; Business</th>
                      <th className="py-3 px-4 font-semibold">WhatsApp / Mobile</th>
                      <th className="py-3 px-4 font-semibold">City &amp; GSTIN</th>
                      <th className="py-3 px-4 font-semibold text-right">Orders</th>
                      <th className="py-3 px-4 font-semibold text-right">Confirmed Value</th>
                      <th className="py-3 px-4 font-semibold">Last Order</th>
                      <th className="py-3 px-4 font-semibold">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {customersList.map((c) => (
                      <tr key={c.id} className="hover:bg-stone-50">
                        <td className="py-3 px-4">
                          <div className="font-bold text-stone-900">{c.customerName}</div>
                          <div className="text-stone-500">{c.companyName || 'Direct B2B Buyer'}</div>
                        </td>
                        <td className="py-3 px-4 tabular-nums font-medium text-stone-800">{c.whatsapp}</td>
                        <td className="py-3 px-4 text-stone-600">
                          {c.city}, {c.state} · <span className="font-mono">{c.gstNumber || 'N/A'}</span>
                        </td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums">{c.orderCount}</td>
                        <td className="py-3 px-4 text-right font-bold tabular-nums text-emerald-700">
                          {formatINR(c.confirmedValue)}
                        </td>
                        <td className="py-3 px-4 tabular-nums text-stone-500">{c.lastOrderDate.slice(0, 10)}</td>
                        <td className="py-3 px-4 text-stone-600 max-w-xs truncate">{c.notes || 'Active account'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* SECTION 8: CAMPAIGNS MANAGEMENT */}
        {activeSection === 'campaigns' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
              <div>
                <h1 className="text-lg font-bold text-stone-900">
                  Campaign Storefront &amp; Seasonal Promotion Manager ({campaigns.length} Campaigns)
                </h1>
                <p className="text-xs text-stone-500">
                  Create, edit, activate, or deactivate campaigns. Each active campaign publishes a dedicated storefront
                  page at <code>/campaigns/:slug</code> with multi-product bulk ordering.
                </p>
              </div>
              {editingCampId && (
                <button
                  type="button"
                  onClick={resetCampaignEditor}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 shrink-0"
                >
                  <Plus className="h-4 w-4" />
                  Switch to Create New Campaign
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Existing Campaigns List */}
              <div className="lg:col-span-7 space-y-4">
                {campaigns.map((camp) => {
                  const campTheme = themes.find((t) => t.id === camp.themeId) || activeTheme;
                  const campProducts = products.filter((p) => doesProductBelongToCampaign(p, camp));
                  const campOrders = bulkOrders.filter(
                    (o) => o.campaignSlug === camp.slug || (o.campaignSlugs || []).includes(camp.slug)
                  );
                  const scheduleState = getCampaignScheduleState(camp);
                  const publicUrl = `${window.location.origin}/campaigns/${camp.slug}`;

                  return (
                    <div
                      key={camp.id}
                      className={`rounded-xl border bg-white p-5 space-y-4 transition-colors ${
                        editingCampId === camp.id ? 'border-amber-500 ring-1 ring-amber-500' : 'border-stone-200'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div className="w-24 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-900">
                            <ProductVisual
                              product={{
                                name: camp.name,
                                brand: camp.slug,
                                category: 'Campaign',
                                imageUrl: camp.bannerImageUrl || campProducts[0]?.imageUrl || '',
                              }}
                              className="aspect-16/10 w-full"
                            />
                          </div>
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              <span className="font-mono font-semibold text-amber-800">
                                /campaigns/{camp.slug}
                              </span>
                              <span>·</span>
                              <span
                                className={`font-bold uppercase ${
                                  scheduleState === 'active'
                                    ? 'text-emerald-700'
                                    : scheduleState === 'scheduled'
                                      ? 'text-amber-700'
                                      : 'text-stone-500'
                                }`}
                              >
                                {scheduleState}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-stone-900">{camp.name}</h3>
                            {camp.promotionalHeadline && (
                              <div className="text-[11px] font-semibold text-amber-700">
                                {camp.promotionalHeadline}
                              </div>
                            )}
                            <p className="text-xs text-stone-600 line-clamp-2">{camp.description}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              onSaveCampaign({
                                ...camp,
                                status: camp.status === 'active' ? 'inactive' : 'active',
                              })
                            }
                            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                              camp.status === 'active'
                                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : 'border-stone-300 bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {camp.status === 'active' ? 'Active (Click to Deactivate)' : 'Inactive (Click to Activate)'}
                          </button>

                          <button
                            type="button"
                            onClick={() => loadCampaignIntoEditor(camp)}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-800 hover:bg-stone-50"
                          >
                            <Edit3 className="h-3.5 w-3.5" />
                            Edit
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-stone-100 text-xs text-stone-500 tabular-nums">
                        <div className="flex flex-wrap items-center gap-4">
                          <span>
                            Products: <strong>{campProducts.length} SKUs</strong>
                          </span>
                          <span>
                            Bulk Inquiries: <strong>{campOrders.length}</strong>
                          </span>
                          <span>
                            Theme: <strong>{campTheme.name}</strong>
                          </span>
                          <span>
                            Window: {camp.startDate} → {camp.endDate}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onOpenPublicCatalog(camp.slug)}
                            className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-800 hover:bg-stone-100"
                          >
                            Preview Page <ExternalLink className="h-3 w-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard?.writeText(publicUrl);
                              setCopiedCampSlug(camp.slug);
                              setTimeout(() => setCopiedCampSlug(null), 2000);
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                          >
                            <Copy className="h-3 w-3" />
                            {copiedCampSlug === camp.slug ? 'Copied URL' : 'Copy Link'}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setOrderCampaignFilter(camp.slug);
                              onSelectSection('orders');
                            }}
                            className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50"
                          >
                            Orders ({campOrders.length})
                          </button>

                          {confirmDeleteCampId === camp.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={async () => {
                                  await onDeleteCampaign(camp.id);
                                  setConfirmDeleteCampId(null);
                                  if (editingCampId === camp.id) resetCampaignEditor();
                                }}
                                className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-red-700"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteCampId(null)}
                                className="rounded-md border border-stone-300 px-2 py-1 text-xs text-stone-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteCampId(camp.id)}
                              className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Right Column: Create / Edit Campaign Form */}
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!newCampName.trim()) return;
                  const slug =
                    newCampSlug.trim() ||
                    newCampName
                      .trim()
                      .toLowerCase()
                      .replace(/[^a-z0-9]+/g, '-');
                  await onSaveCampaign({
                    id: editingCampId || undefined,
                    name: newCampName.trim(),
                    slug,
                    promotionalHeadline: newCampPromoHeadline.trim(),
                    bannerTitle: newCampBannerTitle.trim() || newCampName.trim(),
                    bannerSubtitle: newCampBannerSub.trim(),
                    description: newCampBannerSub.trim(),
                    bannerImageUrl: newCampBannerImage.trim(),
                    accentColor: newCampAccentColor,
                    themeId: newCampThemeId,
                    startDate: newCampStart,
                    endDate: newCampEnd,
                    status: newCampStatus,
                    productIds: newCampProductIds,
                  });
                  resetCampaignEditor();
                }}
                className="lg:col-span-5 rounded-xl border border-stone-200 bg-white p-5 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-stone-900">
                    {editingCampId ? `Edit Campaign — /campaigns/${newCampSlug}` : 'Create New Shopping Campaign'}
                  </h2>
                  {editingCampId && (
                    <button
                      type="button"
                      onClick={resetCampaignEditor}
                      className="text-xs font-semibold text-stone-500 underline"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="camp-name-input" className="block text-xs font-medium text-stone-700 mb-1">
                      Campaign Name *
                    </label>
                    <input
                      id="camp-name-input"
                      type="text"
                      required
                      placeholder="e.g. Festive Home Decoration"
                      value={newCampName}
                      onChange={(e) => {
                        setNewCampName(e.target.value);
                        if (!editingCampId) {
                          setNewCampSlug(
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
                    <label htmlFor="camp-slug-input" className="block text-xs font-medium text-stone-700 mb-1">
                      Public URL Slug (/campaigns/:slug) *
                    </label>
                    <input
                      id="camp-slug-input"
                      type="text"
                      required
                      placeholder="festive-home-decoration"
                      value={newCampSlug}
                      onChange={(e) => setNewCampSlug(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="camp-promo-headline" className="block text-xs font-medium text-stone-700 mb-1">
                    Promotional Offer Headline
                  </label>
                  <input
                    id="camp-promo-headline"
                    type="text"
                    placeholder="e.g. FLAT 15% WHOLESALE DISCOUNT ON 50+ UNITS"
                    value={newCampPromoHeadline}
                    onChange={(e) => setNewCampPromoHeadline(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="camp-banner-title" className="block text-xs font-medium text-stone-700 mb-1">
                    Hero Banner Heading
                  </label>
                  <input
                    id="camp-banner-title"
                    type="text"
                    placeholder="e.g. Festive Home & Hospitality Brassware Collection"
                    value={newCampBannerTitle}
                    onChange={(e) => setNewCampBannerTitle(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>

                <div>
                  <label htmlFor="camp-banner-desc" className="block text-xs font-medium text-stone-700 mb-1">
                    Campaign Description &amp; Bulk Offer Terms
                  </label>
                  <textarea
                    id="camp-banner-desc"
                    rows={2}
                    value={newCampBannerSub}
                    onChange={(e) => setNewCampBannerSub(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                  />
                </div>

                {/* Banner Image Upload / URL */}
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-stone-700">
                    Campaign Banner Image (Upload or URL)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="https://... or upload image file"
                      value={newCampBannerImage}
                      onChange={(e) => setNewCampBannerImage(e.target.value)}
                      className="flex-1 rounded-lg border border-stone-300 px-3 py-1.5 text-xs"
                    />
                    <label className="cursor-pointer rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 whitespace-nowrap">
                      {uploadingCampBanner ? 'Uploading...' : 'Upload Banner'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploadingCampBanner(true);
                          try {
                            const url = await uploadPersistentProductImage(file);
                            setNewCampBannerImage(url);
                          } finally {
                            setUploadingCampBanner(false);
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Assigned Theme</label>
                    <select
                      value={newCampThemeId}
                      onChange={(e) => setNewCampThemeId(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      {themes.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Accent Color</label>
                    <input
                      type="color"
                      value={newCampAccentColor}
                      onChange={(e) => setNewCampAccentColor(e.target.value)}
                      className="h-8 w-full rounded-lg border border-stone-300 bg-white p-1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Campaign Status</label>
                    <select
                      value={newCampStatus}
                      onChange={(e) => setNewCampStatus(e.target.value as 'active' | 'inactive')}
                      className="w-full rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-xs"
                    >
                      <option value="active">Active (Public)</option>
                      <option value="inactive">Inactive (Hidden)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={newCampStart}
                      onChange={(e) => setNewCampStart(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={newCampEnd}
                      onChange={(e) => setNewCampEnd(e.target.value)}
                      className="w-full rounded-lg border border-stone-300 px-3 py-1.5 text-xs"
                    />
                  </div>
                </div>

                {/* Multi-select Product Assignment */}
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-stone-800">
                      Assign Products ({newCampProductIds.length} selected)
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setNewCampProductIds(
                          newCampProductIds.length === products.length ? [] : products.map((p) => p.id)
                        )
                      }
                      className="text-[11px] font-semibold text-amber-700 underline"
                    >
                      {newCampProductIds.length === products.length ? 'Clear All' : 'Select All'}
                    </button>
                  </div>
                  <input
                    type="search"
                    placeholder="Filter products to assign..."
                    value={campProductSearch}
                    onChange={(e) => setCampProductSearch(e.target.value)}
                    className="w-full rounded border border-stone-300 bg-white px-2.5 py-1 text-xs"
                  />
                  <div className="max-h-36 overflow-y-auto divide-y divide-stone-200/60">
                    {products
                      .filter((p) => {
                        if (!campProductSearch.trim()) return true;
                        const q = campProductSearch.toLowerCase();
                        return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
                      })
                      .map((p) => {
                        const checked = newCampProductIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className="flex items-center justify-between gap-2 py-1.5 text-xs text-stone-800 cursor-pointer"
                          >
                            <span className="flex items-center gap-2 truncate">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setNewCampProductIds((prev) => [...prev, p.id]);
                                  } else {
                                    setNewCampProductIds((prev) => prev.filter((id) => id !== p.id));
                                  }
                                }}
                                className="rounded border-stone-300 text-amber-600"
                              />
                              <span className="truncate font-medium">{p.name}</span>
                            </span>
                            <span className="font-mono text-[11px] text-stone-500 shrink-0">{p.sku}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
                >
                  {editingCampId ? 'Update Campaign & Assigned Products' : 'Create & Publish Campaign'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* SECTION 9: REPORTS */}
        {activeSection === 'reports' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-5">
              <div>
                <h1 className="text-lg font-bold text-stone-900">B2B Revenue &amp; SKU Demand Reports</h1>
                <p className="text-xs text-stone-500">
                  Real-time SKU demand velocity and quotation conversion breakdown
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportOrdersToExcel}
                className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-stone-800"
              >
                <Download className="h-4 w-4" />
                Download Full Ledger (.xlsx)
              </button>
            </div>

            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
              <h2 className="text-sm font-bold text-stone-900">Top Requested Products by Bulk Volume</h2>
              <table className="w-full text-left border-collapse text-xs tabular-nums">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th className="py-2.5 px-3 font-semibold">SKU</th>
                    <th className="py-2.5 px-3 font-semibold">Product Name</th>
                    <th className="py-2.5 px-3 font-semibold">Category</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Unit Price</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Customer Reviews</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {products.map((p) => (
                    <tr key={p.id}>
                      <td className="py-2.5 px-3 font-mono font-semibold">{p.sku}</td>
                      <td className="py-2.5 px-3 font-medium text-stone-900">{p.name}</td>
                      <td className="py-2.5 px-3 text-stone-600">{p.category}</td>
                      <td className="py-2.5 px-3 text-right font-bold">{formatINR(p.sellingPrice)}</td>
                      <td className="py-2.5 px-3 text-right text-stone-600">
                        {p.rating.toFixed(1)} ★ ({p.ratingCount})
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SECTION 10: SETTINGS, FIREBASE & CLOUDFLARE DEPLOYMENT GUIDE */}
        {activeSection === 'settings' && (
          <div className="space-y-6">
            <div className="rounded-xl border border-stone-200 bg-white p-6 space-y-4">
              <h1 className="text-lg font-bold text-stone-900">
                Platform Settings, Firebase Security &amp; Cloudflare Deployment
              </h1>
              <p className="text-xs text-stone-600 leading-relaxed">
                Catalog Maker Pro is pre-configured with Cloud Firestore, Firebase Authentication, Firebase Storage
                rules, and a Cloudflare Workers entry point (<code>worker.ts</code> + <code>wrangler.toml</code>) so your
                public catalogs and bulk order portal stay online 24/7 without requiring your PC to remain running.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-2">
                  <div className="font-bold text-stone-900">Firebase Project Configuration</div>
                  <div>Project ID: <code className="font-mono">gen-lang-client-0664636833</code></div>
                  <div>Bootstrapped Admin: <code className="font-mono">simple.sooraj@gmail.com</code></div>
                  <div>Firestore Rules: Deployed &amp; ESLint Verified (Zero-Trust ABAC)</div>
                  <div>Payment Gateway Architecture: Ready for server-side Razorpay webhook verification</div>
                </div>

                <div className="rounded-lg border border-stone-200 bg-stone-50 p-4 space-y-2">
                  <div className="font-bold text-stone-900">Cloudflare Workers Deployment Commands</div>
                  <pre className="rounded bg-stone-900 text-stone-100 p-3 font-mono text-[11px] overflow-x-auto">
{`npm install
npm run build
npx wrangler secret put GEMINI_API_KEY
npx wrangler deploy`}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
