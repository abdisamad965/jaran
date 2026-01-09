
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { Loader2, RefreshCcw, AlertCircle } from 'lucide-react';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authUser, setAuthUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isProfileReady, setIsProfileReady] = useState(false);
  const [showTimeoutUI, setShowTimeoutUI] = useState(false);
  const timeoutRef = useRef<any>(null);

  const clearSessionAndRestart = async () => {
    console.warn("Clearing all local session data to fix sync issues...");
    try {
      await supabase.auth.signOut();
    } catch (e) {
      // Ignore signout errors if token is already dead
    }
    // Clear all Supabase related local storage keys
    Object.keys(localStorage).forEach(key => {
      if (key.includes('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    });
    // Also clear session storage just in case
    sessionStorage.clear();
    window.location.reload();
  };

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
      return false;
    }
  }, []);

  useEffect(() => {
    const initialize = async () => {
      // Start a timeout timer. If loading takes > 8s, show reset button.
      timeoutRef.current = setTimeout(() => {
        setLoading(prev => {
          if (prev) setShowTimeoutUI(true);
          return prev;
        });
      }, 8000);

      try {
        // Load database settings
        const { data: sets } = await supabase.from('settings').select('*').maybeSingle();
        if (sets) setSettings(sets);
        
        // Fetch session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session initialization error:", sessionError);
          // Explicitly handle "Refresh Token Not Found" or 400 errors by nuking the local session
          if (
            sessionError.message.toLowerCase().includes("refresh token") || 
            sessionError.status === 400 ||
            sessionError.status === 401
          ) {
            await clearSessionAndRestart();
            return;
          }
        }

        if (session?.user) {
          setAuthUser(session.user);
          const hasProfile = await checkProfile(session.user.id);
          if (!hasProfile) {
             setIsProfileReady(false);
          }
        } else {
          setAuthUser(null);
          setUser(null);
        }
      } catch (err: any) {
        console.error("Initialization exception:", err);
        // If we hit a snag during boot, checking if it's auth related
        if (err.message?.toLowerCase().includes("refresh token")) {
          await clearSessionAndRestart();
          return;
        }
      } finally {
        setLoading(false);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
      }
    };

    initialize();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        console.log('Auth token refreshed successfully');
      }
      
      if ((event === 'SIGNED_IN' || event === 'USER_UPDATED') && session?.user) {
        setAuthUser(session.user);
        await checkProfile(session.user.id);
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setAuthUser(null);
        setUser(null);
        setIsProfileReady(false);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [checkProfile]);

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-white gap-6 p-6">
        <div className="relative">
          <Loader2 className="w-16 h-16 text-blue-600 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-ping"></div>
          </div>
        </div>
        
        <div className="text-center space-y-2">
          <p className="text-slate-900 font-black uppercase tracking-[0.2em] text-xs">Syncing Environment</p>
          <p className="text-slate-400 text-[10px] font-medium max-w-[200px] mx-auto leading-relaxed">
            Verifying secure tunnel and business parameters...
          </p>
        </div>

        {showTimeoutUI && (
          <div className="mt-8 p-6 bg-slate-50 border border-slate-100 rounded-[2rem] max-w-sm w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 shadow-sm">
            <div className="flex items-start gap-3 text-slate-600">
              <AlertCircle size={20} className="shrink-0 text-amber-500" />
              <div className="space-y-1">
                <p className="text-[11px] font-bold leading-relaxed">
                  Session synchronization failed.
                </p>
                <p className="text-[10px] text-slate-500 font-medium">
                  Your browser profile has a conflicting security token. This is common when tokens expire.
                </p>
              </div>
            </div>
            <button 
              onClick={clearSessionAndRestart}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-3 hover:bg-black transition-all shadow-xl shadow-slate-200"
            >
              <RefreshCcw size={14} /> Repair Connection
            </button>
            <p className="text-center text-[9px] text-slate-400 font-medium">This mimics an incognito start to resolve token errors.</p>
          </div>
        )}
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
