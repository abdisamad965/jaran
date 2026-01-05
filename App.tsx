import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Inventory from './pages/Inventory';
import Expenses from './pages/Expenses';
import Suppliers from './pages/Suppliers';
import Reports from './pages/Reports';
import Shifts from './pages/Shifts';
import Settings from './pages/Settings';
import CompleteProfile from './pages/CompleteProfile';
import Sidebar from './components/Sidebar';
import { User, Settings as StoreSettings } from './types';
import { Loader2 } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isProfileReady, setIsProfileReady] = useState(false);

  const checkProfile = useCallback(async (userId: string) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (profileError) throw profileError;
      
      if (profile && profile.name) {
        setUser(profile);
        setIsProfileReady(true);
        return true;
      } else {
        setUser(null);
        setIsProfileReady(false);
        return false;
      }
    } catch (err) {
      console.error("Error checking profile:", err);
      setUser(null);
      setIsProfileReady(false);
      return false;
    }
  }, []);

  const clearSessionAndRestart = async () => {
    console.warn("Invalid or expired session. Clearing local session data...");
    await supabase.auth.signOut();
    localStorage.removeItem('sb-qjlzzppimrzthgrpjdeu-auth-token');
    setAuthUser(null);
    setUser(null);
    setIsProfileReady(false);
    setLoading(false);
  };

  useEffect(() => {
    const initialize = async () => {
      setLoading(true);
      try {
        // Load database settings if available
        const { data: sets } = await supabase.from('settings').select('*').maybeSingle();
        if (sets) setSettings(sets);
        
        // Check session with explicit error handling for Refresh Token issues
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          if (sessionError.message.includes("Refresh Token")) {
            await clearSessionAndRestart();
            return;
          }
          throw sessionError;
        }

        if (session?.user) {
          setAuthUser(session.user);
          await checkProfile(session.user.id);
        }
      } catch (err: any) {
        console.error("Initialization error:", err);
        if (err.message?.includes("Refresh Token")) {
          await clearSessionAndRestart();
        }
      } finally {
        setLoading(false);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        setAuthUser(session.user);
        setLoading(true);
        await checkProfile(session.user.id);
        setLoading(false);
      } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED' === false) {
        setAuthUser(null);
        setUser(null);
        setIsProfileReady(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkProfile]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-50 gap-4">
        <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
        <p className="text-slate-500 font-medium animate-pulse">Syncing environment...</p>
      </div>
    );
  }

  if (authUser && !isProfileReady) {
    return (
      <CompleteProfile 
        authUserId={authUser.id} 
        email={authUser.email || ''} 
        onComplete={() => checkProfile(authUser.id)} 
      />
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