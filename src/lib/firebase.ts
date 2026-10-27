import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocs,
  getFirestore,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import type { BulkOrder, Campaign, CatalogTheme, Product } from '../types/catalog';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Mandatory connection check on boot per firebase-integration-rpc skill.
 */
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export async function signInAdminWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type User };

/**
 * Uploads a product image file to Firebase Storage when authenticated as verified admin,
 * or converts to a persistent compressed data URL so images always survive page reloads.
 */
export async function uploadPersistentProductImage(file: File): Promise<string> {
  if (auth.currentUser && auth.currentUser.emailVerified) {
    try {
      const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storageRef = ref(storage, `products/${safeName}`);
      await uploadBytes(storageRef, file, { contentType: file.type || 'image/jpeg' });
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch {
      // Fallback to data URL if Storage bucket rules or CORS block direct browser upload
    }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Syncs a Product document to Firestore when a verified admin is signed in.
 */
export async function syncProductToFirestore(product: Product): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = product.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `products/${docId}`;
  try {
    await setDoc(doc(db, 'products', docId), {
      sku: product.sku.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64),
      name: product.name.slice(0, 200),
      heading: (product.heading || product.name).slice(0, 200),
      subtitle: (product.subtitle || '').slice(0, 300),
      description: (product.description || '').slice(0, 2000),
      category: product.category.slice(0, 100),
      brand: product.brand.slice(0, 100),
      imageUrl: (product.imageUrl || '').slice(0, 10000),
      sellingPrice: Number(product.sellingPrice) || 0,
      mrp: Number(product.mrp) || 0,
      badge: (product.badge || '').slice(0, 60),
      campaign: (product.campaign || '').slice(0, 100),
      status: product.status,
      stockStatus: product.stockStatus,
      rating: Number(product.rating) || 4.8,
      ratingCount: Number(product.ratingCount) || 0,
      amazonUrl: (product.amazonUrl || '').slice(0, 500),
      flipkartUrl: (product.flipkartUrl || '').slice(0, 500),
      meeshoUrl: (product.meeshoUrl || '').slice(0, 500),
      websiteUrl: (product.websiteUrl || '').slice(0, 500),
      featured: Boolean(product.featured),
      sortOrder: Number(product.sortOrder) || 1,
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteProductFromFirestore(productId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = productId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `products/${docId}`;
  try {
    await deleteDoc(doc(db, 'products', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncThemeToFirestore(theme: CatalogTheme): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = theme.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `themes/${docId}`;
  try {
    await setDoc(doc(db, 'themes', docId), {
      name: theme.name.slice(0, 100),
      primaryColor: theme.primaryColor.slice(0, 20),
      secondaryColor: theme.secondaryColor.slice(0, 20),
      backgroundColor: theme.backgroundColor.slice(0, 20),
      surfaceColor: theme.surfaceColor.slice(0, 20),
      textColor: theme.textColor.slice(0, 20),
      accentColor: theme.accentColor.slice(0, 20),
      headingFont: theme.headingFont.slice(0, 80),
      bodyFont: theme.bodyFont.slice(0, 80),
      cardLayout: theme.cardLayout,
      borderRadius: theme.borderRadius,
      buttonStyle: theme.buttonStyle,
      isPublic: Boolean(theme.isPublic),
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function syncCampaignToFirestore(campaign: Campaign): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = campaign.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `campaigns/${docId}`;
  try {
    await setDoc(doc(db, 'campaigns', docId), {
      slug: campaign.slug.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100),
      name: campaign.name.slice(0, 150),
      description: (campaign.description || '').slice(0, 1000),
      bannerTitle: (campaign.bannerTitle || '').slice(0, 200),
      bannerSubtitle: (campaign.bannerSubtitle || '').slice(0, 400),
      startDate: (campaign.startDate || '').slice(0, 40),
      endDate: (campaign.endDate || '').slice(0, 40),
      themeId: campaign.themeId.slice(0, 100),
      status: campaign.status,
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteCampaignFromFirestore(campaignId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = campaignId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `campaigns/${docId}`;
  try {
    await deleteDoc(doc(db, 'campaigns', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncBulkOrderToFirestore(order: BulkOrder): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = order.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `bulkOrders/${docId}`;
  try {
    await setDoc(doc(db, 'bulkOrders', docId), {
      orderRef: order.orderRef.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 64),
      ownerId: auth.currentUser.uid,
      customerName: order.customerName.slice(0, 150),
      companyName: (order.companyName || '').slice(0, 150),
      mobile: order.mobile.slice(0, 25),
      whatsapp: (order.whatsapp || order.mobile).slice(0, 25),
      email: (order.email || '').slice(0, 254),
      address: order.address.slice(0, 500),
      city: order.city.slice(0, 100),
      state: order.state.slice(0, 100),
      pinCode: order.pinCode.slice(0, 16),
      gstNumber: (order.gstNumber || '').slice(0, 30),
      campaignSlug: (order.campaignSlug || '').slice(0, 100),
      expectedDeliveryDate: (order.expectedDeliveryDate || '').slice(0, 40),
      preferredContact: order.preferredContact,
      requirements: (order.requirements || '').slice(0, 2000),
      itemsSummary: order.itemsSummary.slice(0, 2000),
      totalQuantity: Math.max(1, Number(order.totalQuantity) || 1),
      estimatedAmount: Math.max(0, Number(order.estimatedAmount) || 0),
      finalAmount: Math.max(0, Number(order.finalAmount) || 0),
      status: 'New Request',
      paymentStatus: 'unpaid',
      paymentLink: (order.paymentLink || '').slice(0, 500),
      transactionRef: (order.transactionRef || '').slice(0, 120),
      courierName: (order.courierName || '').slice(0, 100),
      trackingNumber: (order.trackingNumber || '').slice(0, 100),
      internalNotes: (order.internalNotes || '').slice(0, 2000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchActiveProductsFromFirestore(): Promise<Partial<Product>[]> {
  try {
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Record<string, any>) }));
  } catch {
    return [];
  }
}
