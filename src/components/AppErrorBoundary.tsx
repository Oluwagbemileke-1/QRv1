import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    message: "",
  };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message || "Something went wrong while rendering this page.",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("App render error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#0b0c0e",
            color: "#f1f5f9",
            fontFamily: "DM Sans, sans-serif",
            padding: "2rem",
          }}
        >
          <div
            style={{
              width: "min(640px, 100%)",
              background: "#111316",
              border: "1px solid rgba(239,68,68,0.22)",
              borderRadius: "18px",
              padding: "1.25rem",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.25rem", color: "#fecaca" }}>This page hit a runtime error</h2>
            <p style={{ marginTop: "0.75rem", color: "#cbd5e1", lineHeight: 1.6 }}>
              {this.state.message}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
