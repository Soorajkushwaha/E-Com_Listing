import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rulesContent = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.resolve('firebase-blueprint.json'), 'utf8'));

/**
 * Deterministic rule-engine verifier that mirrors firestore.rules invariants
 * to test the "Dirty Dozen" adversarial payloads and structural synchronicity.
 */
function simulateFirestoreRuleCheck(params: {
  collection: 'admins' | 'products' | 'themes' | 'campaigns' | 'bulkOrders';
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  docId: string;
  auth: { uid: string; email: string; email_verified: boolean } | null;
  incoming?: Record<string, any>;
  existing?: Record<string, any>;
  requestTime: string;
}): boolean {
  const { collection, operation, docId, auth, incoming, existing, requestTime } = params;
  const isValidId = (id: string) =>
    typeof id === 'string' && id.length >= 1 && id.length <= 128 && /^[a-zA-Z0-9_-]+$/.test(id);
  const isSignedIn = auth !== null;
  const isVerifiedUser = isSignedIn && auth.email_verified === true;
  const isOwner = (uid: string) => isVerifiedUser && auth.uid === uid;
  const isAdmin = isVerifiedUser && auth.email === 'simple.sooraj@gmail.com';

  if (operation !== 'list' && !isValidId(docId)) return false;

  if (collection === 'admins') {
    if (operation === 'list' || operation === 'update') return false;
    if (operation === 'get') return isOwner(docId) || isAdmin;
    if (operation === 'create') {
      if (!isVerifiedUser || !isAdmin || !incoming) return false;
      const keys = Object.keys(incoming);
      const allowed = ['uid', 'email', 'createdAt'];
      return (
        allowed.every((k) => keys.includes(k)) &&
        keys.every((k) => allowed.includes(k)) &&
        incoming.uid === docId &&
        incoming.createdAt === requestTime
      );
    }
    return isVerifiedUser && isAdmin;
  }

  if (collection === 'products') {
    const reqKeys = [
      'sku', 'name', 'category', 'brand', 'sellingPrice', 'mrp',
      'status', 'stockStatus', 'ownerId', 'createdAt', 'updatedAt',
    ];
    const allowedKeys = [
      ...reqKeys,
      'heading', 'subtitle', 'description', 'imageUrl', 'badge', 'campaign',
      'rating', 'ratingCount', 'amazonUrl', 'flipkartUrl', 'meeshoUrl', 'websiteUrl',
      'featured', 'sortOrder',
    ];
    const isValidProduct = (d?: Record<string, any>) => {
      if (!d) return false;
      const keys = Object.keys(d);
      if (!reqKeys.every((k) => keys.includes(k))) return false;
      if (!keys.every((k) => allowedKeys.includes(k))) return false;
      if (typeof d.sku !== 'string' || d.sku.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(d.sku)) return false;
      if (typeof d.name !== 'string' || d.name.length < 1 || d.name.length > 200) return false;
      if (d.description && (typeof d.description !== 'string' || d.description.length > 2000)) return false;
      if (typeof d.sellingPrice !== 'number' || d.sellingPrice < 0) return false;
      if (typeof d.mrp !== 'number' || d.mrp < 0) return false;
      return true;
    };

    if (operation === 'get' || operation === 'list') {
      return existing?.status === 'active' || isAdmin;
    }
    if (operation === 'create') {
      return (
        isVerifiedUser &&
        isValidProduct(incoming) &&
        incoming!.ownerId === auth!.uid &&
        incoming!.createdAt === requestTime &&
        incoming!.updatedAt === requestTime &&
        isAdmin
      );
    }
    if (operation === 'update') {
      return (
        isVerifiedUser &&
        isValidProduct(incoming) &&
        incoming!.ownerId === existing?.ownerId &&
        incoming!.createdAt === existing?.createdAt &&
        incoming!.updatedAt === requestTime &&
        isAdmin
      );
    }
  }

  if (collection === 'bulkOrders') {
    const reqKeys = [
      'orderRef', 'ownerId', 'customerName', 'mobile', 'whatsapp',
      'address', 'city', 'state', 'pinCode', 'preferredContact',
      'itemsSummary', 'totalQuantity', 'estimatedAmount', 'finalAmount',
      'status', 'paymentStatus', 'createdAt', 'updatedAt',
    ];
    const allowedKeys = [
      ...reqKeys,
      'companyName', 'email', 'gstNumber', 'campaignSlug', 'expectedDeliveryDate',
      'requirements', 'paymentLink', 'transactionRef', 'courierName',
      'trackingNumber', 'internalNotes',
    ];
    const isValidOrder = (d?: Record<string, any>) => {
      if (!d) return false;
      const keys = Object.keys(d);
      if (!reqKeys.every((k) => keys.includes(k))) return false;
      if (!keys.every((k) => allowedKeys.includes(k))) return false;
      if (typeof d.totalQuantity !== 'number' || d.totalQuantity < 1) return false;
      return true;
    };

    if (operation === 'get' || operation === 'list') {
      return isVerifiedUser && (existing?.ownerId === auth!.uid || isAdmin);
    }
    if (operation === 'create') {
      return (
        isVerifiedUser &&
        isValidOrder(incoming) &&
        incoming!.ownerId === auth!.uid &&
        incoming!.status === 'New Request' &&
        incoming!.paymentStatus === 'unpaid' &&
        incoming!.createdAt === requestTime &&
        incoming!.updatedAt === requestTime
      );
    }
    if (operation === 'update') {
      if (!isVerifiedUser || !isValidOrder(incoming) || !existing) return false;
      if (
        incoming!.ownerId !== existing.ownerId ||
        incoming!.orderRef !== existing.orderRef ||
        incoming!.createdAt !== existing.createdAt ||
        incoming!.updatedAt !== requestTime
      ) {
        return false;
      }
      if (isAdmin) return true;
      if (isOwner(existing.ownerId)) {
        if (['Delivered', 'Cancelled', 'Rejected'].includes(existing.status)) return false;
        const changed = Object.keys(incoming!).filter((k) => incoming![k] !== existing[k]);
        return changed.every((k) => ['requirements', 'expectedDeliveryDate', 'updatedAt'].includes(k));
      }
      return false;
    }
  }

  return false;
}

