import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  subscribeUserProgressFromFirestore,
} from '../firebase';

interface FirebaseContextValue {
  authReady: boolean;
  firebaseUser: User | null;
  signInWithGoogle: () => Promise<User>;
  signOutFirebase: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextValue | null>(null);

export const FirebaseProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // Anexa listener Firestore apenas quando auth está pronto e usuário autenticado
  useEffect(() => {
    if (!authReady || !firebaseUser) return;
    const unsubscribe = subscribeUserProgressFromFirestore(
      firebaseUser.uid,
      () => {
        // Mantém sincronia ativa e captura eventuais erros de permissão via handleFirestoreError
      },
    );
    return () => unsubscribe();
  }, [authReady, firebaseUser]);

  const signInWithGoogle = useCallback(async (): Promise<User> => {
    const cred = await signInWithPopup(auth, googleProvider);
    return cred.user;
  }, []);

  const signOutFirebase = useCallback(async (): Promise<void> => {
    await signOut(auth);
  }, []);

  const value = useMemo<FirebaseContextValue>(
    () => ({
      authReady,
      firebaseUser,
      signInWithGoogle,
      signOutFirebase,
    }),
    [authReady, firebaseUser, signInWithGoogle, signOutFirebase],
  );

  return (
    <FirebaseContext.Provider value={value}>
      {children}
    </FirebaseContext.Provider>
  );
};

export function useFirebase(): FirebaseContextValue {
  const ctx = useContext(FirebaseContext);
  if (!ctx) {
    throw new Error('useFirebase deve ser usado dentro de FirebaseProvider.');
  }
  return ctx;
}
