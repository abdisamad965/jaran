
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Download, 
  Calendar,
  Filter,
  BarChart3,
  TrendingUp,
  CreditCard,
  Package,
  Users,
  Search,
  ArrowRight
} from 'lucide-react';

type ReportType = 'sales' | 'expenses' | 'profit' | 'suppliers' | 'inventory';

const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportType>('sales');
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const [data, setData] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});

  useEffect(() => {
    fetchReportData();
  }, [activeTab, startDate, endDate]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const startISO = `${startDate}T00:00:00`;
      const endISO = `${endDate}T23:59:59`;

      if (activeTab === 'sales') {
        const { data: sales } = await supabase
          .from('sales')
          .select('*, user:users(name)')
          .gte('sale_date', startISO)
          .lte('sale_date', endISO)
          .order('sale_date', { ascending: false });
        
        setData(sales || []);
        const total = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        setSummary({ totalSales: total, count: sales?.length });

      } else if (activeTab === 'expenses') {
        const { data: expenses } = await supabase
          .from('expenses')
          .select('*')
          .gte('date', startDate)
          .lte('date', endDate)
          .order('date', { ascending: false });
        
        setData(expenses || []);
        const total = expenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0;
        setSummary({ totalExpenses: total, count: expenses?.length });

      } else if (activeTab === 'profit') {
        // Profit Report (sales - expenses - cost)
        const { data: sales } = await supabase
          .from('sales')
          .select('total_amount, sale_items(quantity, unit_price, product:products(cost_price))')
          .gte('sale_date', startISO)
          .lte('sale_date', endISO);
        
        const { data: expenses } = await supabase
          .from('expenses')
          .select('amount')
          .gte('date', startDate)
          .lte('date', endDate);

        const totalSales = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        const totalExpenses = expenses?.reduce((acc, e) => acc + Number(e.amount), 0) || 0;
        
        let totalCOGS = 0;
        sales?.forEach(s => {
          s.sale_items?.forEach((item: any) => {
            totalCOGS += (Number(item.product?.cost_price || 0) * Number(item.quantity));
          });
        });

        setSummary({
          sales: totalSales,
          expenses: totalExpenses,
          cogs: totalCOGS,
          profit: totalSales - totalExpenses - totalCOGS
        });

      } else if (activeTab === 'suppliers') {
        const { data: payments } = await supabase
          .from('supplier_payments')
          .select('*, supplier:suppliers(name)')
          .gte('payment_date', startDate)
          .lte('payment_date', endDate)
          .order('payment_date', { ascending: false });
        
        setData(payments || []);
        const totalPaid = payments?.filter(p => p.payment_type === 'debit').reduce((acc, p) => acc + Number(p.amount), 0) || 0;
        const totalOwed = payments?.filter(p => p.payment_type === 'credit').reduce((acc, p) => acc + Number(p.amount), 0) || 0;
        setSummary({ totalPaid, totalOwed });

      } else if (activeTab === 'inventory') {
        const { data: products } = await supabase
          .from('products')
          .select('*')
          .order('stock_quantity', { ascending: true });
        
        setData(products || []);
        const totalValue = products?.reduce((acc, p) => acc + (Number(p.cost_price) * p.stock_quantity), 0) || 0;
        setSummary({ totalValue, count: products?.length });
      }

    } catch (err) {
      console.error("Report generation failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const exportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];

    if (activeTab === 'sales') {
      headers = ['Date', 'ID', 'Cashier', 'Method', 'Total (KSh)'];
      rows = data.map(s => [s.sale_date, s.id, s.user?.name, s.payment_method.toUpperCase(), s.total_amount]);
    } else if (activeTab === 'expenses') {
      headers = ['Date', 'Category', 'Description', 'Amount (KSh)'];
      rows = data.map(e => [e.date, e.category, e.description, e.amount]);
    } else if (activeTab === 'suppliers') {
      headers = ['Date', 'Supplier', 'Type', 'Amount (KSh)', 'Notes'];
      rows = data.map(p => [p.payment_date, p.supplier?.name, p.payment_type, p.amount, p.notes]);
    } else if (activeTab === 'inventory') {
      headers = ['Product', 'Category', 'Stock', 'Price', 'Value'];
      rows = data.map(p => [p.name, p.category, p.stock_quantity, p.price, p.stock_quantity * p.cost_price]);
    }

    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${activeTab}_report_${startDate}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const TabButton = ({ id, label, icon: Icon }: { id: ReportType, label: string, icon: any }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center gap-3 px-6 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${
        activeTab === id 
        ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
        : 'bg-white text-slate-400 hover:bg-slate-50 border border-slate-100'
      }`}
    >
      <Icon size={18} /> {label}
    </button>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Financial Reports</h1>
          <p className="text-slate-500 font-medium">Detailed breakdown of your business health.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-[2rem] border border-slate-100 shadow-sm">
           <div className="flex items-center gap-2 px-4 py-2">
             <Calendar size={18} className="text-slate-400"/>
             <input type="date" className="bg-transparent border-none text-xs font-bold outline-none text-slate-700" value={startDate} onChange={e => setStartDate(e.target.value)} />
             <span className="text-slate-200">—</span>
             <input type="date" className="bg-transparent border-none text-xs font-bold outline-none text-slate-700" value={endDate} onChange={e => setEndDate(e.target.value)} />
           </div>
           <button 
             onClick={exportCSV}
             className="px-6 py-2.5 bg-blue-600 text-white rounded-xl font-black flex items-center gap-2 hover:bg-blue-700 transition-all text-xs shadow-lg shadow-blue-500/20"
           >
             <Download size={14} /> EXPORT CSV
           </button>
        </div>
      </header>

      {/* Report Tabs */}
      <div className="flex flex-wrap gap-4">
        <TabButton id="sales" label="Sales Report" icon={BarChart3} />
        <TabButton id="expenses" label="Expenses Report" icon={CreditCard} />
        <TabButton id="profit" label="Profit Analysis" icon={TrendingUp} />
        <TabButton id="suppliers" label="Supplier Ledger" icon={Users} />
        <TabButton id="inventory" label="Inventory Audit" icon={Package} />
      </div>

      {/* Content Area */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden min-h-[500px]">
        {activeTab === 'profit' ? (
          <div className="p-12 max-w-2xl mx-auto space-y-12">
            <h2 className="text-2xl font-black text-slate-900 text-center uppercase tracking-widest">Net Profit Breakdown</h2>
            <div className="grid grid-cols-1 gap-6">
              <div className="flex justify-between items-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">Total Sales Revenue</span>
                <span className="text-xl font-black text-blue-600">KSh {summary.sales?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">Cost of Goods Sold (COGS)</span>
                <span className="text-xl font-black text-rose-600">- KSh {summary.cogs?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center p-6 bg-slate-50 rounded-3xl border border-slate-100">
                <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">Operating Expenses</span>
                <span className="text-xl font-black text-rose-600">- KSh {summary.expenses?.toLocaleString()}</span>
              </div>
              <div className="pt-6 border-t-2 border-dashed border-slate-200 flex justify-between items-center px-6">
                <span className="font-black text-slate-900 uppercase tracking-widest text-lg">Net Profit</span>
                <span className="text-4xl font-black text-emerald-600">KSh {summary.profit?.toLocaleString()}</span>
              </div>
            </div>
            <p className="text-center text-slate-400 text-xs font-medium italic">Profit calculation: Total Sales - (Expenses + Cost Price of items sold).</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                {activeTab === 'sales' && <>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Transaction ID</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Method</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Total</th>
                </>}
                {activeTab === 'expenses' && <>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Notes</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Amount</th>
                </>}
                {activeTab === 'inventory' && <>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Product</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Stock</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Unit Price</th>
                </>}
                {activeTab === 'suppliers' && <>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Supplier</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Type</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Amount</th>
                </>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {data.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  {activeTab === 'sales' && <>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{new Date(item.sale_date).toLocaleString()}</td>
                    <td className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">{item.id.slice(0, 8)}</td>
                    <td className="px-8 py-5">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[10px] font-black uppercase rounded-full">{item.payment_method}</span>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-slate-900">KSh {Number(item.total_amount).toLocaleString()}</td>
                  </>}
                  {activeTab === 'expenses' && <>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                    <td className="px-8 py-5">
                      <span className="px-2.5 py-1 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-full">{item.category}</span>
                    </td>
                    <td className="px-8 py-5 text-sm text-slate-500 italic">{item.description || '—'}</td>
                    <td className="px-8 py-5 text-right font-black text-rose-600">KSh {Number(item.amount).toLocaleString()}</td>
                  </>}
                  {activeTab === 'inventory' && <>
                    <td className="px-8 py-5">
                       <p className="font-bold text-slate-900">{item.name}</p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID: {item.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">{item.category}</td>
                    <td className="px-8 py-5 text-center font-black text-slate-900">{item.stock_quantity}</td>
                    <td className="px-8 py-5 text-right font-black text-slate-900">KSh {Number(item.price).toLocaleString()}</td>
                  </>}
                  {activeTab === 'suppliers' && <>
                    <td className="px-8 py-5 text-sm font-bold text-slate-600">{new Date(item.payment_date).toLocaleDateString()}</td>
                    <td className="px-8 py-5 font-bold text-slate-900">{item.supplier?.name}</td>
                    <td className="px-8 py-5">
                      <span className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-full ${item.payment_type === 'debit' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                        {item.payment_type === 'debit' ? 'Paid' : 'Bill'}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right font-black text-slate-900">KSh {Number(item.amount).toLocaleString()}</td>
                  </>}
                </tr>
              ))}
              {data.length === 0 && !loading && ( activeTab !== 'profit' &&
                <tr>
                  <td colSpan={5} className="px-8 py-20 text-center text-slate-300 italic">No records found for the selected period.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default Reports;