const NOW = '2026-10-25T00:00:00Z';
const baseProduct = {
  sku: 'PROD-1',
  name: 'Brass Diya Set',
  category: 'Decor',
  brand: 'Artisan',
  sellingPrice: 1200,
  mrp: 1500,
  status: 'active',
  stockStatus: 'in_stock',
  ownerId: 'admin-uid',
  createdAt: NOW,
  updatedAt: NOW,
};

const baseOrder = {
  orderRef: 'ORD-101',
  ownerId: 'cust-1',
  customerName: 'Riya Sharma',
  mobile: '9876543210',
  whatsapp: '9876543210',
  address: 'MG Road',
  city: 'Bengaluru',
  state: 'Karnataka',
  pinCode: '560001',
  preferredContact: 'whatsapp',
  itemsSummary: 'Brass Diya Set x 50',
  totalQuantity: 50,
  estimatedAmount: 60000,
  finalAmount: 60000,
  status: 'New Request',
  paymentStatus: 'unpaid',
  createdAt: NOW,
  updatedAt: NOW,
};

test('firestore.rules file contains all blueprint collections and Eight Pillars primitives', () => {
  assert.ok(rulesContent.includes("rules_version = '2';"));
  assert.ok(rulesContent.includes('match /{document=**}'));
  assert.ok(rulesContent.includes('function isValidId(id)'));
  assert.ok(rulesContent.includes('function isVerifiedUser()'));
  for (const colPath of Object.keys(blueprint.firestore)) {
    const colName = colPath.split('/')[1];
    assert.ok(rulesContent.includes(`match /${colName}/`), `Missing match block for ${colName}`);
  }
});

