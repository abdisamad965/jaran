
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  History,
  Clock,
  LogOut,
  Play,
  FileText,
  Filter,
  Trash2,
  Undo2,
  RefreshCw,
  Loader2,
  ChevronRight
} from 'lucide-react';
import { Shift, User as UserType } from '../types';

interface ShiftsProps {
  user: UserType;
}

const Shifts: React.FC<ShiftsProps> = ({ user }) => {
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [activeShiftSales, setActiveShiftSales] = useState<any[]>([]);
  const [history, setHistory] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [filterDate, setFilterDate] = useState('');

  // Helper for EAT Time (UTC+3)
  const getEATTime = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 3));
  };

  useEffect(() => {
    fetchShifts();
  }, [filterDate]);

  const fetchShifts = async () => {
    setLoading(true);
    try {
      const { data: active } = await supabase
        .from('shifts')
        .select('*, user:users(*)')
        .eq('closed', false)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      setActiveShift(active || null);

      if (active) {
        const { data: currentSales } = await supabase
          .from('sales')
          .select('*, sale_items(*, product:products(name))')
          .eq('shift_id', active.id)
          .order('sale_date', { ascending: false });
        setActiveShiftSales(currentSales || []);
      } else {
        setActiveShiftSales([]);
      }

      let query = supabase
        .from('shifts')
        .select('*, user:users(*)')
        .eq('closed', true)
        .order('end_time', { ascending: false });

      if (filterDate) {
        query = query.gte('start_time', `${filterDate}T00:00:00`).lte('start_time', `${filterDate}T23:59:59`);
      }

      const { data: past } = await query.limit(30);
      if (past) setHistory(past);
    } catch (err) {
      console.error("Shift load error:", err);
    } finally {
      setLoading(false);
    }
  };

  const startShift = async () => {
    if (activeShift) return;
    setIsProcessing(true);
    try {
      // Create session using current EAT time
      const startTime = getEATTime().toISOString();
      const { data, error } = await supabase
        .from('shifts')
        .insert([{
          user_id: user.id,
          start_time: startTime,
          total_sales: 0,
          total_cash: 0,
          total_card: 0,
          closed: false
        }])
        .select()
        .single();
      
      if (error) throw error;
      await fetchShifts();
    } catch (err: any) {
      alert("Failed to start shift: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeShift = async () => {
    if (!activeShift) return;
    if (!confirm("Finalize EAT Settlement and Close Terminal Session?")) return;

    setIsProcessing(true);
    try {
      const { data: sales } = await supabase.from('sales').select('total_amount, payment_method').eq('shift_id', activeShift.id);
      const totalSales = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
      const totalCash = sales?.filter(s => s.payment_method === 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
      const totalCard = sales?.filter(s => s.payment_method !== 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;

      const { error } = await supabase
        .from('shifts')
        .update({
          closed: true,
          end_time: getEATTime().toISOString(),
          total_sales: totalSales,
          total_cash: totalCash,
          total_card: totalCard
        })
        .eq('id', activeShift.id);

      if (error) throw error;
      
      await fetchShifts();
      alert("Shift settled successfully. Terminal ready for new session.");
    } catch (err: any) {
      alert(`Audit Failure: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoidSale = async (sale: any) => {
    if (!confirm(`Void Transaction #${sale.id.slice(0,8).toUpperCase()}?`)) return;
    setIsProcessing(true);
    try {
      await supabase.from('sale_items').delete().eq('sale_id', sale.id);
      await supabase.from('sales').delete().eq('id', sale.id);
      await fetchShifts();
      alert("Transaction voided.");
    } catch (err: any) {
      alert("Void failed.");
    } finally {
      setIsProcessing(false);
    }
  };

  const formatEAT = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-KE', { 
      timeZone: 'Africa/Nairobi',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Session Control</h1>
          <p className="text-slate-500 font-medium mt-2 text-sm uppercase tracking-widest text-[10px]">Current Time: {getEATTime().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} EAT</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
             <Filter className="text-blue-500" size={18} />
             <input 
               type="date" 
               className="bg-transparent border-none text-xs font-black outline-none cursor-pointer text-slate-700"
               value={filterDate}
               onChange={e => setFilterDate(e.target.value)}
             />
           </div>
        </div>
      </header>

      {/* Primary Terminal Control */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className={`lg:col-span-9 p-12 rounded-[3.5rem] border shadow-sm transition-all duration-500 relative overflow-hidden ${activeShift ? 'bg-slate-950 text-white border-blue-500/20 shadow-2xl shadow-blue-500/10' : 'bg-white text-slate-900 border-slate-100'}`}>
          <div className="flex flex-col justify-between h-full relative z-10">
            <div className="flex items-start justify-between mb-16">
              <div className="flex items-center gap-6">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all ${activeShift ? 'bg-blue-600 shadow-xl shadow-blue-500/40' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                  {isProcessing ? <Loader2 size={32} className="animate-spin" /> : <Clock size={32} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">{activeShift ? 'Session Live' : 'Station Idle'}</h2>
                  <p className={`font-bold text-[10px] uppercase tracking-widest ${activeShift ? 'text-blue-400' : 'text-slate-400'}`}>
                    {activeShift ? `OPERATOR: ${activeShift.user?.name} • EAT START: ${formatEAT(activeShift.start_time)}` : 'Handover Complete • Awaiting Activation'}
                  </p>
                </div>
              </div>
            </div>

            {activeShift && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Net Sales (EAT Session)</p>
                  <p className="text-3xl font-black tracking-tighter">KSh {Number(activeShift.total_sales).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Cash Balance</p>
                  <p className="text-3xl font-black tracking-tighter">KSh {Number(activeShift.total_cash).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Digital (Mpesa/Card)</p>
                  <p className="text-3xl font-black text-blue-400 tracking-tighter">KSh {Number(activeShift.total_card).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
          {!activeShift ? (
            <button onClick={startShift} disabled={isProcessing} className="flex-1 p-10 bg-blue-600 text-white rounded-[3rem] shadow-2xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex flex-col items-center justify-center gap-5 group active:scale-95">
              <Play size={40} />
              <span className="font-black uppercase tracking-widest text-[11px]">Open Terminal</span>
            </button>
          ) : (
            <button onClick={closeShift} disabled={isProcessing} className="flex-1 p-10 bg-rose-600 text-white rounded-[3rem] shadow-2xl shadow-rose-500/20 hover:bg-rose-700 transition-all flex flex-col items-center justify-center gap-5 group active:scale-95">
              <LogOut size={40} />
              <span className="font-black uppercase tracking-widest text-[11px]">Final Settlement</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Session Ledger */}
      {activeShift && (
        <section className="space-y-6">
           <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest px-6">Live Session Transaction Journal</h3>
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
             <table className="w-full text-left">
               <thead className="bg-slate-50/50 border-b border-slate-100 font-black text-slate-500 text-[10px] uppercase tracking-widest">
                 <tr>
                   <th className="px-10 py-5">EAT Time</th>
                   <th className="px-10 py-5">Reference</th>
                   <th className="px-10 py-5 text-right">Amount</th>
                   <th className="px-10 py-5 text-right">Action</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {activeShiftSales.map(sale => (
                   <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-10 py-5 text-sm font-bold text-slate-600 tabular-nums">{new Date(sale.sale_date).toLocaleTimeString([], {timeZone: 'Africa/Nairobi', hour:'2-digit', minute:'2-digit'})}</td>
                     <td className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">#{sale.id.slice(0,8).toUpperCase()}</td>
                     <td className="px-10 py-5 text-right font-black text-slate-900 tabular-nums">KSh {Number(sale.total_amount).toLocaleString()}</td>
                     <td className="px-10 py-5 text-right">
                        <button onClick={() => handleVoidSale(sale)} className="px-4 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all">Void</button>
                     </td>
                   </tr>
                 ))}
                 {activeShiftSales.length === 0 && (
                   <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-black uppercase tracking-widest text-[10px] italic opacity-30">Journal Empty.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </section>
      )}

      {/* History */}
      <section className="space-y-6">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-6">Audit Archives (Last 30 Sessions)</h3>
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-500 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-10 py-5">Operator</th>
                <th className="px-10 py-5 text-center">EAT Date</th>
                <th className="px-10 py-5 text-right">Revenue Collected</th>
                <th className="px-10 py-5 text-right">Audit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-10 py-5 font-black text-slate-900 uppercase tracking-tight">{s.user?.name}</td>
                  <td className="px-10 py-5 text-center font-bold text-slate-500 tabular-nums">{new Date(s.start_time).toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi', day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-10 py-5 text-right font-black text-slate-900 tabular-nums">KSh {Number(s.total_sales).toLocaleString()}</td>
                  <td className="px-10 py-5 text-right">
                    <button className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                       <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Shifts;
    