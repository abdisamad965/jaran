import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CheckCircle2,
  History,
  Undo2,
  X,
  RefreshCw,
  Banknote,
  Clock,
  Wifi,
  WifiOff
} from 'lucide-react';
import { Product, CartItem, User, Settings, Shift } from '../types';

interface WholesaleCartItem extends CartItem {
  customPrice: number;
  itemDiscount: number;
}

interface POSProps {
  user: User;
  settings: Settings | null;
}

const POS: React.FC<POSProps> = ({ user, settings }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<WholesaleCartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRecentSales, setShowRecentSales] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    fetchProducts();
    ensureValidShift();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const fetchProducts = async () => {
    try {
      const { data, error } = await supabase.from('products').select('*').order('name');
      if (error) throw error;
      if (data) setProducts(data);
    } catch (err) {
      console.error("Fetch products failed:", err);
    }
  };

  const ensureValidShift = async () => {
    try {
      const { data: currentShift, error } = await supabase
        .from('shifts')
        .select('id, total_sales, total_cash, total_card')
        .eq('closed', false)
        .limit(1)
        .maybeSingle();

      if (error && error.message !== 'JSON object requested, multiple (or no) rows returned') throw error;

      if (currentShift) {
        setActiveShift(currentShift as Shift);
        fetchRecentSales(currentShift.id);
      } else {
        const { data: newShift, error: createError } = await supabase.from('shifts').insert([{
          user_id: user.id,
          start_time: new Date().toISOString(),
          total_sales: 0,
          total_cash: 0,
          total_card: 0,
          closed: false
        }]).select('id, total_sales, total_cash, total_card').single();
        
        if (createError) throw createError;
        if (newShift) {
          setActiveShift(newShift as Shift);
          fetchRecentSales(newShift.id);
        }
      }
    } catch (err) {
      console.error("Shift sync failed:", err);
    }
  };

  const fetchRecentSales = async (shiftId: string) => {
    try {
      const { data } = await supabase
        .from('sales')
        .select('*, sale_items(*, product:products(name))')
        .eq('shift_id', shiftId)
        .order('sale_date', { ascending: false })
        .limit(8);
      if (data) setRecentSales(data);
    } catch (err) {
      console.error("Recent sales fetch failed:", err);
    }
  };

  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) return;
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.cartQuantity >= product.stock_quantity) return prev;
        return prev.map(item => item.id === product.id ? { ...item, cartQuantity: item.cartQuantity + 1 } : item);
      }
      return [...prev, { ...product, cartQuantity: 1, customPrice: Number(product.price), itemDiscount: 0 }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.cartQuantity + delta);
        return newQty > item.stock_quantity ? item : { ...item, cartQuantity: newQty };
      }
      return item;
    }).filter(item => item.cartQuantity > 0));
  };

  const handlePriceChange = (id: string, value: string) => {
    const newPrice = value === '' ? 0 : Number(value);
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, customPrice: newPrice };
      }
      return item;
    }));
  };

  const validatePrice = (id: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        if (item.customPrice < item.price) {
          return { ...item, customPrice: item.price };
        }
      }
      return item;
    }));
  };

  const cartSummary = useMemo(() => {
    const subtotal = cart.reduce((acc, item) => acc + (item.customPrice * item.cartQuantity), 0);
    const taxRate = settings?.tax_rate || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const netTotal = subtotal + taxAmount;
    return { subtotal, taxAmount, netTotal };
  }, [cart, settings]);

  const handleCheckout = async () => {
    if (cart.length === 0 || !activeShift) return;
    if (!navigator.onLine) {
      alert("Network Connection Lost. Please check your internet before finalizing.");
      return;
    }
    
    setIsProcessing(true);
    try {
      const { data: sale, error: saleErr } = await supabase.from('sales').insert([{
        total_amount: cartSummary.netTotal,
        payment_method: paymentMethod,
        cashier_id: user.id,
        shift_id: activeShift.id,
        sale_date: new Date().toISOString()
      }]).select().single();

      if (saleErr) throw saleErr;

      const items = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.customPrice,
        total_price: item.customPrice * item.cartQuantity
      }));
      
      const { error: itemsErr } = await supabase.from('sale_items').insert(items);
      if (itemsErr) throw itemsErr;

      for (const item of cart) {
        await supabase.from('products').update({ stock_quantity: item.stock_quantity - item.cartQuantity }).eq('id', item.id);
      }

      const { data: st } = await supabase.from('shifts').select('total_sales, total_cash, total_card').eq('id', activeShift.id).single();
      const updatedTotals = {
        total_sales: Number(st?.total_sales || 0) + cartSummary.netTotal,
        total_cash: paymentMethod === 'cash' ? Number(st?.total_cash || 0) + cartSummary.netTotal : Number(st?.total_cash || 0),
        total_card: paymentMethod !== 'cash' ? Number(st?.total_card || 0) + cartSummary.netTotal : Number(st?.total_card || 0),
      };
      
      await supabase.from('shifts').update(updatedTotals).eq('id', activeShift.id);
      
      setActiveShift({...activeShift, ...updatedTotals});
      fetchRecentSales(activeShift.id);
      setCheckoutComplete(true);
      setCart([]);
      fetchProducts();
    } catch (err: any) {
      console.error("Checkout process failed:", err);
      alert(err.message === "Failed to fetch" 
        ? "Network error: The server could not be reached." 
        : "Transaction failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleVoidSale = async (sale: any) => {
    if (!confirm(`Void Transaction #${sale.id.slice(0,8).toUpperCase()}?`)) return;
    
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
        
        setActiveShift({ ...activeShift, total_sales: totalSales, total_cash: totalCash, total_card: totalCard });
      }

      fetchRecentSales(activeShift?.id || '');
      fetchProducts();
      alert("Sale voided successfully.");
    } catch (err: any) {
      alert("Void operation failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      p.category.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [products, searchQuery]);

  return (
    <div className="max-w-full flex flex-col lg:flex-row h-[calc(100vh-64px)] overflow-hidden bg-slate-50 animate-in fade-in duration-500">
      
      {/* LEFT: Product Selection */}
      <div className="flex-1 flex flex-col p-4 md:p-6 min-w-0">
        <div className="flex items-center justify-between mb-4 md:mb-6 bg-white p-3 md:p-4 rounded-3xl border border-slate-100 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Search catalog..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-black outline-none" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
          
          <div className="flex items-center gap-3 ml-4">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
              {isOnline ? <Wifi size={12}/> : <WifiOff size={12}/>}
              {isOnline ? 'Online' : 'Offline'}
            </div>
            <button onClick={() => setShowRecentSales(true)} className="px-4 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[9px] uppercase tracking-widest flex items-center gap-2 hover:bg-black transition-all">
              <History size={16} /> History
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start custom-scrollbar pr-2">
          {filteredProducts.map(p => (
            <button 
              key={p.id} 
              onClick={() => addToCart(p)} 
              disabled={p.stock_quantity <= 0}
              className="group p-4 bg-white border border-slate-100 rounded-[2rem] text-left hover:border-indigo-600 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all flex flex-col justify-between h-40 disabled:opacity-30 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-3 opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-lg"><Plus size={16}/></div>
              </div>
              <div>
                <span className="text-[8px] font-black text-indigo-500 uppercase tracking-widest px-2 py-0.5 bg-indigo-50 rounded-lg">{p.category}</span>
                <h4 className="font-black text-slate-800 mt-2 line-clamp-2 text-xs leading-tight">{p.name}</h4>
              </div>
              <div>
                <p className="text-base font-black text-slate-900 leading-none">KSh {Number(p.price).toLocaleString()}</p>
                <p className="text-[8px] font-bold text-slate-400 mt-1 uppercase">Stock: {p.stock_quantity}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: Wholesale Ledger (FIXED FOOTER LAYOUT) */}
      <div className="w-full lg:w-[48%] xl:w-[45%] bg-white flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.05)] relative border-l border-slate-100 overflow-hidden">
        {/* Sticky Header */}
        <div className="p-6 md:p-8 border-b border-slate-50 flex items-center justify-between shrink-0 bg-white">
           <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-600 rounded-2xl shadow-xl shadow-indigo-600/20 text-white"><ShoppingCart size={24} /></div>
             <div>
               <h3 className="font-black uppercase tracking-[0.2em] text-xs text-slate-900 leading-none mb-1">Wholesale Ledger</h3>
               <p className="text-[9px] text-slate-400 font-black tracking-widest uppercase">Pricing Engine: Dynamic Adjustment</p>
             </div>
           </div>
           <div className="text-right">
             <span className="bg-slate-50 text-slate-500 text-[10px] font-black px-5 py-2.5 rounded-2xl border border-slate-100">{cart.length} LINE ITEMS</span>
           </div>
        </div>
        
        {/* Scrollable Middle Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-4 custom-scrollbar bg-white">
           {cart.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-200">
               <ShoppingCart size={120} strokeWidth={0.5} />
               <p className="mt-6 font-black text-xs uppercase tracking-[0.6em]">Station Ready</p>
             </div>
           ) : (
             cart.map(item => (
               <div key={item.id} className="bg-slate-50/50 p-4 md:p-6 rounded-[2rem] border border-slate-100 group hover:border-indigo-500/30 hover:bg-white hover:shadow-xl transition-all flex flex-col gap-4">
                 <div className="flex items-start justify-between">
                   <div className="flex-1 min-w-0">
                     <h4 className="text-sm md:text-base font-black text-slate-900 truncate">{item.name}</h4>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Min: KSh {item.price.toLocaleString()}</p>
                   </div>
                   <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-rose-500 p-2 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                 </div>

                 <div className="flex flex-wrap items-center justify-between gap-4">
                   <div className="flex items-center bg-white rounded-xl p-1 border border-slate-200 shadow-sm">
                     <button onClick={() => updateCartQuantity(item.id, -1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors bg-slate-50 rounded-lg hover:bg-indigo-600"><Minus size={16}/></button>
                     <span className="w-12 text-center text-slate-900 text-base font-black">{item.cartQuantity}</span>
                     <button onClick={() => updateCartQuantity(item.id, 1)} className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-white transition-colors bg-slate-50 rounded-lg hover:bg-indigo-600"><Plus size={16}/></button>
                   </div>

                   <div className="flex-1 min-w-[150px]">
                      <div className={`flex items-center bg-white rounded-xl px-4 py-2 border transition-all ${item.customPrice < item.price ? 'border-rose-500 bg-rose-50/30' : 'border-slate-200 focus-within:border-indigo-500'}`}>
                        <Banknote size={14} className={item.customPrice < item.price ? 'text-rose-500' : 'text-slate-400'} />
                        <input 
                          type="number" 
                          className="bg-transparent w-full text-slate-900 font-black text-sm outline-none ml-2"
                          value={item.customPrice === 0 ? '' : item.customPrice}
                          onBlur={() => validatePrice(item.id)}
                          onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        />
                      </div>
                   </div>

                   <div className="text-right">
                     <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Line Total</p>
                     <p className="text-xl font-black text-indigo-600 tabular-nums leading-none">KSh {(item.customPrice * item.cartQuantity).toLocaleString()}</p>
                   </div>
                 </div>
               </div>
             ))
           )}
        </div>

        {/* FIXED FOOTER: Always Visible Settlement Area */}
        <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-100 space-y-4 md:space-y-6 shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.03)]">
           <div className="flex justify-between items-center px-2">
             <div className="space-y-0.5">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Gross Subtotal</p>
               <p className="text-base font-black text-slate-600">KSh {cartSummary.subtotal.toLocaleString()}</p>
             </div>
             <div className="text-right space-y-0.5">
               <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Computed Tax</p>
               <p className="text-base font-black text-slate-600">KSh {cartSummary.taxAmount.toLocaleString()}</p>
             </div>
           </div>

           <div className="bg-indigo-600/5 p-4 md:p-6 rounded-[2rem] border border-indigo-100 flex flex-col md:flex-row justify-between items-center gap-4">
             <div className="text-center md:text-left flex-1">
               <span className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.4em]">Settlement Balance</span>
               <h2 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 tabular-nums tracking-tighter mt-1 leading-none">KSh {cartSummary.netTotal.toLocaleString()}</h2>
             </div>
             <div className="flex flex-col gap-2 w-full md:w-auto">
                <div className="grid grid-cols-3 gap-1.5">
                   <button onClick={() => setPaymentMethod('cash')} className={`py-3 px-4 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'cash' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}>Cash</button>
                   <button onClick={() => setPaymentMethod('card')} className={`py-3 px-4 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'card' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}>Card</button>
                   <button onClick={() => setPaymentMethod('mpesa')} className={`py-3 px-4 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'mpesa' ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-white border-slate-200 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600'}`}>Mpesa</button>
                </div>
             </div>
           </div>

           <button 
             onClick={handleCheckout} 
             disabled={cart.length === 0 || isProcessing || !isOnline} 
             className="w-full py-6 md:py-8 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-[2rem] uppercase tracking-[0.4em] text-sm flex items-center justify-center gap-4 active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/30 disabled:opacity-20"
           >
             {isProcessing ? <RefreshCw className="animate-spin" size={20} /> : <><CheckCircle2 size={24}/> Finalize Settlement</>}
           </button>
        </div>
      </div>

      {/* History Slide-out */}
      {showRecentSales && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl z-[60] flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-indigo-600 rounded-2xl text-white"><History size={24} /></div>
                 <div>
                   <h3 className="text-xl font-black uppercase tracking-tight">Terminal History</h3>
                   <p className="text-[10px] text-indigo-400 font-black tracking-widest uppercase">Session Audit Journal</p>
                 </div>
              </div>
              <button onClick={() => setShowRecentSales(false)} className="text-slate-400 hover:text-white transition-colors bg-white/10 p-3 rounded-2xl"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {recentSales.map(sale => (
                <div key={sale.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 space-y-6 group hover:border-indigo-600/20 transition-all">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Audit Key: #{sale.id.slice(0,8).toUpperCase()}</p>
                      <p className="text-2xl font-black text-slate-900 tracking-tighter">KSh {Number(sale.total_amount).toLocaleString()}</p>
                      <p className="text-[9px] text-slate-400 mt-3 font-bold flex items-center gap-2"><Clock size={12}/> {new Date(sale.sale_date).toLocaleString()}</p>
                    </div>
                    <span className="bg-white px-5 py-2 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 shadow-sm">{sale.payment_method}</span>
                  </div>
                  <button onClick={() => handleVoidSale(sale)} className="w-full py-4 bg-rose-50 text-rose-600 text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl border border-rose-100 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-3">
                    <Undo2 size={16} /> Void Transaction
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Success View */}
      {checkoutComplete && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[3.5rem] max-w-xl w-full text-center space-y-10 animate-in zoom-in duration-300 shadow-3xl">
             <div className="w-28 h-28 bg-emerald-50 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto border-[10px] border-emerald-100 animate-bounce">
               <CheckCircle2 size={56} strokeWidth={2.5} />
             </div>
             <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">Settled</h2>
             <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex justify-between items-center mx-4">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Total Collected</span>
                <span className="text-3xl font-black text-indigo-600 tabular-nums">KSh {cartSummary.netTotal.toLocaleString()}</span>
             </div>
             <button onClick={() => setCheckoutComplete(false)} className="w-full py-6 bg-slate-950 text-white font-black rounded-3xl uppercase tracking-[0.4em] text-xs hover:bg-indigo-600 transition-all shadow-2xl active:scale-95">Dismiss Ledger & New Order</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;