import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  FileText,
  LogOut,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
  User,
} from 'lucide-react';
import type {
  BulkOrder,
  CustomerAccountType,
  CustomerAddress,
  CustomerProfile,
} from '../types/catalog';
import { buildWhatsAppMessage, formatINR } from '../utils/catalogLogic';
import { exportQuotationToPdf } from '../utils/pdfExporter';

export type CustomerAccountTab = 'overview' | 'profile' | 'orders' | 'addresses';

interface CustomerAccountDashboardProps {
  customer: CustomerProfile;
  customerOrders: BulkOrder[];
  activeTab: CustomerAccountTab;
  onSelectTab: (tab: CustomerAccountTab) => void;
  onUpdateProfile: (updates: Partial<CustomerProfile>) => Promise<CustomerProfile>;
  onSignOut: () => Promise<void>;
  onNavigateShop: () => void;
  onOpenSignInModal: () => void;
}

const ACCOUNT_TYPES: CustomerAccountType[] = [
  'Individual Customer',
  'Business Buyer',
  'Event Planner',
  'Decorator',
  'Wholesaler',
  'Corporate Buyer',
];

export const CustomerAccountDashboard: React.FC<CustomerAccountDashboardProps> = ({
  customer,
  customerOrders,
  activeTab,
  onSelectTab,
  onUpdateProfile,
  onSignOut,
  onNavigateShop,
}) => {
  const [fullName, setFullName] = useState(customer.fullName);
  const [phoneNumber, setPhoneNumber] = useState(customer.phoneNumber);
  const [whatsappNumber, setWhatsappNumber] = useState(
    customer.whatsappNumber || customer.phoneNumber
  );
  const [businessName, setBusinessName] = useState(customer.businessName);
  const [accountType, setAccountType] = useState<CustomerAccountType>(customer.accountType);
  const [city, setCity] = useState(customer.city);
  const [stateName, setStateName] = useState(customer.state);
  const [pincode, setPincode] = useState(customer.pincode);
  const [gstNumber, setGstNumber] = useState(customer.gstNumber);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSavedMsg, setProfileSavedMsg] = useState('');

  // Address Form State
  const [addrLabel, setAddrLabel] = useState('Primary Venue / Warehouse');
  const [addrRecipient, setAddrRecipient] = useState(customer.fullName);
  const [addrPhone, setAddrPhone] = useState(customer.phoneNumber);
  const [addrStreet, setAddrStreet] = useState('');
  const [addrCity, setAddrCity] = useState(customer.city);
  const [addrState, setAddrState] = useState(customer.state);
  const [addrPin, setAddrPin] = useState(customer.pincode);
  const [savingAddress, setSavingAddress] = useState(false);

  // Expanded Order Detail ID
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(
    customerOrders[0]?.id || null
  );

  React.useEffect(() => {
    setFullName(customer.fullName);
    setPhoneNumber(customer.phoneNumber);
    setWhatsappNumber(customer.whatsappNumber || customer.phoneNumber);
    setBusinessName(customer.businessName);
    setAccountType(customer.accountType);
    setCity(customer.city);
    setStateName(customer.state);
    setPincode(customer.pincode);
    setGstNumber(customer.gstNumber);
  }, [customer]);

  const myOrders = useMemo(() => {
    return customerOrders.filter(
      (o) =>
        o.ownerId === customer.uid ||
        (customer.email && o.email && o.email.toLowerCase() === customer.email.toLowerCase()) ||
        (customer.phoneNumber &&
          o.mobile &&
          o.mobile.replace(/[^0-9]/g, '') === customer.phoneNumber.replace(/[^0-9]/g, ''))
    );
  }, [customerOrders, customer]);

  const totalUnitsRequested = useMemo(
    () => myOrders.reduce((s, o) => s + o.totalQuantity, 0),
    [myOrders]
  );

  const totalInquiryEstimate = useMemo(
    () => myOrders.reduce((s, o) => s + (o.finalAmount || o.estimatedAmount), 0),
    [myOrders]
  );

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSavedMsg('');
    try {
      await onUpdateProfile({
        fullName: fullName.trim(),
        phoneNumber: phoneNumber.trim(),
        whatsappNumber: (whatsappNumber.trim() || phoneNumber.trim()),
        businessName: businessName.trim(),
        accountType,
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
      });
      setProfileSavedMsg('Your DesiDiya customer profile has been saved.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addrStreet.trim() || !addrCity.trim() || !addrState.trim() || !addrPin.trim()) return;
    setSavingAddress(true);
    try {
      const newAddr: CustomerAddress = {
        id: `addr-${Date.now()}`,
        label: addrLabel.trim() || 'Delivery Address',
        recipientName: addrRecipient.trim() || customer.fullName,
        phone: addrPhone.trim() || customer.phoneNumber,
        streetAddress: addrStreet.trim(),
        city: addrCity.trim(),
        state: addrState.trim(),
        pincode: addrPin.trim(),
        isDefault: (customer.deliveryAddresses || []).length === 0,
      };
      const nextList = [...(customer.deliveryAddresses || []), newAddr];
      await onUpdateProfile({
        deliveryAddresses: nextList,
        city: customer.city || newAddr.city,
        state: customer.state || newAddr.state,
        pincode: customer.pincode || newAddr.pincode,
      });
      setAddrStreet('');
    } finally {
      setSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (addressId: string) => {
    const nextList = (customer.deliveryAddresses || []).filter((a) => a.id !== addressId);
    await onUpdateProfile({ deliveryAddresses: nextList });
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    const nextList = (customer.deliveryAddresses || []).map((a) => ({
      ...a,
      isDefault: a.id === addressId,
    }));
    const defaultAddr = nextList.find((a) => a.id === addressId);
    await onUpdateProfile({
      deliveryAddresses: nextList,
      city: defaultAddr?.city || customer.city,
      state: defaultAddr?.state || customer.state,
      pincode: defaultAddr?.pincode || customer.pincode,
    });
  };

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Customer Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-2xs">
        <div className="flex items-center gap-4">
          {customer.photoURL ? (
            <img
              src={customer.photoURL}
              alt={customer.fullName}
              className="h-14 w-14 rounded-full object-cover border-2 border-amber-500"
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-stone-900 text-amber-400 font-serif text-xl font-bold">
              {customer.fullName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-serif text-2xl font-bold text-stone-950">{customer.fullName}</h1>
              <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-900">
                {customer.accountType}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              {customer.email}
              {customer.businessName ? ` · ${customer.businessName}` : ''}
              {customer.gstNumber ? ` · GSTIN: ${customer.gstNumber}` : ''}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={onNavigateShop}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-300 bg-white px-3.5 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Continue Shopping
          </button>
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-xs font-semibold text-red-800 hover:bg-red-100 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-stone-200 pb-2">
        {(
          [
            { id: 'overview', label: 'Account Overview', icon: Sparkles },
            { id: 'orders', label: `My Bulk Inquiries (${myOrders.length})`, icon: Package },
            { id: 'profile', label: 'Profile & Business Info', icon: User },
            {
              id: 'addresses',
              label: `Saved Addresses (${(customer.deliveryAddresses || []).length})`,
              icon: MapPin,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors whitespace-nowrap ${
                active
                  ? 'bg-stone-900 text-white'
                  : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: ACCOUNT OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 tabular-nums">
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="text-xs text-stone-500">Total Bulk Inquiries</div>
              <div className="mt-1 text-2xl font-bold text-stone-900">{myOrders.length}</div>
              <div className="mt-1 text-[11px] text-stone-500">Submitted under your account</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="text-xs text-stone-500">Total Requested Units</div>
              <div className="mt-1 text-2xl font-bold text-stone-900">
                {totalUnitsRequested.toLocaleString('en-IN')}
              </div>
              <div className="mt-1 text-[11px] text-stone-500">Across all decoration inquiries</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="text-xs text-stone-500">Total Quotation Value</div>
              <div className="mt-1 text-2xl font-bold text-amber-700">
                {formatINR(totalInquiryEstimate)}
              </div>
              <div className="mt-1 text-[11px] text-stone-500">Estimated / quoted value</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <div className="text-xs text-stone-500">Saved Delivery Addresses</div>
              <div className="mt-1 text-2xl font-bold text-stone-900">
                {(customer.deliveryAddresses || []).length}
              </div>
              <div className="mt-1 text-[11px] text-stone-500">
                {customer.city ? `${customer.city}, ${customer.state}` : 'Add your default venue/warehouse'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Profile Snapshot */}
            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-stone-900">Profile &amp; Business Summary</h2>
                <button
                  type="button"
                  onClick={() => onSelectTab('profile')}
                  className="text-xs font-semibold text-amber-800 underline"
                >
                  Edit Profile
                </button>
              </div>
              <div className="space-y-2 text-xs text-stone-600">
                <div>
                  <span className="text-stone-400">Full Name:</span>{' '}
                  <strong className="text-stone-900">{customer.fullName}</strong>
                </div>
                <div>
                  <span className="text-stone-400">Account Type:</span>{' '}
                  <strong className="text-stone-900">{customer.accountType}</strong>
                </div>
                <div>
                  <span className="text-stone-400">Business Name:</span>{' '}
                  <strong className="text-stone-900">{customer.businessName || 'Not provided'}</strong>
                </div>
                <div>
                  <span className="text-stone-400">Mobile / WhatsApp:</span>{' '}
                  <strong className="text-stone-900 tabular-nums">
                    {customer.phoneNumber || 'Not provided'}
                  </strong>
                </div>
                <div>
                  <span className="text-stone-400">GSTIN:</span>{' '}
                  <strong className="font-mono text-stone-900">{customer.gstNumber || 'Not provided'}</strong>
                </div>
              </div>
            </div>

            {/* Recent Inquiries */}
            <div className="lg:col-span-2 rounded-xl border border-stone-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-stone-900">Recent Bulk Inquiries &amp; Quotations</h2>
                <button
                  type="button"
                  onClick={() => onSelectTab('orders')}
                  className="text-xs font-semibold text-amber-800 underline"
                >
                  View All ({myOrders.length})
                </button>
              </div>

              {myOrders.length === 0 ? (
                <div className="rounded-xl border border-dashed border-stone-200 p-8 text-center space-y-2">
                  <Package className="h-8 w-8 text-stone-400 mx-auto" />
                  <div className="text-xs font-semibold text-stone-800">
                    You haven&apos;t submitted any bulk inquiries yet
                  </div>
                  <p className="text-xs text-stone-500">
                    Explore DesiDiya wedding, festival, and corporate decoration themes or products to create your first
                    bulk quotation request.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-stone-100">
                  {myOrders.slice(0, 4).map((ord) => (
                    <div
                      key={ord.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs"
                    >
                      <div>
                        <div className="font-bold text-stone-900">
                          {ord.orderRef}{' '}
                          <span className="font-normal text-stone-500">
                            · {ord.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        <div className="text-stone-600 line-clamp-1">{ord.itemsSummary}</div>
                      </div>
                      <div className="flex items-center gap-3 tabular-nums">
                        <div className="text-right">
                          <div className="font-bold text-stone-900">{formatINR(ord.finalAmount)}</div>
                          <div className="text-[11px] font-semibold text-amber-800">{ord.status}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setExpandedOrderId(ord.id);
                            onSelectTab('orders');
                          }}
                          className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-1.5 font-semibold text-stone-800 hover:bg-stone-100"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MY BULK ORDERS & QUOTATIONS */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="rounded-xl border border-stone-200 bg-white p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900">
                My Bulk Order Inquiries &amp; Quotations ({myOrders.length})
              </h2>
              <p className="text-xs text-stone-500">
                Track quotation status, download official PDF quotations, and communicate with the DesiDiya B2B desk.
              </p>
            </div>
          </div>

          {myOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center space-y-3">
              <Package className="h-10 w-10 text-stone-400 mx-auto" />
              <div className="text-sm font-bold text-stone-800">No bulk order inquiries found</div>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                Browse DesiDiya products, occasion themes, or decoration designs and click &ldquo;Buy in Bulk&rdquo; to
                request a customized B2B quotation.
              </p>
              <button
                type="button"
                onClick={onNavigateShop}
                className="inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600"
              >
                Explore Products &amp; Occasions
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {myOrders.map((ord) => {
                const isExpanded = expandedOrderId === ord.id;
                const waSupport = buildWhatsAppMessage('initial', ord);
                return (
                  <div
                    key={ord.id}
                    className="rounded-xl border border-stone-200 bg-white overflow-hidden shadow-2xs"
                  >
                    <div
                      onClick={() => setExpandedOrderId(isExpanded ? null : ord.id)}
                      className="cursor-pointer flex flex-wrap items-center justify-between gap-4 p-5 hover:bg-stone-50/80 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="font-mono text-sm font-bold text-stone-950">
                            {ord.orderRef}
                          </span>
                          <span className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                            {ord.status}
                          </span>
                          <span className="text-xs text-stone-500 tabular-nums">
                            Submitted on {ord.createdAt.slice(0, 10)}
                          </span>
                        </div>
                        <div className="text-xs text-stone-600">
                          {ord.itemsSummary}
                          {ord.occasionName ? ` · Occasion: ${ord.occasionName}` : ''}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 tabular-nums">
                        <div className="text-right">
                          <div className="text-xs text-stone-500">
                            {ord.totalQuantity} units · Quoted Total
                          </div>
                          <div className="text-base font-bold text-stone-950">
                            {formatINR(ord.finalAmount || ord.estimatedAmount)}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-stone-400" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-stone-400" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-stone-200 bg-stone-50/50 p-5 space-y-5 text-xs">
                        {/* Order Metadata Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="rounded-lg border border-stone-200 bg-white p-3.5 space-y-1">
                            <div className="font-bold text-stone-900">Delivery &amp; Venue Details</div>
                            <div className="text-stone-600">{ord.address}</div>
                            <div className="text-stone-600">
                              {ord.city}, {ord.state} — {ord.pinCode}
                            </div>
                            {ord.expectedDeliveryDate && (
                              <div className="text-amber-800 font-medium pt-1">
                                Requested Delivery: {ord.expectedDeliveryDate}
                              </div>
                            )}
                          </div>

                          <div className="rounded-lg border border-stone-200 bg-white p-3.5 space-y-1">
                            <div className="font-bold text-stone-900">Occasion &amp; Event Context</div>
                            <div className="text-stone-600">
                              Occasion: <strong>{ord.occasionName || ord.campaignSlug || 'General Bulk'}</strong>
                            </div>
                            {ord.decorationThemeName && (
                              <div className="text-stone-600">Theme: {ord.decorationThemeName}</div>
                            )}
                            {ord.eventDate && <div className="text-stone-600">Event Date: {ord.eventDate}</div>}
                            {ord.guestCount && <div className="text-stone-600">Guest Count: {ord.guestCount}</div>}
                          </div>

                          <div className="rounded-lg border border-stone-200 bg-white p-3.5 space-y-1 tabular-nums">
                            <div className="font-bold text-stone-900">Quotation Breakdown</div>
                            <div className="flex justify-between text-stone-600">
                              <span>Catalog Estimate:</span>
                              <span>{formatINR(ord.estimatedAmount)}</span>
                            </div>
                            {ord.discountAmount > 0 && (
                              <div className="flex justify-between text-emerald-700">
                                <span>Wholesale Discount ({ord.discountPercent}%):</span>
                                <span>-{formatINR(ord.discountAmount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-stone-600">
                              <span>GST ({ord.taxPercent || 18}%):</span>
                              <span>{formatINR(ord.taxAmount)}</span>
                            </div>
                            {ord.shippingAmount > 0 && (
                              <div className="flex justify-between text-stone-600">
                                <span>Logistics / Shipping:</span>
                                <span>{formatINR(ord.shippingAmount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between font-bold text-stone-950 border-t border-stone-200 pt-1">
                              <span>Final Quoted Total:</span>
                              <span>{formatINR(ord.finalAmount)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Selected Products Table */}
                        <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
                          <table className="w-full text-left border-collapse text-xs tabular-nums">
                            <thead>
                              <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                                <th className="py-2.5 px-3 font-semibold">SKU</th>
                                <th className="py-2.5 px-3 font-semibold">Product Name</th>
                                <th className="py-2.5 px-3 font-semibold text-right">Quantity</th>
                                <th className="py-2.5 px-3 font-semibold text-right">Unit Rate</th>
                                <th className="py-2.5 px-3 font-semibold text-right">Line Subtotal</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-stone-100">
                              {ord.items.map((item, idx) => {
                                const unitRate = item.negotiatedUnitPrice ?? item.unitPrice;
                                return (
                                  <tr key={`${item.sku}-${idx}`}>
                                    <td className="py-2 px-3 font-mono font-semibold text-stone-900">
                                      {item.sku}
                                    </td>
                                    <td className="py-2 px-3 font-medium text-stone-900">
                                      {item.productName}
                                    </td>
                                    <td className="py-2 px-3 text-right font-semibold">
                                      {item.requestedQuantity} {item.quantityUnit || 'pcs'}
                                    </td>
                                    <td className="py-2 px-3 text-right">{formatINR(unitRate)}</td>
                                    <td className="py-2 px-3 text-right font-bold">
                                      {formatINR(unitRate * item.requestedQuantity)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>

                        {/* Payment & Dispatch Tracking Info if available */}
                        {(ord.paymentLink || ord.courierName || ord.trackingNumber) && (
                          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3.5 flex flex-wrap items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <div className="font-bold text-emerald-950">
                                Payment Status: <span className="uppercase">{ord.paymentStatus}</span>
                              </div>
                              {ord.courierName && (
                                <div className="text-emerald-900">
                                  Dispatched via <strong>{ord.courierName}</strong> · Tracking:{' '}
                                  <strong className="font-mono">{ord.trackingNumber}</strong>
                                </div>
                              )}
                            </div>
                            {ord.paymentLink && (
                              <a
                                href={ord.paymentLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg bg-emerald-700 px-3.5 py-2 font-bold text-white hover:bg-emerald-800"
                              >
                                Open Official Payment Link
                              </a>
                            )}
                          </div>
                        )}

                        {/* Actions Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                          <div className="flex items-center gap-2 text-stone-500">
                            <Clock className="h-4 w-4" />
                            <span>Last updated: {ord.updatedAt.slice(0, 16).replace('T', ' ')}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2.5">
                            <button
                              type="button"
                              onClick={() => exportQuotationToPdf(ord)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2 font-semibold text-stone-800 hover:bg-stone-100"
                            >
                              <FileText className="h-3.5 w-3.5 text-amber-700" />
                              Download Quotation PDF
                            </button>
                            <a
                              href={waSupport.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 font-semibold text-white hover:bg-emerald-800"
                            >
                              <MessageSquare className="h-3.5 w-3.5" />
                              Contact DesiDiya B2B Support on WhatsApp
                            </a>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: PROFILE & BUSINESS DETAILS */}
      {activeTab === 'profile' && (
        <form
          onSubmit={handleSaveProfile}
          className="rounded-xl border border-stone-200 bg-white p-6 space-y-5 max-w-3xl"
        >
          <div className="border-b border-stone-200 pb-4">
            <h2 className="text-base font-bold text-stone-900">
              Customer Profile &amp; B2B GST Details
            </h2>
            <p className="text-xs text-stone-500">
              Your saved details automatically pre-fill future bulk order inquiries for faster checkout.
            </p>
          </div>

          {profileSavedMsg && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-700" />
              <span>{profileSavedMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">Email Address</label>
              <input
                type="email"
                disabled
                value={customer.email}
                className="w-full rounded-lg border border-stone-200 bg-stone-100 px-3 py-2 text-xs text-stone-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Mobile Number *
              </label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="9820112233"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                WhatsApp Number *
              </label>
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                placeholder="9820112233"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Account Classification
              </label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as CustomerAccountType)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-900"
              >
                {ACCOUNT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Company / Event Agency Name
              </label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-400" />
                <input
                  type="text"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g. Celebrations Decor Studio"
                  className="w-full rounded-lg border border-stone-300 pl-8 pr-3 py-2 text-xs text-stone-900"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                GST Number (Optional)
              </label>
              <input
                type="text"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
                placeholder="27AABCM1234F1Z5"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs font-mono uppercase text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Mumbai"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">State</label>
              <input
                type="text"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                placeholder="Maharashtra"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">PIN Code</label>
              <input
                type="text"
                value={pincode}
                onChange={(e) => setPincode(e.target.value)}
                placeholder="400051"
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs text-stone-900 tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <span>Synced with Cloud Firestore (`users/{customer.uid}`)</span>
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="rounded-xl bg-stone-900 px-5 py-2.5 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {savingProfile ? 'Saving Changes...' : 'Save Profile Changes'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: SAVED DELIVERY ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-7 space-y-4">
            <div className="rounded-xl border border-stone-200 bg-white p-5">
              <h2 className="text-base font-bold text-stone-900">
                Saved Venue &amp; Warehouse Addresses ({(customer.deliveryAddresses || []).length})
              </h2>
              <p className="text-xs text-stone-500">
                Manage multiple event venues, warehouses, or corporate offices for rapid bulk order inquiries.
              </p>
            </div>

            {(customer.deliveryAddresses || []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-stone-300 bg-white p-8 text-center text-xs text-stone-500">
                No delivery addresses saved yet. Add an address using the form on the right.
              </div>
            ) : (
              <div className="space-y-3">
                {(customer.deliveryAddresses || []).map((addr) => (
                  <div
                    key={addr.id}
                    className={`rounded-xl border bg-white p-4 flex flex-wrap items-start justify-between gap-4 ${
                      addr.isDefault ? 'border-amber-500 ring-1 ring-amber-500' : 'border-stone-200'
                    }`}
                  >
                    <div className="space-y-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-stone-900">{addr.label}</span>
                        {addr.isDefault && (
                          <span className="rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-stone-700 font-medium">
                        {addr.recipientName} · {addr.phone}
                      </div>
                      <div className="text-stone-600">{addr.streetAddress}</div>
                      <div className="text-stone-600">
                        {addr.city}, {addr.state} — {addr.pincode}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!addr.isDefault && (
                        <button
                          type="button"
                          onClick={() => handleSetDefaultAddress(addr.id)}
                          className="rounded-lg border border-stone-300 px-2.5 py-1 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                        >
                          Set Default
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteAddress(addr.id)}
                        className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-700 hover:bg-red-100"
                        aria-label="Remove address"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={handleAddAddress}
            className="lg:col-span-5 rounded-xl border border-stone-200 bg-white p-5 space-y-4"
          >
            <h3 className="text-sm font-bold text-stone-900">Add New Delivery Address</h3>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">Address Label *</label>
              <input
                type="text"
                required
                placeholder="e.g. Primary Warehouse / Taj Ballroom Venue"
                value={addrLabel}
                onChange={(e) => setAddrLabel(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Recipient Name *</label>
                <input
                  type="text"
                  required
                  value={addrRecipient}
                  onChange={(e) => setAddrRecipient(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">Contact Phone *</label>
                <input
                  type="tel"
                  required
                  value={addrPhone}
                  onChange={(e) => setAddrPhone(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs tabular-nums"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-700 mb-1">
                Street / Building / Venue Address *
              </label>
              <input
                type="text"
                required
                placeholder="Plot 14, Industrial Estate, Andheri East"
                value={addrStreet}
                onChange={(e) => setAddrStreet(e.target.value)}
                className="w-full rounded-lg border border-stone-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">City *</label>
                <input
                  type="text"
                  required
                  value={addrCity}
                  onChange={(e) => setAddrCity(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">State *</label>
                <input
                  type="text"
                  required
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-700 mb-1">PIN Code *</label>
                <input
                  type="text"
                  required
                  value={addrPin}
                  onChange={(e) => setAddrPin(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-2.5 py-2 text-xs tabular-nums"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingAddress}
              className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-stone-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>{savingAddress ? 'Saving Address...' : 'Save Delivery Address'}</span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