test('Dirty Dozen #1: Shadow field injection on Product create is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'products',
    operation: 'create',
    docId: 'prod-1',
    auth: { uid: 'admin-uid', email: 'simple.sooraj@gmail.com', email_verified: true },
    incoming: { ...baseProduct, isGhostField: true },
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #2: Email spoofing attack (unverified admin email) is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'products',
    operation: 'create',
    docId: 'prod-1',
    auth: { uid: 'admin-uid', email: 'simple.sooraj@gmail.com', email_verified: false },
    incoming: baseProduct,
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #3: ID poisoning attack with spaces or oversized ID is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'products',
    operation: 'create',
    docId: 'invalid id with spaces!',
    auth: { uid: 'admin-uid', email: 'simple.sooraj@gmail.com', email_verified: true },
    incoming: baseProduct,
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #4: PII blanket read on bulkOrders by non-owner is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'bulkOrders',
    operation: 'get',
    docId: 'ord-101',
    auth: { uid: 'other-user', email: 'other@example.com', email_verified: true },
    existing: baseOrder,
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #5: Identity spoofing on BulkOrder create is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'bulkOrders',
    operation: 'create',
    docId: 'ord-101',
    auth: { uid: 'attacker-uid', email: 'attacker@example.com', email_verified: true },
    incoming: { ...baseOrder, ownerId: 'victim-uid' },
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #6: Timestamp forgery on create is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'bulkOrders',
    operation: 'create',
    docId: 'ord-101',
    auth: { uid: 'cust-1', email: 'riya@example.com', email_verified: true },
    incoming: { ...baseOrder, createdAt: '2020-01-01T00:00:00Z' },
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #7: Immortal field mutation (ownerId / createdAt) on update is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'products',
    operation: 'update',
    docId: 'prod-1',
    auth: { uid: 'admin-uid', email: 'simple.sooraj@gmail.com', email_verified: true },
    existing: baseProduct,
    incoming: { ...baseProduct, createdAt: '2025-01-01T00:00:00Z' },
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #8: Value poisoning (negative price) on Product update is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'products',
    operation: 'update',
    docId: 'prod-1',
    auth: { uid: 'admin-uid', email: 'simple.sooraj@gmail.com', email_verified: true },
    existing: baseProduct,
    incoming: { ...baseProduct, sellingPrice: -500 },
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #9: Denial-of-Wallet oversized description string (>2000 chars) is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'products',
    operation: 'create',
    docId: 'prod-1',
    auth: { uid: 'admin-uid', email: 'simple.sooraj@gmail.com', email_verified: true },
    incoming: { ...baseProduct, description: 'A'.repeat(2500) },
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #10: Terminal state modification by non-admin on Delivered order is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'bulkOrders',
    operation: 'update',
    docId: 'ord-101',
    auth: { uid: 'cust-1', email: 'riya@example.com', email_verified: true },
    existing: { ...baseOrder, status: 'Delivered' },
    incoming: { ...baseOrder, status: 'Delivered', requirements: 'Changed mind' },
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #11: Unverified user write on BulkOrder create is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'bulkOrders',
    operation: 'create',
    docId: 'ord-101',
    auth: { uid: 'cust-1', email: 'riya@example.com', email_verified: false },
    incoming: baseOrder,
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});

test('Dirty Dozen #12: Self-assigned privilege escalation on /admins is rejected', () => {
  const allowed = simulateFirestoreRuleCheck({
    collection: 'admins',
    operation: 'create',
    docId: 'cust-1',
    auth: { uid: 'cust-1', email: 'riya@example.com', email_verified: true },
    incoming: { uid: 'cust-1', email: 'riya@example.com', createdAt: NOW },
    requestTime: NOW,
  });
  assert.equal(allowed, false);
});
