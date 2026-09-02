"use client";

import React from "react";
import { toUserMessage } from "@/lib/errors";

interface ErrorBoundaryState {
  hasError: boolean;
  error: unknown;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error: unknown; reset: () => void }>;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { fallback: Fallback } = this.props;

    if (Fallback) {
      return <Fallback error={this.state.error} reset={this.reset} />;
    }

    return (
      <DefaultErrorFallback error={this.state.error} reset={this.reset} />
    );
  }
}

function DefaultErrorFallback({
  error,
  reset,
}: {
  error: unknown;
  reset: () => void;
}): React.ReactElement {
  const message = toUserMessage(error);

  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-lg border border-red-200 bg-red-50 p-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
        <span className="text-2xl">⚠️</span>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-red-800">
          Something went wrong
        </h3>
        <p className="mt-1 text-sm text-red-600">{message}</p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
      >
        Try again
      </button>
    </div>
  );
}
