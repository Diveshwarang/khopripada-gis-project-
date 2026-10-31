import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { VillageMap } from './components/VillageMap';
import { LoginPage } from './components/LoginPage';

function DashboardGateway() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="w-screen h-[100dvh] flex flex-col items-center justify-center bg-[#F4F6F5] dark:bg-[#0D161A] text-[#1C2927] dark:text-[#F8FAFC]">
        <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#1B2F38] border border-[#D3DFD8] dark:border-[#38BDF8]/50 flex items-center justify-center animate-pulse mb-3 shadow-[0_0_20px_rgba(85,148,159,0.3)] dark:shadow-[0_0_20px_rgba(56,189,248,0.3)]">
          <span className="w-4 h-4 rounded-full bg-[#55949F] dark:bg-[#38BDF8]" />
        </div>
        <div className="text-xs font-mono text-[#55949F] dark:text-[#38BDF8] tracking-wider">
          Initializing Smart Village GIS Security Context...
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#F4F6F5] dark:bg-[#0D161A] text-[#1C2927] dark:text-[#F8FAFC] relative overscroll-none transition-colors duration-200">
      <VillageMap />
    </main>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <DashboardGateway />
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
