import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';
import type {
  BulkOrder,
  Campaign,
  CatalogTheme,
  CustomerAccountType,
  CustomerAddress,
  CustomerProfile,
  DecorationDesign,
  DecorationPackage,
  DecorationTheme,
  DesignProductMapping,
  Occasion,
  PackageProductMapping,
  Product,
} from '../types/catalog';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const ADMIN_EMAIL = 'simple.sooraj@gmail.com';

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
 * Formats Firebase Auth error codes into clear, user-friendly messages.
 */
export function formatFirebaseAuthError(err: unknown): string {
  const code = (err as any)?.code || '';
  const msg = err instanceof Error ? err.message : String(err);

  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email address or password. Please check your credentials and try again.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Please sign in or use "Forgot Password".';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters long.';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in window was closed before completing authentication.';
    case 'auth/popup-blocked':
      return 'Your browser blocked the Google sign-in popup. Please allow popups for this site or sign in with email and password.';
    case 'auth/account-exists-with-different-credential':
      return 'An account already exists with this email using a different sign-in method.';
    case 'auth/network-request-failed':
      return 'Network error detected. Please check your internet connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many unsuccessful attempts. Please wait a moment or reset your password.';
    case 'auth/unauthorized-domain':
      return 'This domain is not yet added to Firebase Authorized Domains. Please add this domain in Firebase Console → Authentication → Settings → Authorized domains.';
    default:
      return msg || 'Authentication failed. Please try again.';
  }
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

// ============================================================================
// ADMIN & CUSTOMER AUTHENTICATION
// ============================================================================

export async function signInAdminWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}

export async function signInCustomerWithGoogle(): Promise<CustomerProfile> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  return ensureCustomerProfileInFirestore(result.user);
}

export async function registerCustomerWithEmail(input: {
  fullName: string;
  email: string;
  password: string;
  phoneNumber?: string;
  whatsappNumber?: string;
  businessName?: string;
  accountType?: CustomerAccountType;
}): Promise<CustomerProfile> {
  const cred = await createUserWithEmailAndPassword(auth, input.email.trim(), input.password);
  if (input.fullName.trim()) {
    await updateProfile(cred.user, { displayName: input.fullName.trim() }).catch(() => {});
  }
  await sendEmailVerification(cred.user).catch(() => {});
  return ensureCustomerProfileInFirestore(cred.user, {
    fullName: input.fullName.trim(),
    phoneNumber: input.phoneNumber?.trim() || '',
    whatsappNumber: input.whatsappNumber?.trim() || input.phoneNumber?.trim() || '',
    businessName: input.businessName?.trim() || '',
    accountType: input.accountType || 'Individual Customer',
  });
}

export async function signInCustomerWithEmail(
  email: string,
  password: string
): Promise<CustomerProfile> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return ensureCustomerProfileInFirestore(cred.user);
}

export async function resetCustomerPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export async function signOutCustomer(): Promise<void> {
  await signOut(auth);
}

export { onAuthStateChanged, type User };

// ============================================================================
// CUSTOMER PROFILE MANAGEMENT (Firestore /users/{uid} + Server API Sync)
// ============================================================================

