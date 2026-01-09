
import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Edit2, 
  Trash2, 
  AlertTriangle,
  Package,
  X,
  RefreshCw
} from 'lucide-react';
import { Product, Supplier } from '../types';

const Inventory: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    category: '',
    price: 0,
    cost_price: 0,
    stock_quantity: 0,
    reorder_level: 5,
    supplier_id: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Direct fetch from products table to ensure all items are recovered
      const { data: prods, error: pErr } = await supabase
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      
      const { data: sups, error: sErr } = await supabase
        .from('suppliers')
        .select('*');

      if (pErr) throw pErr;
      if (prods) setProducts(prods);
      if (sups) setSuppliers(sups);
    } catch (error) {
      console.error("Inventory sync failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        price: Number(formData.price),
        cost_price: Number(formData.cost_price),
        stock_quantity: Number(formData.stock_quantity),
        reorder_level: Number(formData.reorder_level),
        supplier_id: formData.supplier_id || null
      };

      if (editingProduct) {
        const { error } = await supabase
          .from('products')
          .update(payload)
          .eq('id', editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([payload]);
        if (error) throw error;
      }
      
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', category: '', price: 0, cost_price: 0, stock_quantity: 0, reorder_level: 5, supplier_id: '' });
      fetchData();
    } catch (err: any) {
      alert("Failed to save product: " + err.message);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Are you sure you want to remove this item from the catalog? This action cannot be undone.")) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const openEdit = (prod: Product) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      category: prod.category,
      price: Number(prod.price),
      cost_price: Number(prod.cost_price),
      stock_quantity: prod.stock_quantity,
      reorder_level: prod.reorder_level,
      supplier_id: prod.supplier_id || ''
    });
    setIsModalOpen(true);
  };

  const exportCSV = () => {
    const headers = ['Name', 'Category', 'Price (KSh)', 'Cost (KSh)', 'Stock', 'Supplier'];
    const rows = products.map(p => [
      p.name,
      p.category,
      p.price,
      p.cost_price,
      p.stock_quantity,
      suppliers.find(s => s.id === p.supplier_id)?.name || 'N/A'
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = filterCategory === 'All' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = Array.from(new Set(products.map(p => p.category)));

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-20 gap-4">
        <RefreshCw className="w-10 h-10 text-blue-600 animate-spin opacity-20" />
        <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.4em]">Loading Catalog...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight leading-none uppercase">Services Catalog</h1>
          <p className="text-slate-500 font-medium mt-2 text-sm uppercase tracking-widest text-[10px]">Manage Inventory & Pricing</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportCSV} className="px-5 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-sm">
            <Download size={18} /> Export CSV
          </button>
          <button 
            onClick={() => { 
              setEditingProduct(null); 
              setFormData({ name: '', category: '', price: 0, cost_price: 0, stock_quantity: 0, reorder_level: 5, supplier_id: '' }); 
              setIsModalOpen(true); 
            }} 
            className="px-5 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-black flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-xl shadow-slate-200 active:scale-95 transition-all"
          >
            <Plus size={18} /> Add New Item
          </button>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search products by name..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-medium"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <select 
              className="pl-10 pr-10 py-3 bg-white border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none appearance-none font-bold text-xs text-slate-700 shadow-sm uppercase tracking-widest"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option value="All">All Categories</option>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-slate-100 overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Description</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Category</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest">Price (KSh)</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Stock</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 font-medium">
            {filteredProducts.map(product => (
              <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-8 py-5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg">
                      <Package size={22} />
                    </div>
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-tight text-sm">{product.name}</p>
                      <p className="text-[9px] text-slate-400 font-bold tracking-widest uppercase">ID: {product.id.slice(0, 8)}</p>
                    </div>
                  </div>
                </td>
                <td className="px-8 py-5">
                  <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[9px] font-black rounded-full uppercase tracking-widest">{product.category}</span>
                </td>
                <td className="px-8 py-5">
                  <p className="font-black text-slate-900 tabular-nums">KSh {Number(product.price).toLocaleString()}</p>
                  <p className="text-[9px] text-slate-400 uppercase tracking-widest">Cost: {Number(product.cost_price).toLocaleString()}</p>
                </td>
                <td className="px-8 py-5 text-center">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl font-black tabular-nums ${product.stock_quantity <= product.reorder_level ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-slate-50 text-slate-900 border border-slate-100'}`}>
                    {product.stock_quantity}
                  </div>
                </td>
                <td className="px-8 py-5 text-right">
                  <div className="flex justify-end gap-3">
                    <button onClick={() => openEdit(product)} className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-2xl transition-all">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => deleteProduct(product.id)} className="p-3 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProducts.length === 0 && !loading && (
          <div className="py-24 flex flex-col items-center justify-center text-slate-200">
            <Package size={80} className="mb-4 opacity-10" strokeWidth={1} />
            <p className="font-black text-xs uppercase tracking-[0.4em] text-slate-300">No records found.</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] w-full max-w-2xl shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">{editingProduct ? 'Update Inventory Item' : 'Add New To Catalog'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full transition-all"><X size={20} /></button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-8">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Service / Item Name</label>
                  <input required type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-bold transition-all" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Category</label>
                  <input required type="text" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-bold transition-all" placeholder="e.g. Services" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Retail Price (KSh)</label>
                  <input required type="number" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-black tabular-nums transition-all" value={formData.price} onChange={(e) => setFormData({...formData, price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Cost Price (KSh)</label>
                  <input required type="number" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-black tabular-nums transition-all" value={formData.cost_price} onChange={(e) => setFormData({...formData, cost_price: Number(e.target.value)})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Current Stock Level</label>
                  <input required type="number" className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-black tabular-nums transition-all" value={formData.stock_quantity} onChange={(e) => setFormData({...formData, stock_quantity: Number(e.target.value)})} />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Associate Supplier</label>
                  <select className="w-full px-6 py-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none focus:ring-2 focus:ring-blue-600 font-bold transition-all appearance-none" value={formData.supplier_id} onChange={(e) => setFormData({...formData, supplier_id: e.target.value})}>
                    <option value="">No Linked Supplier</option>
                    {suppliers.map(sup => <option key={sup.id} value={sup.id}>{sup.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="pt-6 flex gap-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-5 bg-slate-100 text-slate-700 rounded-3xl font-black uppercase tracking-widest text-[10px] hover:bg-slate-200 transition-all">Cancel</button>
                <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-3xl font-black uppercase tracking-widest text-[10px] shadow-2xl shadow-blue-600/20 active:scale-95 transition-all">Commit To Cloud</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
