import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Calendar, 
  History,
  Download,
  AlertCircle,
  Clock,
  LogOut,
  Play,
  TrendingUp,
  CreditCard,
  Banknote,
  Smartphone,
  ChevronRight,
  FileText,
  DollarSign,
  Filter,
  CheckCircle2,
  Trash2,
  Undo2,
  RefreshCw,
  Loader2
} from 'lucide-react';
import { Shift, User as UserType, Sale } from '../types';

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
      // Use standard columns first, catch if extended ones fail
      const payload = {
        user_id: user.id,
        start_time: new Date().toISOString(),
        total_sales: 0,
        total_cash: 0,
        total_card: 0,
        closed: false
      };

      const { data, error } = await supabase
        .from('shifts')
        .insert([payload])
        .select()
        .single();
      
      if (error) throw error;
      await fetchShifts();
    } catch (err: any) {
      alert("Terminal Activation Failure: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoidSale = async (sale: any) => {
    if (!confirm(`Are you sure you want to VOID transaction #${sale.id.slice(0,8).toUpperCase()}? This will restore stock levels and remove the sale from records.`)) return;
    
    setIsProcessing(true);
    try {
      if (sale.sale_items && sale.sale_items.length > 0) {
        for (const item of sale.sale_items) {
          const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
          if (prod) {
            await supabase.from('products').update({ stock_quantity: prod.stock_quantity + item.quantity }).eq('id', item.product_id);
          }
        }
      }

      await supabase.from('sale_items').delete().eq('sale_id', sale.id);
      const { error: deleteError } = await supabase.from('sales').delete().eq('id', sale.id);
      if (deleteError) throw deleteError;

      if (activeShift) {
        const { data: remainingSales } = await supabase.from('sales').select('total_amount, payment_method').eq('shift_id', activeShift.id);
        
        const newTotal = remainingSales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        const newCash = remainingSales?.filter(s => s.payment_method === 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        const newCard = remainingSales?.filter(s => s.payment_method === 'card').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        const newMpesa = remainingSales?.filter(s => s.payment_method === 'mpesa').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;

        // Use a safe update here too
        const updatePayload: any = {
          total_sales: newTotal,
          total_cash: newCash,
          total_card: newCard
        };

        // Try adding mpesa if it exists
        try { await supabase.from('shifts').update({...updatePayload, total_mpesa: newMpesa}).eq('id', activeShift.id); }
        catch (e) { await supabase.from('shifts').update(updatePayload).eq('id', activeShift.id); }
      }

      await fetchShifts();
      alert("Transaction voided and stock restored.");
    } catch (err: any) {
      console.error("Void error:", err);
      alert("Error voiding transaction: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const closeShift = async () => {
    if (!activeShift) return;
    if (!confirm("Confirm final settlement audit and terminal closure?")) return;

    setIsProcessing(true);
    try {
      const { data: sales } = await supabase
        .from('sales')
        .select('id, total_amount, payment_method')
        .eq('shift_id', activeShift.id);

      const totalSales = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
      const totalCash = sales?.filter(s => s.payment_method === 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
      const totalCard = sales?.filter(s => s.payment_method === 'card').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
      const totalMpesa = sales?.filter(s => s.payment_method === 'mpesa').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
      
      const { data: expenses } = await supabase.from('expenses').select('amount').eq('shift_id', activeShift.id);
      const totalExpenses = expenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0;

      let totalCogs = 0;
      const saleIds = sales?.map(s => s.id) || [];
      if (saleIds.length > 0) {
        const { data: saleItems } = await supabase.from('sale_items').select('quantity, product:products(cost_price)').in('sale_id', saleIds);
        saleItems?.forEach((item: any) => { totalCogs += (Number(item.product?.cost_price || 0) * item.quantity); });
      }

      // 1. ATTEMPT FULL AUDIT UPDATE
      const fullPayload = {
        closed: true,
        end_time: new Date().toISOString(),
        total_sales: totalSales,
        total_cash: totalCash,
        total_card: totalCard,
        total_mpesa: totalMpesa,
        total_expenses: totalExpenses,
        total_cogs: totalCogs
      };

      const { error: fullError } = await supabase
        .from('shifts')
        .update(fullPayload)
        .eq('id', activeShift.id);

      if (fullError) {
        console.warn("Full audit failed, retrying with core columns...", fullError.message);
        
        // 2. RETRY WITH SAFE PAYLOAD (Columns guaranteed to exist)
        const safePayload = {
          closed: true,
          end_time: new Date().toISOString(),
          total_sales: totalSales,
          total_cash: totalCash,
          total_card: totalCard
        };

        const { error: safeError } = await supabase
          .from('shifts')
          .update(safePayload)
          .eq('id', activeShift.id);

        if (safeError) throw safeError;
      }
      
      await fetchShifts();
      alert("Terminal settled. Audit complete.");
    } catch (err: any) {
      console.error("Closure audit failed:", err);
      alert(`Critical Audit Failure: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const exportCSV = (shift: Shift) => {
    const profit = Number(shift.total_sales) - Number(shift.total_expenses || 0) - Number(shift.total_cogs || 0);
    const rows = [
      ['Report Detail', 'Value'],
      ['Operator', shift.user?.name || 'N/A'],
      ['Start', new Date(shift.start_time).toLocaleString()],
      ['End', shift.end_time ? new Date(shift.end_time).toLocaleString() : 'N/A'],
      ['Total Sales', shift.total_sales],
      ['Net Profit', profit]
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
        <div className="flex items-center gap-4">
           <div className="w-14 h-14 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-xl">
             <Clock size={32} />
           </div>
           <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Session Manager</h1>
            <p className="text-slate-500 font-medium mt-1">Daily settlement and transaction auditing.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <div className="bg-white px-5 py-3 rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
             <Filter className="text-blue-500" size={18} />
             <input 
               type="date" 
               className="bg-transparent border-none text-xs font-black outline-none cursor-pointer"
               value={filterDate}
               onChange={e => setFilterDate(e.target.value)}
             />
           </div>
           <button onClick={() => setFilterDate('')} className="p-4 bg-white text-slate-400 border border-slate-100 rounded-2xl hover:text-rose-500 transition-colors shadow-sm">
             <Trash2 size={18} />
           </button>
        </div>
      </header>

      {/* Manual Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className={`lg:col-span-9 p-12 rounded-[3.5rem] border shadow-sm relative overflow-hidden transition-all duration-500 ${activeShift ? 'bg-slate-900 text-white border-blue-500/30 shadow-2xl shadow-blue-900/10' : 'bg-white text-slate-900 border-slate-100'}`}>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div className="flex items-start justify-between mb-12">
              <div className="flex items-center gap-5">
                <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center ${activeShift ? 'bg-blue-600 shadow-xl shadow-blue-900/40' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
                  {isProcessing ? <Loader2 size={32} className="animate-spin" /> : <Clock size={32} className={activeShift ? 'animate-pulse' : ''} />}
                </div>
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tight leading-none mb-2">{activeShift ? 'Terminal Active' : 'Station Idle'}</h2>
                  <p className={`font-bold text-[10px] uppercase tracking-widest ${activeShift ? 'text-blue-400' : 'text-slate-400'}`}>
                    {activeShift ? `OPERATOR: ${activeShift.user?.name} • SINCE ${new Date(activeShift.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Terminal ready for activation.'}
                  </p>
                </div>
              </div>
              {activeShift && (
                <div className="flex items-center gap-2">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                   <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Live</span>
                </div>
              )}
            </div>

            {activeShift && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Unsettled Gross</p>
                  <p className="text-2xl font-black">KSh {Number(activeShift.total_sales).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Cash Balance</p>
                  <p className="text-2xl font-black">KSh {Number(activeShift.total_cash).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Digital Intake</p>
                  <p className="text-2xl font-black">KSh {(Number(activeShift.total_card || 0) + Number(activeShift.total_mpesa || 0)).toLocaleString()}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operating Costs</p>
                  <p className="text-2xl font-black text-rose-500">KSh {Number(activeShift.total_expenses || 0).toLocaleString()}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-3 flex flex-col gap-4">
          {!activeShift ? (
            <button 
              onClick={startShift}
              disabled={isProcessing}
              className="flex-1 p-10 bg-blue-600 text-white rounded-[3rem] shadow-2xl shadow-blue-500/20 flex flex-col items-center justify-center gap-5 group hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <Play size={40} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black uppercase tracking-tight">Open Terminal</h3>
              </div>
            </button>
          ) : (
            <button 
              onClick={closeShift}
              disabled={isProcessing}
              className="flex-1 p-10 bg-rose-600 text-white rounded-[3rem] shadow-2xl shadow-rose-500/20 flex flex-col items-center justify-center gap-5 group hover:bg-rose-700 transition-all active:scale-95 disabled:opacity-50"
            >
              <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                <LogOut size={40} />
              </div>
              <div className="text-center">
                <h3 className="text-xl font-black uppercase tracking-tight">End Session</h3>
                <p className="text-rose-100 text-[10px] font-black mt-1 uppercase tracking-widest opacity-60">Settle & Close</p>
              </div>
            </button>
          )}
        </div>
      </div>

      {/* Active Session Ledger (Void Sales) */}
      {activeShift && (
        <section className="space-y-6 animate-in slide-in-from-bottom-5">
           <div className="flex items-center justify-between px-6">
            <div className="flex items-center gap-3">
               <RefreshCw className="text-blue-500 animate-spin-slow" size={20} />
               <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em]">Active Session Transactions</h3>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
              Void mistakes here to restore stock
            </p>
          </div>

          <div className="bg-white rounded-[3rem] border border-blue-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-blue-50/50 border-b border-blue-100">
                <tr>
                  <th className="px-10 py-6 text-[10px] font-black text-blue-600 uppercase tracking-widest">Time</th>
                  <th className="px-10 py-6 text-[10px] font-black text-blue-600 uppercase tracking-widest">Reference</th>
                  <th className="px-10 py-6 text-[10px] font-black text-blue-600 uppercase tracking-widest">Items</th>
                  <th className="px-10 py-6 text-[10px] font-black text-blue-600 uppercase tracking-widest text-right">Amount</th>
                  <th className="px-10 py-6 text-[10px] font-black text-blue-600 uppercase tracking-widest text-right">Control</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeShiftSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-blue-50/20 transition-colors group">
                    <td className="px-10 py-6 text-sm font-black text-slate-700 tabular-nums">
                      {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-10 py-6">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">#{sale.id.slice(0, 8).toUpperCase()}</p>
                    </td>
                    <td className="px-10 py-6">
                       <p className="text-xs font-bold text-slate-600 truncate max-w-[200px]">
                         {sale.sale_items?.map((i: any) => i.product?.name).join(', ')}
                       </p>
                    </td>
                    <td className="px-10 py-6 text-right font-black text-slate-900">KSh {Number(sale.total_amount).toLocaleString()}</td>
                    <td className="px-10 py-6 text-right">
                       <button 
                        onClick={() => handleVoidSale(sale)}
                        disabled={isProcessing}
                        className="px-5 py-2.5 bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white rounded-xl transition-all font-black text-[9px] uppercase tracking-widest flex items-center gap-2 ml-auto border border-rose-100 active:scale-95"
                       >
                         <Undo2 size={14} /> Void Transaction
                       </button>
                    </td>
                  </tr>
                ))}
                {activeShiftSales.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-10 py-16 text-center text-slate-300 italic text-[10px] font-black uppercase tracking-widest opacity-30">
                      No transactions recorded in this session.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* History Ledger */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
             <History className="text-slate-400" size={20} />
             <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Audit Ledger</h3>
          </div>
        </div>

        <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest">Operator</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Date</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Revenue</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Status</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {history.map(s => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-10 py-6">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-[1.25rem] bg-slate-900 text-white flex items-center justify-center font-black text-sm shadow-lg">
                        {s.user?.name?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 tracking-tight">{s.user?.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {s.id.slice(0, 5)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-10 py-6 text-center">
                     <p className="text-sm font-black text-slate-900 leading-none mb-1">{new Date(s.start_time).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</p>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       {new Date(s.start_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                     </p>
                  </td>
                  <td className="px-10 py-6 text-right font-black text-slate-900 tabular-nums">
                    KSh {Number(s.total_sales).toLocaleString()}
                  </td>
                  <td className="px-10 py-6 text-right">
                    <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black rounded-full uppercase tracking-widest">Settled</span>
                  </td>
                  <td className="px-10 py-6 text-right">
                    <button 
                      onClick={() => exportCSV(s)}
                      className="px-5 py-3 bg-slate-50 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-sm flex items-center gap-2 ml-auto"
                    >
                      <FileText size={16} /> Audit
                    </button>
                  </td>
                </tr>
              ))}
              {history.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-10 py-40 text-center">
                     <div className="flex flex-col items-center gap-4 opacity-20">
                        <History size={80} className="text-slate-300" />
                        <p className="font-black text-xs uppercase tracking-widest">Zero historical data found.</p>
                     </div>
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