function parseDeliveryAddresses(rawJson?: string, fallback?: CustomerAddress[]): CustomerAddress[] {
  if (Array.isArray(fallback)) return fallback;
  if (!rawJson) return [];
  try {
    const parsed = JSON.parse(rawJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializeFirestoreUserDoc(uid: string, data: Record<string, any>): CustomerProfile {
  const nowIso = new Date().toISOString();
  const createdAt =
    typeof data.createdAt === 'string'
      ? data.createdAt
      : data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : nowIso;
  const updatedAt =
    typeof data.updatedAt === 'string'
      ? data.updatedAt
      : data.updatedAt?.toDate
        ? data.updatedAt.toDate().toISOString()
        : nowIso;

  return {
    uid,
    fullName: String(data.fullName || 'DesiDiya Customer'),
    email: String(data.email || ''),
    photoURL: String(data.photoURL || ''),
    phoneNumber: String(data.phoneNumber || ''),
    whatsappNumber: String(data.whatsappNumber || data.phoneNumber || ''),
    businessName: String(data.businessName || ''),
    accountType: (data.accountType as CustomerAccountType) || 'Individual Customer',
    deliveryAddresses: parseDeliveryAddresses(data.deliveryAddressesJson, data.deliveryAddresses),
    city: String(data.city || ''),
    state: String(data.state || ''),
    pincode: String(data.pincode || ''),
    gstNumber: String(data.gstNumber || ''),
    accountStatus: data.accountStatus === 'suspended' ? 'suspended' : 'active',
    internalNotes: typeof data.internalNotes === 'string' ? data.internalNotes : '',
    createdAt,
    updatedAt,
    lastLoginAt: String(data.lastLoginAt || updatedAt),
  };
}

/**
 * Ensures a persistent customer profile exists in Firestore (`users/{uid}`) and backend API.
 * On first login: creates profile with Google/Auth details.
 * On subsequent logins: retrieves existing profile and updates `lastLoginAt` without overwriting saved fields.
 */
export async function ensureCustomerProfileInFirestore(
  user: User,
  extra?: Partial<CustomerProfile>
): Promise<CustomerProfile> {
  const uid = user.uid.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const nowIso = new Date().toISOString();

  let existingProfile: CustomerProfile | null = null;

  // 1. Try reading from Firestore if verified user
  if (user.emailVerified) {
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      if (snap.exists()) {
        existingProfile = serializeFirestoreUserDoc(uid, snap.data() as Record<string, any>);
      }
    } catch {
      // Fallback to API if Firestore read is unavailable
    }
  }

  // 2. Also check backend API store for existing profile
  if (!existingProfile) {
    try {
      const resp = await fetch(`/api/customers/${encodeURIComponent(uid)}`);
      if (resp.ok) {
        const apiData = await resp.json();
        if (apiData.customer) {
          existingProfile = apiData.customer as CustomerProfile;
        }
      }
    } catch {
      // Ignore network error
    }
  }

  const profile: CustomerProfile = existingProfile
    ? {
        ...existingProfile,
        fullName:
          existingProfile.fullName && existingProfile.fullName !== 'DesiDiya Customer'
            ? existingProfile.fullName
            : extra?.fullName || user.displayName || user.email?.split('@')[0] || 'DesiDiya Customer',
        email: existingProfile.email || user.email || extra?.email || '',
        photoURL: existingProfile.photoURL || user.photoURL || extra?.photoURL || '',
        phoneNumber: existingProfile.phoneNumber || extra?.phoneNumber || '',
        whatsappNumber:
          existingProfile.whatsappNumber ||
          extra?.whatsappNumber ||
          existingProfile.phoneNumber ||
          extra?.phoneNumber ||
          '',
        businessName: existingProfile.businessName || extra?.businessName || '',
        accountType: existingProfile.accountType || extra?.accountType || 'Individual Customer',
        lastLoginAt: nowIso,
        updatedAt: nowIso,
      }
    : {
        uid,
        fullName:
          extra?.fullName || user.displayName || user.email?.split('@')[0] || 'DesiDiya Customer',
        email: user.email || extra?.email || '',
        photoURL: user.photoURL || extra?.photoURL || '',
        phoneNumber: extra?.phoneNumber || '',
        whatsappNumber: extra?.whatsappNumber || extra?.phoneNumber || '',
        businessName: extra?.businessName || '',
        accountType: extra?.accountType || 'Individual Customer',
        deliveryAddresses: extra?.deliveryAddresses || [],
        city: extra?.city || '',
        state: extra?.state || '',
        pincode: extra?.pincode || '',
        gstNumber: extra?.gstNumber || '',
        accountStatus: 'active',
        internalNotes: '',
        createdAt: nowIso,
        updatedAt: nowIso,
        lastLoginAt: nowIso,
      };

  // 3. Persist to Firestore when user has verified email (Google Auth or verified email)
  if (user.emailVerified) {
    try {
      const docRef = doc(db, 'users', uid);
      const snap = await getDoc(docRef);
      const existingData = snap.exists() ? (snap.data() as Record<string, any>) : null;
      await setDoc(docRef, {
        uid,
        fullName: profile.fullName.slice(0, 150),
        email: (profile.email || 'customer@desidiya.in').slice(0, 254),
        photoURL: (profile.photoURL || '').slice(0, 2000),
        phoneNumber: (profile.phoneNumber || '').slice(0, 25),
        whatsappNumber: (profile.whatsappNumber || '').slice(0, 25),
        businessName: (profile.businessName || '').slice(0, 150),
        accountType: profile.accountType,
        deliveryAddressesJson: JSON.stringify(profile.deliveryAddresses || []).slice(0, 5000),
        city: (profile.city || '').slice(0, 100),
        state: (profile.state || '').slice(0, 100),
        pincode: (profile.pincode || '').slice(0, 16),
        gstNumber: (profile.gstNumber || '').slice(0, 30),
        accountStatus: existingData?.accountStatus || 'active',
        internalNotes: existingData?.internalNotes || '',
        lastLoginAt: nowIso.slice(0, 60),
        createdAt: existingData?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore user profile sync warning:', err);
    }
  }

  // 4. Always sync to backend API & local storage cache for instant hydration
  try {
    await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
  } catch {
    // Ignore offline error
  }
  try {
    localStorage.setItem(`desidiya_customer_${uid}`, JSON.stringify(profile));
  } catch {
    // Ignore storage quota
  }

  return profile;
}

export async function updateCustomerProfileInFirestore(
  uid: string,
  updates: Partial<CustomerProfile>
): Promise<CustomerProfile> {
  const cleanUid = uid.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const nowIso = new Date().toISOString();

  // Merge with cached or server profile first
  let current: CustomerProfile | null = null;
  try {
    const cached = localStorage.getItem(`desidiya_customer_${cleanUid}`);
    if (cached) current = JSON.parse(cached) as CustomerProfile;
  } catch {
    // Ignore
  }

  if (!current && auth.currentUser?.emailVerified) {
    try {
      const snap = await getDoc(doc(db, 'users', cleanUid));
      if (snap.exists()) {
        current = serializeFirestoreUserDoc(cleanUid, snap.data() as Record<string, any>);
      }
    } catch {
      // Ignore
    }
  }

  const merged: CustomerProfile = {
    uid: cleanUid,
    fullName: (updates.fullName ?? current?.fullName ?? 'DesiDiya Customer').trim() || 'DesiDiya Customer',
    email: (updates.email ?? current?.email ?? auth.currentUser?.email ?? '').trim(),
    photoURL: updates.photoURL ?? current?.photoURL ?? auth.currentUser?.photoURL ?? '',
    phoneNumber: (updates.phoneNumber ?? current?.phoneNumber ?? '').trim(),
    whatsappNumber: (updates.whatsappNumber ?? current?.whatsappNumber ?? updates.phoneNumber ?? '').trim(),
    businessName: (updates.businessName ?? current?.businessName ?? '').trim(),
    accountType: updates.accountType ?? current?.accountType ?? 'Individual Customer',
    deliveryAddresses: updates.deliveryAddresses ?? current?.deliveryAddresses ?? [],
    city: (updates.city ?? current?.city ?? '').trim(),
    state: (updates.state ?? current?.state ?? '').trim(),
    pincode: (updates.pincode ?? current?.pincode ?? '').trim(),
    gstNumber: (updates.gstNumber ?? current?.gstNumber ?? '').trim().toUpperCase(),
    accountStatus: updates.accountStatus ?? current?.accountStatus ?? 'active',
    internalNotes: updates.internalNotes ?? current?.internalNotes ?? '',
    createdAt: current?.createdAt ?? nowIso,
    updatedAt: nowIso,
    lastLoginAt: current?.lastLoginAt ?? nowIso,
  };

  if (auth.currentUser && auth.currentUser.emailVerified) {
    try {
      const docRef = doc(db, 'users', cleanUid);
      const snap = await getDoc(docRef);
      const existingData = snap.exists() ? (snap.data() as Record<string, any>) : null;
      const isAdminUser = auth.currentUser.email === ADMIN_EMAIL;

      await setDoc(docRef, {
        uid: cleanUid,
        fullName: merged.fullName.slice(0, 150),
        email: (merged.email || 'customer@desidiya.in').slice(0, 254),
        photoURL: (merged.photoURL || '').slice(0, 2000),
        phoneNumber: (merged.phoneNumber || '').slice(0, 25),
        whatsappNumber: (merged.whatsappNumber || '').slice(0, 25),
        businessName: (merged.businessName || '').slice(0, 150),
        accountType: merged.accountType,
        deliveryAddressesJson: JSON.stringify(merged.deliveryAddresses || []).slice(0, 5000),
        city: (merged.city || '').slice(0, 100),
        state: (merged.state || '').slice(0, 100),
        pincode: (merged.pincode || '').slice(0, 16),
        gstNumber: (merged.gstNumber || '').slice(0, 30),
        accountStatus: isAdminUser
          ? merged.accountStatus
          : existingData?.accountStatus || 'active',
        internalNotes: isAdminUser
          ? (merged.internalNotes || '').slice(0, 2000)
          : existingData?.internalNotes || '',
        lastLoginAt: (merged.lastLoginAt || nowIso).slice(0, 60),
        createdAt: existingData?.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn('Firestore profile update warning:', err);
    }
  }

  try {
    const resp = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged),
    });
    if (resp.ok) {
      const data = await resp.json();
      if (data.customer) {
        localStorage.setItem(`desidiya_customer_${cleanUid}`, JSON.stringify(data.customer));
        return data.customer as CustomerProfile;
      }
    }
  } catch {
    // Ignore offline error
  }

  try {
    localStorage.setItem(`desidiya_customer_${cleanUid}`, JSON.stringify(merged));
  } catch {
    // Ignore
  }

  return merged;
}

export async function fetchAllCustomersFromFirestore(): Promise<CustomerProfile[]> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return [];
  try {
    const snap = await getDocs(collection(db, 'users'));
    return snap.docs.map((d) => serializeFirestoreUserDoc(d.id, d.data() as Record<string, any>));
  } catch {
    return [];
  }
}

export async function fetchCustomerOrdersFromFirestore(uid: string): Promise<BulkOrder[]> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return [];
  try {
    const q = query(collection(db, 'bulkOrders'), where('ownerId', '==', uid));
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const raw = d.data() as Record<string, any>;
      return {
        id: d.id,
        ...raw,
        createdAt:
          typeof raw.createdAt === 'string'
            ? raw.createdAt
            : raw.createdAt?.toDate
              ? raw.createdAt.toDate().toISOString()
              : new Date().toISOString(),
        updatedAt:
          typeof raw.updatedAt === 'string'
            ? raw.updatedAt
            : raw.updatedAt?.toDate
              ? raw.updatedAt.toDate().toISOString()
              : new Date().toISOString(),
      } as BulkOrder;
    });
  } catch {
    return [];
  }
}

