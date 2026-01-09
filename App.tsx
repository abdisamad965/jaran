
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase, clearAuthSession } from './supabaseClient';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Shifts from './pages/Shifts';
import Settings from './pages/Settings';
import Sidebar from './components/Sidebar';
import { User, Settings as StoreSettings } from './types';
import { Loader2, LogOut, RefreshCw } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState(false);
  const [settings, setSettings] = useState<StoreSettings | null>(null);

  const syncProfile = useCallback(async (userId: string, email: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (error && error.message.includes('Refresh Token Not Found')) {
        throw error;
      }

      if (profile) {
        setUser(profile);
      } else {
        const { data: newProfile } = await supabase
          .from('users')
          .insert({
            id: userId,
            name: email.split('@')[0],
            email: email,
            role: 'admin',
            password_hash: 'managed_by_supabase_auth'
          })
          .select()
          .single();
        
        if (newProfile) setUser(newProfile);
      }
    } catch (err: any) {
      console.error("Profile sync error:", err);
      if (err.message?.includes('Refresh Token Not Found')) {
        setSessionError(true);
      } else {
        setUser({ id: userId, name: email.split('@')[0], email, role: 'admin' });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    setSessionError(false);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error || (session && !session.user)) {
        console.warn("Invalid session detected, clearing...");
        await clearAuthSession();
        setLoading(false);
        return;
      }

      if (session?.user) {
        setAuthUser(session.user);
        await syncProfile(session.user.id, session.user.email || '');
      } else {
        setLoading(false);
      }
      
      supabase.from('settings').select('*').maybeSingle().then(({ data }) => {
        if (data) setSettings(data);
      });
    } catch (err) {
      console.error("Initialization error:", err);
      setLoading(false);
    }
  }, [syncProfile]);

  useEffect(() => {
    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log("Token refreshed successfully");
      }
      if (event === 'SIGNED_IN' && session?.user) {
        setAuthUser(session.user);
        await syncProfile(session.user.id, session.user.email || '');
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [initialize, syncProfile]);

  if (sessionError) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-3xl flex items-center justify-center mb-6">
          <LogOut size={40} />
        </div>
        <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Session Expired</h2>
        <p className="text-slate-500 text-sm max-w-xs mt-2">Your security token has expired. Please sign in again to restore your data connection.</p>
        <button 
          onClick={() => { clearAuthSession(); window.location.reload(); }}
          className="mt-8 px-8 py-4 bg-blue-600 text-white font-black text-xs uppercase tracking-[0.2em] rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-3"
        >
          <RefreshCw size={16} /> Re-Authenticate
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white gap-6">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <div className="text-center">
          <p className="text-slate-900 font-black text-[10px] uppercase tracking-[0.4em]">Verifying Identity</p>
          <p className="text-slate-400 text-[8px] font-bold uppercase tracking-widest mt-2 animate-pulse">Establishing secure handshake...</p>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <div className="flex min-h-screen bg-slate-50">
        {user && <Sidebar user={user} />}
        <main className={`flex-1 overflow-auto p-4 md:p-8 ${user ? '' : 'flex items-center justify-center p-0'}`}>
          <Routes>
            <Route path="/login" element={!authUser ? <Login /> : <Navigate to="/" />} />
            <Route path="/" element={user ? <Dashboard /> : <Navigate to="/login" />} />
            <Route path="/pos" element={user ? <POS user={user} settings={settings} /> : <Navigate to="/login" />} />
            <Route path="/inventory" element={user ? <Inventory /> : <Navigate to="/login" />} />
            <Route path="/expenses" element={user ? <Expenses user={user} /> : <Navigate to="/login" />} />
            <Route path="/suppliers" element={user ? <Suppliers user={user} /> : <Navigate to="/login" />} />
            <Route path="/reports" element={user?.role === 'admin' ? <Reports /> : <Navigate to="/" />} />
            <Route path="/shifts" element={user ? <Shifts user={user} /> : <Navigate to="/login" />} />
            <Route path="/settings" element={user?.role === 'admin' ? <Settings settings={settings} onUpdate={setSettings} /> : <Navigate to="/" />} />
            <Route path="*" element={<Navigate to={authUser ? "/" : "/login"} />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
};

export default App;
