"use client";

import { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen gap-4 bg-[var(--bg-primary)] text-[var(--text-primary)]">
          <AlertCircle className="w-10 h-10 text-red-400" />
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-[var(--text-muted)] max-w-md text-center">{this.state.error?.message || 'An unexpected error occurred.'}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            <RefreshCw className="w-4 h-4" /> Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
