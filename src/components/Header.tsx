import React from 'react';
import { 
  Search, 
  Shield, 
  Database,
  Users,
  LogOut,
  Palette
} from 'lucide-react';
import { UserRole } from '../types';
import { AppUser } from '../utils/auth';

interface HeaderProps {
  currentUser: AppUser | null;
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  onOpenSearch: () => void;
  onOpenAuditLogs: () => void;
  onOpenUsersModal: () => void;
  onOpenThemeModal: () => void;
  onOpenLogout: () => void;
  activeTab: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  activeRole,
  setActiveRole,
  onOpenSearch,
  onOpenAuditLogs,
  onOpenUsersModal,
  onOpenThemeModal,
  onOpenLogout,
  activeTab,
}) => {
  const roles: UserRole[] = ['Super Admin', 'Admin', 'Teacher', 'Operator'];

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Super Admin':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Admin':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Teacher':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Operator':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const getTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Institute Analytics Dashboard';
      case 'attendance': return 'Digital Attendance Register & In/Out Tracking';
      case 'students': return 'Student Roster & Directory';
      case 'boxes': return 'Tablet Box Storage (7 Capacity Max)';
      case 'tablets': return 'Tablet Inventory Management';
      case 'assignments': return 'Tablet Student Assignments';
      case 'reports': return 'Attendance & Asset Reports';
      default: return 'Student Tablet Management System';
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-slate-200 transition-colors shadow-xs">
      <div className="px-4 lg:px-6 h-16 flex items-center justify-between gap-4">
        
        {/* Left Title & Status */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl bg-indigo-600 text-white font-extrabold text-xs shadow-sm">
            STM
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-900 flex items-center gap-2 tracking-tight">
              {getTitle()}
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-0.5 text-[10px] font-bold bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live System
              </span>
            </h1>
            <p className="text-[11px] text-slate-500 hidden sm:block">
              Replacing manual registers with digital tablet management & tracking
            </p>
          </div>
        </div>

        {/* Center Global Search Trigger */}
        <div className="flex-1 max-w-md hidden md:block">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-slate-500 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-slate-400" />
              <span>Search student, PIN, tablet, box number...</span>
            </div>
            <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[9px] font-mono font-bold text-slate-500 bg-white border border-slate-200 rounded shadow-2xs">
              ⌘K
            </kbd>
          </button>
        </div>

        {/* Right Actions & Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          
          {/* Mobile Search Icon */}
          <button
            onClick={onOpenSearch}
            className="md:hidden p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition"
            title="Search"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Theme Settings Module Trigger */}
          <button
            onClick={onOpenThemeModal}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer shadow-2xs"
            title="Theme Customization Module"
          >
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
            <span className="hidden sm:inline">Theme</span>
          </button>

          {/* User Management shortcut for admins */}
          <button
            onClick={onOpenUsersModal}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
            title="Manage System Users & Registration"
          >
            <Users className="w-3.5 h-3.5 text-blue-600" />
            <span>Users</span>
          </button>

          {/* Role Switcher */}
          <div className="relative group">
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
              <Shield className="w-3.5 h-3.5 ml-1 text-slate-500" />
              <select
                value={activeRole}
                onChange={(e) => setActiveRole(e.target.value as UserRole)}
                className={`text-xs font-bold px-2 py-0.5 rounded border bg-white shadow-2xs cursor-pointer outline-none transition ${getRoleBadgeColor(activeRole)}`}
                title="Switch role to simulate permissions"
              >
                {roles.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Audit Logs button */}
          <button
            onClick={onOpenAuditLogs}
            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition cursor-pointer"
            title="View Security & Audit Logs"
          >
            <Database className="w-4 h-4" />
          </button>

          {/* User Profile & Logout */}
          <div className="pl-2 border-l border-slate-200 flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-100 font-bold text-blue-700 flex items-center justify-center text-xs shrink-0 border border-blue-200">
              {currentUser?.fullName.charAt(0) || 'U'}
            </div>
            <div className="hidden xl:block text-left">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {currentUser?.fullName || 'Dr. Rajesh Sharma'}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">{activeRole}</div>
            </div>

            <button
              onClick={onOpenLogout}
              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer ml-1"
              title="Logout Account"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>
    </header>
  );
};
