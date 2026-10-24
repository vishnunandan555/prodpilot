import React from 'react';
import { AlertTriangle, RefreshCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showStack: false,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('[ProdPilot ErrorBoundary] Caught UI error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onGoHome) {
      this.props.onGoHome();
    } else {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || String(this.state.error || 'Unknown error');
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#080b11] text-[#c9d1d9] min-h-[400px]">
          <div className="max-w-xl w-full p-6 rounded-2xl bg-[#0e1420] border border-[#2b1d22] shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#38151b] border border-[#ff7b72]/30 flex items-center justify-center text-[#ff7b72] shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-semibold text-[#f0f6fc]">
                  {this.props.title || 'View Render Error Encountered'}
                </h3>
                <p className="text-xs text-[#8b949e] mt-0.5">
                  ProdPilot intercepted a component exception before the window crashed.
                </p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-[#07090e] border border-[#1b2438] font-mono text-xs text-[#ff7b72] break-all">
              {errorMsg}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReset}
                className="px-3.5 py-1.5 rounded-lg bg-[#1f6feb] hover:bg-[#388bfd] text-white text-xs font-semibold flex items-center gap-1.5 transition shadow-sm cursor-pointer"
              >
                <RefreshCw size={13} />
                <span>Retry View</span>
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-3.5 py-1.5 rounded-lg bg-[#161f30] hover:bg-[#202b40] border border-[#2b3a58] text-[#58a6ff] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              >
                <Home size={13} />
                <span>Return to Dashboard</span>
              </button>
              <button
                type="button"
                onClick={() => this.setState({ showStack: !this.state.showStack })}
                className="ml-auto text-xs text-[#6e7681] hover:text-[#8b949e] flex items-center gap-1 cursor-pointer"
              >
                <span>Details</span>
                {this.state.showStack ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {this.state.showStack && (
              <pre className="max-h-48 overflow-y-auto p-3 rounded-lg bg-[#05070a] border border-[#161d2d] font-mono text-[11px] text-[#8b949e] leading-relaxed whitespace-pre-wrap">
                {this.state.error?.stack || componentStack || 'No stack trace available.'}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
