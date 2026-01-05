
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { Store, Lock, Mail, Loader2, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      // We do not check for profile here. 
      // App.tsx handles the redirection to CompleteProfile if the record is missing.
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-slate-50">
      {/* Left side: Branding/Image */}
      <div className="hidden lg:flex flex-1 bg-slate-900 items-center justify-center p-12 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-32 -mt-32"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl -ml-48 -mb-48"></div>
        
        <div className="max-w-md space-y-8 relative z-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/20">
            <Store className="text-white" size={32} />
          </div>
          <div>
            <h1 className="text-4xl font-extrabold text-white tracking-tight leading-tight">
              Manage your business with <span className="text-blue-500">intelligence.</span>
            </h1>
            <p className="text-slate-400 mt-4 text-lg">
              Streamline POS, Inventory, and Reports in one powerful dashboard.
            </p>
          </div>
          <div className="flex gap-4">
            <div className="px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium">Real-time Stock</div>
            <div className="px-4 py-2 bg-slate-800 rounded-lg border border-slate-700 text-slate-300 text-sm font-medium">AI Insights</div>
          </div>
        </div>
      </div>

      {/* Right side: Login Form */}
      <div className="w-full lg:w-[500px] flex items-center justify-center p-8">
        <div className="w-full max-sm space-y-8">
          <div className="text-center lg:text-left">
            <div className="lg:hidden inline-flex w-12 h-12 bg-blue-600 rounded-xl items-center justify-center mb-6">
              <Store className="text-white" size={24} />
            </div>
            <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Welcome back</h2>
            <p className="text-slate-500 mt-2">Sign in to your account to continue</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-3 text-rose-600 text-sm font-medium animate-in shake-in">
                <AlertCircle size={18} />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  disabled={loading}
                  type="email"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                  placeholder="name@store.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold text-slate-700">Password</label>
                <a href="#" className="text-xs text-blue-600 font-bold hover:underline">Forgot password?</a>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  required
                  disabled={loading}
                  type="password"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all disabled:opacity-50"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              disabled={loading}
              type="submit"
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  <span>Authenticating...</span>
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-sm">
            Restricted access. Contact admin for credentials.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
