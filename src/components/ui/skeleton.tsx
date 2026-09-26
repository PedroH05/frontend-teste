import { cn } from "cn"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-md bg-[var(--vt-sk)] motion-reduce:animate-none",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
