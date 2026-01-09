
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle, 
  LayoutGrid,
  Sparkles,
  Clock,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area 
} from 'recharts';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalSales: 0,
    allTimeSales: 0,
    totalExpenses: 0,
    activeShiftSales: 0,
    lowStockCount: 0
  });
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. RECOVERY: Fetch ALL Sales without any filters
      const { data: allSales, error: salesError } = await supabase
        .from('sales')
        .select('total_amount, sale_date');
      
      if (salesError) throw salesError;

      const allTimeTotal = allSales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;

      // Calculate today's stats locally
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      const totalToday = allSales?.filter(s => new Date(s.sale_date) >= startOfDay)
        .reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;

      // 2. RECOVERY: Fetch ALL Expenses
      const { data: expenses } = await supabase.from('expenses').select('amount');
      const totalExpenses = expenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0;

      // 3. RECOVERY: Fetch ALL Products
      const { data: allProducts } = await supabase.from('products').select('stock_quantity, reorder_level');
      const lowStock = allProducts?.filter(p => p.stock_quantity <= p.reorder_level) || [];

      // 4. Fetch Active Shift (if any)
      const { data: activeShift } = await supabase
        .from('shifts')
        .select('total_sales')
        .eq('closed', false)
        .maybeSingle();

      setStats({
        totalSales: totalToday,
        allTimeSales: allTimeTotal,
        totalExpenses,
        activeShiftSales: activeShift?.total_sales || 0,
        lowStockCount: lowStock.length
      });

      // 5. Build History Chart from ALL recovered data
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const last7Days = Array.from({length: 7}).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0,0,0,0);
        const dayTotal = allSales?.filter(s => new Date(s.sale_date).toDateString() === d.toDateString())
          .reduce((acc, cur) => acc + Number(cur.total_amount), 0) || 0;
        return { name: dayNames[d.getDay()], sales: dayTotal };
      });
      setChartData(last7Days);

    } catch (error) {
      console.error("Dashboard recovery error:", error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ title, value, icon: Icon, color, subValue }: any) => (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 flex items-start justify-between group hover:shadow-lg transition-all">
      <div>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{title}</p>
        <h3 className="text-3xl font-black text-slate-900 leading-none">KSh {Number(value).toLocaleString()}</h3>
        {subValue && <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest">{subValue}</p>}
      </div>
      <div className={`p-4 rounded-2xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600 group-hover:scale-110 transition-transform`}>
        <Icon size={24} />
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 gap-4">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Deep-Syncing Your Data...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
            <LayoutGrid size={28}/>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Business Command</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Status: All Records Synchronized</p>
          </div>
        </div>
        <button onClick={fetchDashboardData} className="p-3 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 transition-colors">
          <RefreshCw size={20} />
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Lifetime Revenue" value={stats.allTimeSales} icon={DollarSign} color="bg-indigo-600" subValue="Total Historical Sales" />
        <StatCard title="Today's Performance" value={stats.totalSales} icon={TrendingUp} color="bg-blue-600" subValue="Current Day Revenue" />
        <StatCard title="Active Terminal" value={stats.activeShiftSales} icon={Clock} color="bg-emerald-600" subValue="Current Shift Sales" />
        <StatCard title="Service Alerts" value={stats.lowStockCount} icon={AlertCircle} color="bg-amber-600" subValue="Items Needing Restock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Revenue Velocity (7 Days)</h3>
          <div className="flex-1 min-h-0">
            {chartData.some(d => d.sales > 0) ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="dashSales" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '900'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '900'}} />
                  <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'black' }} />
                  <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={5} fillOpacity={1} fill="url(#dashSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-4 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                 <Sparkles size={64} className="opacity-10" />
                 <p className="font-black text-xs uppercase tracking-widest text-slate-400 text-center">No sales history detected.<br/>Open the POS to start recording.</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10">Quick Actions</h3>
              <div className="space-y-4">
                <button onClick={() => navigate('/pos')} className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-600 hover:border-blue-500 transition-all text-left flex items-center justify-between group">
                  <p className="text-base font-black text-white">Open POS Terminal</p>
                  <ArrowRight size={20} className="text-slate-700 group-hover:text-white" />
                </button>
                <button onClick={() => navigate('/inventory')} className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-600 hover:border-blue-500 transition-all text-left flex items-center justify-between group">
                  <p className="text-base font-black text-white">Manage Services</p>
                  <ArrowRight size={20} className="text-slate-700 group-hover:text-white" />
                </button>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
    