// ============================================================================
// PRODUCT IMAGE UPLOAD & CATALOG FIRESTORE PERSISTENCE
// ============================================================================

/**
 * Uploads a product or decoration image file to Firebase Storage when authenticated as verified admin,
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

function buildValidFirestoreProductPayload(product: Product, ownerUid: string) {
  const safeSku = (product.sku || `SKU-${Date.now()}`)
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 64);
  const safeName = (product.name || safeSku).trim().slice(0, 200);
  const safeCategory = (product.category || 'Decorative Lighting').trim().slice(0, 100);
  const safeBrand = (product.brand || 'DesiDiya').trim().slice(0, 100);
  const safeSellingPrice = Math.max(0, Math.min(100000000, Number(product.sellingPrice) || 0));
  const safeMrp = Math.max(
    safeSellingPrice,
    Math.min(100000000, Number(product.mrp) || safeSellingPrice)
  );
  const allowedStatus = ['active', 'draft', 'archived'] as const;
  const safeStatus = allowedStatus.includes(product.status as any) ? product.status : 'active';
  const allowedStock = ['in_stock', 'low_stock', 'made_to_order', 'out_of_stock'] as const;
  const safeStock = allowedStock.includes(product.stockStatus as any)
    ? product.stockStatus
    : 'in_stock';

  return {
    sku: safeSku,
    name: safeName,
    heading: (product.heading || safeName).slice(0, 200),
    subtitle: (product.subtitle || `${safeBrand} · ${safeCategory}`).slice(0, 300),
    description: (product.description || '').slice(0, 2000),
    category: safeCategory,
    brand: safeBrand,
    imageUrl: (product.imageUrl || '').slice(0, 10000),
    sellingPrice: safeSellingPrice,
    mrp: safeMrp,
    badge: (product.badge || '').slice(0, 60),
    campaign: (product.campaign || 'diwali-2026').slice(0, 100),
    status: safeStatus,
    stockStatus: safeStock,
    rating: Math.min(5, Math.max(0, Number(product.rating) || 4.8)),
    ratingCount: Math.max(0, Math.min(10000000, Math.round(Number(product.ratingCount) || 0))),
    amazonUrl: (product.amazonUrl || '').slice(0, 500),
    flipkartUrl: (product.flipkartUrl || '').slice(0, 500),
    meeshoUrl: (product.meeshoUrl || '').slice(0, 500),
    websiteUrl: (product.websiteUrl || '').slice(0, 500),
    featured: Boolean(product.featured),
    sortOrder: Math.max(0, Math.min(100000, Number(product.sortOrder) || 1)),
    ownerId: ownerUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

/**
 * Syncs a Product document to Firestore when a verified admin is signed in.
 */
