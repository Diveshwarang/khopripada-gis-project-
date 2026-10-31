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
    <div className="min-h-[100dvh] w-full bg-[#0D161A] text-[#F8FAFC] overflow-y-auto px-4 py-6 flex flex-col justify-start md:justify-center items-center relative select-none">
      {/* Background Satellite Backdrop */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center opacity-15 mix-blend-luminosity filter blur-[1px] scale-105 pointer-events-none"
        style={{
          backgroundImage:
            "url('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/28096/44760')",
        }}
      />

      {/* Dark Executive Navy Slate Overlays */}
      <div className="fixed inset-0 z-0 bg-gradient-to-tr from-[#0D161A] via-[#132228]/95 to-[#1B2F38]/85 pointer-events-none" />
      <div className="fixed top-1/4 -left-32 w-96 h-96 bg-[#38BDF8]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Responsive Grid Container */}
      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center px-4 sm:px-6 my-auto">
        
        {/* Left Column: Hero Info & Governance Overview */}
        <div className="flex flex-col justify-center space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#0369A1] shadow-md flex items-center justify-center text-white font-bold text-base shrink-0">
              खि
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#132228] border border-[#2C4654] text-[#38BDF8] inline-block shadow-xs">
                Khopripada Digital Twin • बापणे ग्रामपंचायत
              </span>
              <span className="text-xs text-[#94A3B8]">
                • Palghar
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#F8FAFC] tracking-tight leading-tight">
              Smart Village GIS Platform
            </h1>
            <p className="text-xs sm:text-sm text-[#94A3B8] mt-1.5 leading-relaxed">
              Spatial Decision Support & Citizen Grievance Portal for Bapane Gram Panchayat
            </p>
          </div>

          {/* Key Platform Highlights */}
          <div className="flex flex-col space-y-2 md:space-y-3 pt-1">
            <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#132228] p-3 md:p-3.5 rounded-xl border border-[#2C4654] shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-[#10B981] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#F8FAFC]">Role-Segregated Portals:</strong>{' '}
                Executive Panchayat Admin, Field Officer, and Villager desks with granular geospatial permissions.
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#132228] p-3 md:p-3.5 rounded-xl border border-[#2C4654] shadow-sm">
              <Cpu className="w-4 h-4 text-[#38BDF8] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#F8FAFC]">ML Decision Support:</strong>{' '}
                Automated priority scoring (0–100), spatial failure heatmap, and municipal budgeting models.
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#94A3B8] bg-[#132228] p-3 md:p-3.5 rounded-xl border border-[#2C4654] shadow-sm">
              <Compass className="w-4 h-4 text-[#F59E0B] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#F8FAFC]">100% Offline Capability:</strong>{' '}
                IndexedDB storage and service worker tile caching for disconnected field inspections.
              </div>
            </div>
          </div>

          {/* Coordinate Telemetry */}
          <div className="flex pt-3 border-t border-[#2C4654] items-center justify-between text-[11px] font-mono text-[#94A3B8]">
            <span className="flex items-center gap-1.5 text-[#38BDF8] font-bold">
              <MapPin className="w-3.5 h-3.5" />
              19.3551°N, 72.8846°E
            </span>
            <span className="bg-[#132228] border border-[#2C4654] px-2 py-0.5 rounded text-[#94A3B8]">
              Study Corridor 401208
            </span>
          </div>
        </div>

        {/* Right Column: Authentication Gateway & Form */}
        <div className="w-full bg-[#132228] border border-[#2C4654] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#94A3B8] block">
                Authentication Gateway
              </span>
              <h2 className="text-base sm:text-lg font-bold text-[#F8FAFC] mt-0.5">
                Select Portal Access Level
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-full border border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Live Sync Ready
            </span>
          </div>

          {/* 3-Tab Touch Selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                id: 'user',
                label: 'Resident',
                icon: <User className="w-4 h-4 text-emerald-400" />,
                activeClass: 'bg-[#1B2F38] border-emerald-500 text-emerald-400 font-bold',
              },
              {
                id: 'officer',
                label: 'Officer',
                icon: <ClipboardCheck className="w-4 h-4 text-[#38BDF8]" />,
                activeClass: 'bg-[#1B2F38] border-[#38BDF8] text-[#38BDF8] font-bold',
              },
              {
                id: 'admin',
                label: 'Admin',
                icon: <Shield className="w-4 h-4 text-[#E05A47]" />,
                activeClass: 'bg-[#1B2F38] border-[#E05A47] text-[#E05A47] font-bold',
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleRoleSelect(tab.id as Role)}
                className={`py-2 px-1.5 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                  selectedRole === tab.id
                    ? tab.activeClass
                    : 'bg-[#172A33]/50 border-[#2C4654] text-[#94A3B8] hover:border-[#38BDF8] hover:text-[#F8FAFC]'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="text-xs leading-tight truncate w-full">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Role Mini Description */}
          <div className="p-2.5 rounded-xl bg-[#172A33] border border-[#2C4654] text-xs text-[#94A3B8] flex items-center gap-2">
            <span className="shrink-0">
              {selectedRole === 'admin' ? (
                <Shield className="w-3.5 h-3.5 text-[#E05A47]" />
              ) : selectedRole === 'officer' ? (
                <ClipboardCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
              ) : (
                <User className="w-3.5 h-3.5 text-emerald-400" />
              )}
            </span>
            <div className="truncate">
              <strong className="text-[#F8FAFC]">{DEMO_ACCOUNTS[selectedRole].designation}:</strong>{' '}
              <span className="text-[#94A3B8]">{DEMO_ACCOUNTS[selectedRole].description}</span>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-800 text-red-400 text-xs flex items-center gap-2 animate-in fade-in">
              <Lock className="w-4 h-4 text-red-400 shrink-0" />
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
                  placeholder="e.g. admin@khopripada.gov.in"
                  className="w-full h-11 pl-9 pr-3.5 bg-[#172A33] border border-[#2C4654] rounded-xl text-sm text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#38BDF8] transition"
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
                  className="w-full h-11 pl-9 pr-10 bg-[#172A33] border border-[#2C4654] rounded-xl text-sm text-[#F8FAFC] placeholder-[#94A3B8]/60 focus:outline-none focus:border-[#38BDF8] transition"
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

            {/* Enter Portal Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 bg-[#0284C7] hover:bg-[#0369A1] active:scale-[0.98] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
            >
              <span>{isSubmitting ? 'Verifying...' : 'Enter Executive Portal'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* 1-Click Access */}
          <div className="pt-3 border-t border-[#2C4654]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#38BDF8]" />
                Quick 1-Click Demo Portals:
              </span>
              <span className="text-[10px] text-[#94A3B8] font-mono">Instant Auth</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                type="button"
                onClick={() => loginAsDemoRole('user')}
                className="bg-[#172A33] hover:bg-[#1B2F38] border border-[#2C4654] text-xs font-semibold py-2 rounded-xl text-center text-[#F8FAFC] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-emerald-400" />
                <span>Resident</span>
              </button>
              <button
                type="button"
                onClick={() => loginAsDemoRole('officer')}
                className="bg-[#172A33] hover:bg-[#1B2F38] border border-[#2C4654] text-xs font-semibold py-2 rounded-xl text-center text-[#F8FAFC] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Officer</span>
              </button>
              <button
                type="button"
                onClick={() => loginAsDemoRole('admin')}
                className="bg-[#172A33] hover:bg-[#1B2F38] border border-[#2C4654] text-xs font-semibold py-2 rounded-xl text-center text-[#F8FAFC] active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-[#E05A47]" />
                <span>Admin</span>
              </button>
            </div>

            {/* Quick Guest Villager */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleGuestVillager}
                className="text-xs text-[#94A3B8] hover:text-[#38BDF8] transition underline underline-offset-4 cursor-pointer"
              >
                Explore Map as Guest Resident (Khopripada Corridor) &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Branding */}
      <footer className="relative z-10 mt-6 md:mt-8 pb-4 text-center text-[11px] text-[#94A3B8]/80 font-medium">
        Gram Panchayat Bapane • Khopripada Ward 1 & 2 • Vasai-Virar Corridor
      </footer>
    </div>
  );
};

export default LoginPage;
