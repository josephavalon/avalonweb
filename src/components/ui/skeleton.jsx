import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}) {
  return (
    (<div
      className={cn("av-premium-shimmer rounded-2xl bg-primary/10", className)}
      {...props} />)
  );
}

export { Skeleton }
