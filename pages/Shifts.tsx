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
      const { data, error } = await supabase
        .from('shifts')
        .insert([{
          user_id: user.id,
          start_time: new Date().toISOString(),
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

  const handleVoidSale = async (sale: any) => {
    if (!confirm(`Void Transaction #${sale.id.slice(0,8).toUpperCase()}? This will restore stock levels.`)) return;
    
    setIsProcessing(true);
    try {
      if (sale.sale_items) {
        for (const item of sale.sale_items) {
          const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          if (prod) {
            await supabase.from('products').update({ stock_quantity: prod.stock_quantity + item.quantity }).eq('id', item.product_id);
          }
        }
      }

      await supabase.from('sale_items').delete().eq('sale_id', sale.id);
      await supabase.from('sales').delete().eq('id', sale.id);

      if (activeShift) {
        const { data: remainingSales } = await supabase.from('sales').select('total_amount, payment_method').eq('shift_id', activeShift.id);
        const totalSales = remainingSales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        const totalCash = remainingSales?.filter(s => s.payment_method === 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        const totalCard = remainingSales?.filter(s => s.payment_method !== 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;

        await supabase.from('shifts').update({
          total_sales: totalSales,
          total_cash: totalCash,
          total_card: totalCard
        }).eq('id', activeShift.id);
      }

      await fetchShifts();
      alert("Sale voided successfully.");
    } catch (err: any) {
      alert("Void failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeShift = async () => {
    if (!activeShift) return;
    if (!confirm("Confirm final settlement and session closure?")) return;

    setIsProcessing(true);
    try {
      // Fetch latest sales to ensure totals are perfectly accurate
      const { data: sales } = await supabase.from('sales').select('total_amount, payment_method').eq('shift_id', activeShift.id);
      const totalSales = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
      const totalCash = sales?.filter(s => s.payment_method === 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
      const totalCard = sales?.filter(s => s.payment_method !== 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;

      // CRITICAL: We only send columns GUARANTEED to be in the database.
      // Removed 'total_cogs', 'total_mpesa', and 'total_expenses' to prevent Schema Cache errors.
      const { error } = await supabase
        .from('shifts')
        .update({
          closed: true,
          end_time: new Date().toISOString(),
          total_sales: totalSales,
          total_cash: totalCash,
          total_card: totalCard
        })
        .eq('id', activeShift.id);

      if (error) throw error;
      
      await fetchShifts();
      alert("Shift settled and closed successfully.");
    } catch (err: any) {
      alert(`Audit Failure: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportCSV = (shift: Shift) => {
    const rows = [
      ['Audit Field', 'Value'],
      ['Operator', shift.user?.name || 'N/A'],
      ['Start', new Date(shift.start_time).toLocaleString()],
      ['End', shift.end_time ? new Date(shift.end_time).toLocaleString() : 'N/A'],
      ['Total Sales', shift.total_sales],
      ['Cash Intake', shift.total_cash],
      ['Digital Intake', shift.total_card]
    ];
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `audit_${shift.id.slice(0,8)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Terminal Sessions</h1>
          <p className="text-slate-500 font-medium mt-2 text-sm">Review daily closures and resolve transaction discrepancies.</p>
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
           <button onClick={() => setFilterDate('')} className="p-4 bg-white text-slate-400 border border-slate-100 rounded-2xl hover:text-rose-500 transition-all shadow-sm">
             <Trash2 size={18} />
           </button>
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
                  <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">{activeShift ? 'Terminal Active' : 'Station Idle'}</h2>
                  <p className={`font-bold text-[10px] uppercase tracking-widest ${activeShift ? 'text-blue-400' : 'text-slate-400'}`}>
                    {activeShift ? `OPERATOR: ${activeShift.user?.name} • SINCE: ${new Date(activeShift.start_time).toLocaleTimeString()}` : 'Ready for shift activation'}
                  </p>
                </div>
              </div>
              {activeShift && <span className="flex items-center gap-2 bg-emerald-500/10 text-emerald-400 px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 animate-pulse">Live Feed</span>}
            </div>

            {activeShift && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Gross Session Sales</p>
                  <p className="text-3xl font-black tracking-tighter">KSh {Number(activeShift.total_sales).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Expected Cash</p>
                  <p className="text-3xl font-black tracking-tighter">KSh {Number(activeShift.total_cash).toLocaleString()}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">Digital Inflow</p>
                  <p className="text-3xl font-black text-blue-400 tracking-tighter">KSh {Number(activeShift.total_card).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
          {!activeShift ? (
            <button onClick={startShift} disabled={isProcessing} className="flex-1 p-10 bg-blue-600 text-white rounded-[3rem] shadow-2xl shadow-blue-500/20 hover:bg-blue-700 transition-all flex flex-col items-center justify-center gap-5 group active:scale-95">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play size={32} />
              </div>
              <span className="font-black uppercase tracking-widest text-[11px]">Open Station</span>
            </button>
          ) : (
            <button onClick={closeShift} disabled={isProcessing} className="flex-1 p-10 bg-rose-600 text-white rounded-[3rem] shadow-2xl shadow-rose-500/20 hover:bg-rose-700 transition-all flex flex-col items-center justify-center gap-5 group active:scale-95">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <LogOut size={32} />
              </div>
              <span className="font-black uppercase tracking-widest text-[11px]">End Session</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Session Transaction Ledger */}
      {activeShift && (
        <section className="space-y-6 animate-in slide-in-from-bottom-5">
           <div className="flex items-center justify-between px-6">
              <div className="flex items-center gap-3">
                <RefreshCw className="text-blue-500" size={18} />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-widest leading-none">Live Session Ledger</h3>
              </div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Action required for transaction errors</p>
           </div>
           <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
             <table className="w-full text-left">
               <thead className="bg-slate-50/50 border-b border-slate-100">
                 <tr>
                   <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Timestamp</th>
                   <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">ID Reference</th>
                   <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Net Amount</th>
                   <th className="px-10 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Adjustment</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                 {activeShiftSales.map(sale => (
                   <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors">
                     <td className="px-10 py-5 text-sm font-bold text-slate-600 tabular-nums">{new Date(sale.sale_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</td>
                     <td className="px-10 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">#{sale.id.slice(0,8).toUpperCase()}</td>
                     <td className="px-10 py-5 text-right font-black text-slate-900 tabular-nums">KSh {Number(sale.total_amount).toLocaleString()}</td>
                     <td className="px-10 py-5 text-right">
                        <button onClick={() => handleVoidSale(sale)} className="px-5 py-2.5 bg-rose-50 text-rose-600 rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-rose-600 hover:text-white transition-all border border-rose-100 active:scale-95 flex items-center gap-2 ml-auto shadow-sm">
                           <Undo2 size={14} /> Void Transaction
                        </button>
                     </td>
                   </tr>
                 ))}
                 {activeShiftSales.length === 0 && (
                   <tr><td colSpan={4} className="p-20 text-center text-slate-300 font-bold uppercase tracking-widest text-[10px] italic opacity-30">No transaction records detected in current stream.</td></tr>
                 )}
               </tbody>
             </table>
           </div>
        </section>
      )}

      {/* Historical Audit Archives */}
      <section className="space-y-6">
        <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest px-6">Audit Archive</h3>
        <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 font-black text-slate-500 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-10 py-5">Session Operator</th>
                <th className="px-10 py-5 text-center">Calendar Date</th>
                <th className="px-10 py-5 text-right">Final Revenue</th>
                <th className="px-10 py-5 text-right">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-10 py-5 font-black text-slate-900 uppercase tracking-tight">{s.user?.name}</td>
                  <td className="px-10 py-5 text-center font-bold text-slate-500 tabular-nums">{new Date(s.start_time).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                  <td className="px-10 py-5 text-right font-black text-slate-900 tabular-nums">KSh {Number(s.total_sales).toLocaleString()}</td>
                  <td className="px-10 py-5 text-right">
                    <button onClick={() => exportCSV(s)} className="p-3 bg-slate-100 text-slate-500 rounded-xl hover:bg-slate-900 hover:text-white transition-all shadow-sm">
                       <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && !loading && (
                <tr>
                   <td colSpan={4} className="p-40 text-center flex flex-col items-center gap-4 opacity-10">
                      <History size={64} />
                      <p className="font-black text-xs uppercase tracking-[0.3em]">Archives Clean</p>
                   </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default Shifts;