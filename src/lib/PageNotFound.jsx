import { Link, useLocation } from 'react-router-dom';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.replace(/^\//, '') || 'this page';

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-background text-foreground">
      <div className="max-w-md w-full text-center space-y-8">
        <div className="space-y-3">
          <p className="font-body text-[11px] tracking-[0.32em] uppercase text-muted-foreground">
            Error 404
          </p>
          <h1 className="font-heading text-[18vw] md:text-[8rem] leading-none tracking-wide">
            Not Found
          </h1>
          <div className="h-px w-12 bg-foreground/30 mx-auto" />
        </div>

        <p className="font-body text-sm text-muted-foreground leading-relaxed">
          <span className="text-foreground">"{pageName}"</span> could not be located.
          Return home and we'll take you back to Avalon.
        </p>

        <div className="pt-2">
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-full border border-foreground/20 hover:border-foreground/60 font-body text-[11px] tracking-[0.25em] uppercase transition-colors"
          >
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
