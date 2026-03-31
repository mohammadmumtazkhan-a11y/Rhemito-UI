import { countries } from "@/data/countries";

interface PhoneInputProps {
  codeValue: string;
  numberValue: string;
  onCodeChange: (code: string) => void;
  onNumberChange: (number: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export default function PhoneInput({
  codeValue,
  numberValue,
  onCodeChange,
  onNumberChange,
  label = "Mobile Number",
  required = true,
  error,
}: PhoneInputProps) {
  return (
    <div>
      <label className="block text-sm text-slate-500 mb-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={codeValue}
          onChange={(e) => onCodeChange(e.target.value)}
          className="w-[90px] sm:w-[100px] px-2 py-2.5 border border-slate-200 rounded text-sm text-slate-700 bg-white focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">00</option>
          {countries.map((c) => (
            <option key={c.code} value={c.dialCode}>
              {c.flag} {c.dialCode}
            </option>
          ))}
        </select>
        <input
          type="tel"
          value={numberValue}
          onChange={(e) => onNumberChange(e.target.value.replace(/\D/g, ""))}
          className={`flex-1 px-3 py-2.5 border rounded text-sm text-slate-700 focus:ring-blue-500 focus:border-blue-500 ${
            error ? "border-red-300" : "border-slate-200"
          }`}
          placeholder="Contact number"
        />
      </div>
      {error && <p className="text-red-500 text-xs mt-1 font-medium">{error}</p>}
    </div>
  );
}
