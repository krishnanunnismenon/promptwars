"use client";

import React, { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Uncaught error boundary exception:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center p-6 text-center bg-cream text-ink">
          <div className="rounded-3xl border border-border bg-surface p-8 max-w-md shadow-card">
            <h2 className="text-2xl font-bold mb-3">Something went wrong</h2>
            <p className="text-muted mb-6 text-sm">
              An unexpected error occurred. Don&apos;t worry — your progress is safe.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full min-h-14 rounded-2xl bg-accent text-white font-medium text-base shadow-button transition active:scale-[0.98]"
            >
              Refresh page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
