import { AuthProvider, useAuth } from './context/AuthContext';
import { VillageMap } from './components/VillageMap';
import { LoginPage } from './components/LoginPage';

function DashboardGateway() {
  const { session, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="w-screen h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-200">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center animate-pulse mb-3">
          <span className="w-4 h-4 rounded-full bg-emerald-400" />
        </div>
        <div className="text-xs font-mono text-emerald-400 tracking-wider">
          Initializing Smart Village GIS Security Context...
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-slate-950">
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
