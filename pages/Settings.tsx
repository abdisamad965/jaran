import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Store, 
  Settings as SettingsIcon, 
  Save, 
  MapPin,
  Phone,
  Receipt,
  CheckCircle2,
  AlertCircle,
  Trash2,
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
  const [isWiping, setIsWiping] = useState(false);

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

  const wipeAllData = async () => {
    const confirmation = window.confirm("CRITICAL WARNING: This will permanently WIPE ALL data (Products, Sales, Expenses, Suppliers, Shifts). This action CANNOT be undone. Are you absolutely sure?");
    if (!confirmation) return;

    const secondConfirmation = window.prompt("Type 'DELETE EVERYTHING' to confirm total system wipe:");
    if (secondConfirmation !== 'DELETE EVERYTHING') return;

    setIsWiping(true);
    try {
      // Step-by-step deletion following foreign key hierarchy (Child to Parent)
      const epochDate = '1970-01-01T00:00:00Z';
      
      console.log("Starting full system wipe sequence...");
      
      // 1. Delete items inside sales first (Child of Sales)
      await supabase.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // 2. Delete sales records (Child of Shifts)
      await supabase.from('sales').delete().gt('created_at', epochDate);
      
      // 3. Delete expense records (Child of Shifts)
      await supabase.from('expenses').delete().gt('created_at', epochDate);
      
      // 4. Delete shift sessions (Child of Users)
      await supabase.from('shifts').delete().gt('created_at', epochDate);
      
      // 5. Delete products (Child of Suppliers)
      await supabase.from('products').delete().gt('created_at', epochDate);
      
      // 6. Delete supplier transaction history
      await supabase.from('supplier_payments').delete().gt('created_at', epochDate);
      
      // 7. Finally delete suppliers
      await supabase.from('suppliers').delete().gt('created_at', epochDate);
      
      console.log("System wipe complete.");
      alert("All business data has been purged. The application will now refresh.");
      window.location.reload();
    } catch (err: any) {
      console.error("Data Purge Error:", err);
      alert(`Wipe Failed: ${err.message}. Check browser console for details.`);
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-black text-slate-900 tracking-tighter leading-none mb-2 uppercase">System Configuration</h1>
        <p className="text-slate-500 font-medium text-sm">Manage business identity, tax compliance, and data lifecycle.</p>
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

      {/* Danger Zone */}
      <div className="mt-20 border-t border-slate-200 pt-16">
        <div className="bg-rose-50 border border-rose-100 p-8 md:p-10 rounded-[3rem] space-y-6">
           <div className="flex items-center gap-4">
              <div className="p-3 bg-rose-600 text-white rounded-xl">
                 <Trash2 size={24} />
              </div>
              <div>
                 <h3 className="text-lg font-black text-rose-900 uppercase tracking-tight">System Data Purge</h3>
                 <p className="text-xs font-bold text-rose-500 uppercase tracking-widest">DANGER ZONE • DESTRUCTIVE ACTION</p>
              </div>
           </div>
           <p className="text-sm font-medium text-rose-800 max-w-2xl leading-relaxed">
             Wiping all data will reset the system to a clean state. This deletes all transaction history, expenses, supplier ledgers, and products. This action follows database referential integrity rules.
           </p>
           <button 
             onClick={wipeAllData}
             disabled={isWiping}
             className="px-10 py-5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-rose-200 transition-all flex items-center gap-3 active:scale-95 disabled:opacity-50"
           >
             {isWiping ? <RefreshCw className="animate-spin" size={18} /> : <><Trash2 size={18} /> Wipe System Data</>}
           </button>
        </div>
      </div>
    </div>
  );
};

export default Settings;