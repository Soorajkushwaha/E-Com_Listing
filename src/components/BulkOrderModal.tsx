import React, { useState } from 'react';
import { CheckCircle2, Plus, Trash2, X, MessageSquare, ShieldCheck } from 'lucide-react';
import type { BulkOrder, BulkOrderItem, Campaign, Product } from '../types/catalog';
import {
  buildWhatsAppMessage,
  formatINR,
  resolveOrderCampaignAssociations,
} from '../utils/catalogLogic';

interface BulkOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialItems: BulkOrderItem[];
  allProducts: Product[];
  campaigns: Campaign[];
  activeCampaignSlug?: string;
  onSubmitOrder: (payload: Partial<BulkOrder>) => Promise<BulkOrder>;
}

export const BulkOrderModal: React.FC<BulkOrderModalProps> = ({
  isOpen,
  onClose,
  initialItems,
  allProducts,
  campaigns,
  activeCampaignSlug = 'diwali-2026',
  onSubmitOrder,
}) => {
  const [items, setItems] = useState<BulkOrderItem[]>(
    initialItems.length > 0
      ? initialItems
      : allProducts.slice(0, 1).map((p) => ({
          productId: p.id,
          sku: p.sku,
          productName: p.name,
          unitPrice: p.sellingPrice,
          mrp: p.mrp,
          requestedQuantity: 25,
        }))
  );

  React.useEffect(() => {
    if (initialItems.length > 0) {
      setItems(initialItems);
    }
  }, [initialItems]);

  const [selectedAddProductId, setSelectedAddProductId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [mobile, setMobile] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [campaignSlug, setCampaignSlug] = useState(activeCampaignSlug || 'diwali-2026');

  React.useEffect(() => {
    if (activeCampaignSlug && activeCampaignSlug !== 'all') {
      setCampaignSlug(activeCampaignSlug);
    }
  }, [activeCampaignSlug]);

  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [preferredContact, setPreferredContact] = useState<'whatsapp' | 'phone' | 'email'>('whatsapp');
  const [requirements, setRequirements] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmedOrder, setConfirmedOrder] = useState<BulkOrder | null>(null);

  if (!isOpen) return null;

  const totalUnits = items.reduce((s, i) => s + Math.max(1, Number(i.requestedQuantity) || 1), 0);
  const estimatedSubtotal = items.reduce(
    (s, i) => s + i.unitPrice * Math.max(1, Number(i.requestedQuantity) || 1),
    0
  );

  const handleUpdateQty = (idx: number, qty: number) => {
    const safe = Math.max(1, Math.min(100000, Math.round(qty) || 1));
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, requestedQuantity: safe } : item)));
  };

  const handleRemoveItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddProduct = () => {
    if (!selectedAddProductId) return;
    const prod = allProducts.find((p) => p.id === selectedAddProductId);
    if (!prod) return;
    const existingIdx = items.findIndex((i) => i.productId === prod.id);
    if (existingIdx >= 0) {
      handleUpdateQty(existingIdx, items[existingIdx].requestedQuantity + 25);
    } else {
      setItems((prev) => [
        ...prev,
        {
          productId: prod.id,
          sku: prod.sku,
          productName: prod.name,
          unitPrice: prod.sellingPrice,
          mrp: prod.mrp,
          requestedQuantity: 25,
        },
      ]);
    }
    setSelectedAddProductId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (items.length === 0) {
      setErrorMsg('Please include at least one product in your bulk inquiry.');
      return;
    }

    const cleanMobile = mobile.replace(/[^0-9+]/g, '');
    if (customerName.trim().length < 2) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    if (cleanMobile.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    if (!address.trim() || !city.trim() || !stateName.trim() || pinCode.trim().length < 4) {
      setErrorMsg('Please complete the delivery address, city, state, and PIN code.');
      return;
    }

    setSubmitting(true);
    try {
      const campaignAssoc = resolveOrderCampaignAssociations({
        explicitCampaignSlug: campaignSlug,
        items,
        products: allProducts,
        campaigns,
      });

      const created = await onSubmitOrder({
        customerName: customerName.trim(),
        companyName: companyName.trim(),
        mobile: cleanMobile,
        whatsapp: (whatsapp.trim() || cleanMobile).replace(/[^0-9+]/g, ''),
        email: email.trim(),
        address: address.trim(),
        city: city.trim(),
        state: stateName.trim(),
        pinCode: pinCode.trim(),
        gstNumber: gstNumber.trim().toUpperCase(),
        campaignId: campaignAssoc.campaignId,
        campaignSlug: campaignAssoc.campaignSlug,
        campaignSlugs: campaignAssoc.campaignSlugs,
        expectedDeliveryDate,
        preferredContact,
        requirements: requirements.trim(),
        items,
      });
      setConfirmedOrder(created);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to submit bulk order request. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setConfirmedOrder(null);
    setErrorMsg('');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-order-modal-title"
    >
      <div className="relative my-8 w-full max-w-3xl rounded-xl border border-stone-200 bg-white text-stone-900 shadow-2xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-stone-200 bg-stone-900 px-6 py-4 text-stone-50">
          <div>
            <h2 id="bulk-order-modal-title" className="text-lg font-semibold tracking-tight">
              {confirmedOrder ? 'Bulk Order Inquiry Confirmed' : 'Request B2B Bulk Order Quotation'}
            </h2>
            <p className="text-xs text-stone-300">
              No immediate online payment required · Custom B2B tier pricing &amp; GST invoice provided on review
            </p>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Close bulk order dialog"
            className="rounded-lg p-2 text-stone-300 hover:bg-stone-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {confirmedOrder ? (
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex items-start gap-4 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
              <CheckCircle2 className="h-7 w-7 text-emerald-700 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
                  Status: {confirmedOrder.status}
                </div>
                <h3 className="text-xl font-bold text-stone-900 tabular-nums">
                  Order Reference: {confirmedOrder.orderRef}
                </h3>
                <p className="text-sm text-stone-700">
                  Thank you, <strong>{confirmedOrder.customerName}</strong>. Your inquiry for{' '}
                  <strong className="tabular-nums">{confirmedOrder.totalQuantity} units</strong> (Estimated Catalog
                  Value: <strong className="tabular-nums">{formatINR(confirmedOrder.estimatedAmount)}</strong>) has
                  been logged. Our B2B desk will contact you on WhatsApp (
                  <span className="tabular-nums">{confirmedOrder.whatsapp}</span>) with your formal quotation.
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-stone-200 p-4 space-y-2 text-sm">
              <div className="font-semibold text-stone-900">Requested Items Snapshot</div>
              <div className="divide-y divide-stone-100">
                {confirmedOrder.items.map((item) => (
                  <div key={item.sku} className="flex items-center justify-between py-2 text-xs">
                    <span>
                      <strong>{item.productName}</strong> · SKU: {item.sku}
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      {item.requestedQuantity} units × {formatINR(item.unitPrice)} ={' '}
                      {formatINR(item.requestedQuantity * item.unitPrice)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <a
                href={buildWhatsAppMessage('initial', confirmedOrder).url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-emerald-800 transition-colors"
              >
                <MessageSquare className="h-4 w-4" />
                Open WhatsApp Inquiry Thread
              </a>
              <button
                type="button"
                onClick={resetAndClose}
                className="rounded-lg bg-stone-900 px-5 py-2.5 text-xs font-semibold text-white hover:bg-stone-800 transition-colors"
              >
                Done &amp; Return to Catalog
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto p-6 space-y-6">
            {errorMsg && (
              <div
                role="alert"
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-800"
              >
                {errorMsg}
              </div>
            )}

            {/* Selected Products Section */}
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                  1. Selected Products &amp; Quantities ({items.length} SKU{items.length === 1 ? '' : 's'})
                </label>
                <div className="text-xs font-medium text-stone-700 tabular-nums">
                  Total Units: <strong>{totalUnits}</strong> · Catalog Estimate:{' '}
                  <strong>{formatINR(estimatedSubtotal)}</strong>
                </div>
              </div>

              <div className="divide-y divide-stone-200 rounded-lg border border-stone-200 bg-stone-50/60">
                {items.map((item, idx) => (
                  <div key={`${item.sku}-${idx}`} className="flex flex-wrap items-center justify-between gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-stone-900 truncate">{item.productName}</div>
                      <div className="text-xs text-stone-500 tabular-nums">
                        SKU: {item.sku} · Catalog Price: {formatINR(item.unitPrice)} / unit
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label htmlFor={`qty-${item.sku}`} className="text-xs text-stone-600">
                        Qty:
                      </label>
                      <input
                        id={`qty-${item.sku}`}
                        type="number"
                        min={1}
                        max={100000}
                        value={item.requestedQuantity}
                        onChange={(e) => handleUpdateQty(idx, Number(e.target.value))}
                        className="w-24 rounded-md border border-stone-300 bg-white px-2.5 py-1.5 text-sm font-medium tabular-nums text-stone-900 focus:border-amber-600 focus:outline-none"
                      />
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          aria-label={`Remove ${item.productName}`}
                          className="rounded-md p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add another product */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select
                  aria-label="Add another product to bulk order"
                  value={selectedAddProductId}
                  onChange={(e) => setSelectedAddProductId(e.target.value)}
                  className="flex-1 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs text-stone-800 focus:border-amber-600 focus:outline-none"
                >
                  <option value="">+ Add another product to this bulk request...</option>
                  {allProducts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({formatINR(p.sellingPrice)})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAddProduct}
                  disabled={!selectedAddProductId}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-xs font-semibold text-stone-800 hover:bg-stone-200 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Item
                </button>
              </div>
            </div>

            {/* Customer Contact & Company Details */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                2. Buyer &amp; Company Information
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="bulk-customer-name" className="block text-xs font-medium text-stone-700 mb-1">
                    Customer Full Name *
                  </label>
                  <input
                    id="bulk-customer-name"
                    type="text"
                    required
                    placeholder="e.g. Aarav Mehta"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-company-name" className="block text-xs font-medium text-stone-700 mb-1">
                    Business / Company Name (Optional)
                  </label>
                  <input
                    id="bulk-company-name"
                    type="text"
                    placeholder="e.g. Mehta FinCorp Pvt. Ltd."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-mobile" className="block text-xs font-medium text-stone-700 mb-1">
                    Mobile Number *
                  </label>
                  <input
                    id="bulk-mobile"
                    type="tel"
                    required
                    placeholder="e.g. 9820112233"
                    value={mobile}
                    onChange={(e) => {
                      setMobile(e.target.value);
                      if (!whatsapp) setWhatsapp(e.target.value);
                    }}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm tabular-nums text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-whatsapp" className="block text-xs font-medium text-stone-700 mb-1">
                    WhatsApp Number *
                  </label>
                  <input
                    id="bulk-whatsapp"
                    type="tel"
                    required
                    placeholder="e.g. 9820112233"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm tabular-nums text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-email" className="block text-xs font-medium text-stone-700 mb-1">
                    Email Address (Optional)
                  </label>
                  <input
                    id="bulk-email"
                    type="email"
                    placeholder="procurement@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-gst" className="block text-xs font-medium text-stone-700 mb-1">
                    GST Number (Optional — for Input Tax Credit)
                  </label>
                  <input
                    id="bulk-gst"
                    type="text"
                    placeholder="e.g. 27AABCM1234F1Z5"
                    value={gstNumber}
                    onChange={(e) => setGstNumber(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm uppercase text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Address & Event */}
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-stone-600">
                3. Delivery Location &amp; Occasion Details
              </div>
              <div>
                <label htmlFor="bulk-address" className="block text-xs font-medium text-stone-700 mb-1">
                  Full Delivery Address *
                </label>
                <input
                  id="bulk-address"
                  type="text"
                  required
                  placeholder="Building, Floor, Street, Area"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="bulk-city" className="block text-xs font-medium text-stone-700 mb-1">
                    City *
                  </label>
                  <input
                    id="bulk-city"
                    type="text"
                    required
                    placeholder="Mumbai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-state" className="block text-xs font-medium text-stone-700 mb-1">
                    State *
                  </label>
                  <input
                    id="bulk-state"
                    type="text"
                    required
                    placeholder="Maharashtra"
                    value={stateName}
                    onChange={(e) => setStateName(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-pincode" className="block text-xs font-medium text-stone-700 mb-1">
                    PIN Code *
                  </label>
                  <input
                    id="bulk-pincode"
                    type="text"
                    required
                    placeholder="400051"
                    value={pinCode}
                    onChange={(e) => setPinCode(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm tabular-nums text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                <div>
                  <label htmlFor="bulk-campaign" className="block text-xs font-medium text-stone-700 mb-1">
                    Event / Campaign
                  </label>
                  <select
                    id="bulk-campaign"
                    value={campaignSlug}
                    onChange={(e) => setCampaignSlug(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                  >
                    {campaigns.map((c) => (
                      <option key={c.slug} value={c.slug}>
                        {c.name}
                      </option>
                    ))}
                    <option value="wholesale-general">General Wholesale Inquiry</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="bulk-delivery-date" className="block text-xs font-medium text-stone-700 mb-1">
                    Expected Delivery Date
                  </label>
                  <input
                    id="bulk-delivery-date"
                    type="date"
                    value={expectedDeliveryDate}
                    onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="bulk-contact-pref" className="block text-xs font-medium text-stone-700 mb-1">
                    Preferred Contact Method
                  </label>
                  <select
                    id="bulk-contact-pref"
                    value={preferredContact}
                    onChange={(e) => setPreferredContact(e.target.value as 'whatsapp' | 'phone' | 'email')}
                    className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                  >
                    <option value="whatsapp">WhatsApp (Fastest Quotation)</option>
                    <option value="phone">Phone Call</option>
                    <option value="email">Email</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="bulk-requirements" className="block text-xs font-medium text-stone-700 mb-1">
                  Custom Branding, Packaging, or Multi-Address Dispatch Notes
                </label>
                <textarea
                  id="bulk-requirements"
                  rows={2}
                  placeholder="Mention logo engraving, custom sleeves, gift message cards, or delivery schedule..."
                  value={requirements}
                  onChange={(e) => setRequirements(e.target.value)}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-900 focus:border-amber-600 focus:outline-none"
                />
              </div>
            </div>

            {/* Privacy Notice & Submit */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-stone-200 pt-4">
              <div className="flex items-start gap-2 text-xs text-stone-500 max-w-md">
                <ShieldCheck className="h-4 w-4 text-stone-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Privacy Notice:</strong> Your contact and GST details are strictly isolated and used solely to
                  prepare your B2B quotation and fulfill your order.
                </span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={resetAndClose}
                  className="rounded-lg border border-stone-300 px-4 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-amber-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                >
                  {submitting ? 'Submitting Inquiry...' : 'Submit Bulk Order Request'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
