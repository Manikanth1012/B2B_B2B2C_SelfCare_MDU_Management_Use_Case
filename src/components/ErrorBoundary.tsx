import { Component, type ReactNode } from 'react';

/** Keeps one broken page from blanking the whole portal; resets on navigation via `key`. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto my-10 max-w-lg rounded-card border border-red-200 bg-red-50 p-6 text-center">
        <h2 className="font-bold text-navy">This page hit an unexpected error</h2>
        <p className="mt-1 text-sm text-ink-700">{this.state.error.message}</p>
        <button className="mt-4 rounded-full bg-brand px-5 py-2 text-sm font-bold text-white" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    );
  }
}
