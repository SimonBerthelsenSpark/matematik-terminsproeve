/**
 * Login-tilstand for hele appen.
 * status: 'loading' | 'anonym' | 'ubekraeftet' | 'afventer' | 'klar'
 */
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../config/firebase.js';
import { hentGodkendelse } from '../services/authService.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null, rolle: null });

  const evaluer = useCallback(async (user) => {
    if (!user) {
      setState({ status: 'anonym', user: null, rolle: null });
      return;
    }
    if (!user.emailVerified) {
      setState({ status: 'ubekraeftet', user, rolle: null });
      return;
    }
    const { godkendt, rolle } = await hentGodkendelse(user.email);
    setState({ status: godkendt ? 'klar' : 'afventer', user, rolle });
  }, []);

  useEffect(() => onAuthStateChanged(auth, (user) => { evaluer(user); }), [evaluer]);

  /** Tjek igen (fx efter at e-mailen er bekræftet, eller en administrator har godkendt kontoen). */
  const opdater = useCallback(async () => {
    const user = auth.currentUser;
    if (user) {
      await user.reload();
      // Nyt token, så Firestore-reglerne ser email_verified = true
      await user.getIdToken(true);
    }
    await evaluer(auth.currentUser);
  }, [evaluer]);

  return (
    <AuthContext.Provider value={{ ...state, erAdmin: state.rolle === 'admin', opdater }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth skal bruges inden i AuthProvider');
  return ctx;
}
