import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Save, 
  MapPin,
  Phone,
  Receipt,
  CheckCircle2,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Settings as SettingsType } from '../types';

interface SettingsProps {
  settings: SettingsType | null;
  onUpdate: (s: SettingsType) => void;
}

const Settings: React.FC<SettingsProps> = ({ settings, onUpdate }) => {
  const [formData, setFormData] = useState<Partial<SettingsType>>({
    store_name: 'Jaran Cleaning Service',
    tax_rate: 0,
    phone: '',
    location: '',
    shift_closing_enabled: true,
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    setError(null);
    try {
      let result;
      if (settings?.id) {
        result = await supabase
          .from('settings')
          .update({
            store_name: formData.store_name,
            tax_rate: formData.tax_rate,
            phone: formData.phone,
            location: formData.location,
            shift_closing_enabled: formData.shift_closing_enabled
          })
          .eq('id', settings.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('settings')
          .insert([{
            store_name: formData.store_name,
            tax_rate: formData.tax_rate,
            phone: formData.phone,
            location: formData.location,
            shift_closing_enabled: formData.shift_closing_enabled,
            receipt_template: {}
          }])
          .select()
          .single();
      }

      if (result.error) throw result.error;
      if (result.data) {
        onUpdate(result.data);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(`Failed to save: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2 uppercase">System Configuration</h1>
        <p className="text-slate-500 font-medium text-sm">Manage business identity and tax compliance settings.</p>
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
            <div className="p-4 bg-blue-600 text-white rounded-2xl shadow-xl shadow-blue-500/20">
              <Receipt size={28} />
            </div>
            <div>
              <h3 className="text-xl font-black uppercase tracking-tight leading-none mb-1">Business Identity</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receipt and legal details</p>
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
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Customer Support Phone</label>
              <div className="relative">
                <Phone className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  className="w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-slate-800 text-sm"
                  placeholder="+254..."
                  value={formData.phone || ''}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Physical Address</label>
              <div className="relative">
                <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  className="w-full pl-16 pr-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-slate-800 text-sm"
                  placeholder="Street, City"
                  value={formData.location || ''}
                  onChange={e => setFormData({...formData, location: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">VAT Percentage (%)</label>
              <input
                type="number"
                step="0.01"
                className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-black text-slate-800 text-sm"
                value={formData.tax_rate}
                onChange={e => setFormData({...formData, tax_rate: Number(e.target.value)})}
              />
            </div>

            <div className="flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100">
               <input
                 type="checkbox"
                 id="shift_toggle"
                 className="w-6 h-6 rounded-lg accent-blue-600 border-slate-200"
                 checked={formData.shift_closing_enabled}
                 onChange={e => setFormData({...formData, shift_closing_enabled: e.target.checked})}
               />
               <label htmlFor="shift_toggle" className="text-[10px] font-black text-slate-600 uppercase tracking-widest cursor-pointer leading-tight">Enforce Daily Shift Sessions</label>
            </div>
          </div>
        </div>

        <div className="flex justify-end items-center gap-6">
          {success && (
            <div className="flex items-center gap-2 text-emerald-600 font-black text-[10px] uppercase tracking-widest animate-in fade-in slide-in-from-right-2">
              <CheckCircle2 size={20} /> Update Committed
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="px-10 py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-slate-200 hover:bg-black transition-all flex items-center gap-3 active:scale-[0.98] disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="animate-spin" size={20} />
            ) : (
              <><Save size={20} /> Save Configuration</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;