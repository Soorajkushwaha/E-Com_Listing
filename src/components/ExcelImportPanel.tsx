import React, { useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  CheckCircle2,
  CloudUpload,
  Download,
  FileSpreadsheet,
  Sparkles,
  Upload,
} from 'lucide-react';
import type { Campaign, ExcelColumnMapping, Product } from '../types/catalog';
import {
  autoDetectExcelColumnMapping,
  formatINR,
  validateAndNormalizeExcelRows,
} from '../utils/catalogLogic';
import { SAMPLE_EXCEL_WORKBOOK_ROWS } from '../utils/seedData';
import { uploadPersistentProductImage } from '../lib/firebase';

export interface BatchImportResult {
  added: number;
  updated: number;
  skipped: number;
  failed?: number;
  firestoreSynced?: number;
  firestoreError?: string | null;
}

interface ExcelImportPanelProps {
  existingProducts: Product[];
  campaigns?: Campaign[];
  onBatchImportProducts: (
    products: Omit<Product, 'id' | 'ownerId' | 'createdAt' | 'updatedAt'>[],
    duplicateMode: 'update' | 'skip',
    onProgress?: (completed: number, total: number) => void
  ) => Promise<BatchImportResult>;
}

const MAPPING_FIELDS: { key: keyof ExcelColumnMapping; label: string; required?: boolean }[] = [
  { key: 'sku', label: 'SKU / Product ID', required: true },
  { key: 'name', label: 'Product Name', required: true },
  { key: 'sellingPrice', label: 'Selling Price (₹)', required: true },
  { key: 'mrp', label: 'MRP / Original Price (₹)' },
  { key: 'category', label: 'Category' },
  { key: 'brand', label: 'Brand' },
  { key: 'heading', label: 'Title / Heading' },
  { key: 'subtitle', label: 'Subtitle' },
  { key: 'description', label: 'Product Description' },
  { key: 'imageUrl', label: 'Image URL / Filename' },
  { key: 'badge', label: 'Promotional Badge' },
  { key: 'campaign', label: 'Campaign Slug' },
  { key: 'stockStatus', label: 'Stock / Availability' },
  { key: 'amazonUrl', label: 'Amazon URL' },
  { key: 'flipkartUrl', label: 'Flipkart URL' },
  { key: 'meeshoUrl', label: 'Meesho URL' },
  { key: 'websiteUrl', label: 'Own Website URL' },
  { key: 'rating', label: 'Rating (1-5)' },
  { key: 'ratingCount', label: 'Rating Count' },
];

