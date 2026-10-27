import type { BulkOrder, Campaign, CatalogTheme, Product } from '../types/catalog.ts';

/**
 * Generates a high-craft studio SVG product illustration encoded as a data URI.
 */
export function createStudioProductSvgDataUri(options: {
  title: string;
  subtitle: string;
  bgStart: string;
  bgEnd: string;
  accent: string;
  motif: 'urli' | 'hamper' | 'silk' | 'copper' | 'silver' | 'incense';
}): string {
  const { title, subtitle, bgStart, bgEnd, accent, motif } = options;

  let illustration = '';
  switch (motif) {
    case 'urli':
      illustration = `
        <ellipse cx="400" cy="360" rx="180" ry="26" fill="#000000" opacity="0.22"/>
        <path d="M220 270 C220 355, 580 355, 580 270 Z" fill="url(#brassGrad)" stroke="${accent}" stroke-width="3"/>
        <ellipse cx="400" cy="270" rx="180" ry="38" fill="#451A03" stroke="${accent}" stroke-width="4"/>
        <ellipse cx="400" cy="272" rx="164" ry="28" fill="#78350F" opacity="0.85"/>
        <circle cx="340" cy="268" r="14" fill="#F59E0B"/>
        <circle cx="400" cy="278" r="16" fill="#EA580C"/>
        <circle cx="460" cy="266" r="14" fill="#F59E0B"/>
        <path d="M398 232 Q408 248 400 262 Q392 248 398 232 Z" fill="#FDE68A"/>
      `;
      break;
    case 'hamper':
      illustration = `
        <ellipse cx="400" cy="375" rx="190" ry="22" fill="#000000" opacity="0.24"/>
        <rect x="235" y="195" width="330" height="165" rx="14" fill="#450A0A" stroke="${accent}" stroke-width="3"/>
        <rect x="255" y="155" width="95" height="110" rx="10" fill="#D97706" stroke="#FDE68A" stroke-width="2"/>
        <rect x="362" y="140" width="90" height="125" rx="10" fill="#1E293B" stroke="${accent}" stroke-width="2"/>
        <rect x="462" y="165" width="82" height="100" rx="10" fill="#B45309" stroke="#FDE68A" stroke-width="2"/>
        <rect x="235" y="255" width="330" height="24" fill="${accent}" opacity="0.9"/>
      `;
      break;
    case 'silk':
      illustration = `
        <ellipse cx="400" cy="375" rx="175" ry="20" fill="#000000" opacity="0.2"/>
        <path d="M240 160 L530 140 L560 330 L270 350 Z" fill="#881337" stroke="${accent}" stroke-width="3"/>
        <path d="M265 180 L540 162 L552 308 L278 326 Z" fill="#9F1239" stroke="#FDE68A" stroke-width="2" stroke-dasharray="8 6"/>
        <circle cx="350" cy="235" r="18" fill="none" stroke="${accent}" stroke-width="3"/>
        <circle cx="445" cy="228" r="18" fill="none" stroke="${accent}" stroke-width="3"/>
        <rect x="260" y="295" width="285" height="24" fill="${accent}" opacity="0.85"/>
      `;
      break;
    case 'copper':
      illustration = `
        <ellipse cx="400" cy="375" rx="165" ry="20" fill="#000000" opacity="0.22"/>
        <rect x="355" y="115" width="76" height="245" rx="28" fill="url(#brassGrad)" stroke="${accent}" stroke-width="3"/>
        <rect x="372" y="88" width="42" height="32" rx="6" fill="#7C2D12" stroke="${accent}" stroke-width="2"/>
        <rect x="268" y="235" width="64" height="125" rx="14" fill="url(#brassGrad)" stroke="${accent}" stroke-width="2.5"/>
        <rect x="454" y="235" width="64" height="125" rx="14" fill="url(#brassGrad)" stroke="${accent}" stroke-width="2.5"/>
      `;
      break;
    case 'silver':
      illustration = `
        <ellipse cx="400" cy="370" rx="185" ry="22" fill="#000000" opacity="0.2"/>
        <rect x="235" y="185" width="330" height="165" rx="16" fill="#334155" stroke="#E2E8F0" stroke-width="3"/>
        <rect x="255" y="205" width="138" height="60" rx="8" fill="#475569" stroke="#CBD5E1" stroke-width="2"/>
        <rect x="407" y="205" width="138" height="60" rx="8" fill="#475569" stroke="#CBD5E1" stroke-width="2"/>
        <rect x="255" y="275" width="138" height="58" rx="8" fill="#475569" stroke="#CBD5E1" stroke-width="2"/>
        <rect x="407" y="275" width="138" height="58" rx="8" fill="#475569" stroke="#CBD5E1" stroke-width="2"/>
      `;
      break;
    case 'incense':
      illustration = `
        <ellipse cx="400" cy="370" rx="170" ry="20" fill="#000000" opacity="0.2"/>
        <rect x="260" y="215" width="280" height="135" rx="14" fill="#292524" stroke="${accent}" stroke-width="3"/>
        <circle cx="400" cy="282" r="38" fill="none" stroke="${accent}" stroke-width="2.5"/>
        <path d="M398 120 C380 155, 420 175, 400 205" fill="none" stroke="#FDE68A" stroke-width="3" opacity="0.7"/>
        <path d="M418 135 C402 165, 432 182, 412 208" fill="none" stroke="${accent}" stroke-width="2" opacity="0.5"/>
      `;
      break;
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${bgStart}"/>
        <stop offset="100%" stop-color="${bgEnd}"/>
      </linearGradient>
      <linearGradient id="brassGrad" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#92400E"/>
        <stop offset="50%" stop-color="#F59E0B"/>
        <stop offset="100%" stop-color="#78350F"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bgGrad)"/>
    <circle cx="400" cy="260" r="210" fill="${accent}" opacity="0.08"/>
    ${illustration}
    <text x="400" y="475" text-anchor="middle" fill="#FAFAF9" font-family="Georgia, serif" font-size="28" font-weight="600">${title.replace(/&/g, '&amp;')}</text>
    <text x="400" y="512" text-anchor="middle" fill="${accent}" font-family="sans-serif" font-size="15" letter-spacing="2">${subtitle.toUpperCase().replace(/&/g, '&amp;')}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const INITIAL_THEMES: CatalogTheme[] = [
  {
    id: 'theme-diwali-gold',
    name: 'Diwali Gold',
    primaryColor: '#F59E0B',
    secondaryColor: '#D97706',
    backgroundColor: '#141210',
    surfaceColor: '#1F1C18',
    textColor: '#FAFAF9',
    accentColor: '#FBBF24',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Plus Jakarta Sans',
    cardLayout: 'editorial',
    borderRadius: 'md',
    buttonStyle: 'solid',
    isPublic: true,
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'theme-minimal-white',
    name: 'Minimal White',
    primaryColor: '#18181B',
    secondaryColor: '#52525B',
    backgroundColor: '#FAFAF9',
    surfaceColor: '#FFFFFF',
    textColor: '#18181B',
    accentColor: '#B45309',
    headingFont: 'Outfit',
    bodyFont: 'Plus Jakarta Sans',
    cardLayout: 'bordered',
    borderRadius: 'sm',
    buttonStyle: 'solid',
    isPublic: true,
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'theme-luxury-black',
    name: 'Luxury Black',
    primaryColor: '#E4E4E7',
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
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'theme-festive-red',
    name: 'Festive Red',
    primaryColor: '#FDE68A',
    secondaryColor: '#FCA5A5',
    backgroundColor: '#3B0712',
    surfaceColor: '#540B1C',
    textColor: '#FFFBEB',
    accentColor: '#F59E0B',
    headingFont: 'Cormorant Garamond',
    bodyFont: 'Plus Jakarta Sans',
    cardLayout: 'elevated',
    borderRadius: 'lg',
    buttonStyle: 'solid',
    isPublic: true,
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'theme-corporate-blue',
    name: 'Corporate Blue',
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
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'theme-modern-ecommerce',
    name: 'Modern E-commerce',
    primaryColor: '#1C1917',
    secondaryColor: '#57534E',
    backgroundColor: '#F5F5F4',
    surfaceColor: '#FFFFFF',
    textColor: '#1C1917',
    accentColor: '#D97706',
    headingFont: 'Outfit',
    bodyFont: 'Plus Jakarta Sans',
    cardLayout: 'elevated',
    borderRadius: 'lg',
    buttonStyle: 'solid',
    isPublic: true,
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
];

export const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: 'camp-diwali-2026',
    slug: 'diwali-2026',
    name: 'Diwali Sovereign Gifting 2026',
    description:
      'Handcrafted Moradabad brassware, royal dry-fruit velvet trunks, and custom-engraved festive hampers for enterprise & family gifting.',
    bannerTitle: 'The 2026 Diwali & Festive Bulk Collection',
    bannerSubtitle:
      'Custom corporate branding, pan-India multi-address dispatch, and dedicated GST billing for bulk orders of 25+ units.',
    bannerImageUrl: createStudioProductSvgDataUri({
      title: 'Diwali Sovereign Gifting 2026',
      subtitle: 'Moradabad Brassware & Royal Velvet Hampers',
      bgStart: '#1C1917',
      bgEnd: '#451A03',
      accent: '#F59E0B',
      motif: 'urli',
    }),
    promotionalHeadline: 'FLAT 12% B2B TIER DISCOUNT + COMPLIMENTARY LOGO BRASS PLATE ON 50+ UNITS',
    accentColor: '#F59E0B',
    startDate: '2026-10-01',
    endDate: '2026-11-20',
    themeId: 'theme-diwali-gold',
    productIds: ['prod-brass-urli-01', 'prod-royal-hamper-02', 'prod-silver-box-05', 'prod-incense-coffret-06'],
    status: 'active',
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'camp-corporate-gifting',
    slug: 'corporate-gifting',
    name: 'Executive Corporate Gifting Suite',
    description:
      'Curated onboarding kits, client appreciation hampers, and annual summit mementos with bespoke logo embossing.',
    bannerTitle: 'Executive Gifting & Client Appreciation',
    bannerSubtitle:
      'Tailored B2B pricing tiers with complimentary brass nameplate customization on orders above 50 units.',
    bannerImageUrl: createStudioProductSvgDataUri({
      title: 'Executive Corporate Gifting',
      subtitle: 'Custom Logo Embossing · Pan-India Dispatch',
      bgStart: '#0F172A',
      bgEnd: '#1E293B',
      accent: '#38BDF8',
      motif: 'copper',
    }),
    promotionalHeadline: 'DIRECT FACTORY WHOLESALE RATES · 100% GST INPUT CREDIT INVOICING',
    accentColor: '#0284C7',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    themeId: 'theme-corporate-blue',
    productIds: ['prod-royal-hamper-02', 'prod-copper-carafe-04', 'prod-incense-coffret-06'],
    status: 'active',
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'camp-wedding-season',
    slug: 'wedding-season',
    name: 'Royal Wedding Trousseau & Return Gifts',
    description:
      'Heirloom silver-plated boxes, Banarasi silk stoles, and artisanal brass urlis crafted for luxury wedding hospitality.',
    bannerTitle: 'Royal Wedding Return Gifts & Hospitality Hampers',
    bannerSubtitle:
      'Bespoke monogrammed packaging and scheduled venue delivery across India.',
    bannerImageUrl: createStudioProductSvgDataUri({
      title: 'Royal Wedding Trousseau Suite',
      subtitle: 'Nakashi Silver Chests & Banarasi Katan Silk',
      bgStart: '#3B0712',
      bgEnd: '#1C1917',
      accent: '#FBBF24',
      motif: 'silk',
    }),
    promotionalHeadline: 'BESPOKE COUPLE MONOGRAMMING & LUXURY POTLI WRAPPING INCLUDED',
    accentColor: '#E11D48',
    startDate: '2026-10-15',
    endDate: '2027-02-28',
    themeId: 'theme-festive-red',
    productIds: ['prod-silk-stole-03', 'prod-silver-box-05', 'prod-brass-urli-01'],
    status: 'active',
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'camp-wholesale-lighting',
    slug: 'wholesale-lighting',
    name: 'Wholesale Brass Lighting & Temple Decor',
    description:
      'Heavy-gauge Moradabad brass urlis, temple diyas, and ceremonial dhoop burners at direct foundry bulk pricing for retailers, hotels, and event planners.',
    bannerTitle: 'Direct Foundry Wholesale Brass & Lighting Deals',
    bannerSubtitle:
      'Up to 30% margin advantage for hospitality procurement, interior designers, and bulk festive buyers.',
    bannerImageUrl: createStudioProductSvgDataUri({
      title: 'Wholesale Brass & Temple Decor',
      subtitle: 'Direct Moradabad Foundry Bulk Pricing',
      bgStart: '#18181B',
      bgEnd: '#3F2305',
      accent: '#F59E0B',
      motif: 'incense',
    }),
    promotionalHeadline: 'MOQ 20 UNITS · DIRECT MORADABAD FOUNDRY DISPATCH',
    accentColor: '#D97706',
    startDate: '2026-09-01',
    endDate: '2027-03-31',
    themeId: 'theme-luxury-black',
    productIds: ['prod-brass-urli-01', 'prod-incense-coffret-06', 'prod-copper-carafe-04'],
    status: 'active',
    ownerId: 'system-admin',
    createdAt: '2026-10-01T09:00:00.000Z',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-brass-urli-01',
    sku: 'KH-URLI-101',
    name: 'Moradabad Hammered Brass Lotus Urli (14 Inch)',
    heading: '14" Hand-Hammered Pure Brass Lotus Urli Bowl',
    subtitle: 'Kansa Heritage · Festive Decor',
    description:
      'Hand-forged by master artisans in Moradabad using heavy-gauge virgin brass. Features a burnished golden finish ideal for floating diyas and marigold arrangements in corporate lobbies and festive hampers.',
    category: 'Festive Decor',
    brand: 'Kansa Heritage',
    imageUrl: createStudioProductSvgDataUri({
      title: 'Hammered Brass Lotus Urli',
      subtitle: '14 Inch Heavy-Gauge Artisan Brass',
      bgStart: '#1C1917',
      bgEnd: '#292524',
      accent: '#F59E0B',
      motif: 'urli',
    }),
    sellingPrice: 2450,
    mrp: 3499,
    badge: 'Diwali Bestseller',
    campaign: 'diwali-2026',
    campaigns: ['diwali-2026', 'wedding-season', 'wholesale-lighting'],
    status: 'active',
    stockStatus: 'in_stock',
    rating: 4.9,
    ratingCount: 318,
    amazonUrl: 'https://www.amazon.in/dp/B09KANS101',
    flipkartUrl: 'https://www.flipkart.com/kansa-heritage-brass-urli/p/itm101',
    meeshoUrl: 'https://www.meesho.com/brass-urli-14inch/p/ms101',
    websiteUrl: 'https://kansaheritage.in/products/hammered-brass-lotus-urli',
    featured: true,
    sortOrder: 1,
    ownerId: 'system-admin',
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
  },
  {
    id: 'prod-royal-hamper-02',
    sku: 'AL-HAMP-204',
    name: 'Sovereign Velvet Gourmet & Saffron Trunk',
    heading: 'Sovereign Velvet Gourmet Gift Trunk (6-Piece Suite)',
    subtitle: 'Ananda Luxe · Gourmet Hampers',
    description:
      'Presented in a reusable crimson velvet keepsake trunk with brass latches. Includes Pampore Mongra saffron (2g), Kashmiri Mamra almonds (250g), pistachio brittle, single-origin Nilgiri oolong tea in a brass caddy, and two hand-poured soy wax diyas.',
    category: 'Gourmet Hampers',
    brand: 'Ananda Luxe',
    imageUrl: createStudioProductSvgDataUri({
      title: 'Sovereign Velvet Gourmet Trunk',
      subtitle: 'Saffron · Mamra Almonds · Brass Tea Caddy',
      bgStart: '#2A0A10',
      bgEnd: '#1C1917',
      accent: '#FBBF24',
      motif: 'hamper',
    }),
    sellingPrice: 3890,
    mrp: 4999,
    badge: 'Corporate Favorite',
    campaign: 'diwali-2026',
    campaigns: ['diwali-2026', 'corporate-gifting'],
    status: 'active',
    stockStatus: 'in_stock',
    rating: 4.9,
    ratingCount: 412,
    amazonUrl: 'https://www.amazon.in/dp/B09ANAND204',
    flipkartUrl: 'https://www.flipkart.com/ananda-luxe-sovereign-trunk/p/itm204',
    meeshoUrl: '',
    websiteUrl: 'https://anandaluxe.in/products/sovereign-velvet-trunk',
    featured: true,
    sortOrder: 2,
    ownerId: 'system-admin',
    createdAt: '2026-10-02T10:00:00.000Z',
    updatedAt: '2026-10-02T10:00:00.000Z',
  },
  {
    id: 'prod-silk-stole-03',
    sku: 'VK-SILK-309',
    name: 'Varanasi Katan Pure Silk Zari Ceremonial Stole',
    heading: 'Handloom Banarasi Katan Silk Stole with Gold Zari',
    subtitle: 'Varanasi Karigar · Heritage Textiles',
    description:
      'Woven on traditional pit looms in Varanasi using 100% pure mulberry katan silk and Certified Silk Mark floral jaal zari borders. Delivered in a cedarwood-lined gift box for VIP guests and wedding dignitaries.',
    category: 'Heritage Textiles',
    brand: 'Varanasi Karigar',
    imageUrl: createStudioProductSvgDataUri({
      title: 'Banarasi Katan Silk Zari Stole',
      subtitle: ' Handloom Pure Mulberry Silk · GI Tagged',
      bgStart: '#310B19',
      bgEnd: '#18181B',
      accent: '#F59E0B',
      motif: 'silk',
    }),
    sellingPrice: 2950,
    mrp: 4200,
    badge: 'Silk Mark Certified',
    campaign: 'wedding-season',
    campaigns: ['wedding-season', 'diwali-2026'],
    status: 'active',
    stockStatus: 'in_stock',
    rating: 4.8,
    ratingCount: 189,
    amazonUrl: 'https://www.amazon.in/dp/B09SILK309',
    flipkartUrl: 'https://www.flipkart.com/varanasi-katan-silk-stole/p/itm309',
    meeshoUrl: '',
    websiteUrl: 'https://varanasikarigar.in/products/katan-zari-stole',
    featured: true,
    sortOrder: 3,
    ownerId: 'system-admin',
    createdAt: '2026-10-03T10:00:00.000Z',
    updatedAt: '2026-10-03T10:00:00.000Z',
  },
  {
    id: 'prod-copper-carafe-04',
    sku: 'KH-COPP-412',
    name: 'Ayurvedic Hammered Pure Copper Bedside Carafe Set',
    heading: '99.9% Pure Hammered Copper Carafe & 2 Tumblers',
    subtitle: 'Kansa Heritage · Executive Wellness',
    description:
      'Lab-certified 99.9% pure food-grade copper water carafe (1100ml) paired with two ergonomic hammered tumblers. Packaged in a rigid matte-black magnetic gift box suitable for corporate wellness and client onboarding.',
    category: 'Executive Wellness',
    brand: 'Kansa Heritage',
    imageUrl: createStudioProductSvgDataUri({
      title: 'Hammered Copper Carafe Set',
      subtitle: '1100ml Carafe + 2 Tumblers · Gift Boxed',
      bgStart: '#1E1B18',
      bgEnd: '#27272A',
      accent: '#EA580C',
      motif: 'copper',
    }),
    sellingPrice: 1690,
    mrp: 2299,
    badge: 'Bulk Custom Logo',
    campaign: 'corporate-gifting',
    campaigns: ['corporate-gifting', 'wholesale-lighting'],
    status: 'active',
    stockStatus: 'in_stock',
    rating: 4.7,
    ratingCount: 274,
    amazonUrl: 'https://www.amazon.in/dp/B09COPP412',
    flipkartUrl: 'https://www.flipkart.com/kansa-copper-carafe-set/p/itm412',
    meeshoUrl: 'https://www.meesho.com/copper-carafe-gift-set/p/ms412',
    websiteUrl: 'https://kansaheritage.in/products/copper-bedside-carafe',
    featured: false,
    sortOrder: 4,
    ownerId: 'system-admin',
    createdAt: '2026-10-04T10:00:00.000Z',
    updatedAt: '2026-10-04T10:00:00.000Z',
  },
  {
    id: 'prod-silver-box-05',
    sku: 'RJ-SILV-518',
    name: 'Jaipur Nakashi Silver-Plated 4-Jar Dry Fruit Box',
    heading: 'Hand-Embossed Silver-Plated Brass Dry Fruit Chest',
    subtitle: 'Rajputana Silver · Wedding & Festive',
    description:
      'Intricate Rajasthani floral repoussé metalwork over solid brass with micron-grade pure silver electroplating and tarnish-resistant lacquer. Houses four removable glass & silver-lid jars.',
    category: 'Festive Decor',
    brand: 'Rajputana Silver',
    imageUrl: createStudioProductSvgDataUri({
      title: 'Jaipur Nakashi Silver Chest',
      subtitle: '4-Compartment Heirloom Dry Fruit Box',
      bgStart: '#0F172A',
      bgEnd: '#1E293B',
      accent: '#E2E8F0',
      motif: 'silver',
    }),
    sellingPrice: 4450,
    mrp: 5800,
    badge: 'Limited Edition',
    campaign: 'wedding-season',
    campaigns: ['wedding-season', 'diwali-2026'],
    status: 'active',
    stockStatus: 'low_stock',
    rating: 4.9,
    ratingCount: 156,
    amazonUrl: 'https://www.amazon.in/dp/B09SILV518',
    flipkartUrl: 'https://www.flipkart.com/rajputana-silver-box/p/itm518',
    meeshoUrl: '',
    websiteUrl: 'https://rajputanasilver.in/products/nakashi-dry-fruit-box',
    featured: true,
    sortOrder: 5,
    ownerId: 'system-admin',
    createdAt: '2026-10-05T10:00:00.000Z',
    updatedAt: '2026-10-05T10:00:00.000Z',
  },
  {
    id: 'prod-incense-coffret-06',
    sku: 'AL-AROM-605',
    name: 'Mysore Sandalwood & Brass Dhoop Coffret',
    heading: 'Artisanal Mysore Sandalwood Cones & Brass Burner Suite',
    subtitle: 'Ananda Luxe · Executive Wellness',
    description:
      'Hand-rolled temple-flower and Mysore sandalwood dhoop cones (60 pcs) accompanied by a solid brass geometric incense holder and rosewater linen mist (100ml).',
    category: 'Executive Wellness',
    brand: 'Ananda Luxe',
    imageUrl: createStudioProductSvgDataUri({
      title: 'Mysore Sandalwood Coffret',
      subtitle: 'Brass Dhoop Burner & Temple Botanicals',
      bgStart: '#1C1917',
      bgEnd: '#27272A',
      accent: '#D97706',
      motif: 'incense',
    }),
    sellingPrice: 1290,
    mrp: 1750,
    badge: 'Eco-Luxury',
    campaign: 'corporate-gifting',
    campaigns: ['corporate-gifting', 'diwali-2026', 'wholesale-lighting'],
    status: 'active',
    stockStatus: 'in_stock',
    rating: 4.8,
    ratingCount: 220,
    amazonUrl: 'https://www.amazon.in/dp/B09AROM605',
    flipkartUrl: 'https://www.flipkart.com/ananda-sandalwood-coffret/p/itm605',
    meeshoUrl: 'https://www.meesho.com/sandalwood-gift-coffret/p/ms605',
    websiteUrl: 'https://anandaluxe.in/products/mysore-sandalwood-coffret',
    featured: false,
    sortOrder: 6,
    ownerId: 'system-admin',
    createdAt: '2026-10-06T10:00:00.000Z',
    updatedAt: '2026-10-06T10:00:00.000Z',
  },
];

