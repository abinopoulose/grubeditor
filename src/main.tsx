import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean; error: any}> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050811] text-red-400 p-10 font-mono flex flex-col items-center justify-center">
          <div className="max-w-2xl w-full bg-slate-900/80 border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              ⚠️ GrubEditor UI Runtime Exception
            </h1>
            <p className="text-sm text-slate-300">An error occurred while mounting the graphical workspace:</p>
            <div className="bg-[#020408] p-4 rounded-xl border border-white/10 text-xs overflow-auto font-mono text-red-300 max-h-64">
              <p className="font-bold mb-2">{this.state.error?.message || "Unknown rendering exception"}</p>
              <pre className="text-[10px] text-slate-500 leading-relaxed">{this.state.error?.stack || ""}</pre>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all shadow-md"
            >
              Reload Interface
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
