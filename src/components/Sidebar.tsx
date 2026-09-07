import React from 'react';
import { LayoutDashboard, ClipboardCheck, Users, Box, BarChart3, Settings, ChevronLeft, ChevronRight, Search, Palette, Shield, Database, LogOut, Clock3, ClipboardList, Download } from 'lucide-react';
import { UserRole } from '../types';
import { AppUser } from '../utils/auth';
import logoUrl from '../assets/images/school_management_logo_1785906402051.jpg';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  collapsed: boolean;
  setCollapsed: (collapsed: boolean) => void;
  currentUser: AppUser | null;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  onOpenSearch: () => void;
  onOpenAuditLogs: () => void;
  onOpenUsersModal: () => void;
  onOpenThemeModal: () => void;
  onOpenLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, collapsed, setCollapsed, currentUser, activeRole, setActiveRole, onOpenSearch, onOpenAuditLogs, onOpenUsersModal, onOpenThemeModal, onOpenLogout }) => {
  const roles: UserRole[] = ['Super Admin', 'Admin', 'Teacher', 'Operator'];
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'attendance', label: 'Attendance', icon: ClipboardCheck, badge: 'Live' },
    { id: 'boxes', label: 'Boxes', icon: Box },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'tablet-usage', label: 'Tablet Usage', icon: Clock3, badge: 'NEW' },
    { id: 'tablet-movement', label: 'Tablet Movement', icon: ClipboardList, badge: 'NEW' },
    { id: 'student-download', label: 'Student App', icon: Download, badge: 'APK' },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return <aside className={`fixed left-0 top-0 bottom-0 z-30 bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shadow-sm select-none ${collapsed ? 'w-16' : 'w-64'}`}>
    <button onClick={() => setCollapsed(!collapsed)} className="absolute -right-3 top-5 bg-white border border-slate-200 text-slate-600 hover:text-blue-600 p-1.5 rounded-full shadow-md z-40 cursor-pointer transition hover:scale-110" title={collapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}>{collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}</button>
    <div className={`p-3.5 border-b border-slate-100 flex items-center ${collapsed ? 'justify-center' : 'justify-between'}`}><div className="flex items-center gap-3 overflow-hidden"><img src={logoUrl} alt="Logo" className="w-9 h-9 rounded-xl object-cover shadow-md shrink-0" />{!collapsed && <div className="min-w-0"><h1 className="text-xs font-black text-slate-900 tracking-tight uppercase truncate">Attendance OS</h1><p className="text-[10px] text-slate-500 font-medium truncate">Digital Register</p></div>}</div></div>
    <nav className="flex-1 p-2 space-y-1.5 overflow-y-auto">{navItems.map(({ id, label, icon: Icon, badge }) => { const active = activeTab === id; return <button key={id} onClick={() => setActiveTab(id)} className={`flex items-center rounded-xl font-bold text-xs transition-all cursor-pointer group relative ${collapsed ? 'w-10 h-10 mx-auto justify-center' : 'w-full px-3 py-2.5 gap-3'} ${active ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`} title={collapsed ? label : undefined}><Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'}`} />{!collapsed && <div className="flex-1 flex items-center justify-between text-left min-w-0"><span className="truncate">{label}</span>{badge && <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${active ? 'bg-white/20 text-white' : 'bg-blue-50 text-blue-600 border border-blue-200/80'}`}>{badge}</span>}</div>}{collapsed && <div className="absolute left-14 bg-slate-900 text-white text-xs font-semibold px-2.5 py-1 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap shadow-xl">{label}</div>}</button>; })}</nav>
    <div className={`p-2 border-t border-slate-100 bg-slate-50/50 flex ${collapsed ? 'flex-col items-center gap-1.5' : 'items-center justify-around gap-1'}`}><button onClick={onOpenSearch} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition cursor-pointer" title="Search"><Search className="w-4 h-4" /></button><button onClick={onOpenThemeModal} className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition cursor-pointer" title="Theme Settings"><Palette className="w-4 h-4" /></button>{!collapsed && <><button onClick={onOpenUsersModal} className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition cursor-pointer" title="Manage Users"><Users className="w-4 h-4" /></button><button onClick={onOpenAuditLogs} className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-lg transition cursor-pointer" title="Audit Logs"><Database className="w-4 h-4" /></button></>}</div>
    {collapsed ? <div className="py-2 border-t border-slate-100 bg-slate-50/80 flex justify-center"><button onClick={() => { const nextIndex = (roles.indexOf(activeRole) + 1) % roles.length; setActiveRole(roles[nextIndex]); }} className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-white transition cursor-pointer" title={`Role: ${activeRole} (Click to switch)`}><Shield className="w-4 h-4 text-blue-600" /></button></div> : <div className="px-3 py-2 border-t border-slate-100 bg-slate-50/80"><div className="flex items-center justify-between gap-1 text-[11px]"><span className="font-bold text-slate-500 flex items-center gap-1"><Shield className="w-3.5 h-3.5 text-blue-600" /> Role:</span><select value={activeRole} onChange={(e) => setActiveRole(e.target.value as UserRole)} className="text-[11px] font-bold px-2 py-1 rounded-lg border border-slate-200 bg-white text-slate-800 cursor-pointer outline-none shadow-2xs hover:border-blue-300">{roles.map(r => <option key={r} value={r}>{r}</option>)}</select></div></div>}
    <div className={`border-t border-slate-200 bg-slate-50/90 rounded-xl border shadow-2xs ${collapsed ? 'm-1.5 p-1.5 flex flex-col items-center gap-1.5' : 'm-2 p-2.5 flex items-center justify-between gap-2'}`}>{collapsed ? <><div className="w-8 h-8 rounded-full bg-blue-100 font-extrabold text-blue-700 flex items-center justify-center text-xs shrink-0 border border-blue-200 shadow-2xs" title={`${currentUser?.fullName || 'User'} (${activeRole})`}>{currentUser?.fullName?.charAt(0) || 'U'}</div><button onClick={onOpenLogout} className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer" title="Logout Account"><LogOut className="w-3.5 h-3.5" /></button></> : <><div className="flex items-center gap-2.5 min-w-0"><div className="w-8 h-8 rounded-full bg-blue-100 font-extrabold text-blue-700 flex items-center justify-center text-xs shrink-0 border border-blue-200 shadow-2xs">{currentUser?.fullName?.charAt(0) || 'U'}</div><div className="min-w-0 flex-1"><div className="text-xs font-bold text-slate-900 truncate leading-tight">{currentUser?.fullName || 'User'}</div><div className="text-[10px] text-slate-500 font-medium truncate">{activeRole}</div></div></div><button onClick={onOpenLogout} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer shrink-0" title="Logout Account"><LogOut className="w-4 h-4" /></button></>}</div>
  </aside>;
};
