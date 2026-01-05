
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  Receipt, 
  Calendar,
  Filter,
  X,
  AlertCircle
} from 'lucide-react';
import { Expense, User } from '../types';

interface ExpensesProps {
  user: User;
}

const Expenses: React.FC<ExpensesProps> = ({ user }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [activeShiftId, setActiveShiftId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    amount: 0,
    category: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchExpenses();
    fetchActiveShift();
  }, []);

  const fetchActiveShift = async () => {
    const { data } = await supabase
      .from('shifts')
      .select('id')
      .eq('closed', false)
      .limit(1)
      .maybeSingle();
    
    if (data) setActiveShiftId(data.id);
  };

  const fetchExpenses = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .order('date', { ascending: false });
    if (data) setExpenses(data);
    setLoading(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!activeShiftId) {
        alert("You must start a shift before recording expenses.");
        return;
      }

      const { error } = await supabase.from('expenses').insert({
        ...formData,
        created_by: user.id,
        shift_id: activeShiftId,
        amount: Number(formData.amount)
      });
      if (error) throw error;
      
      setIsModalOpen(false);
      setFormData({ amount: 0, category: '', description: '', date: new Date().toISOString().split('T')[0] });
      fetchExpenses();
    } catch (err) {
      console.error(err);
      alert("Failed to save expense.");
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm("Are you sure?")) return;
    await supabase.from('expenses').delete().eq('id', id);
    fetchExpenses();
  };

  const exportCSV = () => {
    const headers = ['Date', 'Category', 'Description', 'Amount'];
    const rows = expenses.map(e => [e.date, e.category, e.description, e.amount]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "expenses_report.csv");
    document.body.appendChild(link);
    link.click();
  };

  const filtered = expenses.filter(e => 
    e.category.toLowerCase().includes(search.toLowerCase()) || 
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Expense Ledger</h1>
          <p className="text-slate-500 font-medium">Log and categorize business spending.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-sm">
            <Download size={18} /> Export
          </button>
          <button onClick={() => setIsModalOpen(true)} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all">
            <Plus size={18} /> New Expense
          </button>
        </div>
      </header>

      {!activeShiftId && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-700 text-sm font-bold animate-in slide-in-from-top-4">
           <AlertCircle size={20} />
           <span>Warning: No active shift found. Please activate a terminal session to log expenses.</span>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search by category or keyword..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-medium"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Memo</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Amount</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(expense => (
              <tr key={expense.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-5 text-sm font-bold text-slate-600">
                  {new Date(expense.date).toLocaleDateString()}
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 bg-rose-50 text-rose-600 text-[10px] font-black rounded-full uppercase tracking-tighter">{expense.category}</span>
                </td>
                <td className="px-8 py-5 text-sm font-medium text-slate-500">{expense.description || '—'}</td>
                <td className="px-8 py-5 text-right font-black text-rose-600 tabular-nums">KSh {Number(expense.amount).toLocaleString()}</td>
                <td className="px-8 py-5 text-right">
                  <button onClick={() => deleteExpense(expense.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors">
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && !loading && (
          <div className="py-24 flex flex-col items-center justify-center text-slate-200">
             <Receipt size={64} className="opacity-10 mb-4" />
             <p className="font-bold italic text-sm">No expenses recorded yet.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">New Expense Entry</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 bg-slate-50 p-2 rounded-full hover:bg-slate-100"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Effective Date</label>
                  <input required type="date" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Spending Category</label>
                  <input required type="text" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g. Detergents, Salary, Rent" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Amount (KSh)</label>
                  <input required type="number" step="1" className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black outline-none focus:ring-2 focus:ring-blue-500" value={formData.amount} onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Description / Memo</label>
                  <textarea className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-medium outline-none focus:ring-2 focus:ring-blue-500" rows={3} value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
              <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 hover:bg-black transition-all active:scale-95">Record Expense</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
