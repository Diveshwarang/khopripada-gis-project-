import { AuthProvider, useAuth } from './context/AuthContext';
import { VillageMap } from './components/VillageMap';
import { LoginPage } from './components/LoginPage';

function DashboardGateway() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="w-screen h-[100dvh] flex flex-col items-center justify-center bg-[#132228] text-[#F8FAFC]">
        <div className="w-12 h-12 rounded-2xl bg-[#1B2F38] border border-[#38BDF8]/50 flex items-center justify-center animate-pulse mb-3 shadow-[0_0_20px_rgba(56,189,248,0.3)]">
          <span className="w-4 h-4 rounded-full bg-[#38BDF8]" />
        </div>
        <div className="text-xs font-mono text-[#38BDF8] tracking-wider">
          Initializing Smart Village GIS Security Context...
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-[#0D161A] relative overscroll-none">
      <VillageMap />
    </main>
  );
}

export function App() {
  return (
    <AuthProvider>
      <DashboardGateway />
    </AuthProvider>
  );
}

export default App;
