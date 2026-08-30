import { Database } from 'lucide-react';

export default function OperationalSourceUnavailable({ title = 'Live source unavailable', description }) {
  return (
    <div className="mx-auto flex min-h-[28rem] w-full max-w-2xl items-center justify-center px-5 py-12">
      <div className="av-glass-card w-full rounded-[1.75rem] border border-foreground/[0.12] bg-background/62 p-8 text-center backdrop-blur-2xl md:p-12">
        <Database className="mx-auto h-9 w-9 text-foreground/28" />
        <p className="mt-5 font-heading text-4xl uppercase leading-none text-foreground">{title}</p>
        <p className="mx-auto mt-4 max-w-lg font-body text-sm leading-relaxed text-foreground/50">
          {description || 'No fixture, sample, or locally invented operational records are shown. Actions remain disabled until the live source is connected and verified.'}
        </p>
      </div>
    </div>
  );
}
