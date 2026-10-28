import { cn } from "@/lib/utils";

interface RhemitoLogoIconProps {
  className?: string;
}

/**
 * Official Rhemito brand mark from assets/Rhemito-logo.svg.
 */
export function RhemitoLogoIcon({ className }: RhemitoLogoIconProps) {
  return (
    <svg
      width="26"
      height="33"
      viewBox="0 0 26 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      data-testid="rhemito-official-logo"
      className={cn("w-[24px] h-[30px] shrink-0", className)}
    >
      <path
        d="M25.0764 30.3999C25.0471 30.0963 24.9593 29.8023 24.813 29.5351L16.8761 14.4493L24.8398 3.57589C25.5715 2.5726 25.352 1.17091 24.3471 0.439699C23.9495 0.165191 23.5007 0 22.9983 0H2.25129C1.63908 0 1.08296 0.238069 0.658557 0.655904C0.251228 1.06159 0 1.62275 0 2.24222V30.604C0 31.3109 0.348792 32.0008 0.924419 32.4162C1.83664 33.0988 3.22693 32.9434 3.95622 32.0688C3.99769 32.0227 4.03183 31.9741 4.07086 31.9279L10.3296 23.3818L21.3836 32.3312C21.5568 32.4769 21.7543 32.5911 21.9641 32.6786C23.5007 33.332 25.2447 32.0591 25.0739 30.4023L25.0764 30.3999ZM9.49542 16.915L4.5099 23.7218V4.4893H18.6006L11.5857 14.0606L15.7541 21.9825L9.49542 16.915Z"
        fill="#3D48D1"
      />
    </svg>
  );
}
