import * as React from "react";
import * as SliderPrimitives from "@radix-ui/react-slider";
import { clsx } from "clsx";

export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitives.Root>
>(({ className, ...props }, ref) => (
  <SliderPrimitives.Root
    ref={ref}
    className={clsx(
      "relative flex w-full touch-none select-none items-center py-2 cursor-pointer",
      className
    )}
    {...props}
  >
    <SliderPrimitives.Track className="relative h-2.5 w-full grow overflow-hidden rounded-full bg-slate-800/80 border border-white/[0.06] shadow-inner">
      <SliderPrimitives.Range className="absolute h-full bg-gradient-to-r from-indigo-600 to-blue-500 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.45)]" />
    </SliderPrimitives.Track>
    <SliderPrimitives.Thumb className="block h-6 w-6 rounded-full border-[3px] border-indigo-500 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.6)] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50 hover:scale-115 hover:shadow-[0_0_18px_rgba(99,102,241,0.85)]" />
  </SliderPrimitives.Root>
));
Slider.displayName = "Slider";
