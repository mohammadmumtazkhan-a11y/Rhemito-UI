/**
 * Approved Rhemito MITO-BLUE legal strip.
 * Always sits on the right of the main column — do not rebuild on pages.
 */
export function LegalStrip() {
  return (
    <div
      className="mb-[2.2rem] flex w-full flex-wrap items-center justify-end gap-x-0 text-[15px] leading-normal text-[#605E5C]"
      data-testid="legal-strip"
    >
      <span className="whitespace-nowrap font-normal">powered by mito.money</span>
      <button
        type="button"
        className="whitespace-nowrap px-[1.4rem] font-normal text-blue-600 hover:text-blue-700 lg:px-[2.4rem]"
        onClick={(e) => e.preventDefault()}
      >
        Privacy Policy
      </button>
      <button
        type="button"
        className="whitespace-nowrap font-normal text-blue-600 hover:text-blue-700"
        onClick={(e) => e.preventDefault()}
      >
        Terms of use
      </button>
    </div>
  );
}