export async function syncProductToFirestore(product: Product): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = (product.sku || product.id)
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .toUpperCase()
    .slice(0, 128);
  const path = `products/${docId}`;
  try {
    const docRef = doc(db, 'products', docId);
    const existingSnap = await getDoc(docRef);
    const payload = buildValidFirestoreProductPayload(product, auth.currentUser.uid);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data();
      await setDoc(docRef, {
        ...payload,
        ownerId: existingData.ownerId || auth.currentUser.uid,
        createdAt: existingData.createdAt || serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(docRef, payload);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

/**
 * Batch-imports products to Firestore in chunks with progress reporting and truthful confirmation.
 */
export async function batchImportProductsToFirestore(
  productsToSync: Product[],
  onProgress?: (completed: number, total: number) => void
): Promise<{ firestoreSynced: number; firestoreError: string | null }> {
  const total = productsToSync.length;
  if (total === 0) {
    return { firestoreSynced: 0, firestoreError: null };
  }

  // Always persist in localStorage as well so same-browser refreshes never lose imported products
  try {
    const existingRaw = localStorage.getItem('desidiya_imported_products_backup');
    const existingList: Product[] = existingRaw ? JSON.parse(existingRaw) : [];
    const bySku = new Map<string, Product>();
    for (const p of existingList) bySku.set(p.sku.toUpperCase(), p);
    for (const p of productsToSync) bySku.set(p.sku.toUpperCase(), p);
    localStorage.setItem(
      'desidiya_imported_products_backup',
      JSON.stringify(Array.from(bySku.values()))
    );
  } catch {
    // Ignore storage quota issues
  }

  if (!auth.currentUser || !auth.currentUser.emailVerified) {
    onProgress?.(total, total);
    return {
      firestoreSynced: 0,
      firestoreError:
        'Products were imported into the active server session and browser cache. To permanently write to Cloud Firestore, please sign in with your verified Administrator Google account (simple.sooraj@gmail.com).',
    };
  }

  let synced = 0;
  const CHUNK_SIZE = 50;

  try {
    // Fetch existing product docs once so we preserve createdAt and ownerId on updates per firestore.rules
    const existingDocsSnap = await getDocs(collection(db, 'products'));
    const existingMetaMap = new Map<string, { ownerId: string; createdAt: any }>();
    existingDocsSnap.docs.forEach((d) => {
      const data = d.data();
      existingMetaMap.set(d.id, {
        ownerId: data.ownerId,
        createdAt: data.createdAt,
      });
    });

    for (let i = 0; i < productsToSync.length; i += CHUNK_SIZE) {
      const chunk = productsToSync.slice(i, i + CHUNK_SIZE);
      const batch = writeBatch(db);

      for (const product of chunk) {
        const docId = (product.sku || product.id)
          .replace(/[^a-zA-Z0-9_-]/g, '-')
          .toUpperCase()
          .slice(0, 128);
        const docRef = doc(db, 'products', docId);
        const basePayload = buildValidFirestoreProductPayload(product, auth.currentUser.uid);
        const existingMeta = existingMetaMap.get(docId);

        if (existingMeta && existingMeta.ownerId && existingMeta.createdAt) {
          batch.set(docRef, {
            ...basePayload,
            ownerId: existingMeta.ownerId,
            createdAt: existingMeta.createdAt,
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.set(docRef, basePayload);
        }
      }

      await batch.commit();
      synced += chunk.length;
      onProgress?.(synced, total);
    }

    return { firestoreSynced: synced, firestoreError: null };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Batch Firestore import error:', errMsg);
    return {
      firestoreSynced: synced,
      firestoreError: `Firestore write error after ${synced}/${total} products: ${errMsg}`,
    };
  }
}

export async function deleteProductFromFirestore(productId: string, sku?: string): Promise<void> {
  // Also remove from local backup cache
  try {
    const existingRaw = localStorage.getItem('desidiya_imported_products_backup');
    if (existingRaw) {
      const existingList: Product[] = JSON.parse(existingRaw);
      const filtered = existingList.filter(
        (p) => p.id !== productId && (!sku || p.sku.toUpperCase() !== sku.toUpperCase())
      );
      localStorage.setItem('desidiya_imported_products_backup', JSON.stringify(filtered));
    }
  } catch {
    // Ignore
  }

  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = (sku || productId).replace(/[^a-zA-Z0-9_-]/g, '-').toUpperCase().slice(0, 128);
  const path = `products/${docId}`;
  try {
    await deleteDoc(doc(db, 'products', docId));
    const altDocId = productId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
    if (altDocId !== docId) {
      await deleteDoc(doc(db, 'products', altDocId)).catch(() => {});
    }
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

export async function syncOccasionToFirestore(occasion: Occasion): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = occasion.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `occasions/${docId}`;
  try {
    await setDoc(doc(db, 'occasions', docId), {
      name: occasion.name.slice(0, 150),
      slug: occasion.slug.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100),
      description: (occasion.description || '').slice(0, 2000),
      coverImage: (occasion.coverImage || '').slice(0, 10000),
      bannerImage: (occasion.bannerImage || '').slice(0, 10000),
      icon: (occasion.icon || 'Sparkles').slice(0, 60),
      featured: Boolean(occasion.featured),
      displayOrder: Math.max(0, Number(occasion.displayOrder) || 1),
      status: occasion.status === 'inactive' ? 'inactive' : 'active',
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteOccasionFromFirestore(occasionId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = occasionId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `occasions/${docId}`;
  try {
    await deleteDoc(doc(db, 'occasions', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncDecorationThemeToFirestore(theme: DecorationTheme): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = theme.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `decorationThemes/${docId}`;
  try {
    await setDoc(doc(db, 'decorationThemes', docId), {
      occasionId: theme.occasionId.slice(0, 128),
      occasionSlug: theme.occasionSlug.slice(0, 100),
      title: theme.title.slice(0, 200),
      slug: theme.slug.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100),
      description: (theme.description || '').slice(0, 2000),
      coverImage: (theme.coverImage || '').slice(0, 10000),
      colorPaletteSummary: (theme.colorPalette || []).join(', ').slice(0, 300),
      style: (theme.style || 'Royal').slice(0, 100),
      featured: Boolean(theme.featured),
      displayOrder: Math.max(0, Number(theme.displayOrder) || 1),
      status: theme.status === 'draft' ? 'draft' : 'published',
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDecorationThemeFromFirestore(themeId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = themeId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `decorationThemes/${docId}`;
  try {
    await deleteDoc(doc(db, 'decorationThemes', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncDecorationDesignToFirestore(
  design: DecorationDesign,
  mappings?: DesignProductMapping[]
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = design.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `decorationDesigns/${docId}`;
  try {
    await setDoc(doc(db, 'decorationDesigns', docId), {
      title: design.title.slice(0, 200),
      slug: design.slug.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100),
      occasionId: design.occasionId.slice(0, 128),
      occasionSlug: design.occasionSlug.slice(0, 100),
      themeId: design.themeId.slice(0, 128),
      themeSlug: design.themeSlug.slice(0, 100),
      mainImage: (design.mainImage || '').slice(0, 10000),
      shortDescription: (design.shortDescription || '').slice(0, 500),
      fullDescription: (design.fullDescription || '').slice(0, 3000),
      decorationArea: (design.decorationArea || 'Stage / Mandap').slice(0, 80),
      recommendedGuestCount: (design.recommendedGuestCount || '100 - 300 Guests').slice(0, 100),
      indoorOutdoor: design.indoorOutdoor || 'both',
      estimatedBudgetRange: (design.estimatedBudgetRange || '').slice(0, 120),
      featured: Boolean(design.featured),
      status: design.status === 'draft' ? 'draft' : 'published',
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (Array.isArray(mappings)) {
      for (const m of mappings) {
        const mapId = m.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
        await setDoc(doc(db, 'designProducts', mapId), {
          designId: m.designId.slice(0, 128),
          productId: m.productId.slice(0, 128),
          sku: m.sku.slice(0, 64),
          recommendedQuantity: Math.max(1, Number(m.recommendedQuantity) || 1),
          quantityUnit: (m.quantityUnit || 'pcs').slice(0, 40),
          isRequired: Boolean(m.isRequired),
          displayOrder: Math.max(0, Number(m.displayOrder) || 1),
          notes: (m.notes || '').slice(0, 500),
          ownerId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteDecorationDesignFromFirestore(designId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = designId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `decorationDesigns/${docId}`;
  try {
    await deleteDoc(doc(db, 'decorationDesigns', docId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function syncPackageToFirestore(
  pkg: DecorationPackage,
  mappings?: PackageProductMapping[]
): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = pkg.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `packages/${docId}`;
  try {
    await setDoc(doc(db, 'packages', docId), {
      name: pkg.name.slice(0, 200),
      slug: pkg.slug.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 100),
      occasionId: pkg.occasionId.slice(0, 128),
      occasionSlug: pkg.occasionSlug.slice(0, 100),
      themeId: (pkg.themeId || '').slice(0, 128),
      themeSlug: (pkg.themeSlug || '').slice(0, 100),
      coverImage: (pkg.coverImage || '').slice(0, 10000),
      description: (pkg.description || '').slice(0, 2000),
      startingPrice: Math.max(0, Number(pkg.startingPrice) || 0),
      guestCapacity: (pkg.guestCapacity || '').slice(0, 100),
      featured: Boolean(pkg.featured),
      status: pkg.status === 'draft' ? 'draft' : 'published',
      ownerId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (Array.isArray(mappings)) {
      for (const m of mappings) {
        const mapId = m.id.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
        await setDoc(doc(db, 'packageProducts', mapId), {
          packageId: m.packageId.slice(0, 128),
          productId: m.productId.slice(0, 128),
          sku: m.sku.slice(0, 64),
          recommendedQuantity: Math.max(1, Number(m.recommendedQuantity) || 1),
          quantityUnit: (m.quantityUnit || 'pcs').slice(0, 40),
          isRequired: Boolean(m.isRequired),
          displayOrder: Math.max(0, Number(m.displayOrder) || 1),
          notes: (m.notes || '').slice(0, 500),
          ownerId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deletePackageFromFirestore(packageId: string): Promise<void> {
  if (!auth.currentUser || !auth.currentUser.emailVerified) return;
  const docId = packageId.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
  const path = `packages/${docId}`;
  try {
    await deleteDoc(doc(db, 'packages', docId));
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
      occasionSlug: (order.occasionSlug || '').slice(0, 100),
      occasionName: (order.occasionName || '').slice(0, 150),
      decorationThemeSlug: (order.decorationThemeSlug || '').slice(0, 100),
      decorationThemeName: (order.decorationThemeName || '').slice(0, 200),
      packageName: (order.packageName || '').slice(0, 200),
      eventDate: (order.eventDate || '').slice(0, 40),
      venueLocation: (order.venueLocation || '').slice(0, 300),
      guestCount: (order.guestCount || '').slice(0, 60),
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

/**
 * Fetches persisted active products from Firestore AND browser backup cache so imported products
 * remain visible across page reloads even on ephemeral Cloudflare Workers.
 */
export async function fetchActiveProductsFromFirestore(): Promise<Product[]> {
  const mergedBySku = new Map<string, Product>();

  // 1. Check local backup cache first
  try {
    const raw = localStorage.getItem('desidiya_imported_products_backup');
    if (raw) {
      const parsed = JSON.parse(raw) as Product[];
      if (Array.isArray(parsed)) {
        for (const p of parsed) {
          if (p && p.sku) mergedBySku.set(p.sku.toUpperCase(), p);
        }
      }
    }
  } catch {
    // Ignore
  }

  // 2. Query Firestore products collection
  try {
    const q = query(collection(db, 'products'), where('status', '==', 'active'));
    const snap = await getDocs(q);
    snap.docs.forEach((d) => {
      const data = d.data() as Record<string, any>;
      if (!data.sku || !data.name) return;
      const sku = String(data.sku).toUpperCase();
      const nowIso = new Date().toISOString();
      const prod: Product = {
        id: d.id,
        sku,
        name: String(data.name),
        heading: String(data.heading || data.name),
        subtitle: String(data.subtitle || `${data.brand || 'DesiDiya'} · ${data.category || 'Decor'}`),
        description: String(data.description || ''),
        category: String(data.category || 'Decorative Lighting'),
        brand: String(data.brand || 'DesiDiya'),
        imageUrl: String(data.imageUrl || ''),
        sellingPrice: Number(data.sellingPrice) || 0,
        mrp: Number(data.mrp) || Number(data.sellingPrice) || 0,
        badge: String(data.badge || ''),
        campaign: String(data.campaign || 'diwali-2026'),
        campaigns: [String(data.campaign || 'diwali-2026')],
        status: (data.status as any) || 'active',
        stockStatus: (data.stockStatus as any) || 'in_stock',
        rating: Number(data.rating) || 4.8,
        ratingCount: Number(data.ratingCount) || 24,
        amazonUrl: String(data.amazonUrl || ''),
        flipkartUrl: String(data.flipkartUrl || ''),
        meeshoUrl: String(data.meeshoUrl || ''),
        websiteUrl: String(data.websiteUrl || ''),
        featured: Boolean(data.featured),
        sortOrder: Number(data.sortOrder) || 1,
        ownerId: String(data.ownerId || 'system-admin'),
        createdAt:
          typeof data.createdAt === 'string'
            ? data.createdAt
            : data.createdAt?.toDate
              ? data.createdAt.toDate().toISOString()
              : nowIso,
        updatedAt:
          typeof data.updatedAt === 'string'
            ? data.updatedAt
            : data.updatedAt?.toDate
              ? data.updatedAt.toDate().toISOString()
              : nowIso,
      };
      mergedBySku.set(sku, prod);
    });
  } catch {
    // Ignore if offline
  }

  return Array.from(mergedBySku.values());
}
