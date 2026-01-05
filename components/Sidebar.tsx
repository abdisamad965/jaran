
import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ShoppingCart, 
  Package, 
  CreditCard, 
  Users, 
  BarChart3, 
  Clock, 
  Settings, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { User } from '../types';
import { supabase } from '../supabaseClient';

interface SidebarProps {
  user: User;
}

const Sidebar: React.FC<SidebarProps> = ({ user }) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/login');
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', roles: ['admin', 'cashier'] },
    { icon: ShoppingCart, label: 'POS Terminal', path: '/pos', roles: ['admin', 'cashier'] },
    { icon: Package, label: 'Services', path: '/inventory', roles: ['admin', 'cashier'] },
    { icon: CreditCard, label: 'Expenses', path: '/expenses', roles: ['admin', 'cashier'] },
    { icon: Users, label: 'Suppliers', path: '/suppliers', roles: ['admin', 'cashier'] },
    { icon: BarChart3, label: 'Reports', path: '/reports', roles: ['admin'] },
    { icon: Clock, label: 'Shifts', path: '/shifts', roles: ['admin', 'cashier'] },
    { icon: Settings, label: 'Settings', path: '/settings', roles: ['admin'] },
  ];

  return (
    <div className="hidden md:flex flex-col w-64 bg-slate-950 text-slate-400 h-screen sticky top-0 border-r border-white/5 shadow-2xl overflow-hidden shrink-0">
      {/* Brand Header */}
      <div className="p-6 flex items-center gap-3 border-b border-white/5 shrink-0 bg-slate-950">
        <div className="p-2.5 bg-blue-600 rounded-xl shadow-lg shadow-blue-500/20">
          <Sparkles className="text-white" size={18} />
        </div>
        <div>
          <h1 className="text-sm font-black text-white tracking-tighter leading-none">JARAN</h1>
          <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Cleaning Service</p>
        </div>
      </div>

      {/* Main Navigation - High Visibility for Laptops */}
      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto dark-scrollbar custom-scrollbar">
        {menuItems.filter(item => item.roles.includes(user.role)).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
                isActive 
                ? 'bg-blue-600 text-white shadow-xl shadow-blue-500/20 font-bold' 
                : 'hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            <span className="text-[10px] font-black uppercase tracking-[0.15em]">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Actions - Pinned and Visible */}
      <div className="p-4 border-t border-white/5 bg-slate-950 shrink-0">
        <div className="flex items-center gap-3 p-3 mb-2 bg-white/5 rounded-2xl border border-white/5">
          <div className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center font-black text-blue-400 text-xs shadow-inner">
            {user.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-black text-white truncate uppercase tracking-tight leading-none mb-1">{user.name}</p>
            <p className="text-[8px] text-slate-600 uppercase font-black tracking-widest leading-none">{user.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-4 py-3 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all font-black text-[10px] uppercase tracking-widest group"
        >
          <LogOut size={16} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Logout Session</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
