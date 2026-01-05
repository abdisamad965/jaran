
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  DollarSign,
  X,
  Trash2,
  Edit2,
  ArrowRightLeft,
  Calendar,
  Download,
  AlertCircle,
  MapPin,
  ChevronRight,
  Users
} from 'lucide-react';
import { Supplier, User, SupplierPayment } from '../types';

interface SuppliersProps {
  user: User;
}

const Suppliers: React.FC<SuppliersProps> = ({ user }) => {
  const [suppliers, setSuppliers] = useState<(Supplier & { balance: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState<(Supplier & { balance: number }) | null>(null);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [paymentFilter, setPaymentFilter] = useState({ start: '', end: '' });

  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    email: '',
    address: ''
  });

  const [paymentFormData, setPaymentFormData] = useState({
    payment_type: 'debit' as 'debit' | 'credit',
    amount: 0,
    notes: '',
    payment_date: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    const { data: sups } = await supabase.from('suppliers').select('*').order('name');
    if (sups) {
      const supsWithBalance = await Promise.all(sups.map(async (s) => {
        const { data: pays } = await supabase
          .from('supplier_payments')
          .select('amount, payment_type')
          .eq('supplier_id', s.id);
        
        const balance = pays?.reduce((acc, p) => {
          return p.payment_type === 'credit' ? acc + Number(p.amount) : acc - Number(p.amount);
        }, 0) || 0;

        return { ...s, balance };
      }));
      setSuppliers(supsWithBalance);
    }
    setLoading(false);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSupplier) {
      const { error } = await supabase.from('suppliers').update(formData).eq('id', editingSupplier.id);
      if (!error) {
        setIsModalOpen(false);
        setEditingSupplier(null);
        setFormData({ name: '', contact: '', email: '', address: '' });
        fetchSuppliers();
      }
    } else {
      const { error } = await supabase.from('suppliers').insert(formData);
      if (!error) {
        setIsModalOpen(false);
        setFormData({ name: '', contact: '', email: '', address: '' });
        fetchSuppliers();
      }
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!confirm("Deleting a supplier will also affect inventory records. Are you sure?")) return;
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) {
      alert("Cannot delete supplier while products are linked to it.");
    } else {
      fetchSuppliers();
    }
  };

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact: supplier.contact || '',
      email: supplier.email || '',
      address: supplier.address || ''
    });
    setIsModalOpen(true);
  };

  const openPayments = async (supplier: Supplier & { balance: number }) => {
    setSelectedSupplier(supplier);
    setIsPaymentModalOpen(true);
    fetchPayments(supplier.id);
  };

  const fetchPayments = async (supplierId: string) => {
    let query = supabase
      .from('supplier_payments')
      .select('*')
      .eq('supplier_id', supplierId)
      .order('payment_date', { ascending: false });

    if (paymentFilter.start) query = query.gte('payment_date', paymentFilter.start);
    if (paymentFilter.end) query = query.lte('payment_date', paymentFilter.end);

    const { data } = await query;
    if (data) setPayments(data);
  };

  useEffect(() => {
    if (selectedSupplier) fetchPayments(selectedSupplier.id);
  }, [paymentFilter]);

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;

    const { error } = await supabase.from('supplier_payments').insert({
      ...paymentFormData,
      supplier_id: selectedSupplier.id,
      created_by: user.id
    });

    if (!error) {
      setPaymentFormData({ payment_type: 'debit', amount: 0, notes: '', payment_date: new Date().toISOString().split('T')[0] });
      fetchPayments(selectedSupplier.id);
      fetchSuppliers(); // Refresh balances
    }
  };

  const exportPaymentsCSV = () => {
    if (!selectedSupplier) return;
    const headers = ['Date', 'Type', 'Amount', 'Notes'];
    const rows = payments.map(p => [p.payment_date, p.payment_type.toUpperCase(), p.amount, p.notes]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `${selectedSupplier.name}_ledger.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const filtered = suppliers.filter(s => s.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Suppliers</h1>
          <p className="text-slate-500">Manage vendor relationships, credits, and payments.</p>
        </div>
        <button onClick={() => { setEditingSupplier(null); setFormData({ name: '', contact: '', email: '', address: '' }); setIsModalOpen(true); }} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 font-bold shadow-lg shadow-blue-500/20 transition-all">
          <Plus size={18} /> Add Supplier
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input
          type="text"
          placeholder="Search suppliers by name..."
          className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(supplier => (
          <div key={supplier.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4 flex flex-col justify-between group hover:border-blue-200 transition-all">
            <div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center font-bold text-xl">
                    {supplier.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{supplier.name}</h3>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">ID: {supplier.id.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="text-right">
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Balance</p>
                   <p className={`text-lg font-bold ${supplier.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                     KSh {Math.abs(supplier.balance).toLocaleString()}
                   </p>
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-slate-600 mt-6 pt-4 border-t border-slate-50">
                <div className="flex items-center gap-3"><Phone size={14} className="text-slate-400"/> {supplier.contact || 'No phone'}</div>
                <div className="flex items-center gap-3"><Mail size={14} className="text-slate-400"/> {supplier.email || 'No email'}</div>
                <div className="flex items-center gap-3"><MapPin size={14} className="text-slate-400"/> {supplier.address || 'No address'}</div>
              </div>
            </div>

            <div className="pt-6 flex gap-2">
              <button 
                onClick={() => openPayments(supplier)}
                className="flex-1 py-2.5 bg-blue-50 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-100 flex items-center justify-center gap-2 transition-colors"
              >
                <ArrowRightLeft size={14} /> PAYMENTS
              </button>
              <button onClick={() => openEdit(supplier)} className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"><Edit2 size={16}/></button>
              <button onClick={() => handleDeleteSupplier(supplier.id)} className="p-2.5 bg-slate-50 text-rose-600 rounded-xl hover:bg-rose-100 transition-colors"><Trash2 size={16}/></button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && !loading && (
          <div className="col-span-full py-12 flex flex-col items-center justify-center text-slate-400 italic bg-white border border-dashed rounded-3xl">
            {/* Fix: Added missing Users icon import from lucide-react above */}
            <Users className="mb-2 opacity-20" size={48} />
            <p>No suppliers found matching your search.</p>
          </div>
        )}
      </div>

      {/* Supplier CRUD Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 animate-in zoom-in duration-200 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-2xl font-bold text-slate-900">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-100 p-1 rounded-full transition-colors"><X/></button>
            </div>
            <form onSubmit={handleSaveSupplier} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Supplier Name</label>
                <input required type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="e.g. Acme Supplies" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Contact Number</label>
                <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="+254..." value={formData.contact} onChange={e => setFormData({...formData, contact: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                <input type="email" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="vendor@example.com" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Location/Address</label>
                <input type="text" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" placeholder="Nairobi, Kenya" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} />
              </div>
              <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-xl font-extrabold shadow-lg shadow-blue-500/20 hover:bg-blue-700 transition-all transform active:scale-[0.98]">
                {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Ledger Modal */}
      {isPaymentModalOpen && selectedSupplier && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2rem] w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white rounded-t-[2rem]">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-2xl font-bold">{selectedSupplier.name}</h3>
                  <span className="px-3 py-1 bg-white/10 rounded-full text-[10px] font-bold tracking-widest uppercase">Ledger</span>
                </div>
                <p className={`text-sm mt-1 font-semibold ${selectedSupplier.balance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {selectedSupplier.balance > 0 ? `Outstanding Debt: KSh ${Math.abs(selectedSupplier.balance).toLocaleString()}` : `Positive Credit: KSh ${Math.abs(selectedSupplier.balance).toLocaleString()}`}
                </p>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="text-slate-400 hover:text-white bg-white/10 p-2 rounded-full transition-all"><X size={24} /></button>
            </div>

            <div className="flex-1 overflow-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Form */}
              <div className="lg:col-span-4 space-y-6">
                <div className="p-6 bg-slate-50 rounded-2xl border border-slate-200 shadow-sm">
                  <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
                    <Plus size={18} className="text-blue-600"/> Log Transaction
                  </h4>
                  <form onSubmit={handleSavePayment} className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Type</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-white border border-slate-200 rounded-xl">
                        <button 
                          type="button" 
                          onClick={() => setPaymentFormData({...paymentFormData, payment_type: 'debit'})}
                          className={`py-2 rounded-lg text-xs font-bold transition-all ${paymentFormData.payment_type === 'debit' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          PAID (DEBIT)
                        </button>
                        <button 
                          type="button" 
                          onClick={() => setPaymentFormData({...paymentFormData, payment_type: 'credit'})}
                          className={`py-2 rounded-lg text-xs font-bold transition-all ${paymentFormData.payment_type === 'credit' ? 'bg-rose-600 text-white shadow-md' : 'text-slate-500 hover:bg-slate-50'}`}
                        >
                          BILL (CREDIT)
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Amount (KSh)</label>
                      <input required type="number" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" value={paymentFormData.amount} onChange={e => setPaymentFormData({...paymentFormData, amount: Number(e.target.value)})} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Date</label>
                      <input required type="date" className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" value={paymentFormData.payment_date} onChange={e => setPaymentFormData({...paymentFormData, payment_date: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Notes</label>
                      <textarea className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" rows={2} placeholder="Invoice # or reason..." value={paymentFormData.notes} onChange={e => setPaymentFormData({...paymentFormData, notes: e.target.value})} />
                    </div>
                    <button type="submit" className="w-full py-4 bg-slate-900 text-white rounded-xl font-extrabold shadow-lg hover:bg-black transition-all transform active:scale-[0.98]">
                      Add Entry
                    </button>
                  </form>
                </div>
              </div>

              {/* Right Column: List */}
              <div className="lg:col-span-8 space-y-6">
                <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-50 p-4 rounded-2xl border border-slate-200">
                   <div className="flex items-center gap-3">
                     <Calendar className="text-slate-400" size={18} />
                     <div className="flex items-center gap-2">
                       <input type="date" className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500" value={paymentFilter.start} onChange={e => setPaymentFilter({...paymentFilter, start: e.target.value})} />
                       <span className="text-slate-300">to</span>
                       <input type="date" className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white outline-none focus:ring-2 focus:ring-blue-500" value={paymentFilter.end} onChange={e => setPaymentFilter({...paymentFilter, end: e.target.value})} />
                     </div>
                   </div>
                   <button onClick={exportPaymentsCSV} className="w-full md:w-auto px-5 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all shadow-sm">
                     <Download size={16} /> EXPORT LEDGER
                   </button>
                </div>

                <div className="border border-slate-100 rounded-3xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Date</th>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Type</th>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest text-right">Amount</th>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase text-[10px] tracking-widest">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {payments.map(p => (
                        <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 text-slate-600 font-medium">{new Date(p.payment_date).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${p.payment_type === 'debit' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                              {p.payment_type === 'debit' ? 'Paid' : 'Debt'}
                            </span>
                          </td>
                          <td className={`px-6 py-4 text-right font-bold ${p.payment_type === 'debit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                            KSh {Number(p.amount).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-slate-500 italic max-w-[200px] truncate">{p.notes || '—'}</td>
                        </tr>
                      ))}
                      {payments.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-6 py-20 text-center">
                            <div className="flex flex-col items-center justify-center text-slate-300">
                              <Search size={48} className="mb-4 opacity-20" />
                              <p className="italic font-medium">No transactions found for this period.</p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