export const ExcelImportPanel: React.FC<ExcelImportPanelProps> = ({
  existingProducts,
  campaigns = [],
  onBatchImportProducts,
}) => {
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>('');
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<ExcelColumnMapping>(() =>
    autoDetectExcelColumnMapping([])
  );
  const [duplicateMode, setDuplicateMode] = useState<'update' | 'skip' | 'error'>('update');
  const [assignCampaignSlug, setAssignCampaignSlug] = useState<string>('');
  const [manualImageOverrides, setManualImageOverrides] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ completed: number; total: number } | null>(
    null
  );
  const [fileReadError, setFileReadError] = useState<string>('');
  const [importResultBanner, setImportResultBanner] = useState<BatchImportResult | null>(null);

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
    const detectedHeaders = json.length > 0 ? Object.keys(json[0]) : [];
    setRawRows(json);
    setHeaders(detectedHeaders);
    setMapping(autoDetectExcelColumnMapping(detectedHeaders));
    setImportResultBanner(null);
    setFileReadError('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileReadError('');
    setImportResultBanner(null);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      if (!wb.SheetNames || wb.SheetNames.length === 0) {
        setFileReadError('The uploaded Excel file does not contain any readable worksheets.');
        return;
      }
      setUploadedFileName(file.name);
      setWorkbook(wb);
      setSheetNames(wb.SheetNames);
      const first = wb.SheetNames[0] || '';
      setSelectedSheet(first);
      if (first) loadSheetData(wb, first);
    } catch (err: any) {
      setFileReadError(
        err?.message || 'Unable to parse Excel file. Please ensure it is a valid .xlsx or .xls file.'
      );
    }
  };

  const handleLoadSampleWorkbook = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_EXCEL_WORKBOOK_ROWS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DesiDiya_Festive_2026');
    setUploadedFileName('DesiDiya_Sample_Catalog.xlsx');
    setWorkbook(wb);
    setSheetNames(wb.SheetNames);
    setSelectedSheet('DesiDiya_Festive_2026');
    loadSheetData(wb, 'DesiDiya_Festive_2026');
  };

  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.json_to_sheet(SAMPLE_EXCEL_WORKBOOK_ROWS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'DesiDiya_Template');
    XLSX.writeFile(wb, 'DesiDiya_Product_Catalog_Template.xlsx');
  };

  const existingSkuSet = useMemo(
    () => new Set(existingProducts.map((p) => p.sku.toUpperCase())),
    [existingProducts]
  );

  const knownCampaignSlugs = useMemo(
    () => new Set(campaigns.map((c) => c.slug.toLowerCase())),
    [campaigns]
  );

  const validation = useMemo(() => {
    if (rawRows.length === 0) return null;
    const base = validateAndNormalizeExcelRows(
      rawRows,
      mapping,
      existingSkuSet,
      duplicateMode,
      knownCampaignSlugs.size > 0 ? knownCampaignSlugs : undefined,
      assignCampaignSlug || undefined
    );
    const enrichedProducts = base.validProducts.map((p) => {
      const mergedCampaigns = assignCampaignSlug
        ? Array.from(new Set([assignCampaignSlug, ...(p.campaigns || [p.campaign])]))
        : p.campaigns || [p.campaign];
      return {
        ...p,
        brand: p.brand === 'House of Artisan' ? 'DesiDiya' : p.brand || 'DesiDiya',
        category: p.category === 'General Gifting' ? 'Decorative Lighting' : p.category || 'Decorative Lighting',
        campaign: assignCampaignSlug || p.campaign,
        campaigns: mergedCampaigns,
        imageUrl: manualImageOverrides[p.sku] || p.imageUrl,
      };
    });
    return {
      ...base,
      validProducts: enrichedProducts,
    };
  }, [
    rawRows,
    mapping,
    existingSkuSet,
    duplicateMode,
    knownCampaignSlugs,
    assignCampaignSlug,
    manualImageOverrides,
  ]);

  const handleManualRowImageUpload = async (sku: string, file: File) => {
    const dataUrl = await uploadPersistentProductImage(file);
    setManualImageOverrides((prev) => ({ ...prev, [sku]: dataUrl }));
  };

  const handleExecuteImport = async () => {
    if (!validation || validation.validProducts.length === 0) return;
    setImporting(true);
    setFileReadError('');
    setImportResultBanner(null);
    setImportProgress({ completed: 0, total: validation.validProducts.length });

    try {
      const res = await onBatchImportProducts(
        validation.validProducts,
        duplicateMode === 'skip' ? 'skip' : 'update',
        (completed, total) => {
          setImportProgress({ completed, total });
        }
      );
      setImportResultBanner({
        ...res,
        failed: validation.summary.errorRows,
      });
    } catch (err: any) {
      setFileReadError(
        err?.message || 'Batch product import failed. Please check your connection and permissions.'
      );
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-6">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-stone-900">
            DesiDiya Excel Product Import &amp; Cloud Firestore Sync (.xlsx / .xls)
          </h2>
          <p className="text-xs text-stone-500 max-w-2xl">
            Upload your multi-sheet Excel workbook, map columns to DesiDiya catalog fields, preview and validate SKUs,
            prices, and marketplace links, and batch-save records to Cloud Firestore and the live storefront.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-stone-800 hover:bg-stone-50 transition-colors whitespace-nowrap"
          >
            <Download className="h-4 w-4 text-stone-600" />
            Download Excel Template
          </button>

          <button
            type="button"
            onClick={handleLoadSampleWorkbook}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100 transition-colors whitespace-nowrap"
          >
            <Sparkles className="h-4 w-4 text-amber-700" />
            Load Sample DesiDiya Workbook
          </button>

          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-stone-900 px-4 py-2.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors whitespace-nowrap">
            <Upload className="h-4 w-4" />
            <span>Upload Excel (.xlsx / .xls)</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* File / Import Error Alert */}
      {fileReadError && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-900"
        >
          <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <strong>Excel Import Error:</strong> {fileReadError}
          </div>
        </div>
      )}

      {/* Progress Bar during Import */}
      {importing && importProgress && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-950 tabular-nums">
            <span className="inline-flex items-center gap-2">
              <CloudUpload className="h-4 w-4 text-amber-700 animate-pulse" />
              Saving validated products to DesiDiya Storefront &amp; Cloud Firestore...
            </span>
            <span>
              {importProgress.completed} / {importProgress.total} rows processed
            </span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-amber-200/70 overflow-hidden">
            <div
              className="h-full bg-amber-600 transition-all duration-200"
              style={{
                width: `${Math.max(
                  5,
                  Math.round((importProgress.completed / Math.max(1, importProgress.total)) * 100)
                )}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Result Banner */}
      {importResultBanner && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 space-y-2"
        >
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-bold text-sm">
                DesiDiya Product Import Complete ({uploadedFileName || 'Workbook'})
              </div>
              <div className="flex flex-wrap items-center gap-4 tabular-nums">
                <span>
                  Added New: <strong className="text-emerald-800">{importResultBanner.added}</strong>
                </span>
                <span>
                  Updated by SKU: <strong className="text-amber-800">{importResultBanner.updated}</strong>
                </span>
                <span>
                  Skipped Rows: <strong>{importResultBanner.skipped}</strong>
                </span>
                <span>
                  Validation Errors: <strong className="text-red-700">{importResultBanner.failed ?? 0}</strong>
                </span>
                {typeof importResultBanner.firestoreSynced === 'number' && (
                  <span>
                    Firestore Confirmed Writes:{' '}
                    <strong className="text-emerald-800">{importResultBanner.firestoreSynced}</strong>
                  </span>
                )}
              </div>
              <p className="text-emerald-800">
                All imported products are immediately visible in the DesiDiya public storefront, category filters, and
                admin product table, and persist across page refreshes.
              </p>
              {importResultBanner.firestoreError && (
                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-100/80 p-2.5 text-amber-950">
                  <strong>Cloud Firestore Diagnostic Notice:</strong> {importResultBanner.firestoreError}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {rawRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-stone-300 bg-white p-12 text-center space-y-3">
          <FileSpreadsheet className="h-10 w-10 text-stone-400 mx-auto" />
          <div className="text-sm font-semibold text-stone-800">
            No Excel workbook loaded yet
          </div>
          <p className="text-xs text-stone-500 max-w-md mx-auto">
            Click <strong>Upload Excel (.xlsx / .xls)</strong> to select a spreadsheet from your computer, or click{' '}
            <strong>Load Sample DesiDiya Workbook</strong> to test multi-column mapping and batch import immediately.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Worksheet, Duplicate Mode & Campaign Assignment Controls */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 rounded-xl border border-stone-200 bg-white p-5">
            <div>
              <label htmlFor="excel-sheet-select" className="block text-xs font-semibold text-stone-700 mb-1">
                1. Select Worksheet ({sheetNames.length} found)
              </label>
              <select
                id="excel-sheet-select"
                value={selectedSheet}
                onChange={(e) => {
                  setSelectedSheet(e.target.value);
                  if (workbook) loadSheetData(workbook, e.target.value);
                }}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900"
              >
                {sheetNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="excel-dup-mode" className="block text-xs font-semibold text-stone-700 mb-1">
                2. Duplicate SKU Handling
              </label>
              <select
                id="excel-dup-mode"
                value={duplicateMode}
                onChange={(e) => setDuplicateMode(e.target.value as any)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900"
              >
                <option value="update">Update existing products by SKU (Recommended)</option>
                <option value="skip">Skip existing SKUs (Keep current data)</option>
                <option value="error">Flag error if duplicate SKU exists</option>
              </select>
            </div>

            <div>
              <label htmlFor="excel-campaign-assign" className="block text-xs font-semibold text-stone-700 mb-1">
                3. Assign Batch to Campaign (Optional)
              </label>
              <select
                id="excel-campaign-assign"
                value={assignCampaignSlug}
                onChange={(e) => setAssignCampaignSlug(e.target.value)}
                className="w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-900"
              >
                <option value="">Use spreadsheet Campaign column</option>
                {campaigns.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    Assign all to: {c.name} ({c.slug})
                  </option>
                ))}
              </select>
            </div>

            {validation && (
              <div className="flex flex-col justify-end">
                <button
                  type="button"
                  disabled={importing || validation.validProducts.length === 0}
                  onClick={handleExecuteImport}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-40 transition-colors"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {importing
                    ? 'Saving to Firestore...'
                    : `Import & Save (${validation.validProducts.length} Valid Rows)`}
                </button>
              </div>
            )}
          </div>

          {/* Column Mapping Grid */}
          <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-stone-900">
                Column Mapping ({headers.length} columns detected in sheet "{selectedSheet}")
              </h3>
              <span className="text-xs text-stone-500">
                Auto-detected from header row · Adjust any dropdown if your Excel file uses custom column names
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {MAPPING_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-xs font-medium text-stone-600 mb-1">
                    {field.label} {field.required && <span className="text-red-600">*</span>}
                  </label>
                  <select
                    value={mapping[field.key]}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    className="w-full rounded-lg border border-stone-300 bg-stone-50 px-2.5 py-1.5 text-xs text-stone-900"
                  >
                    <option value="">-- Unmapped --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Validation Summary & Preview Table */}
          {validation && (
            <div className="rounded-xl border border-stone-200 bg-white p-5 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 text-xs tabular-nums">
                <div className="rounded-lg border border-stone-200 p-3">
                  <div className="text-stone-500">Detected Rows</div>
                  <div className="text-lg font-bold text-stone-900">{validation.summary.totalRows}</div>
                </div>
                <div className="rounded-lg border border-stone-200 p-3">
                  <div className="text-stone-500">New Products</div>
                  <div className="text-lg font-bold text-emerald-700">{validation.summary.newProducts}</div>
                </div>
                <div className="rounded-lg border border-stone-200 p-3">
                  <div className="text-stone-500">Updates by SKU</div>
                  <div className="text-lg font-bold text-amber-700">{validation.summary.updatedProducts}</div>
                </div>
                <div className="rounded-lg border border-stone-200 p-3">
                  <div className="text-stone-500">Skipped Rows</div>
                  <div className="text-lg font-bold text-stone-700">{validation.summary.skippedRows}</div>
                </div>
                <div className="rounded-lg border border-stone-200 p-3">
                  <div className="text-stone-500">Warnings</div>
                  <div className="text-lg font-bold text-amber-600">{validation.summary.warningCount}</div>
                </div>
                <div className="rounded-lg border border-stone-200 p-3">
                  <div className="text-stone-500">Failed / Invalid</div>
                  <div className="text-lg font-bold text-red-600">{validation.summary.errorRows}</div>
                </div>
              </div>

              {validation.issues.length > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-700" />
                    Pre-Import Validation Diagnostics ({validation.issues.length} issue
                    {validation.issues.length === 1 ? '' : 's'})
                  </div>
                  <ul className="space-y-1 text-xs text-stone-700 max-h-36 overflow-y-auto">
                    {validation.issues.map((iss, idx) => (
                      <li key={idx}>
                        <strong className={iss.severity === 'error' ? 'text-red-700' : 'text-amber-800'}>
                          [{iss.severity.toUpperCase()} · Row {iss.rowNumber}]
                        </strong>{' '}
                        {iss.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Preview Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-stone-200 text-stone-500">
                      <th className="py-2.5 px-3 font-semibold">Action</th>
                      <th className="py-2.5 px-3 font-semibold">SKU</th>
                      <th className="py-2.5 px-3 font-semibold">Product Name</th>
                      <th className="py-2.5 px-3 font-semibold">Category · Brand</th>
                      <th className="py-2.5 px-3 font-semibold text-right">Selling Price</th>
                      <th className="py-2.5 px-3 font-semibold text-right">MRP</th>
                      <th className="py-2.5 px-3 font-semibold">Image Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {validation.validProducts.map((item) => {
                      const isUpdate = existingSkuSet.has(item.sku);
                      return (
                        <tr key={item.sku} className="hover:bg-stone-50/80">
                          <td className="py-2.5 px-3 font-medium">
                            {isUpdate ? (
                              <span className="text-amber-700">Update SKU</span>
                            ) : (
                              <span className="text-emerald-700">New Product</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-stone-900">{item.sku}</td>
                          <td className="py-2.5 px-3 font-medium text-stone-900">{item.name}</td>
                          <td className="py-2.5 px-3 text-stone-600">
                            {item.category} · {item.brand}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold tabular-nums">
                            {formatINR(item.sellingPrice)}
                          </td>
                          <td className="py-2.5 px-3 text-right text-stone-500 tabular-nums">
                            {formatINR(item.mrp)}
                          </td>
                          <td className="py-2.5 px-3">
                            {item.imageUrl ? (
                              <span className="text-emerald-700 font-medium">Ready</span>
                            ) : (
                              <label className="inline-flex cursor-pointer items-center gap-1 text-amber-700 underline font-medium">
                                <span>Missing — Upload Photo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) handleManualRowImageUpload(item.sku, f);
                                  }}
                                  className="hidden"
                                />
                              </label>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
