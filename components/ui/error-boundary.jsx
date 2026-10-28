"use client";

import React from "react";
import { AlertCircle } from "lucide-react";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    if (this.props.onError) this.props.onError(error, info);
    if (process.env.NODE_ENV !== "production") {
      console.error("ErrorBoundary caught:", error, info);
    }
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback({ error: this.state.error, reset: this.reset });
      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed bg-muted/30 p-6 text-center">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">Something went wrong rendering this section.</p>
          <button
            onClick={this.reset}
            className="text-xs text-primary underline-offset-4 hover:underline"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
