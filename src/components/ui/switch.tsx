import * as React from "react";
import * as SwitchPrimitives from "@radix-ui/react-switch";
import { clsx } from "clsx";

export const Switch = React.forwardRef<
  React.ElementRef<typeof SwitchPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SwitchPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SwitchPrimitives.Root
    className={clsx(
      "peer inline-flex h-7 w-14 shrink-0 cursor-pointer items-center rounded-full border border-white/[0.1] bg-slate-900/90 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#060814] disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-indigo-600 data-[state=checked]:to-blue-600 data-[state=checked]:border-indigo-400/50 data-[state=checked]:shadow-[0_0_15px_rgba(99,102,241,0.45)] shadow-inner",
      className
    )}
    {...props}
    ref={ref}
  >
    <SwitchPrimitives.Thumb
      className={clsx(
        "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform duration-200 translate-x-1 data-[state=checked]:translate-x-7"
      )}
    />
  </SwitchPrimitives.Root>
));
Switch.displayName = "Switch";
