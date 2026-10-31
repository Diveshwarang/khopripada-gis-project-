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
  Sun,
  Moon,
} from 'lucide-react';
import { useAuth, DEMO_ACCOUNTS } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import type { Role } from '../types/auth';

export const LoginPage: React.FC = () => {
  const { login, loginAsDemoRole } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, toggleTheme } = useTheme();

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
    <div className="min-h-[100dvh] w-full bg-[#F4F6F5] dark:bg-[#0D161A] text-[#1C2927] dark:text-[#F8FAFC] overflow-y-auto px-4 py-6 flex flex-col justify-start md:justify-center items-center relative transition-colors duration-200">
      {/* Background High-Tech GIS & Satellite Backdrop */}
      <div
        className="fixed inset-0 z-0 bg-cover bg-center opacity-15 dark:opacity-20 mix-blend-luminosity filter blur-[1px] scale-105 pointer-events-none"
        style={{
          backgroundImage:
            "url('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/16/28096/44760')",
        }}
      />

      {/* Atmospheric Radial Glow & Spatial Grid Overlay */}
      <div className="fixed inset-0 z-0 bg-gradient-to-tr from-[#F4F6F5]/90 via-[#F4F6F5]/80 to-[#EBF2EE]/90 dark:from-[#0B1417] dark:via-[#132228]/95 dark:to-[#1B2F38]/80 pointer-events-none" />
      <div className="fixed top-1/4 -left-32 w-96 h-96 bg-[#55949F]/15 dark:bg-[#38BDF8]/15 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 -right-32 w-96 h-96 bg-[#80A68A]/15 dark:bg-[#10B981]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed inset-0 bg-[radial-gradient(#D3DFD8_1px,transparent_1px)] dark:bg-[radial-gradient(#334B56_1px,transparent_1px)] [background-size:32px_32px] opacity-40 pointer-events-none" />

      {/* Top Right Header Controls: Language Pill + Theme Toggle Button */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-50 flex items-center gap-2">
        {/* Language Toggle Pill: [ EN | मराठी ] */}
        <div className="inline-flex rounded-xl border border-[#D3DFD8] dark:border-[#334B56] bg-white/90 dark:bg-[#132228]/90 backdrop-blur-md p-1 shadow-sm text-xs font-semibold">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              language === 'en'
                ? 'bg-[#55949F] dark:bg-[#38BDF8] text-white dark:text-slate-900 font-bold shadow-xs'
                : 'text-[#566E67] dark:text-[#94A3B8] hover:text-[#1C2927] dark:hover:text-white'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('mr')}
            className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
              language === 'mr'
                ? 'bg-[#55949F] dark:bg-[#38BDF8] text-white dark:text-slate-900 font-bold shadow-xs'
                : 'text-[#566E67] dark:text-[#94A3B8] hover:text-[#1C2927] dark:hover:text-white'
            }`}
          >
            मराठी
          </button>
        </div>

        {/* Theme Button: Sun (☀️) / Moon (🌙) */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl border border-[#D3DFD8] dark:border-[#334B56] bg-white/90 dark:bg-[#132228]/90 backdrop-blur-md text-[#1C2927] dark:text-[#F8FAFC] flex items-center justify-center transition-all active:scale-95 cursor-pointer shadow-sm hover:border-[#55949F] dark:hover:border-[#38BDF8]"
          title={theme === 'dark' ? t('switch_to_light') : t('switch_to_dark')}
          aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-5 h-5 text-amber-400 animate-in fade-in" />
          ) : (
            <Moon className="w-5 h-5 text-teal-700 animate-in fade-in" />
          )}
        </button>
      </div>

      {/* Responsive Grid Container (2-Column Desktop, 1-Column Mobile) */}
      <div className="relative z-10 w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-center px-4 sm:px-6 mt-12 md:mt-0">
        
        {/* Left Column: Hero Info & Governance Overview */}
        <div className="flex flex-col justify-center space-y-4">
          {/* Official Emblem & Panchayat Header */}
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white dark:bg-[#132228] border border-[#D3DFD8] dark:border-[#334B56] shadow-md flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-[#55949F] dark:text-[#38BDF8]" />
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white dark:bg-[#132228] border border-[#D3DFD8] dark:border-[#334B56] text-[#55949F] dark:text-[#38BDF8] inline-block shadow-xs">
                {t('panchayat_name')}
              </span>
              <span className="text-xs text-[#566E67] dark:text-[#94A3B8]">
                • Vasai Sub-District
              </span>
            </div>
          </div>

          <div>
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold text-[#1C2927] dark:text-white tracking-tight leading-tight">
              {t('welcome_title')}
            </h1>
            <p className="text-xs sm:text-sm text-[#566E67] dark:text-[#94A3B8] mt-1.5 leading-relaxed">
              {t('welcome_sub')}
            </p>
          </div>

          {/* Key Platform Highlights */}
          <div className="flex flex-col space-y-2 md:space-y-3 pt-1">
            <div className="flex items-start gap-2.5 text-xs text-[#566E67] dark:text-[#94A3B8] bg-white dark:bg-[#132228] p-3 md:p-3.5 rounded-xl border border-[#D3DFD8] dark:border-[#334B56] shadow-sm">
              <CheckCircle2 className="w-4 h-4 text-[#80A68A] dark:text-[#10B981] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#1C2927] dark:text-[#F8FAFC]">
                  {language === 'mr' ? '३-स्तरीय प्रवेश:' : 'Role-Segregated Portals:'}
                </strong>{' '}
                {language === 'mr'
                  ? 'नागरिक, क्षेत्रीय अधिकारी आणि ग्रामपंचायत प्रशासनासाठी स्वतंत्र व्यवस्था.'
                  : 'Admin, Officer, and Villager workflows with granular spatial access control.'}
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#566E67] dark:text-[#94A3B8] bg-white dark:bg-[#132228] p-3 md:p-3.5 rounded-xl border border-[#D3DFD8] dark:border-[#334B56] shadow-sm">
              <Cpu className="w-4 h-4 text-[#55949F] dark:text-[#38BDF8] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#1C2927] dark:text-[#F8FAFC]">
                  {language === 'mr' ? 'मशीन लर्निंग विश्लेषण:' : 'ML Decision Support:'}
                </strong>{' '}
                {language === 'mr'
                  ? 'प्राधान्यक्रम क्रमवारी (०–१००), समस्यांचे हॉटस्पॉट आणि अर्थसंकल्प नियोजन.'
                  : 'Priority scoring (0–100), DBSCAN failure clustering, and municipal budgeting models.'}
              </div>
            </div>
            <div className="flex items-start gap-2.5 text-xs text-[#566E67] dark:text-[#94A3B8] bg-white dark:bg-[#132228] p-3 md:p-3.5 rounded-xl border border-[#D3DFD8] dark:border-[#334B56] shadow-sm">
              <Compass className="w-4 h-4 text-[#F6AA6E] dark:text-[#FCD34D] flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-[#1C2927] dark:text-[#F8FAFC]">
                  {language === 'mr' ? '१००% ऑफलाइन कार्यक्षमता:' : '100% Offline Capability:'}
                </strong>{' '}
                {language === 'mr'
                  ? 'स्थानिक डेटाबेस आणि नकाशा कॅशद्वारे दुर्गम भागातही सुरळीत कार्य.'
                  : 'Full local IndexedDB and service worker caching for field inspections.'}
              </div>
            </div>
          </div>

          {/* Coordinate Telemetry */}
          <div className="flex pt-3 border-t border-[#D3DFD8] dark:border-[#334B56]/60 items-center justify-between text-[11px] font-mono text-[#566E67] dark:text-[#94A3B8]">
            <span className="flex items-center gap-1.5 text-[#55949F] dark:text-[#38BDF8] font-bold">
              <MapPin className="w-3.5 h-3.5" />
              19.3551°N, 72.8846°E
            </span>
            <span className="bg-white dark:bg-[#132228] border border-[#D3DFD8] dark:border-[#334B56] px-2 py-0.5 rounded text-[#566E67] dark:text-[#94A3B8]">
              Study Corridor 401208
            </span>
          </div>
        </div>

        {/* Right Column: Authentication Gateway & Form */}
        <div className="w-full bg-white dark:bg-[#132228] border border-[#D3DFD8] dark:border-[#334B56] rounded-2xl p-6 sm:p-8 shadow-xl dark:shadow-2xl space-y-4 transition-colors duration-200">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-bold tracking-wider text-[#566E67] dark:text-[#94A3B8] block">
                {language === 'mr' ? 'प्रवेश पोर्टल' : 'Authentication Gateway'}
              </span>
              <h2 className="text-base sm:text-lg font-bold text-[#1C2927] dark:text-white mt-0.5">
                {t('select_role_label')}
              </h2>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#80A68A] dark:text-[#10B981] bg-[#80A68A]/15 dark:bg-[#10B981]/20 px-2.5 py-1 rounded-full border border-[#80A68A]/30 dark:border-[#10B981]/40">
              <span className="w-1.5 h-1.5 rounded-full bg-[#80A68A] dark:bg-[#10B981] animate-pulse" />
              Live Sync Ready
            </span>
          </div>

          {/* Clean 3-Tab Touch Selector */}
          <div className="grid grid-cols-3 gap-2">
            {[
              {
                id: 'user',
                label: t('villager_role'),
                icon: <User className="w-4 h-4 text-[#80A68A] dark:text-[#10B981]" />,
                activeClass: 'bg-[#EBF2EE] dark:bg-[#1B2F38] border-[#80A68A] dark:border-[#10B981] text-[#1C2927] dark:text-[#6EE7B7] shadow-sm',
              },
              {
                id: 'officer',
                label: t('officer_role'),
                icon: <ClipboardCheck className="w-4 h-4 text-[#55949F] dark:text-[#38BDF8]" />,
                activeClass: 'bg-[#EBF2EE] dark:bg-[#1B2F38] border-[#55949F] dark:border-[#38BDF8] text-[#1C2927] dark:text-[#38BDF8] shadow-sm',
              },
              {
                id: 'admin',
                label: t('admin_role'),
                icon: <Shield className="w-4 h-4 text-[#CC6346] dark:text-[#E05A47]" />,
                activeClass: 'bg-[#EBF2EE] dark:bg-[#1B2F38] border-[#CC6346] dark:border-[#E05A47] text-[#1C2927] dark:text-[#FCA5A5] shadow-sm',
              },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleRoleSelect(tab.id as Role)}
                className={`py-2 px-1.5 rounded-xl border transition-all text-center flex flex-col items-center justify-center gap-1 cursor-pointer active:scale-95 ${
                  selectedRole === tab.id
                    ? `${tab.activeClass} font-bold`
                    : 'bg-[#F4F6F5] dark:bg-[#0D161A] border-[#D3DFD8] dark:border-[#334B56] text-[#566E67] dark:text-[#94A3B8] hover:border-[#55949F] dark:hover:border-[#38BDF8]/40 hover:text-[#1C2927] dark:hover:text-white'
                }`}
              >
                <span>{tab.icon}</span>
                <span className="text-xs leading-tight truncate w-full">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Active Role Mini Description */}
          <div className="p-2.5 rounded-xl bg-[#F4F6F5] dark:bg-[#0D161A] border border-[#D3DFD8] dark:border-[#334B56] text-xs text-[#566E67] dark:text-[#94A3B8] flex items-center gap-2">
            <span className="shrink-0">
              {selectedRole === 'admin' ? (
                <Shield className="w-3.5 h-3.5 text-[#CC6346] dark:text-[#E05A47]" />
              ) : selectedRole === 'officer' ? (
                <ClipboardCheck className="w-3.5 h-3.5 text-[#55949F] dark:text-[#38BDF8]" />
              ) : (
                <User className="w-3.5 h-3.5 text-[#80A68A] dark:text-[#10B981]" />
              )}
            </span>
            <div className="truncate">
              <strong className="text-[#1C2927] dark:text-slate-200">{DEMO_ACCOUNTS[selectedRole].designation}:</strong>{' '}
              <span className="text-[#566E67] dark:text-slate-400">{DEMO_ACCOUNTS[selectedRole].description}</span>
            </div>
          </div>

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-2.5 rounded-xl bg-[#CC6346]/15 dark:bg-[#E05A47]/20 border border-[#CC6346]/50 dark:border-[#E05A47]/60 text-[#CC6346] dark:text-[#FCA5A5] text-xs flex items-center gap-2 animate-in fade-in">
              <Lock className="w-4 h-4 text-[#CC6346] dark:text-[#FCA5A5] shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#566E67] dark:text-[#94A3B8]">
                {language === 'mr' ? 'ईमेल किंवा ओळख क्रमांक' : 'Email / Official Identifier'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#566E67] dark:text-[#94A3B8]">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="e.g. officer@khopripada.gov.in"
                  className="w-full h-11 pl-9 pr-3.5 bg-[#F4F6F5] dark:bg-[#0D161A] border border-[#D3DFD8] dark:border-[#334B56] rounded-xl text-sm text-[#1C2927] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#55949F] dark:focus:border-[#38BDF8] transition"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#566E67] dark:text-[#94A3B8]">
                {language === 'mr' ? 'पासवर्ड' : 'Password'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#566E67] dark:text-[#94A3B8]">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={language === 'mr' ? 'पासवर्ड प्रविष्ट करा' : 'Enter portal password'}
                  className="w-full h-11 pl-9 pr-10 bg-[#F4F6F5] dark:bg-[#0D161A] border border-[#D3DFD8] dark:border-[#334B56] rounded-xl text-sm text-[#1C2927] dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-[#55949F] dark:focus:border-[#38BDF8] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#566E67] dark:text-[#94A3B8] hover:text-[#1C2927] dark:hover:text-white transition cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Enter Portal Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-12 bg-gradient-to-r from-[#55949F] to-[#80A68A] dark:from-[#0D9488] dark:to-[#10B981] hover:brightness-105 active:scale-[0.98] text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-1"
            >
              <span>
                {isSubmitting
                  ? (language === 'mr' ? 'पडताळणी सुरू आहे...' : 'Verifying Security Token...')
                  : t('enter_btn')}
              </span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Instant 1-Click Access (Touch-Friendly for Quick Evaluator Testing) */}
          <div className="pt-3 border-t border-[#D3DFD8] dark:border-[#334B56]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[#566E67] dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#55949F] dark:text-[#38BDF8]" />
                {t('quick_demo')}:
              </span>
              <span className="text-[10px] text-[#566E67] dark:text-slate-500 font-mono">1-Click</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mt-2">
              <button
                type="button"
                onClick={() => loginAsDemoRole('user')}
                className="bg-[#EBF2EE] dark:bg-[#1B2F38] hover:bg-[#D3DFD8] dark:hover:bg-[#233B46] border border-[#D3DFD8] dark:border-[#334B56] text-xs font-semibold py-2 rounded-xl text-center text-[#1C2927] dark:text-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <User className="w-3.5 h-3.5 text-[#80A68A] dark:text-[#10B981]" />
                <span>{t('villager_role')}</span>
              </button>
              <button
                type="button"
                onClick={() => loginAsDemoRole('officer')}
                className="bg-[#EBF2EE] dark:bg-[#1B2F38] hover:bg-[#D3DFD8] dark:hover:bg-[#233B46] border border-[#D3DFD8] dark:border-[#334B56] text-xs font-semibold py-2 rounded-xl text-center text-[#1C2927] dark:text-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ClipboardCheck className="w-3.5 h-3.5 text-[#55949F] dark:text-[#38BDF8]" />
                <span>{t('officer_role')}</span>
              </button>
              <button
                type="button"
                onClick={() => loginAsDemoRole('admin')}
                className="bg-[#EBF2EE] dark:bg-[#1B2F38] hover:bg-[#D3DFD8] dark:hover:bg-[#233B46] border border-[#D3DFD8] dark:border-[#334B56] text-xs font-semibold py-2 rounded-xl text-center text-[#1C2927] dark:text-slate-200 active:scale-95 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Shield className="w-3.5 h-3.5 text-[#CC6346] dark:text-[#E05A47]" />
                <span>{t('admin_role')}</span>
              </button>
            </div>

            {/* Continue as Guest */}
            <div className="mt-3 text-center">
              <button
                type="button"
                onClick={handleGuestVillager}
                className="inline-flex items-center gap-1 text-xs text-[#566E67] dark:text-slate-400 hover:text-[#55949F] dark:hover:text-[#38BDF8] transition cursor-pointer group"
              >
                <span>{t('visiting_guest')}</span>
                <span className="font-semibold text-[#55949F] dark:text-[#38BDF8] group-hover:underline">
                  &rarr;
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
