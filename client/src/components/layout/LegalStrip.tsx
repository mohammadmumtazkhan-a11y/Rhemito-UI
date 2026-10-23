import { cn } from "@/lib/utils";

interface LegalStripProps {
  className?: string;
}

/**
 * Approved Rhemito MITO-BLUE legal strip.
 * Always sits on the right of the main column — do not rebuild on pages.
 */
export function LegalStrip({ className }: LegalStripProps) {
  return (
    <div
      className={cn(
        "mb-3 flex w-full flex-wrap items-center justify-end gap-x-4 text-xs md:text-[13px] leading-normal text-[#605E5C]",
        className
      )}
      data-testid="legal-strip"
    >
      <span className="whitespace-nowrap font-normal">powered by mito.money</span>
      <button
        type="button"
        className="whitespace-nowrap font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
        onClick={(e) => e.preventDefault()}
      >
        Privacy Policy
      </button>
      <button
        type="button"
        className="whitespace-nowrap font-medium text-blue-600 hover:text-blue-700 transition-colors cursor-pointer"
        onClick={(e) => e.preventDefault()}
      >
        Terms of use
      </button>
    </div>
  );
}
