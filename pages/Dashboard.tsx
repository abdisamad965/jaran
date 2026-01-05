
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  AlertCircle, 
  LayoutGrid,
  Calendar,
  Sparkles,
  Clock,
  ArrowRight
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
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);
      
      // 1. Fetch Daily Sales (Calendar Day)
      const { data: dailySales } = await supabase
        .from('sales')
        .select('total_amount')
        .gte('sale_date', startOfDay.toISOString());
      
      const totalSales = dailySales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;

      // 2. Fetch Active Shift Sales
      const { data: activeShift } = await supabase
        .from('shifts')
        .select('total_sales')
        .eq('closed', false)
        .maybeSingle();

      // 3. Fetch Daily Expenses
      const { data: expenses } = await supabase
        .from('expenses')
        .select('amount')
        .gte('date', startOfDay.toISOString().split('T')[0]);
      
      const totalExpenses = expenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0;

      // 4. Low Stock Check
      const { data: allProducts } = await supabase.from('products').select('name, stock_quantity, reorder_level');
      const lowStock = allProducts?.filter(p => p.stock_quantity <= p.reorder_level) || [];

      setStats({
        totalSales,
        totalExpenses,
        activeShiftSales: activeShift?.total_sales || 0,
        lowStockCount: lowStock.length
      });

      // 5. Chart Data (Last 7 Days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const { data: history } = await supabase
        .from('sales')
        .select('sale_date, total_amount')
        .gte('sale_date', sevenDaysAgo.toISOString());

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const realChartData = Array.from({length: 7}).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        d.setHours(0,0,0,0);
        const dayTotal = history?.filter(s => new Date(s.sale_date).toDateString() === d.toDateString())
          .reduce((acc, cur) => acc + Number(cur.total_amount), 0) || 0;
        return { name: dayNames[d.getDay()], sales: dayTotal };
      });
      setChartData(realChartData);

    } catch (error) {
      console.error("Dashboard error:", error);
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
      <div className={`p-4 rounded-2xl ${color} bg-opacity-10 text-${color.split('-')[1]}-600`}>
        <Icon size={24} />
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-slate-900 text-white rounded-2xl shadow-xl">
            <LayoutGrid size={28}/>
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Command Hub</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Jaran Cleaning Service Business Analytics</p>
          </div>
        </div>
        <div className="bg-white px-6 py-4 rounded-2xl border border-slate-100 flex items-center gap-4 shadow-sm">
           <Calendar className="text-blue-500" size={20} />
           <div className="text-left">
             <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Modern Date</p>
             <p className="text-sm font-black text-slate-800 leading-none">{new Date().toLocaleDateString('en-KE', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
           </div>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Daily Revenue" value={stats.totalSales} icon={TrendingUp} color="bg-blue-600" subValue="Calendar Day Total" />
        <StatCard title="Session Gross" value={stats.activeShiftSales} icon={Clock} color="bg-emerald-600" subValue="Unsettled Shift Sales" />
        <StatCard title="Operating Costs" value={stats.totalExpenses} icon={TrendingDown} color="bg-rose-600" subValue="Today's Spending" />
        <StatCard title="Supply Alerts" value={stats.lowStockCount} icon={AlertCircle} color="bg-amber-600" subValue="Items needing restock" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 bg-white p-10 rounded-[3rem] shadow-sm border border-slate-100 min-h-[500px] flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Growth Analytics (Last 7 Days)</h3>
          </div>
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
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: '900'}} tickFormatter={(val) => `KSh ${val}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="sales" stroke="#3b82f6" strokeWidth={5} fillOpacity={1} fill="url(#dashSales)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-slate-200 gap-4 bg-slate-50/50 rounded-[2rem] border border-dashed border-slate-200">
                 <Sparkles size={64} className="opacity-10" />
                 <p className="font-black text-xs uppercase tracking-widest text-slate-400">Awaiting Business Activity</p>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <div className="bg-slate-900 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/10 rounded-full -mr-16 -mt-16 blur-3xl"></div>
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-10">Terminal Launchpad</h3>
              <div className="space-y-4">
                <button onClick={() => navigate('/pos')} className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-600 hover:border-blue-500 transition-all text-left flex items-center justify-between group">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-200">Quick Sell</p>
                    <p className="text-base font-black text-white">Open POS Terminal</p>
                  </div>
                  <ArrowRight size={20} className="text-slate-700 group-hover:text-white" />
                </button>
                <button onClick={() => navigate('/shifts')} className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-600 hover:border-blue-500 transition-all text-left flex items-center justify-between group">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-200">Management</p>
                    <p className="text-base font-black text-white">Shift Controls</p>
                  </div>
                  <ArrowRight size={20} className="text-slate-700 group-hover:text-white" />
                </button>
                <button onClick={() => navigate('/expenses')} className="w-full p-6 bg-white/5 border border-white/10 rounded-2xl hover:bg-blue-600 hover:border-blue-500 transition-all text-left flex items-center justify-between group">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1 group-hover:text-blue-200">Operating Costs</p>
                    <p className="text-base font-black text-white">Log Expense</p>
                  </div>
                  <ArrowRight size={20} className="text-slate-700 group-hover:text-white" />
                </button>
              </div>
           </div>

           <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex items-center gap-6">
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
                 <DollarSign size={28} />
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Day Balance</p>
                <h4 className="text-2xl font-black text-slate-900">KSh {(stats.totalSales - stats.totalExpenses).toLocaleString()}</h4>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
