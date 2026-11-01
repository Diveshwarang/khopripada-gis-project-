import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { IssuesProvider, useIssues } from './context/IssuesContext';
import { VillageMap } from './components/VillageMap';
import { LoginPage } from './components/LoginPage';
import { ErrorBoundary } from './components/ErrorBoundary';

function DashboardGateway() {
  const { session, isLoading } = useAuth();
  const { issues } = useIssues();
  const [heatmapActive, setHeatmapActive] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="w-screen h-[100dvh] flex flex-col items-center justify-center bg-[#0D161A] text-[#F8FAFC]">
        <div className="w-12 h-12 rounded-2xl bg-[#132228] border border-[#2C4654] flex items-center justify-center animate-pulse mb-3 shadow-md">
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
    <main className="w-screen h-screen overflow-hidden bg-[#F8FAFC] text-slate-800 relative overscroll-none select-none">
      <ErrorBoundary>
        <VillageMap
          heatmapActive={heatmapActive}
          setHeatmapActive={setHeatmapActive}
          issues={issues}
        />
      </ErrorBoundary>
    </main>
  );
}

export function App() {
  return (
    <AuthProvider>
      <IssuesProvider>
        <DashboardGateway />
      </IssuesProvider>
    </AuthProvider>
  );
}

export default App;
