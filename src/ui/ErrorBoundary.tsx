import { Component, type ErrorInfo, type ReactNode } from 'react';

type State = { error: Error | null };

/** Keeps a rendering bug in one page from blanking the whole app. Your data is untouched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Page crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900">Something went wrong on this page</h1>
        <p className="mt-2 text-sm text-slate-500">Your saved data is safe. Reload the page to continue.</p>
        <pre className="mt-4 overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-600">{this.state.error.message}</pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-6 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Reload
        </button>
      </div>
    );
  }
}
