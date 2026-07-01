import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/react-app/lib/firebase";

interface User {
  id: string;
  email: string | null;
  name: string | null;
  picture: string | null;
  isAnonymous: boolean;
}

interface AuthContextValue {
  user: User | null;
  /** A real (non-anonymous) host account, allowed to create & run quizzes. */
  isHost: boolean;
  isPending: boolean;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toUser(fbUser: FirebaseUser): User {
  return {
    id: fbUser.uid,
    email: fbUser.email,
    name: fbUser.displayName,
    picture: fbUser.photoURL,
    isAnonymous: fbUser.isAnonymous,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isPending, setIsPending] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (fbUser) => {
      setUser(fbUser ? toUser(fbUser) : null);
      setIsPending(false);
    });
  }, []);

  const loginWithGoogle = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const loginWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name) await updateProfile(cred.user, { displayName: name });
    setUser(toUser(cred.user));
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
  };

  const isHost = !!user && !user.isAnonymous;

  return (
    <AuthContext.Provider
      value={{ user, isHost, isPending, loginWithGoogle, loginWithEmail, signUpWithEmail, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
