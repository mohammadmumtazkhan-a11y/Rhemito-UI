import * as React from "react";
import { Eye, EyeOff } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

/**
 * Password input with a show/hide visibility toggle (eye icon) at the right
 * edge. Drops in anywhere the base `Input` is used — every prop (id, value,
 * onChange, data-testid, …) passes straight through.
 */
const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentProps<"input"> & {
    /** Optional testid for the visibility toggle button itself. */
    toggleTestId?: string;
  }
>(({ className, toggleTestId, ...props }, ref) => {
  const [show, setShow] = React.useState(false);

  return (
    <div className="relative">
      <Input
        ref={ref}
        {...props}
        type={show ? "text" : "password"}
        className={cn("pr-10", className)}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        data-testid={toggleTestId}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
