import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { 
  Search, 
  ShoppingCart, 
  Trash2, 
  Plus, 
  Minus, 
  CreditCard, 
  Banknote, 
  Smartphone,
  CheckCircle2,
  Printer,
  History,
  Undo2,
  X,
  RefreshCw,
  Percent,
  Tag
} from 'lucide-react';
import { Product, CartItem, User, Settings, Shift } from '../types';

interface POSProps {
  user: User;
  settings: Settings | null;
}

const POS: React.FC<POSProps> = ({ user, settings }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRecentSales, setShowRecentSales] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mpesa'>('cash');
  const [checkoutComplete, setCheckoutComplete] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  
  // Discount System States
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('fixed');
  const [showDiscountInput, setShowDiscountInput] = useState(false);

  useEffect(() => {
    fetchProducts();
    ensureValidShift();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase.from('products').select('*').order('name');
    if (data) setProducts(data);
  };

  const fetchRecentSales = async (shiftId: string) => {
    const { data } = await supabase
      .from('sales')
      .select('*, sale_items(*, product:products(name))')
      .eq('shift_id', shiftId)
      .order('sale_date', { ascending: false })
      .limit(10);
    if (data) setRecentSales(data);
  };

  const ensureValidShift = async () => {
    const { data: currentShift } = await supabase
      .from('shifts')
      .select('id, total_sales, total_cash, total_card')
      .eq('closed', false)
      .limit(1)
      .maybeSingle();

    if (currentShift) {
      setActiveShift(currentShift as Shift);
      fetchRecentSales(currentShift.id);
    } else {
      const { data: newShift } = await supabase.from('shifts').insert([{
        user_id: user.id,
        start_time: new Date().toISOString(),
        total_sales: 0,
        total_cash: 0,
        total_card: 0,
        closed: false
      }]).select('id, total_sales, total_cash, total_card').single();
      if (newShift) {
        setActiveShift(newShift as Shift);
        fetchRecentSales(newShift.id);
      }
    }
  };

  const handleVoidSale = async (sale: any) => {
    if (!confirm(`VOID transaction #${sale.id.slice(0,8).toUpperCase()}? This will restore inventory.`)) return;
    
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
        const { data: remSales } = await supabase.from('sales').select('total_amount, payment_method').eq('shift_id', activeShift.id);
        const totalSales = remSales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        const totalCash = remSales?.filter(s => s.payment_method === 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        const totalCard = remSales?.filter(s => s.payment_method !== 'cash').reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;

        await supabase.from('shifts').update({
          total_sales: totalSales,
          total_cash: totalCash,
          total_card: totalCard
        }).eq('id', activeShift.id);
        
        setActiveShift(prev => prev ? ({...prev, total_sales: totalSales, total_cash: totalCash, total_card: totalCard}) : null);
        fetchRecentSales(activeShift.id);
      }
      fetchProducts();
      alert("Sale successfully voided.");
    } catch (err: any) {
      alert("Void operation failed: " + err.message);
    } finally {
      setIsProcessing(false);
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
      return [...prev, { ...product, cartQuantity: 1 }];
    });
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = Math.max(0, item.cartQuantity + delta);
        if (newQty > item.stock_quantity) return item;
        return { ...item, cartQuantity: newQty };
      }
      return item;
    }).filter(item => item.cartQuantity > 0));
  };

  // --- Pricing Logic with Discount ---
  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);
  const taxRate = settings?.tax_rate || 0;
  const taxAmount = subtotal * (taxRate / 100);
  const grossTotal = subtotal + taxAmount;
  
  const discountAmount = discountType === 'percent' 
    ? (grossTotal * (discountValue / 100)) 
    : discountValue;
    
  const netTotal = Math.max(0, grossTotal - discountAmount);

  const handleCheckout = async () => {
    if (cart.length === 0 || !activeShift) return;
    setIsProcessing(true);
    try {
      // 1. Create Sale Record (Strictly using core columns)
      const { data: sale, error: saleErr } = await supabase.from('sales').insert([{
        total_amount: netTotal,
        payment_method: paymentMethod,
        cashier_id: user.id,
        shift_id: activeShift.id,
        sale_date: new Date().toISOString()
      }]).select().single();

      if (saleErr) throw saleErr;

      // 2. Insert Items
      const items = cart.map(item => ({
        sale_id: sale.id,
        product_id: item.id,
        quantity: item.cartQuantity,
        unit_price: item.price,
        total_price: item.price * item.cartQuantity
      }));
      await supabase.from('sale_items').insert(items);

      // 3. Update Inventory
      for (const item of cart) {
        await supabase.from('products').update({ stock_quantity: item.stock_quantity - item.cartQuantity }).eq('id', item.id);
      }

      // 4. Update Shift Totals (Strictly using confirmed core columns)
      const { data: st } = await supabase.from('shifts').select('total_sales, total_cash, total_card').eq('id', activeShift.id).single();
      const updatedTotals = {
        total_sales: Number(st.total_sales || 0) + netTotal,
        total_cash: paymentMethod === 'cash' ? Number(st.total_cash || 0) + netTotal : Number(st.total_cash || 0),
        total_card: paymentMethod !== 'cash' ? Number(st.total_card || 0) + netTotal : Number(st.total_card || 0),
      };
      
      const { error: shiftError } = await supabase.from('shifts').update(updatedTotals).eq('id', activeShift.id);
      if (shiftError) console.warn("Background shift sync issue:", shiftError.message);
      
      setActiveShift({...activeShift, ...updatedTotals});
      fetchRecentSales(activeShift.id);
      setCheckoutComplete(true);
      setCart([]);
      setDiscountValue(0); 
      setShowDiscountInput(false);
      fetchProducts();
    } catch (err: any) {
      alert("Transaction Error: " + err.message);
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
    <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] animate-in fade-in duration-500 pb-4 relative">
      {/* Product Browser */}
      <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input 
              type="text" 
              placeholder="Search services..." 
              className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20" 
              value={searchQuery} 
              onChange={e => setSearchQuery(e.target.value)} 
            />
          </div>
          <button onClick={() => setShowRecentSales(true)} className="p-4 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl border border-slate-100 transition-all flex items-center gap-2 font-black text-[10px] uppercase">
            <History size={18} /> History
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start custom-scrollbar">
          {filteredProducts.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock_quantity <= 0} className="p-6 rounded-[2rem] border border-slate-100 bg-white hover:border-blue-600 hover:shadow-xl transition-all text-left flex flex-col justify-between h-48 disabled:opacity-40 group relative overflow-hidden">
               <div className="relative z-10">
                 <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest bg-blue-50 px-2 py-1 rounded-md">{p.category}</span>
                 <h4 className="font-black text-slate-900 mt-3 line-clamp-2 leading-tight">{p.name}</h4>
               </div>
               <div className="relative z-10 flex items-center justify-between">
                 <p className="text-lg font-black text-slate-900">KSh {Number(p.price).toLocaleString()}</p>
                 <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                   <Plus size={16} />
                 </div>
               </div>
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Sidebar */}
      <div className="w-full lg:w-[450px] flex flex-col bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5">
        <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-4 text-white">
             <div className="p-2 bg-blue-600 rounded-lg"><ShoppingCart size={18} /></div>
             <h3 className="font-black uppercase tracking-widest text-[10px]">Active Basket</h3>
           </div>
           <span className="bg-white/10 text-slate-400 text-[10px] font-black px-4 py-2 rounded-full border border-white/5">{cart.length} ITEMS</span>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 space-y-4 dark-scrollbar custom-scrollbar">
           {cart.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-slate-800 opacity-30">
               <ShoppingCart size={80} strokeWidth={1} />
               <p className="mt-4 font-black text-[10px] uppercase tracking-[0.4em]">Cart is empty</p>
             </div>
           ) : (
             cart.map(item => (
               <div key={item.id} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5 group">
                 <div className="flex-1">
                   <h4 className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">{item.name}</h4>
                   <p className="text-xs font-bold text-slate-500">KSh {item.price.toLocaleString()}</p>
                 </div>
                 <div className="flex items-center gap-4">
                   <div className="flex items-center bg-black rounded-lg p-1 border border-white/10">
                     <button onClick={() => updateCartQuantity(item.id, -1)} className="p-1.5 text-slate-500 hover:text-white"><Minus size={14}/></button>
                     <span className="w-8 text-center text-white text-xs font-black">{item.cartQuantity}</span>
                     <button onClick={() => updateCartQuantity(item.id, 1)} className="p-1.5 text-slate-500 hover:text-white"><Plus size={14}/></button>
                   </div>
                   <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="text-rose-500/50 hover:text-rose-500"><Trash2 size={18}/></button>
                 </div>
               </div>
             ))
           )}
        </div>

        {/* Pricing Summary & Discount */}
        <div className="p-8 bg-black/40 border-t border-white/10 space-y-6">
           <div className="space-y-3">
             <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
               <span>Subtotal</span>
               <span>KSh {grossTotal.toLocaleString()}</span>
             </div>
             
             {discountAmount > 0 && (
               <div className="flex justify-between items-center text-[10px] font-black text-blue-400 uppercase tracking-widest animate-in slide-in-from-right-4">
                 <span className="flex items-center gap-1.5"><Tag size={12} /> Discount Applied ({discountValue}{discountType === 'percent' ? '%' : ' KSh'})</span>
                 <span>- KSh {discountAmount.toLocaleString()}</span>
               </div>
             )}

             <div className="flex justify-between items-baseline pt-4 border-t border-white/5">
               <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Net Total</span>
               <span className="text-4xl font-black text-white tabular-nums tracking-tighter">KSh {netTotal.toLocaleString()}</span>
             </div>
           </div>

           {/* Discount Interface */}
           <div className="space-y-3">
             <button 
               onClick={() => setShowDiscountInput(!showDiscountInput)}
               className={`w-full py-4 px-5 rounded-2xl border flex items-center justify-between transition-all group ${showDiscountInput ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10'}`}
             >
               <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2"><Percent size={14} /> {discountValue > 0 ? 'Modify Discount' : 'Apply Discount'}</span>
               {discountValue > 0 && <span className="bg-white/20 px-3 py-1 rounded-lg text-[10px] font-black">-{discountType === 'percent' ? discountValue + '%' : 'KSh ' + discountValue}</span>}
             </button>

             {showDiscountInput && (
               <div className="flex gap-2 animate-in zoom-in-95 duration-200">
                 <div className="flex-1 flex bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                   <button 
                     onClick={() => setDiscountType('fixed')}
                     className={`px-4 text-[10px] font-black transition-colors ${discountType === 'fixed' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                   >KSh</button>
                   <button 
                     onClick={() => setDiscountType('percent')}
                     className={`px-4 text-[10px] font-black border-l border-white/10 transition-colors ${discountType === 'percent' ? 'bg-blue-600 text-white' : 'text-slate-500'}`}
                   >%</button>
                   <input 
                     type="number" 
                     autoFocus
                     className="w-full bg-transparent px-4 py-3 text-white font-black text-sm outline-none placeholder:text-slate-700"
                     placeholder="Enter reduction amount..."
                     value={discountValue || ''}
                     onChange={(e) => setDiscountValue(Number(e.target.value))}
                   />
                 </div>
                 <button 
                   onClick={() => { setDiscountValue(0); setShowDiscountInput(false); }}
                   className="p-4 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all"
                 >
                   <Trash2 size={18} />
                 </button>
               </div>
             )}
           </div>

           <div className="grid grid-cols-3 gap-3">
             <button onClick={() => setPaymentMethod('cash')} className={`py-4 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'cash' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}>Cash</button>
             <button onClick={() => setPaymentMethod('card')} className={`py-4 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'card' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}>Card</button>
             <button onClick={() => setPaymentMethod('mpesa')} className={`py-4 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'mpesa' ? 'bg-blue-600 border-blue-500 text-white shadow-lg' : 'bg-white/5 border-white/10 text-slate-500 hover:bg-white/10'}`}>Mpesa</button>
           </div>

           <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing} className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl uppercase tracking-widest text-[11px] flex items-center justify-center gap-4 active:scale-[0.98] transition-all shadow-2xl shadow-blue-500/20 disabled:opacity-30">
             {isProcessing ? <RefreshCw className="animate-spin" /> : <><CheckCircle2 size={18}/> Finalize Settlement</>}
           </button>
        </div>
      </div>

      {/* History Slide-out */}
      {showRecentSales && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-[60] flex justify-end">
          <div className="w-[450px] bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-8 border-b border-slate-50 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                 <History className="text-blue-400" size={20} />
                 <h3 className="text-xs font-black uppercase tracking-widest">Recent Terminal Activity</h3>
              </div>
              <button onClick={() => setShowRecentSales(false)} className="text-slate-400 hover:text-white transition-colors bg-white/10 p-2 rounded-full"><X /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
              {recentSales.map(sale => (
                <div key={sale.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">TXN: #{sale.id.slice(0,8).toUpperCase()}</p>
                      <p className="text-xl font-black text-slate-900 leading-none">KSh {Number(sale.total_amount).toLocaleString()}</p>
                      <p className="text-[10px] text-slate-400 mt-2 font-bold">{new Date(sale.sale_date).toLocaleString()}</p>
                    </div>
                    <span className="bg-white px-3 py-1.5 border border-slate-200 rounded-xl text-[9px] font-black uppercase text-slate-600 shadow-sm">{sale.payment_method}</span>
                  </div>
                  <button onClick={() => handleVoidSale(sale)} className="w-full py-3.5 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-xl border border-rose-100 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center gap-2">
                    <Undo2 size={14} /> Void Transaction
                  </button>
                </div>
              ))}
              {recentSales.length === 0 && (
                <div className="py-20 text-center opacity-30 italic font-black text-xs uppercase tracking-widest">No activity in this session.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Success Dialog */}
      {checkoutComplete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-12 rounded-[3.5rem] max-w-md w-full text-center space-y-8 animate-in zoom-in duration-300 shadow-2xl border border-slate-100">
             <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto border-4 border-emerald-100 animate-bounce">
               <CheckCircle2 size={50} strokeWidth={2} />
             </div>
             <div>
               <h2 className="text-3xl font-black text-slate-900 leading-none">Transaction Settled</h2>
               <p className="text-slate-400 text-xs font-bold uppercase mt-5 tracking-widest leading-relaxed">Inventory adjusted & session balance updated.</p>
             </div>
             <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Final Amount Paid</span>
                <span className="text-2xl font-black text-slate-900">KSh {netTotal.toLocaleString()}</span>
             </div>
             <button onClick={() => setCheckoutComplete(false)} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest text-[11px] hover:bg-black transition-all shadow-xl shadow-slate-200">Dismiss & New Sale</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;