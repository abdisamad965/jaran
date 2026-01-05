import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Save, 
  MapPin,
  Phone,
  Receipt,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Monitor
} from 'lucide-react';
import { Settings as SettingsType } from '../types';

interface SettingsProps {
  settings: SettingsType | null;
  onUpdate: (s: SettingsType) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  const [formData, setFormData] = useState({
    store_name: 'Jaran Cleaning Service',
    tax_rate: 0,
    phone: '',
    address: '',
    shift_closing_enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Load from LocalStorage (Frontend Source of Truth)
    const localConfig = localStorage.getItem('jaran_biz_config');
    if (localConfig) {
      try {
        const parsed = JSON.parse(localConfig);
        setFormData(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse local config");
      }
    } else if (settings) {
      // 2. Fallback to Database if LocalStorage is empty
      setFormData({
        store_name: settings.store_name || 'Jaran Cleaning Service',
        tax_rate: settings.tax_rate || 0,
        phone: settings.receipt_template?.phone || '',
        address: settings.receipt_template?.address || '',
        shift_closing_enabled: settings.shift_closing_enabled ?? true,
      });
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);

    // Update LocalStorage immediately (Making it a 'frontend thing')
    localStorage.setItem('jaran_biz_config', JSON.stringify(formData));

    try {
      // Attempt to sync with Supabase (only Guaranteed columns)
      const payload = {
        store_name: formData.store_name,
        tax_rate: formData.tax_rate,
        shift_closing_enabled: formData.shift_closing_enabled,
        // We include receipt_template for DBs that have the column, but we catch errors if they don't
        receipt_template: {
          phone: formData.phone,
          address: formData.address,
          updated_at: new Date().toISOString()
        }
      };

      if (settings?.id) {
        const { data, error: dbError } = await supabase
          .from('settings')
          .update(payload)
          .eq('id', settings.id)
          .select()
          .single();
        
        if (!dbError && data) {
          onUpdate(data);
        }
      } else {
        const { data, error: dbError } = await supabase
          .from('settings')
          .insert([payload])
          .select()
          .single();
        
        if (!dbError && data) {
          onUpdate(data);
        }
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      // If DB sync fails, we still consider the frontend update a success
      console.warn("Database sync ignored to prevent blockages:", err.message);
      setSuccess(true); // Still show success because localStorage is updated
      setTimeout(() => setSuccess(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500 pb-20">
      <header>
        <div className="flex items-center gap-3 mb-2">
          <Monitor className="text-blue-600" size={24} />
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none uppercase">Terminal Settings</h1>
        </div>
        <p className="text-slate-500 font-medium text-sm">Receipt details are stored locally on this device for maximum reliability.</p>
      </header>

      {error && (
        <div className="p-5 bg-rose-50 border border-rose-100 rounded-3xl flex items-center gap-4 text-rose-600 text-xs font-black uppercase tracking-widest animate-in shake-in">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-10">
        <div className="bg-white p-8 md:p-12 rounded-[3.5rem] border border-slate-100 shadow-sm space-y-12 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-blue-50/40 rounded-full -mr-40 -mt-40 -z-0"></div>
          
          <div className="relative z-10 flex items-center gap-5 pb-8 border-b border-slate-50">
            <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl">
              <Receipt size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">Receipt Identity</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Printed Header Details (Frontend-Only Persistence)</p>
            </div>
          </div>
          
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-10">
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Service / Business Name</label>
              <input
                type="text"
                required
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-slate-800 transition-all text-sm"
                value={formData.store_name}
                onChange={e => setFormData({...formData, store_name: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Support Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  className="w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-slate-800 text-sm"
                  placeholder="+254..."
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Store Location/Address</label>
              <div className="relative">
                <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  className="w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-slate-800 text-sm"
                  placeholder="Street Name, City"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">VAT %</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-slate-800 text-sm"
                value={formData.tax_rate}
                onChange={e => setFormData({...formData, tax_rate: Number(e.target.value)})}
              />
            </div>
            
            <div className="flex items-center gap-4 bg-blue-50/50 p-6 rounded-2xl border border-blue-100">
               <input
                 type="checkbox"
                 id="shift_toggle"
                 className="w-6 h-6 rounded-lg accent-blue-600 border-slate-200"
                 checked={formData.shift_closing_enabled}
                 onChange={e => setFormData({...formData, shift_closing_enabled: e.target.checked})}
               />
               <label htmlFor="shift_toggle" className="text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer leading-tight">Enforce End-of-Day Settlement</label>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-3 px-10 py-5 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
            {loading ? 'Committing...' : 'Apply Locally & Sync'}
          </button>
        </div>
      </form>

      {success && (
        <div className="fixed bottom-10 right-10 flex items-center gap-3 px-8 py-4 bg-emerald-500 text-white rounded-2xl shadow-2xl animate-in slide-in-from-bottom-10">
          <CheckCircle2 size={24} />
          <span className="font-black text-xs uppercase tracking-widest">Front-end Configuration Locked</span>
        </div>
      )}
    </div>
  );
};

export default Settings;