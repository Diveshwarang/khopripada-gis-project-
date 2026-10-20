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
      pillClass: 'bg-[#E05A47]/20 text-[#FCA5A5] border-[#E05A47]/60',
      borderClass: 'border-[#334B56]',
      glowClass: 'shadow-sm',
      icon: <Building className="w-3.5 h-3.5 text-[#FCA5A5]" />,
    },
    officer: {
      label: 'OFFICER',
      pillClass: 'bg-[#10B981]/20 text-[#6EE7B7] border-[#10B981]/60',
      borderClass: 'border-[#334B56]',
      glowClass: 'shadow-sm',
      icon: <ClipboardList className="w-3.5 h-3.5 text-[#6EE7B7]" />,
    },
    user: {
      label: 'RESIDENT',
      pillClass: 'bg-[#1B2F38] text-[#38BDF8] border-[#38BDF8]/40',
      borderClass: 'border-[#334B56]',
      glowClass: 'shadow-sm',
      icon: <User className="w-3.5 h-3.5 text-[#38BDF8]" />,
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
        className={`bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] text-[#F8FAFC] px-3.5 py-2 rounded-xl shadow-md flex items-center gap-2.5 transition active:scale-95 cursor-pointer text-sm`}
        title={`Logged in as ${session.name} (${session.designation}) - Click for Profile & Logout`}
      >
        {/* Avatar Circle with Status Dot */}
        <div className="relative flex items-center justify-center">
          <div className="w-8 h-8 rounded-xl bg-[#0C171C] border border-[#334B56] flex items-center justify-center text-xs font-bold text-[#F8FAFC]">
            {session.name.charAt(0)}
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#10B981] border border-[#132228]" />
        </div>

        {/* User Info & Role Pill */}
        <div className="hidden sm:flex flex-col text-left">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-[#F8FAFC] max-w-[120px] truncate">
              {session.name}
            </span>
            <span
              className={`text-[10px] font-bold tracking-wider uppercase px-1.5 py-0.5 rounded-md border ${currentRoleConfig.pillClass}`}
            >
              {currentRoleConfig.label}
            </span>
          </div>
          <span className="text-[11px] text-[#94A3B8] truncate max-w-[130px]">
            {session.designation}
          </span>
        </div>

        <ChevronDown
          className={`w-3.5 h-3.5 text-[#94A3B8] transition-transform ${
            isOpen ? 'rotate-180 text-[#F8FAFC]' : ''
          }`}
        />
      </button>

      {/* Profile & Session Dropdown Card */}
      {isOpen && (
        <div className="absolute top-14 right-0 z-[2500] w-72 backdrop-blur-2xl bg-[#132228]/98 border border-[#334B56] rounded-2xl shadow-[0_10px_30px_rgba(12,23,28,0.7)] p-3.5 text-xs text-[#F8FAFC] animate-in fade-in slide-in-from-top-2 flex flex-col gap-3">
          {/* Header Identity Details */}
          <div className="p-3 rounded-xl bg-[#1B2F38] border border-[#334B56]">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[#94A3B8]">
                Panchayat ID Card
              </span>
              <span
                className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full border ${currentRoleConfig.pillClass}`}
              >
                ● {currentRoleConfig.label}
              </span>
            </div>
            <div className="text-sm font-semibold text-[#F8FAFC]">{session.name}</div>
            <div className="text-xs text-[#94A3B8] font-medium">{session.designation}</div>

            <div className="mt-2.5 pt-2 border-t border-[#334B56] space-y-1 text-[11px] text-[#94A3B8]">
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0" />
                <span className="truncate">{session.email}</span>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px]">
                <Clock className="w-3.5 h-3.5 text-[#94A3B8] flex-shrink-0" />
                <span>Session Logged: {formattedLoginTime} IST</span>
              </div>
            </div>
          </div>

          {/* Quick Portal Switcher (For seamless multi-role testing) */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-[#94A3B8] flex items-center justify-between">
              <span>Switch Testing Role:</span>
              <RefreshCw className="w-3 h-3 text-[#38BDF8]" />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {(['admin', 'officer', 'user'] as Role[]).map((r) => (
                <button
                  key={r}
                  onClick={() => handleRoleQuickSwitch(r)}
                  className={`py-1 px-1.5 rounded-lg border text-[10px] font-semibold transition flex items-center justify-center gap-1 cursor-pointer ${
                    session.role === r
                      ? 'bg-[#10B981]/20 border-[#10B981]/60 text-[#6EE7B7] shadow-sm'
                      : 'bg-[#0C171C] border-[#334B56] text-[#94A3B8] hover:bg-[#1B2F38] hover:text-[#F8FAFC]'
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
                className="w-full py-2 px-3 rounded-xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#38BDF8]/40 text-[#38BDF8] font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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
          <div className="pt-2 border-t border-[#334B56]">
            <button
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full py-2 px-3 rounded-xl bg-[#E05A47]/20 hover:bg-[#E05A47]/30 border border-[#E05A47]/60 text-[#FCA5A5] font-semibold text-xs transition flex items-center justify-center gap-2 cursor-pointer active:scale-95"
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
