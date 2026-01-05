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
  RefreshCw
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
      .limit(8);
    if (data) setRecentSales(data);
  };

  const ensureValidShift = async () => {
    const { data: currentShift } = await supabase
      .from('shifts')
      .select('*')
      .eq('closed', false)
      .limit(1)
      .maybeSingle();

    if (currentShift) {
      setActiveShift(currentShift);
      fetchRecentSales(currentShift.id);
    } else {
      const { data: newShift } = await supabase.from('shifts').insert([{
        user_id: user.id,
        start_time: new Date().toISOString(),
        total_sales: 0,
        total_cash: 0,
        total_card: 0,
        closed: false
      }]).select().single();
      if (newShift) {
        setActiveShift(newShift);
        fetchRecentSales(newShift.id);
      }
    }
  };

  const handleVoidSale = async (sale: any) => {
    if (!confirm(`VOID transaction #${sale.id.slice(0,8).toUpperCase()}?`)) return;
    
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
      alert("Void completed.");
    } catch (err: any) {
      alert("Void failed: " + err.message);
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

  const total = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0 || !activeShift) return;
    setIsProcessing(true);
    try {
      const { data: sale, error: saleErr } = await supabase.from('sales').insert([{
        total_amount: total,
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
        unit_price: item.price,
        total_price: item.price * item.cartQuantity
      }));

      await supabase.from('sale_items').insert(items);

      for (const item of cart) {
        await supabase.from('products').update({ stock_quantity: item.stock_quantity - item.cartQuantity }).eq('id', item.id);
      }

      // Update Shift using core columns
      const { data: st } = await supabase.from('shifts').select('*').eq('id', activeShift.id).single();
      const updatedTotals = {
        total_sales: Number(st.total_sales || 0) + total,
        total_cash: paymentMethod === 'cash' ? Number(st.total_cash || 0) + total : Number(st.total_cash || 0),
        total_card: paymentMethod !== 'cash' ? Number(st.total_card || 0) + total : Number(st.total_card || 0),
      };
      await supabase.from('shifts').update(updatedTotals).eq('id', activeShift.id);
      
      setActiveShift({...st, ...updatedTotals});
      fetchRecentSales(activeShift.id);
      setLastSale({...sale, items: cart});
      setCheckoutComplete(true);
      setCart([]);
      fetchProducts();
    } catch (err: any) {
      alert("Checkout error: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-120px)] animate-in fade-in duration-500 pb-4 relative">
      {/* Product View */}
      <div className="flex-1 flex flex-col bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center justify-between shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
            <input type="text" placeholder="Search products..." className="w-full pl-14 pr-6 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold outline-none" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
          <button onClick={() => setShowRecentSales(true)} className="p-4 bg-slate-50 text-slate-400 hover:text-blue-600 rounded-2xl border border-slate-100 transition-all">
            <History size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-8 py-8 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 content-start custom-scrollbar">
          {filteredProducts.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} disabled={p.stock_quantity <= 0} className="p-6 rounded-[2rem] border border-slate-100 bg-white hover:border-blue-600 hover:shadow-xl transition-all text-left flex flex-col justify-between h-44 disabled:opacity-40">
               <div>
                 <span className="text-[9px] font-black text-blue-500 uppercase tracking-widest">{p.category}</span>
                 <h4 className="font-black text-slate-900 mt-2 line-clamp-2">{p.name}</h4>
               </div>
               <p className="text-xl font-black text-slate-900">KSh {Number(p.price).toLocaleString()}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Cart View */}
      <div className="w-full lg:w-[450px] flex flex-col bg-slate-950 rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5">
        <div className="p-8 border-b border-white/5 flex items-center justify-between shrink-0">
           <div className="flex items-center gap-4 text-white">
             <ShoppingCart className="text-blue-500" />
             <h3 className="font-black uppercase tracking-widest text-[10px]">Terminal Basket</h3>
           </div>
           <span className="bg-blue-600 text-white text-[10px] font-black px-4 py-2 rounded-full">{cart.length} ITEMS</span>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-4 custom-scrollbar">
           {cart.map(item => (
             <div key={item.id} className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5">
               <div className="flex-1">
                 <h4 className="text-sm font-black text-white">{item.name}</h4>
                 <p className="text-xs font-bold text-slate-500">KSh {item.price.toLocaleString()}</p>
               </div>
               <div className="flex items-center gap-4">
                 <div className="flex items-center bg-black rounded-lg p-1 border border-white/10">
                   <button onClick={() => updateCartQuantity(item.id, -1)} className="p-1.5 text-slate-500 hover:text-white"><Minus size={14}/></button>
                   <span className="w-6 text-center text-white text-xs font-black">{item.cartQuantity}</span>
                   <button onClick={() => updateCartQuantity(item.id, 1)} className="p-1.5 text-slate-500 hover:text-white"><Plus size={14}/></button>
                 </div>
                 <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="text-rose-500"><Trash2 size={18}/></button>
               </div>
             </div>
           ))}
        </div>
        <div className="p-8 bg-black/40 border-t border-white/10 space-y-6">
           <div className="flex justify-between items-baseline">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Amount Due</span>
             <span className="text-4xl font-black text-blue-500">KSh {total.toLocaleString()}</span>
           </div>
           <div className="grid grid-cols-3 gap-2">
             <button onClick={() => setPaymentMethod('cash')} className={`p-4 rounded-xl border text-[9px] font-black uppercase transition-all ${paymentMethod === 'cash' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>Cash</button>
             <button onClick={() => setPaymentMethod('card')} className={`p-4 rounded-xl border text-[9px] font-black uppercase transition-all ${paymentMethod === 'card' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>Card</button>
             <button onClick={() => setPaymentMethod('mpesa')} className={`p-4 rounded-xl border text-[9px] font-black uppercase transition-all ${paymentMethod === 'mpesa' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-white/5 border-white/10 text-slate-500'}`}>Mpesa</button>
           </div>
           <button onClick={handleCheckout} disabled={cart.length === 0 || isProcessing} className="w-full py-6 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl uppercase tracking-widest text-[11px] flex items-center justify-center gap-3">
             {isProcessing ? <RefreshCw className="animate-spin" /> : 'Settle Transaction'}
           </button>
        </div>
      </div>

      {/* History Drawer */}
      {showRecentSales && (
        <div className="absolute inset-y-0 right-0 w-[400px] bg-white shadow-2xl z-[60] border-l border-slate-100 flex flex-col animate-in slide-in-from-right duration-300 rounded-l-[3rem]">
          <div className="p-8 border-b border-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-900">Recent Terminal Activity</h3>
            <button onClick={() => setShowRecentSales(false)} className="text-slate-400"><X /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {recentSales.map(sale => (
              <div key={sale.id} className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-black text-slate-400">#{sale.id.slice(0,8).toUpperCase()}</p>
                    <p className="text-sm font-black text-slate-900">KSh {Number(sale.total_amount).toLocaleString()}</p>
                  </div>
                  <span className="bg-white px-3 py-1 border rounded-full text-[8px] font-black uppercase">{sale.payment_method}</span>
                </div>
                <button onClick={() => handleVoidSale(sale)} className="w-full py-3 bg-rose-50 text-rose-600 text-[10px] font-black uppercase rounded-xl border border-rose-100 hover:bg-rose-600 hover:text-white transition-all">Void Sale</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {checkoutComplete && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white p-12 rounded-[3.5rem] max-w-md w-full text-center space-y-8 animate-in zoom-in duration-300">
             <div className="w-24 h-24 bg-emerald-50 text-emerald-500 rounded-3xl flex items-center justify-center mx-auto border-4 border-emerald-100">
               <CheckCircle2 size={50} />
             </div>
             <div>
               <h2 className="text-3xl font-black text-slate-900 leading-none">Settled</h2>
               <p className="text-slate-400 text-xs font-bold uppercase mt-4 tracking-widest">Transaction Recorded Successfully</p>
             </div>
             <button onClick={() => setCheckoutComplete(false)} className="w-full py-5 bg-slate-900 text-white font-black rounded-2xl uppercase tracking-widest text-xs">Dismiss</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;