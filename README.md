# Catalog Maker Pro — Full-Stack Product Catalog & Bulk Order Platform

**Catalog Maker Pro** is a full-stack B2B product catalog builder, e-commerce storefront, Excel catalog importer, AI theme designer, and bulk order & quotation management platform built with React, TypeScript, Vite, Tailwind CSS, Firebase (Cloud Firestore, Authentication, Storage), and Cloudflare Workers.

---

## 1. Architecture & Feature Overview

- **Dual Public & Admin Modes Sharing One Database**:
  - **Public Shop & Campaign Catalogs (`/`, `/catalog/diwali-2026`, `/catalog/corporate-gifting`, `/product/:sku`)**: Responsive product grid & list views, category/campaign/price filters, Indian Rupee (`₹`) pricing, discount calculation, marketplace links (Amazon, Flipkart, Meesho, Brand Store), and multi-product **Buy in Bulk** inquiry workflow.
  - **Interactive Catalog Builder (`/builder`)**: Customize occasion banners, switch themes, edit product cards inline, and export standalone themed **HTML** and multi-page text-based **PDF** catalogs (`jsPDF` — fully compatible with browsers and Cloudflare without relying on `xhtml2pdf`).
  - **Protected Admin Dashboard (`/admin`)**:
    1. **Overview**: 13 real-time KPIs (Active Products, Catalog Views, Bulk Order Requests, Awaiting Quotation, Confirmed Orders, Paid Orders, Confirmed Value, Verified Amount Received) with date filters (`Today`, `Last 7 Days`, `Last 30 Days`, `All Time`).
    2. **Products**: Searchable catalog table with Add, Edit, Duplicate, and Delete actions.
    3. **Excel Import (`.xlsx` / `.xls`)**: SheetJS workbook parser, worksheet selector, interactive column mapper, duplicate SKU handling (`Update`, `Skip`, `Error`), local image filename warnings with manual image upload, and batch import.
    4. **Catalog Builder**: Live preview & HTML/PDF export.
    5. **Themes & AI Designer**: Server-side AI theme generation supporting **Gemini**, **OpenAI**, **DeepSeek**, **Grok/xAI**, and **Local Presets** with strict JSON schema validation, live preview, save, and rollback.
    6. **Bulk Orders & Quotations**: Complete 12-stage order lifecycle (`New Request` → `Contact Customer` → `Quote Prepared` → `Awaiting Customer Approval` → `Order Confirmed` → `Awaiting Payment` → `Paid` → `Processing` → `Dispatched` → `Delivered` / `Cancelled` / `Rejected`), negotiated pricing & GST calculator, payment link recording (strictly gated until `Order Confirmed`), Quotation PDF download, Excel export, and **Manual WhatsApp Communication Hub** with 5 prefilled URL-encoded templates.
    7. **Customers CRM**: Aggregated buyer records linked to order history and confirmed value.
    8. **Campaigns**: Seasonal campaign manager publishing dedicated `/catalog/:slug` pages.
    9. **Reports**: SKU demand and B2B ledger export.
    10. **Settings & Deploy**: Firebase & Cloudflare Workers configuration reference.

---

## 2. Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Copy environment variable template
cp .env.example .env

# 3. Run automated unit & security rule tests
npm test

# 4. Start the full-stack development server on http://localhost:3000
npm run dev
```

---

## 3. Firebase Setup Guide

1. **Firebase Project & Configuration**:
   - The app is wired to `firebase-applet-config.json` with Cloud Firestore, Firebase Authentication (Google Sign-In), and Firebase Storage.
2. **Security Rules**:
   - Firestore security rules are defined in `firestore.rules` (validated with `@firebase/eslint-plugin-security-rules`) and enforce zero-trust Attribute-Based Access Control (ABAC) and PII isolation on `/bulkOrders`.
   - Firebase Storage rules are defined in `storage.rules` (restricting product image writes under `/products/{fileName}` to verified administrators).

---

## 4. Deploying to Cloudflare Workers (24/7 Cloud Hosting)

This repository includes `wrangler.toml` and `worker.ts` configured for **Cloudflare Workers with Static Assets** so the application runs 24/7 on a public Cloudflare URL without requiring your PC to stay online.

### Step-by-Step Cloudflare Deployment

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit: Catalog Maker Pro"
   git branch -M main
   git remote add origin https://github.com/<your-username>/catalog-maker-pro.git
   git push -u origin main
   ```

2. **Build Static Frontend Assets**:
   ```bash
   npm run build
   ```

3. **Configure Server-Side AI Provider Secrets on Cloudflare**:
   ```bash
   npx wrangler login
   npx wrangler secret put GEMINI_API_KEY
   # Optional additional providers:
   npx wrangler secret put OPENAI_API_KEY
   npx wrangler secret put DEEPSEEK_API_KEY
   npx wrangler secret put XAI_API_KEY
   ```

4. **Deploy to Cloudflare Workers**:
   ```bash
   npx wrangler deploy
   ```

5. **Connect a Custom Domain**:
   - Open the **Cloudflare Dashboard** → **Workers & Pages** → select `catalog-maker-pro` → **Settings** → **Domains & Routes** → click **Add** → **Custom Domain** and enter your domain (e.g., `catalog.yourdomain.com`). Cloudflare automatically provisions an SSL/TLS certificate over HTTPS.
