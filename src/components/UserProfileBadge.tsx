import React, { useState, useRef, useEffect } from 'react';
import {
  User,
  LogOut,
  ChevronDown,
  ClipboardList,
  Building,
  Clock,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types/auth';

interface UserProfileBadgeProps {
  onRoleSwitched?: () => void;
  onExportAudit?: () => void;
}

export const UserProfileBadge: React.FC<UserProfileBadgeProps> = ({ onRoleSwitched, onExportAudit }) => {
  const { session, logout, loginAsDemoRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  if (!session) return null;

  const roleConfigs: Record<
    Role,
    {
      label: string;
      pillClass: string;
      borderClass: string;
      glowClass: string;
      icon: React.ReactNode;
    }
  > = {
    admin: {
      label: 'ADMIN',
      pillClass: 'bg-rose-500/20 text-rose-300 border-rose-500/50',
      borderClass: 'border-rose-500/40',
      glowClass: 'shadow-[0_0_12px_rgba(244,63,94,0.3)]',
      icon: <Building className="w-3.5 h-3.5 text-rose-400" />,
    },
    officer: {
      label: 'OFFICER',
      pillClass: 'bg-blue-500/20 text-blue-300 border-blue-500/50',
      borderClass: 'border-blue-500/40',
      glowClass: 'shadow-[0_0_12px_rgba(59,130,246,0.3)]',
      icon: <ClipboardList className="w-3.5 h-3.5 text-blue-400" />,
    },
    user: {
      label: 'RESIDENT',
      pillClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50',
      borderClass: 'border-emerald-500/40',
      glowClass: 'shadow-[0_0_12px_rgba(16,185,129,0.3)]',
      icon: <User className="w-3.5 h-3.5 text-emerald-400" />,
    },
  };

  const currentRoleConfig = roleConfigs[session.role] || roleConfigs.user;

  const handleRoleQuickSwitch = (role: Role) => {
    loginAsDemoRole(role);
    setIsOpen(false);
    if (onRoleSwitched) onRoleSwitched();
  };

  const formattedLoginTime = session.loginTime
    ? new Date(session.loginTime).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Active';

  return (
    <div className="relative pointer-events-auto" ref={dropdownRef}>
      {/* Active User Badge Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`backdrop-blur-xl bg-slate-900/90 hover:bg-slate-800/90 border ${currentRoleConfig.borderClass} ${currentRoleConfig.glowClass} text-slate-100 px-3 py-1.5 rounded-2xl shadow-2xl flex items-center gap-2.5 transition active:scale-95 cursor-pointer`}
        title={`Logged in as ${session.name} (${session.designation}) - Click for Profile & Logout`}
      >
        {/* Avatar Circle with Status Dot */}
        <div className="relative flex items-center justify-center">
          <div className="w-7 h-7 rounded-xl bg-slate-950 border border-slate-700 flex items-center justify-center text-xs font-bold text-slate-200">
            {session.name.charAt(0)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-slate-950" />
        </div>

        {/* User Info & Role Pill */}
        <div className="flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-white max-w-[120px] truncate">
              {session.name}
            </span>
            <span
              className={`text-[9px] font-black tracking-wider uppercase px-1.5 py-0.2 rounded-md border ${currentRoleConfig.pillClass}`}
            >
              {currentRoleConfig.label}
            </span>
          </div>
          <span className="text-[10px] text-slate-400 truncate max-w-[130px]">
            {session.designation}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
            isOpen ? 'rotate-180 text-white' : ''
          }`}
        />
      </button>

      {/* Profile & Session Dropdown Card */}
      {isOpen && (
        <div className="absolute top-12 right-0 z-[2500] w-72 backdrop-blur-2xl bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-[0_15px_50px_rgba(0,0,0,0.6)] p-3.5 text-xs text-slate-200 animate-in fade-in slide-in-from-top-2 flex flex-col gap-3">
          {/* Header Identity Details */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Panchayat ID Card
              </span>
              <span
                className={`text-[10px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full border ${currentRoleConfig.pillClass}`}
              >
                ● {currentRoleConfig.label}
              </span>
            </div>
            <div className="text-sm font-bold text-white">{session.name}</div>
            <div className="text-xs text-slate-300 font-medium">{session.designation}</div>

            <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1 text-[11px] text-slate-400">
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span className="truncate">{session.email}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <Clock className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                <span>Session Logged: {formattedLoginTime} IST</span>
              </div>
            </div>
          </div>

          {/* Quick Portal Switcher (For seamless multi-role testing) */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400 flex items-center justify-between">
              <span>Switch Testing Role:</span>
              <RefreshCw className="w-3 h-3 text-cyan-400" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['admin', 'officer', 'user'] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleQuickSwitch(r)}
                  className={`py-1 px-1.5 rounded-lg border text-[10px] font-bold transition flex items-center justify-center gap-1 cursor-pointer ${
                    session.role === r
                      ? 'bg-slate-800 border-cyan-400 text-cyan-300 shadow-sm'
                      : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <span>{r === 'admin' ? '🏛️' : r === 'officer' ? '📋' : '👤'}</span>
                  <span className="capitalize">{r === 'user' ? 'Resident' : r}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Export Audit Summary Option (Admin & Officer) */}
          {onExportAudit && session.role !== 'user' && (
            <div className="pt-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  onExportAudit();
                }}
                className="w-full py-2 px-3 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>
                  {session.role === 'admin'
                    ? 'Export Panchayat Audit (PDF/CSV)'
                    : 'Export Field Worklist (PDF)'}
                </span>
              </button>
            </div>
          )}

          {/* Sign Out Action */}
          <div className="pt-2 border-t border-slate-800/80">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/40 text-rose-300 font-bold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out of Gateway</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
