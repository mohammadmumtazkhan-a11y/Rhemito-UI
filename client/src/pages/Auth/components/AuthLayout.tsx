import React from "react";

interface AuthLayoutProps {
  heading: string;
  subtitle?: string;
  children: React.ReactNode;
}

export default function AuthLayout({ heading, subtitle, children }: AuthLayoutProps) {
  return (
    <div
      className="min-h-screen flex flex-col items-center relative overflow-hidden"
      style={{ background: "linear-gradient(180deg, #f5f7fb 0%, #edf0f7 100%)" }}
    >
      {/* Header Logo */}
      <div className="flex flex-col items-center mt-6 sm:mt-8 mb-2">
        <div className="flex items-center space-x-2">
          <svg
            width="26"
            height="33"
            viewBox="0 0 26 33"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 sm:w-9 sm:h-9"
          >
            <path
              d="M25.0764 30.3999C25.0471 30.0963 24.9593 29.8023 24.813 29.5351L16.8761 14.4493L24.8398 3.57589C25.5715 2.5726 25.352 1.17091 24.3471 0.439699C23.9495 0.165191 23.5007 0 22.9983 0H2.25129C1.63908 0 1.08296 0.238069 0.658557 0.655904C0.251228 1.06159 0 1.62275 0 2.24222V30.604C0 31.3109 0.348792 32.0008 0.924419 32.4162C1.83664 33.0988 3.22693 32.9434 3.95622 32.0688C3.99769 32.0227 4.03183 31.9741 4.07086 31.9279L10.3296 23.3818L21.3836 32.3312C21.5568 32.4769 21.7543 32.5911 21.9641 32.6786C23.5007 33.332 25.2447 32.0591 25.0739 30.4023L25.0764 30.3999ZM9.49542 16.915L4.5099 23.7218V4.4893H18.6006L11.5857 14.0606L15.7541 21.9825L9.49542 16.915Z"
              fill="#3D48D1"
            />
          </svg>
          <span className="text-2xl sm:text-3xl font-semibold text-slate-800 tracking-tight">
            Rhemito
          </span>
        </div>
        {/* Blue gradient line */}
        <div
          className="mt-2 h-[3px] w-28 sm:w-32 rounded-full"
          style={{ background: "linear-gradient(90deg, transparent, #4f56e8, transparent)" }}
        />
      </div>

      {/* Heading */}
      <div className="text-center mt-4 sm:mt-6 mb-4 sm:mb-6 px-4">
        <h1 className="text-lg sm:text-xl font-normal text-slate-600">{heading}</h1>
        {subtitle && (
          <p className="text-sm text-slate-400 mt-1 max-w-md mx-auto">{subtitle}</p>
        )}
      </div>

      {/* Main content */}
      <div className="flex-grow flex items-start justify-center px-3 sm:px-4 w-full z-10 pb-20">
        <div className="w-full max-w-lg">{children}</div>
      </div>

      {/* Globe background */}
      <div className="absolute bottom-0 left-0 right-0 pointer-events-none overflow-hidden flex justify-center">
        <img
          src="/rhemitoGlobeBg.svg"
          alt=""
          aria-hidden="true"
          style={{ width: "800px", maxWidth: "100%" }}
        />
      </div>
    </div>
  );
}