export const INITIAL_BULK_ORDERS: BulkOrder[] = [
  {
    id: 'ord-2026-801',
    orderRef: 'ORD-2026-801',
    ownerId: 'system-admin',
    customerName: 'Vikramaditya Singhania',
    companyName: 'Singhania Infra & Capital Ltd.',
    mobile: '9820112233',
    whatsapp: '9820112233',
    email: 'v.singhania@singhaniacap.in',
    address: 'Floor 18, One BKC, Bandra Kurla Complex',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400051',
    gstNumber: '27AAACS8812F1Z9',
    campaignSlug: 'diwali-2026',
    expectedDeliveryDate: '2026-11-04',
    preferredContact: 'whatsapp',
    requirements: 'Need gold-foiled company crest sleeves on all 120 velvet trunks.',
    items: [
      {
        productId: 'prod-royal-hamper-02',
        sku: 'AL-HAMP-204',
        productName: 'Sovereign Velvet Gourmet & Saffron Trunk',
        unitPrice: 3890,
        mrp: 4999,
        requestedQuantity: 120,
        negotiatedUnitPrice: 3650,
      },
      {
        productId: 'prod-brass-urli-01',
        sku: 'KH-URLI-101',
        productName: 'Moradabad Hammered Brass Lotus Urli (14 Inch)',
        unitPrice: 2450,
        mrp: 3499,
        requestedQuantity: 40,
        negotiatedUnitPrice: 2250,
      },
    ],
    itemsSummary: 'Sovereign Velvet Gourmet & Saffron Trunk (120), Moradabad Hammered Brass Lotus Urli (40)',
    totalQuantity: 160,
    estimatedAmount: 564800,
    discountPercent: 8,
    discountAmount: 45184,
    taxPercent: 18,
    taxAmount: 93531,
    shippingAmount: 4500,
    finalAmount: 617647,
    quotationDate: '2026-10-20',
    quotationValidUntil: '2026-10-30',
    status: 'Paid',
    paymentStatus: 'paid',
    paymentLink: 'https://pay.catalogmaker.pro/inv/ORD-2026-801',
    transactionRef: 'UTR629801449210',
    courierName: 'BlueDart Surface Cargo',
    trackingNumber: 'BD781200491',
    internalNotes: 'NEFT payment verified by finance team. Custom sleeves in print.',
    timeline: [
      {
        id: 'tl-1',
        timestamp: '2026-10-19T11:20:00.000Z',
        actor: 'Customer Portal',
        action: 'Bulk order inquiry submitted (160 units)',
      },
      {
        id: 'tl-2',
        timestamp: '2026-10-20T14:05:00.000Z',
        actor: 'Admin (simple.sooraj@gmail.com)',
        action: 'Quotation prepared for ₹6,17,647 (8% B2B discount + 18% GST)',
      },
      {
        id: 'tl-3',
        timestamp: '2026-10-21T10:15:00.000Z',
        actor: 'Admin (simple.sooraj@gmail.com)',
        action: 'Order Confirmed & payment link shared via WhatsApp',
      },
      {
        id: 'tl-4',
        timestamp: '2026-10-22T16:40:00.000Z',
        actor: 'Admin (simple.sooraj@gmail.com)',
        action: 'Payment verified (UTR629801449210) — Marked as Paid',
      },
    ],
    createdAt: '2026-10-19T11:20:00.000Z',
    updatedAt: '2026-10-22T16:40:00.000Z',
  },
  {
    id: 'ord-2026-802',
    orderRef: 'ORD-2026-802',
    ownerId: 'system-admin',
    customerName: 'Nandini Deshmukh',
    companyName: 'Aurelia Tech Solutions Pvt. Ltd.',
    mobile: '9845099887',
    whatsapp: '9845099887',
    email: 'nandini.d@aureliatech.io',
    address: 'Plot 44, RMZ Ecoworld, Outer Ring Road, Bellandur',
    city: 'Bengaluru',
    state: 'Karnataka',
    pinCode: '560103',
    gstNumber: '29AABCA7721K1Z2',
    campaignSlug: 'corporate-gifting',
    expectedDeliveryDate: '2026-11-08',
    preferredContact: 'whatsapp',
    requirements: 'Laser-engraved Aurelia monogram on copper carafes and custom welcome card.',
    items: [
      {
        productId: 'prod-copper-carafe-04',
        sku: 'KH-COPP-412',
        productName: 'Ayurvedic Hammered Pure Copper Bedside Carafe Set',
        unitPrice: 1690,
        mrp: 2299,
        requestedQuantity: 250,
      },
    ],
    itemsSummary: 'Ayurvedic Hammered Pure Copper Bedside Carafe Set (250)',
    totalQuantity: 250,
    estimatedAmount: 422500,
    discountPercent: 10,
    discountAmount: 42250,
    taxPercent: 18,
    taxAmount: 68445,
    shippingAmount: 3500,
    finalAmount: 452195,
    quotationDate: '2026-10-23',
    quotationValidUntil: '2026-11-02',
    status: 'Order Confirmed',
    paymentStatus: 'link_sent',
    paymentLink: 'https://pay.catalogmaker.pro/inv/ORD-2026-802',
    transactionRef: '',
    courierName: '',
    trackingNumber: '',
    internalNotes: 'PO received from Aurelia procurement. Awaiting RTGS transfer.',
    timeline: [
      {
        id: 'tl-21',
        timestamp: '2026-10-22T09:30:00.000Z',
        actor: 'Customer Portal',
        action: 'Bulk order inquiry submitted (250 units)',
      },
      {
        id: 'tl-22',
        timestamp: '2026-10-23T15:10:00.000Z',
        actor: 'Admin (simple.sooraj@gmail.com)',
        action: 'Customer approved quote of ₹4,52,195 — Marked as Order Confirmed',
      },
    ],
    createdAt: '2026-10-22T09:30:00.000Z',
    updatedAt: '2026-10-23T15:10:00.000Z',
  },
  {
    id: 'ord-2026-803',
    orderRef: 'ORD-2026-803',
    ownerId: 'system-admin',
    customerName: 'Rajeshwari Jindal',
    companyName: 'Jindal Heritage Hospitality',
    mobile: '9811223344',
    whatsapp: '9811223344',
    email: 'events@jindalhospitality.com',
    address: '7 Sardar Patel Marg, Diplomatic Enclave',
    city: 'New Delhi',
    state: 'Delhi',
    pinCode: '110021',
    gstNumber: '07AAACJ4410L1Z8',
    campaignSlug: 'wedding-season',
    expectedDeliveryDate: '2026-11-18',
    preferredContact: 'whatsapp',
    requirements: 'Require ivory & gold silk potli wrapping for wedding suite check-in gifts.',
    items: [
      {
        productId: 'prod-silver-box-05',
        sku: 'RJ-SILV-518',
        productName: 'Jaipur Nakashi Silver-Plated 4-Jar Dry Fruit Box',
        unitPrice: 4450,
        mrp: 5800,
        requestedQuantity: 85,
      },
      {
        productId: 'prod-silk-stole-03',
        sku: 'VK-SILK-309',
        productName: 'Varanasi Katan Pure Silk Zari Ceremonial Stole',
        unitPrice: 2950,
        mrp: 4200,
        requestedQuantity: 85,
      },
    ],
    itemsSummary: 'Jaipur Nakashi Silver-Plated 4-Jar Dry Fruit Box (85), Varanasi Katan Pure Silk Zari Ceremonial Stole (85)',
    totalQuantity: 170,
    estimatedAmount: 629000,
    discountPercent: 7,
    discountAmount: 44030,
    taxPercent: 12,
    taxAmount: 70196,
    shippingAmount: 5000,
    finalAmount: 660166,
    quotationDate: '2026-10-24',
    quotationValidUntil: '2026-11-03',
    status: 'Quote Prepared',
    paymentStatus: 'unpaid',
    paymentLink: '',
    transactionRef: '',
    courierName: '',
    trackingNumber: '',
    internalNotes: 'Sent sample box images on WhatsApp. Quote shared for approval.',
    timeline: [
      {
        id: 'tl-31',
        timestamp: '2026-10-24T08:15:00.000Z',
        actor: 'Customer Portal',
        action: 'Bulk order inquiry submitted (170 units)',
      },
      {
        id: 'tl-32',
        timestamp: '2026-10-24T13:45:00.000Z',
        actor: 'Admin (simple.sooraj@gmail.com)',
        action: 'Quotation prepared for ₹6,60,166',
      },
    ],
    createdAt: '2026-10-24T08:15:00.000Z',
    updatedAt: '2026-10-24T13:45:00.000Z',
  },
  {
    id: 'ord-2026-804',
    orderRef: 'ORD-2026-804',
    ownerId: 'system-admin',
    customerName: 'Siddharth Malhotra',
    companyName: 'Veritas Legal Chambers LLP',
    mobile: '9833445566',
    whatsapp: '9833445566',
    email: 'admin@veritaschambers.in',
    address: '82 Bajaj Bhavan, Nariman Point',
    city: 'Mumbai',
    state: 'Maharashtra',
    pinCode: '400021',
    gstNumber: '27AAAFV9911M1Z1',
    campaignSlug: 'diwali-2026',
    expectedDeliveryDate: '2026-11-02',
    preferredContact: 'whatsapp',
    requirements: 'Include custom printed festive greeting card signed by Managing Partners.',
    items: [
      {
        productId: 'prod-incense-coffret-06',
        sku: 'AL-AROM-605',
        productName: 'Mysore Sandalwood & Brass Dhoop Coffret',
        unitPrice: 1290,
        mrp: 1750,
        requestedQuantity: 60,
      },
    ],
    itemsSummary: 'Mysore Sandalwood & Brass Dhoop Coffret (60)',
    totalQuantity: 60,
    estimatedAmount: 77400,
    discountPercent: 0,
    discountAmount: 0,
    taxPercent: 18,
    taxAmount: 13932,
    shippingAmount: 1200,
    finalAmount: 92532,
    quotationDate: '',
    quotationValidUntil: '',
    status: 'New Request',
    paymentStatus: 'unpaid',
    paymentLink: '',
    transactionRef: '',
    courierName: '',
    trackingNumber: '',
    internalNotes: 'Fresh inquiry from Diwali 2026 catalog.',
    timeline: [
      {
        id: 'tl-41',
        timestamp: '2026-10-25T00:05:00.000Z',
        actor: 'Customer Portal',
        action: 'Bulk order inquiry submitted (60 units)',
      },
    ],
    createdAt: '2026-10-25T00:05:00.000Z',
    updatedAt: '2026-10-25T00:05:00.000Z',
  },
];

