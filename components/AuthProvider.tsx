'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { signInAnonymously, signOut, updateProfile, User } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  username: string | null;
  role: string | null;
  program: string | null;
  permissions: string[];
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  logOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  username: null,
  role: null,
  program: null,
  permissions: [],
  loading: true,
  signIn: async () => {},
  logOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [program, setProgram] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const signIn = async (inputUsername: string, password: string) => {
    // Validate credentials
    const accountRef = doc(db, 'user_accounts', inputUsername);
    const accountSnap = await getDoc(accountRef);
    
    if (!accountSnap.exists() || accountSnap.data().password !== password) {
      throw new Error('Invalid username or password');
    }

    const accountData = accountSnap.data();
    const userPermissions = accountData.permissions || (accountData.role === 'admin' ? ['view', 'print', 'add_order', 'manage_users'] : accountData.role === 'coordinator' ? ['view', 'print', 'add_order'] : ['view']);
    
    // Sign in anonymously
    const userCredential = await signInAnonymously(auth);
    
    // Create user profile with uid as document ID if it doesn't exist
    const userRef = doc(db, 'users', userCredential.user.uid);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        username: inputUsername,
        role: accountData.role,
        program: accountData.program,
        permissions: userPermissions
      });
    } else {
      // Update permissions in case they changed
      await setDoc(userRef, {
        ...userSnap.data(),
        permissions: userPermissions
      }, { merge: true });
    }
    
    setUsername(inputUsername);
    setRole(accountData.role);
    setProgram(accountData.program);
    setPermissions(userPermissions);
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
                    role: 'admin',
                    permissions: ['view', 'print', 'add_order', 'manage_users']
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
          const data = userSnap.data();
          setUsername(data.username);
          setRole(data.role);
          setProgram(data.program);
          setPermissions(data.permissions || (data.role === 'admin' ? ['view', 'print', 'add_order', 'manage_users'] : data.role === 'coordinator' ? ['view', 'print', 'add_order'] : ['view']));
        }
      } else {
        setUsername(null);
        setRole(null);
        setProgram(null);
        setPermissions([]);
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
    <AuthContext.Provider value={{ user, username, role, program, permissions, loading, signIn, logOut }}>
      {children}
    </AuthContext.Provider>
  );
}
