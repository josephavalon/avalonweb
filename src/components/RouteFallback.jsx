export default function RouteFallback() {
  return (
    <div
      className="flex min-h-[100svh] flex-col items-center justify-center bg-background px-4 py-6"
      role="status"
      aria-live="polite"
      aria-label="Loading Avalon Vitality"
    >
      <div className="av-loader-lockup flex flex-col items-center justify-center">
        <p className="av-loader-mark font-heading text-[22vw] leading-none tracking-[0.32em] pl-[0.32em] text-foreground select-none sm:text-[14vw] md:text-[8vw]">
          AV
        </p>
        <p className="mt-2 font-body text-[10px] uppercase tracking-[0.4em] text-foreground/45 select-none">
          AVALON VITALITY
        </p>
        <div className="mt-7 h-px w-40 overflow-hidden bg-foreground/10">
          <div className="h-full origin-left animate-[av-loader-progress_1060ms_cubic-bezier(0.16,1,0.3,1)_forwards] bg-foreground" />
        </div>
      </div>
    </div>
  );
}