export const SAMPLE_EXCEL_WORKBOOK_ROWS = [
  {
    SKU: 'KH-DIYA-701',
    'Product Name': 'Kumbakonam Cast Brass Peacock Standing Diya Pair',
    Title: '12" Artisanal Cast Brass Peacock Standing Diya (Pair)',
    Subtitle: 'Kansa Heritage · Temple Brassware',
    'Product Description':
      'Hand-cast in traditional sand molds with intricate Annapakshi peacock finials. Ideal for ceremonial lighting and festive corporate gifting.',
    Category: 'Festive Decor',
    Brand: 'Kansa Heritage',
    'Image URL': createStudioProductSvgDataUri({
      title: 'Cast Brass Peacock Diya Pair',
      subtitle: '12 Inch Traditional Temple Brassware',
      bgStart: '#1C1917',
      bgEnd: '#451A03',
      accent: '#FBBF24',
      motif: 'urli',
    }),
    'Selling Price': 2190,
    MRP: 2999,
    'Amazon URL': 'https://www.amazon.in/dp/B09PEACOCK701',
    'Flipkart URL': 'https://www.flipkart.com/kansa-peacock-diya/p/itm701',
    'Meesho URL': '',
    'Own Website URL': 'https://kansaheritage.in/products/peacock-diya-pair',
    Rating: 4.9,
    'Rating Count': 164,
    Badge: 'New Arrival',
    Campaign: 'diwali-2026',
    Stock: 'In Stock',
  },
  {
    SKU: 'AL-TEA-702',
    'Product Name': 'Himalayan First-Flush Tea & Brass Infuser Chest',
    Title: 'Darjeeling First-Flush & Kashmiri Kahwa Brass Chest',
    Subtitle: 'Ananda Luxe · Gourmet Hampers',
    'Product Description':
      'Sheesham wood and brass-inlaid tea chest containing three artisanal loose-leaf blends and a perforated pure brass tea infuser.',
    Category: 'Gourmet Hampers',
    Brand: 'Ananda Luxe',
    'Image URL': createStudioProductSvgDataUri({
      title: 'Himalayan Tea & Brass Chest',
      subtitle: 'Sheesham Wood & 3 Estate Blends',
      bgStart: '#14261C',
      bgEnd: '#1C1917',
      accent: '#F59E0B',
      motif: 'hamper',
    }),
    'Selling Price': 2650,
    MRP: 3450,
    'Amazon URL': 'https://www.amazon.in/dp/B09TEACHEST702',
    'Flipkart URL': 'https://www.flipkart.com/ananda-tea-chest/p/itm702',
    'Meesho URL': '',
    'Own Website URL': 'https://anandaluxe.in/products/himalayan-tea-chest',
    Rating: 4.8,
    'Rating Count': 98,
    Badge: 'Executive Choice',
    Campaign: 'corporate-gifting',
    Stock: 'In Stock',
  },
  {
    SKU: 'KH-URLI-101',
    'Product Name': 'Moradabad Hammered Brass Lotus Urli (14 Inch)',
    Title: '14" Hand-Hammered Pure Brass Lotus Urli Bowl',
    Subtitle: 'Kansa Heritage · Festive Decor',
    'Product Description':
      'Updated Festive Pricing: Hand-forged by master artisans in Moradabad using heavy-gauge virgin brass.',
    Category: 'Festive Decor',
    Brand: 'Kansa Heritage',
    'Image URL': INITIAL_PRODUCTS[0].imageUrl,
    'Selling Price': 2390,
    MRP: 3499,
    'Amazon URL': 'https://www.amazon.in/dp/B09KANS101',
    'Flipkart URL': 'https://www.flipkart.com/kansa-heritage-brass-urli/p/itm101',
    'Meesho URL': 'https://www.meesho.com/brass-urli-14inch/p/ms101',
    'Own Website URL': 'https://kansaheritage.in/products/hammered-brass-lotus-urli',
    Rating: 4.9,
    'Rating Count': 340,
    Badge: 'Diwali Bestseller',
    Campaign: 'diwali-2026',
    Stock: 'In Stock',
  },
];
