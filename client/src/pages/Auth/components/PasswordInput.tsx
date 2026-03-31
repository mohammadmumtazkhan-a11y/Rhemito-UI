import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  required?: boolean;
  error?: string;
}

export default function PasswordInput({
  value,
  onChange,
  label,
  placeholder = "Password",
  required = true,
  error,
}: PasswordInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div>
      <label className="block text-sm text-slate-500 mb-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`block w-full px-3 py-2.5 pr-10 border rounded text-sm text-slate-700 focus:ring-blue-500 focus:border-blue-500 ${
            error ? "border-red-300" : "border-slate-200"
          }`}
          placeholder={placeholder}
          required={required}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          tabIndex={-1}
        >
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
    </div>
  );
}
