'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { signInAnonymously, signOut, updateProfile, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  role: string | null;
  program: string | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  role: null,
  program: null,
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [program, setProgram] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const signIn = async (username: string, password: string) => {
    // Validate credentials
    const accountRef = doc(db, 'user_accounts', username);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists() || accountSnap.data().password !== password) {
      throw new Error('Invalid username or password');
    }

    const accountData = accountSnap.data();
    
    // Sign in anonymously
    const userCredential = await signInAnonymously(auth);
    
    // Create user profile with uid as document ID if it doesn't exist
    const userRef = doc(db, 'users', userCredential.user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        username,
        role: accountData.role,
        program: accountData.program
      });
    }
    
    setRole(accountData.role);
    setProgram(accountData.program);
  };

  useEffect(() => {
    // Bootstrap admin if not exists
    const bootstrapAdmin = async () => {
        try {
            const adminRef = doc(db, 'user_accounts', 'Admin');
            const adminSnap = await getDoc(adminRef);
            if (!adminSnap.exists()) {
                await setDoc(adminRef, {
                    username: 'Admin',
                    password: 'Admin',
                    program: 'American',
                    role: 'admin'
                });
                // Admin user document will be created upon first login
            }
        } catch (error) {
            console.error("Failed to bootstrap admin account:", error);
        }
    };
    bootstrapAdmin();

    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setUser(user);
      if (user) {
        // Find user profile by UID
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setRole(userSnap.data().role);
          setProgram(userSnap.data().program);
        }
      } else {
        setRole(null);
        setProgram(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const logOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, role, program, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}
