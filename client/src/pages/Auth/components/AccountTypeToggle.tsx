import { motion } from "framer-motion";

interface AccountTypeToggleProps {
  value: "individual" | "business";
  onChange: (type: "individual" | "business") => void;
}

export default function AccountTypeToggle({ value, onChange }: AccountTypeToggleProps) {
  return (
    <div className="flex rounded-md border border-slate-200 overflow-hidden relative mb-5">
      {/* Animated pill background */}
      <motion.div
        className="absolute top-0 bottom-0 w-1/2 bg-slate-100 rounded-sm"
        animate={{ x: value === "individual" ? 0 : "100%" }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      />

      <button
        type="button"
        onClick={() => onChange("individual")}
        className={`relative z-10 flex-1 py-2.5 text-sm font-medium transition-colors ${
          value === "individual" ? "text-slate-800" : "text-slate-400"
        }`}
      >
        <span className="flex items-center justify-center gap-1.5">
          <span
            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
              value === "individual" ? "border-primary" : "border-slate-300"
            }`}
          >
            {value === "individual" && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </span>
          Individual
        </span>
      </button>

      <button
        type="button"
        onClick={() => onChange("business")}
        className={`relative z-10 flex-1 py-2.5 text-sm font-medium transition-colors ${
          value === "business" ? "text-slate-800" : "text-slate-400"
        }`}
      >
        <span className="flex items-center justify-center gap-1.5">
          <span
            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center ${
              value === "business" ? "border-primary" : "border-slate-300"
            }`}
          >
            {value === "business" && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            )}
          </span>
          Business
        </span>
      </button>
    </div>
  );
}
