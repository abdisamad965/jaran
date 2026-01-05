
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
  Clock,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Product, CartItem, User, Settings, Shift } from '../types';
import { useNavigate } from 'react-router-dom';

interface POSProps {
  user: User;
  settings: Settings | null;
}

const POS: React.FC<POSProps> = ({ user, settings }) => {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
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

  const ensureValidShift = async () => {
    const { data: currentShift } = await supabase
      .from('shifts')
      .select('*')
      .eq('closed', false)
      .limit(1)
      .maybeSingle();

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (currentShift) {
      const shiftDateStr = new Date(currentShift.start_time).toISOString().split('T')[0];
      if (shiftDateStr !== todayStr) {
        // Automatic midnight rotation
        const { data: sales } = await supabase.from('sales').select('total_amount').eq('shift_id', currentShift.id);
        const totalAmt = sales?.reduce((acc, s) => acc + Number(s.total_amount), 0) || 0;
        await supabase.from('shifts').update({ closed: true, end_time: new Date().toISOString(), total_sales: totalAmt }).eq('id', currentShift.id);
        const { data: newShift } = await supabase.from('shifts').insert({ user_id: user.id, start_time: new Date().toISOString(), total_sales: 0, total_cash: 0, total_card: 0, closed: false }).select().single();
        setActiveShift(newShift);
      } else {
        setActiveShift(currentShift);
      }
    } else {
      const { data: newShift } = await supabase.from('shifts').insert({ user_id: user.id, start_time: new Date().toISOString(), total_sales: 0, total_cash: 0, total_card: 0, closed: false }).select().single();
      setActiveShift(newShift);
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

  const subtotal = cart.reduce((acc, item) => acc + (item.price * item.cartQuantity), 0);
  const tax = subtotal * ((settings?.tax_rate || 0) / 100);
  const total = subtotal + tax;

  const handleCheckout = async () => {
    await ensureValidShift(); 
    if (!activeShift) return alert("System authenticated failed. Restarting...");
    if (cart.length === 0) return;

    setIsCheckingOut(true);
    try {
      const { data: sale, error: saleErr } = await supabase.from('sales').insert({ total_amount: total, payment_method: paymentMethod, cashier_id: user.id, shift_id: activeShift.id }).select().single();
      if (saleErr) throw saleErr;

      const itemsToUpdate = cart.map(item => ({ sale_id: sale.id, product_id: item.id, quantity: item.cartQuantity, unit_price: item.price, total_price: item.price * item.cartQuantity }));
      await supabase.from('sale_items').insert(itemsToUpdate);

      for (const item of cart) {
        await supabase.from('products').update({ stock_quantity: item.stock_quantity - item.cartQuantity }).eq('id', item.id);
      }

      const { data: st } = await supabase.from('shifts').select('*').eq('id', activeShift.id).single();
      const updatedTotals = {
        total_sales: Number(st.total_sales || 0) + total,
        total_cash: paymentMethod === 'cash' ? Number(st.total_cash || 0) + total : Number(st.total_cash || 0),
        total_card: paymentMethod !== 'cash' ? Number(st.total_card || 0) + total : Number(st.total_card || 0),
      };
      await supabase.from('shifts').update(updatedTotals).eq('id', activeShift.id);
      
      setActiveShift({ ...st, ...updatedTotals });
      setLastSale({ ...sale, items: cart });
      setCheckoutComplete(true);
      setCart([]);
      fetchProducts();
    } catch (err: any) {
      alert("Terminal Transaction Failed: " + err.message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  const printReceipt = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    const receiptHtml = `
      <html>
        <head>
          <style>@page { margin: 0; } body { font-family: 'Courier New', monospace; width: 80mm; margin: 0; padding: 12mm 6mm; font-size: 13px; line-height: 1.5; } .header { text-align: center; margin-bottom: 18px; } .business { font-size: 16px; font-weight: bold; text-transform: uppercase; } .divider { border-top: 1px dashed #000; margin: 12px 0; } .item { display: flex; justify-content: space-between; margin-bottom: 6px; } .totals { font-weight: bold; margin-top: 12px; border-top: 1px solid #000; padding-top: 8px; } .footer { text-align: center; margin-top: 40px; font-size: 11px; font-weight: bold; }</style>
        </head>
        <body>
          <div class="header">
            <div class="business">${settings?.store_name || 'JARAN CLEANING'}</div>
            ${settings?.location ? `<div>📍 ${settings.location}</div>` : ''}
            ${settings?.phone ? `<div>📞 ${settings.phone}</div>` : ''}
          </div>
          <div class="divider"></div>
          <div>DATE: ${new Date(lastSale.sale_date).toLocaleString()}</div>
          <div>TRANSACTION: ${lastSale.id.slice(0,8).toUpperCase()}</div>
          <div class="divider"></div>
          ${lastSale.items.map((i: any) => `<div class="item"><span>${i.name} x${i.cartQuantity}</span><span>${(i.price * i.cartQuantity).toLocaleString()}</span></div>`).join('')}
          <div class="divider"></div>
          <div class="totals"><div class="item"><span>SUBTOTAL</span><span>KSh ${subtotal.toLocaleString()}</span></div><div class="item" style="font-size: 16px;"><span>TOTAL</span><span>KSh ${lastSale.total_amount.toLocaleString()}</span></div></div>
          <div class="divider"></div>
          <div class="item"><span>PAID VIA</span><span>${lastSale.payment_method.toUpperCase()}</span></div>
          <div class="footer"><p>THANK YOU FOR CHOOSING JARAN!</p></div>
          <script>window.onload = () => { window.print(); setTimeout(() => window.close(), 500); }</script>
        </body>
      </html>
    `;
    printWindow.document.write(receiptHtml);
    printWindow.document.close();
  };

  return (
    <div className="max-w-[1700px] mx-auto flex flex-col lg:flex-row gap-8 h-[calc(100vh-100px)] min-h-[600px] animate-in fade-in duration-500 pb-8">
      {/* Product Grid - Large & Readable */}
      <div className="flex-1 flex flex-col min-h-0 bg-white rounded-[3.5rem] shadow-sm border border-slate-100 overflow-hidden relative">
        <div className="px-10 py-8 border-b border-slate-50 flex items-center justify-between shrink-0">
          <div className="relative flex-1 max-w-lg group">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={22} />
            <input
              type="text"
              placeholder="Search service catalog..."
              className="w-full pl-16 pr-8 py-5 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 text-base font-black text-slate-800 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-5 bg-blue-50 px-8 py-4 rounded-2xl border border-blue-100">
             <div className="w-3 h-3 rounded-full bg-blue-600 animate-pulse"></div>
             <p className="text-[11px] font-black text-blue-700 uppercase tracking-widest leading-none">Terminal Live</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-10 py-10 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 content-start custom-scrollbar">
          {filteredProducts.map(product => (
            <button
              key={product.id}
              onClick={() => addToCart(product)}
              disabled={product.stock_quantity <= 0}
              className={`p-7 rounded-[2.5rem] border transition-all text-left flex flex-col justify-between group h-60 relative overflow-hidden ${
                product.stock_quantity <= 0 ? 'bg-slate-50 border-slate-100 opacity-50 grayscale cursor-not-allowed' : 'bg-white border-slate-100 hover:border-blue-600 hover:shadow-2xl active:scale-[0.98]'
              }`}
            >
              <div className="relative z-10">
                <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{product.category}</span>
                <h4 className="font-black text-slate-900 text-lg mt-3 leading-tight line-clamp-2">{product.name}</h4>
              </div>
              <div className="relative z-10 flex items-center justify-between pt-5 border-t border-slate-50">
                <p className="text-2xl font-black text-slate-900 tracking-tighter">KSh {Number(product.price).toLocaleString()}</p>
                <div className="text-right">
                   <p className="text-[9px] font-bold text-slate-400 uppercase leading-none mb-1">Stock</p>
                   <p className={`text-sm font-black ${product.stock_quantity <= product.reorder_level ? 'text-rose-600' : 'text-slate-600'}`}>{product.stock_quantity}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Terminal Area - Professional Dark UI */}
      <div className="w-full lg:w-[540px] flex flex-col bg-slate-950 rounded-[3.5rem] shadow-[0_50px_100px_-20px_rgba(15,23,42,0.3)] overflow-hidden shrink-0">
        <div className="p-10 border-b border-white/5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-5 text-white">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner">
              <ShoppingCart size={32} className="text-blue-500" />
            </div>
            <div>
              <h3 className="font-black uppercase tracking-[0.25em] text-xs leading-none mb-1.5">Terminal</h3>
              <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">Operator: {user.name.split(' ')[0]}</p>
            </div>
          </div>
          <span className="bg-blue-600 text-white text-[11px] font-black px-6 py-3 rounded-full shadow-2xl shadow-blue-500/30 tracking-widest">{cart.length} ITEMS</span>
        </div>

        <div className="flex-1 overflow-y-auto p-10 space-y-5 dark-scrollbar custom-scrollbar">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-800 space-y-8 opacity-30 grayscale">
              <ShoppingCart size={120} strokeWidth={0.5} />
              <p className="font-black text-[10px] uppercase tracking-[0.5em] text-center">Session Waiting</p>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} className="bg-white/5 p-6 rounded-[2rem] flex items-center justify-between group border border-white/5 animate-in slide-in-from-right-4">
                <div className="flex-1 pr-6">
                  <h4 className="text-base font-black text-white line-clamp-1">{item.name}</h4>
                  <p className="text-sm font-bold text-slate-500 mt-1">KSh {Number(item.price).toLocaleString()}</p>
                </div>
                <div className="flex items-center gap-6">
                  <div className="flex items-center bg-black/50 rounded-2xl p-2 border border-white/10">
                    <button onClick={() => updateCartQuantity(item.id, -1)} className="p-3 hover:text-white text-slate-500 transition-colors"><Minus size={18} /></button>
                    <span className="w-14 text-center text-base font-black text-white tabular-nums">{item.cartQuantity}</span>
                    <button onClick={() => updateCartQuantity(item.id, 1)} className="p-3 hover:text-white text-slate-500 transition-colors"><Plus size={18} /></button>
                  </div>
                  <button onClick={() => setCart(prev => prev.filter(i => i.id !== item.id))} className="text-rose-500 hover:text-rose-400 p-3 transition-colors">
                    <Trash2 size={24} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-10 bg-black/40 border-t border-white/10 space-y-10 shrink-0">
          <div className="space-y-4">
            <div className="flex justify-between text-slate-500 text-[10px] font-black uppercase tracking-[0.25em]">
              <span>Gross Subtotal</span>
              <span className="text-slate-300">KSh {subtotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-500 text-[10px] font-black uppercase tracking-[0.25em]">
              <span>VAT Consumption (${settings?.tax_rate || 0}%)</span>
              <span className="text-slate-300">KSh {tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-white pt-8 border-t border-white/5">
              <span className="text-xs font-black uppercase tracking-[0.4em] pt-4 text-slate-500">Net Due</span>
              <span className="text-6xl font-black text-blue-500 tabular-nums tracking-tighter">KSh {total.toLocaleString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button onClick={() => setPaymentMethod('cash')} className={`flex flex-col items-center gap-3 p-6 rounded-[1.5rem] border text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'cash' ? 'bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-500/30' : 'bg-white/5 border-white/10 text-slate-600 hover:bg-white/10'}`}><Banknote size={24} /> Cash</button>
            <button onClick={() => setPaymentMethod('card')} className={`flex flex-col items-center gap-3 p-6 rounded-[1.5rem] border text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'card' ? 'bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-500/30' : 'bg-white/5 border-white/10 text-slate-600 hover:bg-white/10'}`}><CreditCard size={24} /> Card</button>
            <button onClick={() => setPaymentMethod('mpesa')} className={`flex flex-col items-center gap-3 p-6 rounded-[1.5rem] border text-[10px] font-black uppercase tracking-widest transition-all ${paymentMethod === 'mpesa' ? 'bg-blue-600 border-blue-500 text-white shadow-2xl shadow-blue-500/30' : 'bg-white/5 border-white/10 text-slate-600 hover:bg-white/10'}`}><Smartphone size={24} /> Mpesa</button>
          </div>

          <button
            onClick={handleCheckout}
            disabled={cart.length === 0 || isCheckingOut}
            className="w-full py-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed text-white font-black rounded-[2rem] shadow-[0_25px_60px_-10px_rgba(59,130,246,0.4)] transition-all flex items-center justify-center gap-5 uppercase tracking-[0.5em] text-xs active:scale-95"
          >
            {isCheckingOut ? <RefreshCw className="animate-spin" size={24} /> : 'Process Settlement'}
          </button>
        </div>
      </div>

      {/* Modern Success Overlay */}
      {checkoutComplete && lastSale && (
        <div className="fixed inset-0 bg-slate-950/98 backdrop-blur-3xl z-50 flex items-center justify-center p-6 overflow-y-auto">
          <div className="bg-white rounded-[5rem] p-12 md:p-16 max-w-2xl w-full text-center space-y-10 shadow-2xl animate-in zoom-in duration-500 border border-slate-100 my-auto">
            <div className="w-32 h-32 bg-emerald-50 text-emerald-500 rounded-[2.5rem] flex items-center justify-center mx-auto shadow-inner border-4 border-emerald-100/50">
              <CheckCircle2 size={80} strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-5xl font-black text-slate-900 uppercase tracking-tighter leading-none mb-4">Paid & Settle</h2>
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.4em]">Transaction Hash: #{lastSale.id.slice(0,12).toUpperCase()}</p>
            </div>
            
            <div className="bg-slate-50 p-10 rounded-[3.5rem] space-y-5 text-left border border-slate-100">
               <div className="flex justify-between text-[11px] font-black text-slate-400 uppercase tracking-widest"><span>Payment Channel</span><span className="text-slate-900">{lastSale.payment_method.toUpperCase()}</span></div>
               <div className="flex justify-between items-center text-4xl font-black text-slate-900 pt-2">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Received</span>
                  <span>KSh {lastSale.total_amount.toLocaleString()}</span>
               </div>
            </div>

            <div className="flex gap-5 pt-4">
              <button onClick={() => setCheckoutComplete(false)} className="flex-1 py-7 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-3xl text-[12px] uppercase tracking-widest transition-all">Dismiss</button>
              <button onClick={printReceipt} className="flex-1 py-7 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-3xl shadow-2xl shadow-blue-500/30 transition-all flex items-center justify-center gap-5 text-[12px] uppercase tracking-widest"><Printer size={24} /> Print Receipt</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
