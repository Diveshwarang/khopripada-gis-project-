import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, errorMessage: '' };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error?.message || 'Unknown runtime error' };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full min-h-[300px] flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center rounded-xl border border-slate-700">
          <h3 className="text-base font-bold text-red-400 mb-2">Interface Recovery Active</h3>
          <p className="text-xs text-slate-300 max-w-md mb-4">
            A temporary rendering fault was prevented from crashing the dashboard.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, errorMessage: '' });
              window.location.reload();
            }}
            className="px-4 py-1.5 bg-[#48999E] hover:bg-[#3D858A] rounded-lg text-xs font-semibold text-white transition-colors"
          >
            Reset Interface
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
