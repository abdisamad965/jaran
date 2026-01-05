
import React, { useState } from 'react';
import { supabase } from '../supabaseClient';
import { User as UserIcon, Shield, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { Role } from '../types';

interface CompleteProfileProps {
  authUserId: string;
  email: string;
  onComplete: () => void;
}

const CompleteProfile: React.FC<CompleteProfileProps> = ({ authUserId, email, onComplete }) => {
  const [name, setName] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // We include a placeholder for password_hash because the SQL schema has a NOT NULL constraint.
      // In a Supabase setup, the actual password logic is handled by the 'auth' schema.
      const { error: insertError } = await supabase
        .from('users')
        .insert({
          id: authUserId,
          name,
          email,
          role,
          password_hash: 'managed_by_supabase_auth' // Placeholder to satisfy DB constraint
        });

      if (insertError) {
        // If the error persists, it might be a different constraint.
        throw insertError;
      }
      
      onComplete();
    } catch (err: any) {
      console.error("Profile creation error:", err);
      setError(err.message || "Failed to create profile record.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden animate-in zoom-in duration-300">
        <div className="p-8 bg-slate-900 text-white text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-blue-500/20">
            <UserIcon size={32} />
          </div>
          <h2 className="text-2xl font-bold">Complete Your Profile</h2>
          <p className="text-slate-400 text-sm mt-2">We found your account, but we need a few more details to set up your workspace.</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3 text-rose-600 text-sm font-medium animate-in shake-in">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Full Name</label>
            <input
              required
              type="text"
              placeholder="Enter your name"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">Select Your Role</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('admin')}
                className={`p-4 rounded-xl border text-left transition-all ${role === 'admin' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
              >
                <Shield size={20} className={role === 'admin' ? 'text-blue-600' : 'text-slate-400'} />
                <p className={`font-bold mt-2 text-sm ${role === 'admin' ? 'text-blue-900' : 'text-slate-700'}`}>Admin</p>
                <p className="text-[10px] text-slate-500 mt-1">Full system access and settings.</p>
              </button>
              <button
                type="button"
                onClick={() => setRole('cashier')}
                className={`p-4 rounded-xl border text-left transition-all ${role === 'cashier' ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'bg-white border-slate-200 hover:border-slate-300'}`}
              >
                <CheckCircle2 size={20} className={role === 'cashier' ? 'text-blue-600' : 'text-slate-400'} />
                <p className={`font-bold mt-2 text-sm ${role === 'cashier' ? 'text-blue-900' : 'text-slate-700'}`}>Cashier</p>
                <p className="text-[10px] text-slate-500 mt-1">POS and sales access only.</p>
              </button>
            </div>
          </div>

          <button
            disabled={loading || !name}
            type="submit"
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : 'Finish Setup'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CompleteProfile;
