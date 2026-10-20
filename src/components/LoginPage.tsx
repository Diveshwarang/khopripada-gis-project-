import React, { useState } from 'react';
import {
  Shield,
  User,
  ClipboardList,
  Building,
  KeyRound,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  Sparkles,
  MapPin,
  CheckCircle2,
  Lock,
  Cpu,
  Compass,
} from 'lucide-react';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext';
import type { Role } from '../types/auth';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemoRole } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role>('admin');
  const [email, setEmail] = useState<string>(DEMO_ACCOUNTS.admin.email);
  const [password, setPassword] = useState<string>(DEMO_ACCOUNTS.admin.password);
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Switch selected role tab and populate corresponding credentials for fast testing
  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setEmail(DEMO_ACCOUNTS[role].email);
    setPassword(DEMO_ACCOUNTS[role].password);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const res = await login(email, password);
      if (!res.success) {
        setErrorMessage(res.error || 'Authentication failed. Please verify credentials.');
      }
    } catch {
      setErrorMessage('Unexpected authentication error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGuestVillager = () => {
    loginAsDemoRole('user');
  };

  return (
    <div className="relative min-h-screen w-screen overflow-x-hidden bg-[#0C171C] font-sans flex items-center justify-center p-4 sm:p-6 lg:p-8 select-none">
      {/* Background High-Tech GIS & Satellite Backdrop */}
      <div
        className="absolute inset-0 z-0 bg-cover bg-center opacity-25 mix-blend-luminosity filter blur-[1px] scale-105"
        style={{
          backgroundImage:
            "url('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/28096/44760')",
        }}
      />

      {/* Slate-Marine Radial Glow & Spatial Grid Overlay */}
      <div className="absolute inset-0 z-0 bg-gradient-to-tr from-[#0C171C] via-[#132228]/95 to-[#1B2F38]/80" />
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#38BDF8]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#334B56_1px,transparent_1px)] [background-size:32px_32px] opacity-25 pointer-events-none" />

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-4xl backdrop-blur-2xl bg-[#132228]/95 border border-[#334B56] rounded-3xl shadow-[0_10px_40px_rgba(12,23,28,0.8)] overflow-hidden flex flex-col md:flex-row animate-in fade-in zoom-in-95 duration-300">
        
        {/* Left Side: Village GIS Twin Branding & Highlights */}
        <div className="w-full md:w-5/12 p-6 sm:p-8 bg-gradient-to-br from-[#0C171C] via-[#132228] to-[#0C171C] border-b md:border-b-0 md:border-r border-[#334B56] flex flex-col justify-between relative overflow-hidden">
          {/* Subtle Ambient Accent */}
          <div className="absolute -top-12 -left-12 w-44 h-44 bg-[#38BDF8]/15 rounded-full blur-2xl" />

          <div>
            {/* Official Emblem & Panchayat Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-[#1B2F38] border border-[#334B56] shadow-md flex items-center justify-center">
                <Shield className="w-6 h-6 text-[#38BDF8]" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-bold tracking-widest text-[#38BDF8] bg-[#1B2F38] px-2.5 py-0.5 rounded-full border border-[#38BDF8]/40">
                    Bapane Gram Panchayat
                  </span>
                </div>
                <h2 className="text-xs font-semibold text-[#94A3B8] mt-0.5">
                  Vasai-Virar Sub-District • Palghar
                </h2>
              </div>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-[#F8FAFC] tracking-tight leading-tight">
              Smart Village GIS
              <span className="block text-transparent bg-clip-text bg-gradient-to-r from-[#38BDF8] via-[#F8FAFC] to-[#10B981]">
                Khopripada Digital Twin
              </span>
            </h1>

            <p className="text-xs text-[#94A3B8] mt-3 leading-relaxed">
              Decentralized geospatial management and community decision intelligence system for rural governance, facility monitoring, and grievance resolution.
            </p>

            {/* Key Platform Highlights */}
            <div className="mt-6 space-y-2.5">
              <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#0C171C] p-2.5 rounded-xl border border-[#334B56]">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#F8FAFC]">Role-Segregated Portals:</strong> Admin, Officer, and Villager workflows with granular spatial access control.
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#0C171C] p-2.5 rounded-xl border border-[#334B56]">
                <Cpu className="w-4 h-4 text-[#38BDF8] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#F8FAFC]">ML Decision Support:</strong> Priority scoring (0–100), DBSCAN failure clustering, and municipal budgeting models.
                </div>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#0C171C] p-2.5 rounded-xl border border-[#334B56]">
                <Compass className="w-4 h-4 text-[#FCD34D] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-[#F8FAFC]">100% Offline Capability:</strong> Full local IndexedDB and service worker caching for field inspections.
                </div>
              </div>
            </div>
          </div>

          {/* Village Quick Geolocation Pill */}
          <div className="mt-6 pt-4 border-t border-[#334B56] flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1.5 text-[#38BDF8]">
              <MapPin className="w-3.5 h-3.5" />
              19.3551°N, 72.8846°E
            </span>
            <span className="bg-[#1B2F38] border border-[#334B56] px-2 py-0.5 rounded text-[#94A3B8]">
              Corridor 401208
            </span>
          </div>
        </div>

        {/* Right Side: Authentication Gateway & Portal Selector */}
        <div className="w-full md:w-7/12 p-6 sm:p-8 flex flex-col justify-between bg-[#132228]">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <span className="text-xs uppercase font-bold tracking-wider text-[#94A3B8]">
                  Authentication Gateway
                </span>
                <h3 className="text-lg font-bold text-[#F8FAFC]">Select Access Portal</h3>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#10B981] bg-[#10B981]/20 px-2.5 py-1 rounded-full border border-[#10B981]/40">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
                Offline Ready
              </span>
            </div>

            {/* Role Selector Tabs (Villager, Officer, Admin) */}
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[
                {
                  id: 'user',
                  label: 'Villager Portal',
                  sub: 'Khopripada Citizen',
                  icon: <User className="w-4 h-4" />,
                  color: 'hover:border-[#10B981]/60',
                  active: 'bg-[#1B2F38] border-[#10B981] text-[#6EE7B7] shadow-sm',
                },
                {
                  id: 'officer',
                  label: 'Field Officer',
                  sub: 'Gram Sevak / Insp',
                  icon: <ClipboardList className="w-4 h-4" />,
                  color: 'hover:border-[#38BDF8]/60',
                  active: 'bg-[#1B2F38] border-[#38BDF8] text-[#38BDF8] shadow-sm',
                },
                {
                  id: 'admin',
                  label: 'Panchayat Admin',
                  sub: 'Sarpanch / Lead',
                  icon: <Building className="w-4 h-4" />,
                  color: 'hover:border-[#E05A47]/60',
                  active: 'bg-[#1B2F38] border-[#E05A47] text-[#FCA5A5] shadow-sm',
                },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleRoleSelect(tab.id as Role)}
                  className={`p-2.5 rounded-2xl border transition-all text-left flex flex-col justify-between cursor-pointer ${
                    selectedRole === tab.id
                      ? tab.active
                      : 'bg-[#0C171C] border-[#334B56] text-[#94A3B8] ' + tab.color
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="p-1.5 rounded-lg bg-[#1B2F38] border border-[#334B56]">
                      {tab.icon}
                    </span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        selectedRole === tab.id ? 'bg-current shadow-[0_0_6px_currentColor]' : 'bg-[#334B56]'
                      }`}
                    />
                  </div>
                  <div>
                    <div className="text-xs font-bold leading-snug">{tab.label}</div>
                    <div className="text-[10px] text-[#94A3B8] mt-0.5 truncate">{tab.sub}</div>
                  </div>
                </button>
              ))}
            </div>

            {/* Active Role Description Banner */}
            <div className="mb-5 p-3 rounded-xl bg-[#0C171C] border border-[#334B56] text-xs text-[#94A3B8] flex items-start gap-2.5">
              <span className="text-base mt-0.5">
                {selectedRole === 'admin' ? '🏛️' : selectedRole === 'officer' ? '📋' : '👤'}
              </span>
              <div>
                <span className="font-semibold text-[#F8FAFC]">
                  {DEMO_ACCOUNTS[selectedRole].designation}:
                </span>{' '}
                <span className="text-[#94A3B8]">{DEMO_ACCOUNTS[selectedRole].description}</span>
              </div>
            </div>

            {/* Error Message Alert */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-xl bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] text-xs flex items-center gap-2 animate-in fade-in">
                <Lock className="w-4 h-4 text-[#FCA5A5] flex-shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Authentication Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Email / Official Identifier
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="e.g. officer@khopripada.gov.in"
                    className="w-full pl-9 pr-3 py-2 bg-[#0C171C] border border-[#334B56] rounded-xl text-xs text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8] mb-1">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#94A3B8]">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter portal password"
                    className="w-full pl-9 pr-10 py-2 bg-[#0C171C] border border-[#334B56] rounded-xl text-xs text-[#F8FAFC] placeholder-[#94A3B8]/50 focus:outline-none focus:border-[#38BDF8] focus:ring-1 focus:ring-[#38BDF8] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-[#F8FAFC] transition cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-[#F8FAFC] font-bold text-xs shadow-md active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>
                  {isSubmitting
                    ? 'Verifying Security Token...'
                    : `Authenticate & Enter ${DEMO_ACCOUNTS[selectedRole].badgeLabel}`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* 1-Click Fast Demo Logins Section */}
          <div className="mt-6 pt-5 border-t border-[#334B56]">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[10px] uppercase font-bold tracking-wider text-[#94A3B8] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
                1-Click Instant Demo Login:
              </span>
              <span className="text-[10px] text-[#94A3B8]/80 font-mono">No typing required</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => loginAsDemoRole('admin')}
                className="py-1.5 px-2 rounded-xl bg-[#E05A47]/20 hover:bg-[#E05A47]/30 border border-[#E05A47]/60 text-[#FCA5A5] text-[11px] font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                title="Login as Sarpanch Rajesh Patil"
              >
                <span>🏛️</span>
                <span>Admin</span>
              </button>

              <button
                type="button"
                onClick={() => loginAsDemoRole('officer')}
                className="py-1.5 px-2 rounded-xl bg-[#1B2F38] hover:bg-[#233B46] border border-[#38BDF8]/40 text-[#38BDF8] text-[11px] font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                title="Login as Gram Sevak Anand Kadam"
              >
                <span>📋</span>
                <span>Officer</span>
              </button>

              <button
                type="button"
                onClick={() => loginAsDemoRole('user')}
                className="py-1.5 px-2 rounded-xl bg-[#10B981]/20 hover:bg-[#10B981]/30 border border-[#10B981]/60 text-[#6EE7B7] text-[11px] font-bold transition active:scale-95 cursor-pointer flex items-center justify-center gap-1"
                title="Login as Citizen Santosh Vartak"
              >
                <span>👤</span>
                <span>Villager</span>
              </button>
            </div>

            {/* Resident / Guest Exploration Link */}
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleGuestVillager}
                className="inline-flex items-center gap-1.5 text-xs text-[#94A3B8] hover:text-[#38BDF8] transition cursor-pointer group"
              >
                <span>Visiting Khopripada?</span>
                <span className="font-semibold text-[#38BDF8] group-hover:underline">
                  Explore as Resident / Guest Villager &rarr;
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
