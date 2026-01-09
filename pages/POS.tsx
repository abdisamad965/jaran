
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
  Clock,
  Wifi,
  WifiOff,
  Tag
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

  // Helper for EAT Time (UTC+3)
  const getEATTime = () => {
    const d = new Date();
    const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
    return new Date(utc + (3600000 * 3));
  };

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
        .select('id, total_sales, total_cash, total_card, start_time')
        .eq('closed', false)
        .order('start_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (currentShift) {
        setActiveShift(currentShift as Shift);
        fetchRecentSales(currentShift.id);
      } else {
        // Automatically open a new shift if none exists
        const { data: newShift, error: createError } = await supabase.from('shifts').insert([{
          user_id: user.id,
          start_time: getEATTime().toISOString(),
          total_sales: 0,
          total_cash: 0,
          total_card: 0,
          closed: false
        }]).select('id, total_sales, total_cash, total_card, start_time').single();
        
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
        .limit(10);
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
      alert("No connection. Check internet before finalizing.");
      return;
    }
    
    setIsProcessing(true);
    try {
      // Use EAT for the sale date
      const saleTime = getEATTime().toISOString();

      const { data: sale, error: saleErr } = await supabase.from('sales').insert([{
        total_amount: cartSummary.netTotal,
        payment_method: paymentMethod,
        cashier_id: user.id,
        shift_id: activeShift.id,
        sale_date: saleTime
      }]).select().single();

      if (saleErr) throw saleErr;

      const items = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.customPrice, // Important: adjusted price saved here
        total_price: item.customPrice * item.cartQuantity
      }));
      
      const { error: itemsErr } = await supabase.from('sale_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Deduct stock
      for (const item of cart) {
        await supabase.rpc('decrement_stock', { row_id: item.id, count: item.cartQuantity });
      }

      // Update shift totals
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
      alert("Transaction failed: " + err.message);
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
      <div className="flex-1 lg:flex-none lg:w-[35%] xl:w-[35%] flex flex-col p-4 md:p-6 min-w-0 border-r border-slate-100">
        <div className="flex items-center justify-between mb-4 md:mb-6 bg-white p-3 md:p-4 rounded-3xl border border-slate-100 shadow-sm">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            <input 
              type="text" 
              placeholder="Search services..." 
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-black outline-none" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
          <button onClick={() => setShowRecentSales(true)} className="ml-2 p-3 bg-slate-900 text-white rounded-xl font-black hover:bg-black transition-all">
            <History size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-3 content-start custom-scrollbar pr-2 pb-10">
          {filteredProducts.map(p => (
            <button 
              key={p.id} 
              onClick={() => addToCart(p)} 
              disabled={p.stock_quantity <= 0}
              className="group p-4 bg-white border border-slate-100 rounded-[2rem] text-left hover:border-blue-600 hover:shadow-xl transition-all flex flex-col justify-between h-40 disabled:opacity-30 relative overflow-hidden"
            >
              <div>
                <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest px-2 py-0.5 bg-blue-50 rounded-lg">{p.category}</span>
                <h4 className="font-black text-slate-800 mt-2 line-clamp-2 text-[12px] leading-tight uppercase">{p.name}</h4>
              </div>
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-sm font-black text-slate-900 leading-none">KSh {Number(p.price).toLocaleString()}</p>
                </div>
                <div className="w-8 h-8 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all"><Plus size={16}/></div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT: Wholesale Ledger (DYNAMIC PRICING) */}
      <div className="w-full lg:w-[65%] xl:w-[65%] bg-white flex flex-col shadow-[-10px_0_40px_rgba(0,0,0,0.03)] relative overflow-hidden">
        {/* Sticky Header */}
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0 bg-white">
           <div className="flex items-center gap-5">
             <div className="p-4 bg-blue-600 rounded-2xl shadow-xl shadow-blue-600/20 text-white"><ShoppingCart size={24} /></div>
             <div>
               <h3 className="font-black uppercase tracking-[0.2em] text-xs text-slate-900 leading-none mb-1">Wholesale Ledger</h3>
               <p className="text-[9px] text-slate-400 font-black tracking-widest uppercase">EAT: {getEATTime().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} • Negotiated Pricing Active</p>
             </div>
           </div>
           <div className="flex items-center gap-3">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${isOnline ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'}`}>
                {isOnline ? 'Network: Online' : 'Network: Offline'}
              </div>
              <span className="bg-slate-900 text-white text-[10px] font-black px-5 py-2.5 rounded-2xl uppercase tracking-widest">{cart.length} Rows</span>
           </div>
        </div>
        
        {/* Scrollable Ledger Table */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4 custom-scrollbar bg-slate-50/20">
           {cart.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-200">
               <div className="p-12 bg-white rounded-full border-4 border-dashed border-slate-100">
                 <Tag size={80} strokeWidth={0.5} />
               </div>
               <p className="mt-8 font-black text-xs uppercase tracking-[0.6em] text-slate-300">Ready for Transaction</p>
             </div>
           ) : (
             cart.map(item => (
               <div key={item.id} className="bg-white p-5 rounded-[2.5rem] border border-slate-100 group hover:border-blue-500/30 hover:shadow-2xl hover:shadow-blue-500/5 transition-all flex items-center gap-6">
                 {/* Product Identity */}
                 <div className="flex-1 min-w-0">
                   <div className="flex items-center gap-2 mb-1">
                     <span className="text-[8px] font-black text-blue-500 uppercase px-1.5 py-0.5 bg-blue-50 rounded-md">REF: {item.id.slice(0,6).toUpperCase()}</span>
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Base Rate: KSh {item.price.toLocaleString()}</p>
                   </div>
                   <h4 className="text-sm md:text-base font-black text-slate-900 truncate leading-tight uppercase">{item.name}</h4>
                 </div>

                 {/* Quantity Controls */}
                 <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100 shrink-0">
                   <button onClick={() => updateCartQuantity(item.id, -1)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors bg-white rounded-xl shadow-sm"><Minus size={18}/></button>
                   <span className="w-12 text-center text-slate-900 text-lg font-black tabular-nums">{item.cartQuantity}</span>
                   <button onClick={() => updateCartQuantity(item.id, 1)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-blue-600 transition-colors bg-white rounded-xl shadow-sm"><Plus size={18}/></button>
                 </div>

                 {/* Price Adjustment Engine */}
                 <div className="w-48 lg:w-56 shrink-0">
                    <div className="flex items-center bg-white rounded-2xl px-5 py-3.5 border-2 border-slate-100 focus-within:border-blue-600 transition-all focus-within:shadow-xl focus-within:shadow-blue-500/10">
                      <span className="text-slate-400 font-black text-xs mr-2">KSh</span>
                      <input 
                        type="number" 
                        className="bg-transparent w-full text-slate-900 font-black text-xl outline-none tabular-nums"
                        value={item.customPrice === 0 ? '' : item.customPrice}
                        onChange={(e) => handlePriceChange(item.id, e.target.value)}
                        placeholder="Negotiated Price"
                      />
                    </div>
                 </div>

                 {/* Line Total */}
                 <div className="flex items-center gap-6 shrink-0">
                   <div className="text-right min-w-[120px]">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Row Sum</p>
                     <p className="text-2xl font-black text-blue-600 tabular-nums leading-none">KSh {(item.customPrice * item.cartQuantity).toLocaleString()}</p>
                   </div>
                   <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="text-slate-300 hover:text-rose-500 p-3 hover:bg-rose-50 rounded-2xl transition-all"><Trash2 size={20}/></button>
                 </div>
               </div>
             ))
           )}
        </div>

        {/* SETTLEMENT FOOTER */}
        <div className="px-10 py-8 bg-white border-t border-slate-100 space-y-6 shrink-0 shadow-[0_-20px_50px_rgba(0,0,0,0.04)]">
           <div className="flex justify-between items-end">
             <div className="space-y-6">
                <div className="flex items-center gap-3">
                   <button onClick={() => setPaymentMethod('cash')} className={`py-3 px-6 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'cash' ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Cash</button>
                   <button onClick={() => setPaymentMethod('mpesa')} className={`py-3 px-6 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'mpesa' ? 'bg-emerald-600 border-emerald-600 text-white shadow-xl' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Mpesa</button>
                   <button onClick={() => setPaymentMethod('card')} className={`py-3 px-6 rounded-2xl border text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'card' ? 'bg-slate-900 border-slate-900 text-white shadow-xl' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`}>Card</button>
                </div>
                <div className="flex gap-10">
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Gross Subtotal</p>
                    <p className="text-xl font-black text-slate-500 tabular-nums">KSh {cartSummary.subtotal.toLocaleString()}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Tax (EAT Standard)</p>
                    <p className="text-xl font-black text-slate-500 tabular-nums">KSh {cartSummary.taxAmount.toLocaleString()}</p>
                  </div>
                </div>
             </div>
             
             <div className="text-right">
                <span className="text-[11px] font-black text-blue-600 uppercase tracking-[0.4em]">Final Settlement</span>
                <h2 className="text-6xl lg:text-7xl font-black text-slate-900 tabular-nums tracking-tighter mt-2 leading-none">KSh {cartSummary.netTotal.toLocaleString()}</h2>
             </div>
           </div>

           <button 
             onClick={handleCheckout} 
             disabled={cart.length === 0 || isProcessing || !isOnline} 
             className="w-full py-8 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-[3rem] uppercase tracking-[0.5em] text-sm flex items-center justify-center gap-6 active:scale-[0.99] transition-all shadow-2xl shadow-blue-600/30 disabled:opacity-20"
           >
             {isProcessing ? <RefreshCw className="animate-spin" size={24} /> : <><CheckCircle2 size={32}/> Commit Transaction</>}
           </button>
        </div>
      </div>

      {/* History Side-out */}
      {showRecentSales && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl z-[60] flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-500">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-4">
                 <div className="p-3 bg-blue-600 rounded-2xl text-white"><History size={24} /></div>
                 <div>
                   <h3 className="text-xl font-black uppercase tracking-tight">Today's Audit Trail</h3>
                   <p className="text-[10px] text-blue-400 font-black tracking-widest uppercase">Live Terminal Records (EAT)</p>
                 </div>
              </div>
              <button onClick={() => setShowRecentSales(false)} className="text-slate-400 hover:text-white transition-colors bg-white/10 p-3 rounded-2xl"><X size={24}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
              {recentSales.map(sale => (
                <div key={sale.id} className="bg-slate-50 p-6 rounded-[2.5rem] border border-slate-100 space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SALE: #{sale.id.slice(0,8).toUpperCase()}</p>
                      <p className="text-3xl font-black text-slate-900 tracking-tighter">KSh {Number(sale.total_amount).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-500 mt-4 font-black flex items-center gap-2 uppercase tracking-widest"><Clock size={12}/> {new Date(sale.sale_date).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})} EAT</p>
                    </div>
                    <span className="bg-white px-5 py-2 border border-slate-200 rounded-2xl text-[10px] font-black uppercase text-slate-600 shadow-sm">{sale.payment_method}</span>
                  </div>
                </div>
              ))}
              {recentSales.length === 0 && <p className="text-center text-slate-300 font-black text-xs uppercase tracking-widest py-20">No transactions recorded in this session</p>}
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {checkoutComplete && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
          <div className="bg-white p-12 rounded-[4rem] max-w-xl w-full text-center space-y-10 animate-in zoom-in duration-300 shadow-3xl">
             <div className="w-32 h-32 bg-emerald-50 text-emerald-500 rounded-[3rem] flex items-center justify-center mx-auto border-[10px] border-emerald-100 animate-bounce">
               <CheckCircle2 size={64} strokeWidth={2.5} />
             </div>
             <h2 className="text-4xl font-black text-slate-900 tracking-tighter leading-none uppercase">Transaction Locked</h2>
             <div className="p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 flex justify-between items-center mx-4">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Digital Receipt Value</span>
                <span className="text-4xl font-black text-blue-600 tabular-nums">KSh {cartSummary.netTotal.toLocaleString()}</span>
             </div>
             <button onClick={() => setCheckoutComplete(false)} className="w-full py-7 bg-slate-950 text-white font-black rounded-[2.5rem] uppercase tracking-[0.4em] text-xs hover:bg-blue-600 transition-all shadow-2xl active:scale-95">Next Transaction</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
    