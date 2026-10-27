import React, { useState } from 'react';
import type { Product } from '../types/catalog';
import { createStudioProductSvgDataUri } from '../utils/seedData';

interface ProductVisualProps {
  product: Pick<Product, 'name' | 'category' | 'brand' | 'imageUrl'>;
  className?: string;
}

export const ProductVisual: React.FC<ProductVisualProps> = ({ product, className = '' }) => {
  const [failed, setFailed] = useState(false);

  const fallbackDataUri = createStudioProductSvgDataUri({
    title: product.name.slice(0, 28),
    subtitle: `${product.brand} · ${product.category}`.slice(0, 36),
    bgStart: '#1C1917',
    bgEnd: '#292524',
    accent: '#F59E0B',
    motif: product.category.toLowerCase().includes('hamper')
      ? 'hamper'
      : product.category.toLowerCase().includes('silk') || product.category.toLowerCase().includes('textile')
      ? 'silk'
      : product.category.toLowerCase().includes('wellness')
      ? 'copper'
      : 'urli',
  });

  const srcToUse = !failed && product.imageUrl ? product.imageUrl : fallbackDataUri;

  return (
    <div className={`relative overflow-hidden bg-stone-900 ${className}`}>
      <img
        src={srcToUse}
        alt={product.name}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
      />
    </div>
  );
};
