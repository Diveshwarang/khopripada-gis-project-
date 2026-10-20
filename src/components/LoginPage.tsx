import React, { useState } from 'react';
import {
  Shield,
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
  User,
  ClipboardCheck,
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
    <div className="min-h-[100dvh] w-full bg-[#0B1417] text-slate-100 overflow-y-auto px-4 py-6 flex flex-col justify-start md:justify-center items-center relative">
      {/* Background High-Tech GIS & Satellite Backdrop */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center opacity-20 mix-blend-luminosity filter blur-[1px] scale-105 pointer-events-none"
        style={{
          backgroundImage:
            "url('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/28096/44760')",
        }}
      />

      {/* Slate-Marine Radial Glow & Spatial Grid Overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-tr from-[#0B1417] via-[#132228]/95 to-[#1B2F38]/80 pointer-events-none" />
      <div className="fixed top-1/4 -left-32 w-96 h-96 bg-[#38BDF8]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(#334B56_1px,transparent_1px)] [background-size:32px_32px] opacity-25 pointer-events-none" />

      {/* Responsive Grid Container (2-Column Desktop, 1-Column Mobile) */}
      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
        
        {/* Left Column: Hero Info & Governance Credentials */}
        <div className="flex flex-col justify-center">
          {/* Official Emblem & Panchayat Header */}
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-xl bg-[#132228] border border-[#334B56] shadow-md flex items-center justify-center shrink-0">
              <Shield className="w-4 h-4 md:w-5 md:h-5 text-[#38BDF8]" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#132228] border border-[#334B56] text-[#38BDF8] inline-block">
                Bapane Gram Panchayat
              </span>
              <span className="hidden sm:inline text-xs text-slate-400">
                • Vasai Sub-District
              </span>
            </div>
          </div>

          <h1 className="text-xl md:text-3xl font-bold text-white tracking-tight mt-1 leading-tight">
            Smart Village GIS: Khopripada
          </h1>

          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            Decentralized Geospatial Governance & ML Hotspot Intelligence
          </p>

          {/* Key Platform Highlights (HIDDEN ON MOBILE, FULL ON DESKTOP) */}
          <div className="hidden md:flex flex-col gap-3 mt-5">
            <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#132228]/85 p-3 rounded-xl border border-[#334B56] shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#F8FAFC]">Role-Segregated Portals:</strong> Admin, Officer, and Villager workflows with granular spatial access control.
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#132228]/85 p-3 rounded-xl border border-[#334B56] shadow-sm">
              <Cpu className="w-4 h-4 text-[#38BDF8] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#F8FAFC]">ML Decision Support:</strong> Priority scoring (0–100), DBSCAN failure clustering, and municipal budgeting models.
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#132228]/85 p-3 rounded-xl border border-[#334B56] shadow-sm">
              <Compass className="w-4 h-4 text-[#FCD34D] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#F8FAFC]">100% Offline Capability:</strong> Full local IndexedDB and service worker caching for field inspections.
              </div>
            </div>
          </div>

          {/* Coordinate Telemetry (HIDDEN ON MOBILE, COMPACT ON SM/MD) */}
          <div className="hidden sm:flex mt-4 pt-3 border-t border-[#334B56]/60 items-center justify-between text-[11px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1.5 text-[#38BDF8]">
              <MapPin className="w-3.5 h-3.5" />
              19.3551°N, 72.8846°E
            </span>
            <span className="bg-[#132228] border border-[#334B56] px-2 py-0.5 rounded text-[#94A3B8]">
              Study Corridor 401208
            </span>
          </div>
        </div>

        {/* Right Column: Authentication Gateway & Form */}
        <div className="w-full bg-[#132228]/95 backdrop-blur-xl border border-[#334B56] rounded-2xl p-5 sm:p-7 shadow-2xl space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#94A3B8] block">
                Authentication Gateway
              </span>
              <h2 className="text-sm sm:text-base font-semibold text-white mt-0.5">
                Select Access Portal
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#10B981] bg-[#10B981]/20 px-2.5 py-1 rounded-full border border-[#10B981]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
              Live Sync Ready
            </span>
          </div>

          {/* Clean 3-Tab Touch Selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                id: 'user',
                label: 'Villager',
                icon: <User className="w-4 h-4 text-[#10B981]" />,
                activeClass: 'bg-[#1B2F38] border-[#10B981] text-[#6EE7B7] shadow-sm',
              },
              {
                id: 'officer',
                label: 'Field Officer',
                icon: <ClipboardCheck className="w-4 h-4 text-[#38BDF8]" />,
                activeClass: 'bg-[#1B2F38] border-[#38BDF8] text-[#38BDF8] shadow-sm',
              },
              {
                id: 'admin',
                label: 'Panchayat Admin',
                icon: <Shield className="w-4 h-4 text-[#E05A47]" />,
                activeClass: 'bg-[#1B2F38] border-[#E05A47] text-[#FCA5A5] shadow-sm',
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleRoleSelect(tab.id as Role)}
                className={`py-2 px-1.5 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                  selectedRole === tab.id
                    ? `${tab.activeClass} font-bold`
                    : 'bg-[#0B1417] border-[#334B56] text-[#94A3B8] hover:border-[#38BDF8]/40 hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="text-xs leading-tight truncate w-full">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Role Mini Description */}
          <div className="p-2.5 rounded-xl bg-[#0B1417] border border-[#334B56] text-xs text-[#94A3B8] flex items-center gap-2">
            <span className="shrink-0">
              {selectedRole === 'admin' ? (
                <Shield className="w-3.5 h-3.5 text-[#E05A47]" />
              ) : selectedRole === 'officer' ? (
                <ClipboardCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
              ) : (
                <User className="w-3.5 h-3.5 text-[#10B981]" />
              )}
            </span>
            <div className="truncate">
              <strong className="text-slate-200">{DEMO_ACCOUNTS[selectedRole].designation}:</strong>{' '}
              <span className="text-slate-400">{DEMO_ACCOUNTS[selectedRole].description}</span>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-[#E05A47]/20 border border-[#E05A47]/60 text-[#FCA5A5] text-xs flex items-center gap-2 animate-in fade-in">
              <Lock className="w-4 h-4 text-[#FCA5A5] shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
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
                  className="w-full h-11 pl-9 pr-3.5 bg-[#0B1417] border border-[#334B56] rounded-xl text-base text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] transition"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
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
                  className="w-full h-11 pl-9 pr-10 bg-[#0B1417] border border-[#334B56] rounded-xl text-base text-white placeholder-slate-500 focus:outline-none focus:border-[#38BDF8] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#94A3B8] hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Enter Portal Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-[#0D9488] to-[#10B981] hover:brightness-110 text-white font-bold rounded-xl shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
            >
              <span>
                {isSubmitting
                  ? 'Verifying Security Token...'
                  : `Enter ${DEMO_ACCOUNTS[selectedRole].badgeLabel}`}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Instant 1-Click Access (Touch-Friendly for Quick Evaluator Testing) */}
          <div className="pt-3 border-t border-[#334B56]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
                Quick Demo Testing:
              </span>
              <span className="text-[10px] text-slate-500 font-mono">1-Click</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                type="button"
                onClick={() => loginAsDemoRole('user')}
                className="bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] text-xs font-medium py-2 rounded-xl text-center text-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-[#10B981]" />
                <span>Villager</span>
              </button>
              <button
                type="button"
                onClick={() => loginAsDemoRole('officer')}
                className="bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] text-xs font-medium py-2 rounded-xl text-center text-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Officer</span>
              </button>
              <button
                type="button"
                onClick={() => loginAsDemoRole('admin')}
                className="bg-[#1B2F38] hover:bg-[#233B46] border border-[#334B56] text-xs font-medium py-2 rounded-xl text-center text-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-[#E05A47]" />
                <span>Admin</span>
              </button>
            </div>

            {/* Continue as Guest */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleGuestVillager}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-[#38BDF8] transition cursor-pointer group"
              >
                <span>Visiting Khopripada?</span>
                <span className="font-semibold text-[#38BDF8] group-hover:underline">
                  Continue as Guest &rarr;
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
