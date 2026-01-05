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
    <div className="hidden md:flex flex-col w-60 bg-slate-950 text-slate-400 h-screen sticky top-0 border-r border-white/5 shadow-2xl overflow-hidden shrink-0">
      {/* Brand Header */}
      <div className="p-5 flex items-center gap-3 border-b border-white/5 shrink-0 bg-slate-950">
        <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-500/20">
          <Sparkles className="text-white" size={16} />
        </div>
        <div>
          <h1 className="text-xs font-black text-white tracking-tighter leading-none">JARAN</h1>
          <p className="text-[7px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">Cleaning Service</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto dark-scrollbar custom-scrollbar">
        {menuItems.filter(item => item.roles.includes(user.role)).map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => 
              `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                isActive 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20 font-bold' 
                : 'hover:bg-white/5 hover:text-white'
              }`
            }
          >
            <item.icon size={16} />
            <span className="text-[9px] font-black uppercase tracking-widest">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User Actions */}
      <div className="p-3 border-t border-white/5 bg-slate-950 shrink-0">
        <div className="flex items-center gap-2.5 p-2.5 mb-1.5 bg-white/5 rounded-xl border border-white/5">
          <div className="w-8 h-8 rounded-lg bg-slate-900 border border-white/10 flex items-center justify-center font-black text-blue-400 text-[10px]">
            {user.name.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <p className="text-[9px] font-black text-white truncate uppercase tracking-tight leading-none mb-0.5">{user.name}</p>
            <p className="text-[7px] text-slate-600 uppercase font-black tracking-widest leading-none">{user.role}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 w-full px-3 py-2.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all font-black text-[9px] uppercase tracking-widest group"
        >
          <LogOut size={14} className="group-hover:-translate-x-0.5 transition-transform" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;