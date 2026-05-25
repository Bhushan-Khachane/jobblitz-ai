"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div className="min-h-[400px] flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-1">
                Something went wrong
              </h2>
              <p className="text-sm text-gray-500">
                {this.state.error?.message || "An unexpected error occurred"}
              </p>
            </div>
            <Button onClick={() => this.setState({ hasError: false })}>
              Try Again
            </Button>
            <Button
              variant="ghost"
              onClick={() => (window.location.href = "/dashboard")}
            >
              Go to Dashboard
            </Button>
          </div>
        )
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
