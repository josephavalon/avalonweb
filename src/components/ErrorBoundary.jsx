import React from 'react';

/**
 * Top-level error boundary. Catches render errors anywhere inside the app
 * and replaces them with a calm fallback so users never see a white screen.
 *
 * Intentionally minimal: no state logging service wired yet. When Sentry is
 * added post-launch, pipe componentDidCatch into Sentry.captureException.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('[Avalon] Render error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.href = '/';
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-[100svh] bg-background text-foreground flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <p className="font-body text-[10px] tracking-[0.35em] text-accent uppercase mb-6">
            Something went wrong
          </p>
          <h1 className="font-heading text-4xl md:text-5xl tracking-wide mb-4">
            WHOOPSIES, OUR BAD
          </h1>
          <p className="font-body text-sm text-muted-foreground mb-8 leading-relaxed">
            The page couldn't load. Try refreshing, or head back to the homepage and try again.
          </p>
          <button
            type="button"
            onClick={this.handleReload}
            className="inline-block px-8 py-3 font-body text-[11px] tracking-widest uppercase font-semibold rounded-full bg-foreground text-background hover:bg-foreground/90 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }
}
