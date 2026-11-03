import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  Building2,
  CheckCircle2,
  Download,
  Mail,
  MapPin,
  MessageSquare,
  Package,
  Phone,
  Search,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type {
  BulkOrder,
  CustomerAccountType,
  CustomerProfile,
  CustomerSummary,
  OrderStatus,
} from '../types/catalog';
import { formatINR } from '../utils/catalogLogic';

interface AdminCustomerManagerProps {
  registeredCustomers: CustomerProfile[];
  bulkOrders: BulkOrder[];
  onUpdateCustomerAdminNotes: (
    uid: string,
    updates: { internalNotes: string; accountStatus: 'active' | 'suspended' }
  ) => Promise<void>;
  onSelectOrderInAdmin: (orderId: string) => void;
}

const ACCOUNT_TYPES: ('All' | CustomerAccountType)[] = [
  'All',
  'Individual Customer',
  'Business Buyer',
  'Event Planner',
  'Decorator',
  'Wholesaler',
  'Corporate Buyer',
];

const CONFIRMED_STAGES: OrderStatus[] = [
  'Order Confirmed',
  'Awaiting Payment',
  'Paid',
  'Processing',
  'Dispatched',
  'Delivered',
];

export const AdminCustomerManager: React.FC<AdminCustomerManagerProps> = ({
  registeredCustomers,
  bulkOrders,
  onUpdateCustomerAdminNotes,
  onSelectOrderInAdmin,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [accountTypeFilter, setAccountTypeFilter] = useState<'All' | CustomerAccountType>('All');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [editStatus, setEditStatus] = useState<'active' | 'suspended'>('active');
  const [savingNotes, setSavingNotes] = useState(false);
  const [savedBanner, setSavedBanner] = useState('');

  // Merge registered Firestore/API customers with customers derived from bulkOrders
  const unifiedCustomers = useMemo<CustomerSummary[]>(() => {
    const map = new Map<string, CustomerSummary>();

    // 1. Seed from registered customer accounts first
    registeredCustomers.forEach((c) => {
      const key = c.uid || c.email.toLowerCase() || c.phoneNumber.replace(/[^0-9]/g, '');
      map.set(key, {
        id: c.uid,
        uid: c.uid,
        customerName: c.fullName,
        companyName: c.businessName || '',
        accountType: c.accountType || 'Individual Customer',
        accountStatus: c.accountStatus || 'active',
        photoURL: c.photoURL || '',
        mobile: c.phoneNumber || '',
        whatsapp: c.whatsappNumber || c.phoneNumber || '',
        email: c.email || '',
        city: c.city || '',
        state: c.state || '',
        pinCode: c.pincode || '',
        gstNumber: c.gstNumber || '',
        deliveryAddresses: c.deliveryAddresses || [],
        orderCount: 0,
        confirmedValue: 0,
        lastOrderDate: c.lastLoginAt || c.createdAt || '',
        createdAt: c.createdAt,
        lastLoginAt: c.lastLoginAt,
        notes: c.internalNotes || '',
        orders: [],
      });
    });

    // 2. Attach bulk orders to matching registered customer or create summary entry
    bulkOrders.forEach((o) => {
      const isConfirmed = CONFIRMED_STAGES.includes(o.status);
      // Match by ownerId, email, or clean phone
      let matchedKey: string | null = null;
      if (o.ownerId && map.has(o.ownerId)) {
        matchedKey = o.ownerId;
      } else {
        const cleanOrderPhone = (o.mobile || '').replace(/[^0-9]/g, '');
        const cleanOrderEmail = (o.email || '').trim().toLowerCase();
        for (const [k, existing] of map.entries()) {
          const existingPhone = (existing.mobile || '').replace(/[^0-9]/g, '');
          const existingEmail = (existing.email || '').trim().toLowerCase();
          if (
            (cleanOrderEmail && existingEmail === cleanOrderEmail) ||
            (cleanOrderPhone && existingPhone === cleanOrderPhone)
          ) {
            matchedKey = k;
            break;
          }
        }
      }

      if (matchedKey) {
        const existing = map.get(matchedKey)!;
        existing.orderCount += 1;
        if (isConfirmed) existing.confirmedValue += o.finalAmount;
        if (!existing.lastOrderDate || o.createdAt > existing.lastOrderDate) {
          existing.lastOrderDate = o.createdAt;
        }
        if (!existing.mobile && o.mobile) existing.mobile = o.mobile;
        if (!existing.whatsapp && o.whatsapp) existing.whatsapp = o.whatsapp;
        if (!existing.city && o.city) existing.city = o.city;
        if (!existing.state && o.state) existing.state = o.state;
        if (!existing.gstNumber && o.gstNumber) existing.gstNumber = o.gstNumber;
        if (!existing.companyName && o.companyName) existing.companyName = o.companyName;
        existing.orders.push(o);
      } else {
        const fallbackKey =
          o.ownerId && o.ownerId !== 'customer-portal'
            ? o.ownerId
            : `cust-${(o.mobile || '').replace(/[^0-9]/g, '') || o.customerName}`;
        map.set(fallbackKey, {
          id: fallbackKey,
          uid: o.ownerId && o.ownerId !== 'customer-portal' ? o.ownerId : fallbackKey,
          customerName: o.customerName,
          companyName: o.companyName || '',
          accountType: o.companyName ? 'Business Buyer' : 'Individual Customer',
          accountStatus: 'active',
          mobile: o.mobile,
          whatsapp: o.whatsapp || o.mobile,
          email: o.email || '',
          city: o.city,
          state: o.state,
          pinCode: o.pinCode,
          gstNumber: o.gstNumber || '',
          deliveryAddresses: [],
          orderCount: 1,
          confirmedValue: isConfirmed ? o.finalAmount : 0,
          lastOrderDate: o.createdAt,
          createdAt: o.createdAt,
          lastLoginAt: o.createdAt,
          notes: o.internalNotes || '',
          orders: [o],
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.confirmedValue - a.confirmedValue);
  }, [registeredCustomers, bulkOrders]);

  const filteredCustomers = useMemo(() => {
    return unifiedCustomers.filter((c) => {
      if (accountTypeFilter !== 'All' && c.accountType !== accountTypeFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          c.customerName.toLowerCase().includes(q) ||
          (c.email || '').toLowerCase().includes(q) ||
          (c.mobile || '').includes(q) ||
          (c.whatsapp || '').includes(q) ||
          (c.companyName || '').toLowerCase().includes(q) ||
          (c.gstNumber || '').toLowerCase().includes(q) ||
          (c.city || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [unifiedCustomers, accountTypeFilter, searchQuery]);

  const selectedCustomer = useMemo(
    () =>
      filteredCustomers.find((c) => c.id === selectedCustomerId) ||
      filteredCustomers[0] ||
      unifiedCustomers[0] ||
      null,
    [filteredCustomers, unifiedCustomers, selectedCustomerId]
  );

  React.useEffect(() => {
    if (selectedCustomer) {
      setEditNotes(selectedCustomer.notes || '');
      setEditStatus(selectedCustomer.accountStatus || 'active');
      setSavedBanner('');
    }
  }, [selectedCustomer]);

  const handleSaveNotes = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    setSavingNotes(true);
    setSavedBanner('');
    try {
      await onUpdateCustomerAdminNotes(selectedCustomer.uid || selectedCustomer.id, {
        internalNotes: editNotes.trim(),
        accountStatus: editStatus,
      });
      setSavedBanner('Saved internal notes & account status.');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleExportCustomersCsv = () => {
    const rows = filteredCustomers.map((c) => ({
      'Customer UID': c.uid || c.id,
      'Full Name': c.customerName,
      Email: c.email || '',
      'Mobile Number': c.mobile || '',
      'WhatsApp Number': c.whatsapp || '',
      'Business / Company Name': c.companyName || '',
      'Account Type': c.accountType || 'Individual Customer',
      'Account Status': c.accountStatus || 'active',
      City: c.city || '',
      State: c.state || '',
      'PIN Code': c.pinCode || '',
      'GST Number': c.gstNumber || '',
      'Total Inquiries': c.orderCount,
      'Confirmed Order Value (INR)': c.confirmedValue,
      'Last Activity Date': (c.lastOrderDate || '').slice(0, 10),
      'Internal Admin Notes': c.notes || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DesiDiya_Customers');
    XLSX.writeFile(wb, 'DesiDiya_Customers_Directory.csv', { bookType: 'csv' });
  };

  return (
    <div className="space-y-6">
      {/* Header & Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5">
        <div>
          <h1 className="text-lg font-bold text-stone-900">
            DesiDiya Customer Directory &amp; B2B Account CRM ({unifiedCustomers.length} Accounts)
          </h1>
          <p className="text-xs text-stone-500">
            View registered customer profiles, filter by buyer classification, inspect inquiry history, add private
            admin notes, and export customer records.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCustomersCsv}
          className="inline-flex items-center gap-1.5 rounded-lg bg-stone-900 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-600 transition-colors shrink-0"
        >
          <Download className="h-4 w-4" />
          Export Customers (.CSV)
        </button>
      </div>

      {/* Search & Account Type Filter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4">
        <div className="relative flex-1 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="search"
            placeholder="Search by customer name, email, mobile, business name, or GSTIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-stone-300 pl-9 pr-3 py-1.5 text-xs text-stone-900"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-stone-600">Account Type:</span>
          <select
            aria-label="Filter customers by account type"
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value as any)}
            className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-800"
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'All' ? 'All Account Types' : t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Customers Table */}
        <div className="lg:col-span-7 rounded-xl border border-stone-200 bg-white overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-stone-200 bg-stone-50 text-stone-500">
                  <th className="py-3 px-4 font-semibold">Customer &amp; Business</th>
                  <th className="py-3 px-4 font-semibold">Account Type</th>
                  <th className="py-3 px-4 font-semibold">Contact</th>
                  <th className="py-3 px-4 font-semibold text-right">Inquiries</th>
                  <th className="py-3 px-4 font-semibold text-right">Confirmed Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {filteredCustomers.map((c) => {
                  const active = selectedCustomer?.id === c.id;
                  return (
                    <tr
                      key={c.id}
                      onClick={() => setSelectedCustomerId(c.id)}
                      className={`cursor-pointer transition-colors ${
                        active ? 'bg-amber-50/80' : 'hover:bg-stone-50'
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-bold text-stone-900">{c.customerName}</div>
                        <div className="text-[11px] text-stone-500">
                          {c.companyName || c.email || 'Direct Buyer'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="rounded border border-stone-200 bg-stone-50 px-2 py-0.5 text-[11px] font-medium text-stone-700">
                          {c.accountType || 'Individual Customer'}
                        </span>
                      </td>
                      <td className="py-3 px-4 tabular-nums">
                        <div className="font-medium text-stone-800">{c.whatsapp || c.mobile || '—'}</div>
                        <div className="text-[11px] text-stone-500">{c.city ? `${c.city}, ${c.state}` : c.email}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums">{c.orderCount}</td>
                      <td className="py-3 px-4 text-right font-bold tabular-nums text-emerald-700">
                        {formatINR(c.confirmedValue)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Customer Detail & Order History Inspector */}
        {selectedCustomer && (
          <div className="lg:col-span-5 rounded-xl border border-stone-200 bg-white p-5 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-stone-900">{selectedCustomer.customerName}</h2>
                  <span
                    className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                      selectedCustomer.accountStatus === 'suspended'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {selectedCustomer.accountStatus || 'active'}
                  </span>
                </div>
                <div className="text-xs text-stone-500">
                  {selectedCustomer.accountType || 'Individual Customer'}
                  {selectedCustomer.companyName ? ` · ${selectedCustomer.companyName}` : ''}
                </div>
              </div>

              {selectedCustomer.whatsapp && (
                <a
                  href={`https://wa.me/${selectedCustomer.whatsapp.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  WhatsApp
                </a>
              )}
            </div>

            {/* Contact & GST Metadata */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-stone-500">
                  <Mail className="h-3.5 w-3.5" />
                  <span>Email</span>
                </div>
                <div className="font-semibold text-stone-900 truncate">
                  {selectedCustomer.email || 'Not provided'}
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-stone-500">
                  <Phone className="h-3.5 w-3.5" />
                  <span>Mobile / WhatsApp</span>
                </div>
                <div className="font-semibold text-stone-900 tabular-nums">
                  {selectedCustomer.mobile || selectedCustomer.whatsapp || 'Not provided'}
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-stone-500">
                  <Building2 className="h-3.5 w-3.5" />
                  <span>GSTIN</span>
                </div>
                <div className="font-mono font-semibold text-stone-900">
                  {selectedCustomer.gstNumber || 'N/A'}
                </div>
              </div>
              <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-1">
                <div className="flex items-center gap-1.5 text-stone-500">
                  <MapPin className="h-3.5 w-3.5" />
                  <span>Location</span>
                </div>
                <div className="font-semibold text-stone-900">
                  {selectedCustomer.city
                    ? `${selectedCustomer.city}, ${selectedCustomer.state}`
                    : 'Not specified'}
                </div>
              </div>
            </div>

            {/* Saved Delivery Addresses */}
            {selectedCustomer.deliveryAddresses && selectedCustomer.deliveryAddresses.length > 0 && (
              <div className="space-y-2 text-xs">
                <div className="font-bold text-stone-800">
                  Saved Delivery Addresses ({selectedCustomer.deliveryAddresses.length})
                </div>
                <div className="space-y-2">
                  {selectedCustomer.deliveryAddresses.map((addr) => (
                    <div
                      key={addr.id}
                      className="rounded-lg border border-stone-200 bg-stone-50 p-2.5 text-stone-600"
                    >
                      <strong className="text-stone-900">{addr.label}:</strong> {addr.streetAddress},{' '}
                      {addr.city}, {addr.state} — {addr.pincode}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customer Order History */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800">
                  Bulk Inquiry History ({selectedCustomer.orders.length})
                </span>
                <span className="text-emerald-700 font-bold tabular-nums">
                  Confirmed: {formatINR(selectedCustomer.confirmedValue)}
                </span>
              </div>
              {selectedCustomer.orders.length === 0 ? (
                <div className="rounded-lg border border-dashed border-stone-200 p-4 text-center text-stone-500">
                  No bulk orders submitted yet by this registered customer.
                </div>
              ) : (
                <div className="divide-y divide-stone-100 rounded-lg border border-stone-200 max-h-44 overflow-y-auto">
                  {selectedCustomer.orders.map((ord) => (
                    <div
                      key={ord.id}
                      className="flex items-center justify-between p-2.5 hover:bg-stone-50"
                    >
                      <div>
                        <div className="font-bold text-stone-900">
                          {ord.orderRef} · {ord.createdAt.slice(0, 10)}
                        </div>
                        <div className="text-[11px] text-stone-500 truncate max-w-[200px]">
                          {ord.itemsSummary}
                        </div>
                      </div>
                      <div className="text-right tabular-nums">
                        <div className="font-bold text-stone-900">{formatINR(ord.finalAmount)}</div>
                        <button
                          type="button"
                          onClick={() => onSelectOrderInAdmin(ord.id)}
                          className="text-[11px] font-semibold text-amber-800 underline"
                        >
                          {ord.status}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Internal Admin Notes & Account Status Form */}
            <form onSubmit={handleSaveNotes} className="space-y-3 border-t border-stone-200 pt-4 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-bold text-stone-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-amber-700" />
                  <span>Private Admin Notes (Hidden from Customer)</span>
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as 'active' | 'suspended')}
                  className="rounded border border-stone-300 bg-white px-2 py-1 text-xs font-semibold"
                >
                  <option value="active">Account Active</option>
                  <option value="suspended">Account Suspended</option>
                </select>
              </div>
              <textarea
                rows={3}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Record negotiated wholesale tier, credit verification, or corporate buyer notes..."
                className="w-full rounded-lg border border-stone-300 p-2.5 text-xs text-stone-900"
              />
              {savedBanner && (
                <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{savedBanner}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={savingNotes}
                className="w-full rounded-lg bg-stone-900 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors"
              >
                {savingNotes ? 'Saving Notes...' : 'Save Internal Customer Notes'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
