import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, onSnapshot, Timestamp, addDoc, deleteDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

// --- Error Handling ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- Auth Utilities ---
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    // Create user profile in Firestore if it doesn't exist
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        createdAt: Timestamp.now()
      });
    }
    return user;
  } catch (error: any) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log("User closed the sign-in popup.");
      return null;
    }
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const logout = () => auth.signOut();

// --- Firestore Utilities ---
export interface FruitEntry {
  id?: string;
  userId: string;
  fruitName: string;
  scientificName?: string;
  family?: string;
  origin?: string;
  nutrition?: {
    calories: string;
    vitamins: string[];
    minerals: string[];
  };
  funFact?: string;
  season?: string;
  imageUrl: string;
  timestamp: Timestamp;
}

export interface FavoriteEntry {
  id?: string;
  userId: string;
  fruitName: string;
  timestamp: Timestamp;
}

export const saveFruitToCollection = async (userId: string, entry: Omit<FruitEntry, 'id' | 'userId' | 'timestamp'>) => {
  const path = `users/${userId}/collection`;
  try {
    const docRef = await addDoc(collection(db, path), {
      ...entry,
      userId,
      timestamp: Timestamp.now()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
};

export const deleteFruitFromCollection = async (userId: string, itemId: string) => {
  const path = `users/${userId}/collection/${itemId}`;
  try {
    await deleteDoc(doc(db, path));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const toggleFavoriteFruit = async (userId: string, fruitName: string, isFavorite: boolean) => {
  const path = `users/${userId}/favorites`;
  try {
    if (isFavorite) {
      // Add to favorites
      const q = query(collection(db, path), where('fruitName', '==', fruitName));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        await addDoc(collection(db, path), {
          userId,
          fruitName,
          timestamp: Timestamp.now()
        });
      }
    } else {
      // Remove from favorites
      const q = query(collection(db, path), where('fruitName', '==', fruitName));
      const snapshot = await getDocs(q);
      snapshot.forEach(async (document) => {
        await deleteDoc(doc(db, `users/${userId}/favorites/${document.id}`));
      });
    }
  } catch (error) {
    handleFirestoreError(error, isFavorite ? OperationType.CREATE : OperationType.DELETE, path);
  }
};
