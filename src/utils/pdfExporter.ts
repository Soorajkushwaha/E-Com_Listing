import { jsPDF } from 'jspdf';
import type { BulkOrder } from '../types/catalog';

/**
 * Generates a formal B2B Quotation PDF for a BulkOrder.
 */
export function exportQuotationToPdf(order: BulkOrder): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, 38, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('times', 'bold');
  doc.setFontSize(18);
  doc.text('OFFICIAL B2B BULK ORDER QUOTATION', 15, 18);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`Order Ref: ${order.orderRef}   |   Status: ${order.status}`, 15, 27);
  doc.text(`Date: ${order.quotationDate || order.createdAt.slice(0, 10)}`, pageWidth - 15, 27, {
    align: 'right',
  });

  doc.setTextColor(24, 24, 27);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Prepared For:', 15, 50);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.text(`${order.customerName} (${order.companyName || 'Individual Buyer'})`, 15, 56);
  doc.text(`${order.address}, ${order.city}, ${order.state} - ${order.pinCode}`, 15, 62);
  doc.text(`Mobile / WhatsApp: ${order.whatsapp || order.mobile}   |   GSTIN: ${order.gstNumber || 'N/A'}`, 15, 68);

  let y = 82;
  doc.setFillColor(241, 245, 249);
  doc.rect(14, y, pageWidth - 28, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('SKU & Product Name', 17, y + 6);
  doc.text('Qty', 125, y + 6);
  doc.text('Unit Price', 148, y + 6);
  doc.text('Line Total', pageWidth - 17, y + 6, { align: 'right' });

  y += 14;
  doc.setFont('helvetica', 'normal');
  order.items.forEach((item) => {
    const unit = item.negotiatedUnitPrice ?? item.unitPrice;
    const lineTotal = unit * item.requestedQuantity;
    doc.text(`${item.sku} - ${item.productName.slice(0, 42)}`, 17, y);
    doc.text(String(item.requestedQuantity), 125, y);
    doc.text(`INR ${unit.toLocaleString('en-IN')}`, 148, y);
    doc.text(`INR ${lineTotal.toLocaleString('en-IN')}`, pageWidth - 17, y, { align: 'right' });
    y += 8;
  });

  y += 6;
  doc.line(14, y, pageWidth - 14, y);
  y += 8;
  doc.text(`Estimated Catalog Subtotal: INR ${order.estimatedAmount.toLocaleString('en-IN')}`, pageWidth - 17, y, {
    align: 'right',
  });
  y += 6;
  doc.text(
    `Negotiated B2B Discount (${order.discountPercent}%): -INR ${order.discountAmount.toLocaleString('en-IN')}`,
    pageWidth - 17,
    y,
    { align: 'right' }
  );
  y += 6;
  doc.text(`GST (${order.taxPercent}%): +INR ${order.taxAmount.toLocaleString('en-IN')}`, pageWidth - 17, y, {
    align: 'right',
  });
  y += 6;
  doc.text(`Freight & Packaging: +INR ${order.shippingAmount.toLocaleString('en-IN')}`, pageWidth - 17, y, {
    align: 'right',
  });
  y += 8;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(`Final Quoted Total: INR ${order.finalAmount.toLocaleString('en-IN')}`, pageWidth - 17, y, {
    align: 'right',
  });

  doc.save(`Quotation-${order.orderRef}.pdf`);
}
