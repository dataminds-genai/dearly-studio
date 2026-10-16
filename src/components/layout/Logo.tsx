import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  size?: number;
  showText?: boolean;
  textClassName?: string;
};

/**
 * Official Dearly Studio App Icon:
 * Berry rounded squircle (#9E2B57) with a white tilted card (-8deg),
 * folded peach corner, and center heart.
 */
export function Logo({ className, size = 36, showText = false, textClassName }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 64 64"
        role="img"
        aria-label="Dearly Studio"
        className="shrink-0 drop-shadow-[0_4px_12px_rgba(158,43,87,0.28)]"
      >
        <rect width="64" height="64" rx="16" fill="#9E2B57" />
        <g transform="rotate(-8 32 32)">
          {/* White Card body */}
          <path
            d="M17 14h22l8 8v28a3 3 0 0 1-3 3H17a3 3 0 0 1-3-3V17a3 3 0 0 1 3-3z"
            fill="#FFFFFF"
          />
          {/* Folded corner */}
          <path d="M39 14l8 8h-5a3 3 0 0 1-3-3z" fill="#E9B8A0" />
          {/* Berry Heart */}
          <path
            d="M31 44c-5.500-3.600-8.500-6.500-8.500-9.800 0-2.400 1.800-4.200 4-4.200 1.700 0 3.400 1 4.500 2.700 1.100-1.700 2.800-2.700 4.500-2.700 2.200 0 4 1.800 4 4.200 0 3.300-3 6.200-8.500 9.800z"
            fill="#9E2B57"
          />
        </g>
      </svg>
      {showText && (
        <span
          className={cn(
            "font-serif text-xl sm:text-2xl font-normal tracking-tight text-[#2A1F22]",
            textClassName,
          )}
        >
          Dearly Studio
        </span>
      )}
    </div>
  );
}
