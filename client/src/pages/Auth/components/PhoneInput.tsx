import { countries } from "@/data/countries";
import { SearchableSelect } from "@/components/ui/searchable-select";

interface PhoneInputProps {
  codeValue: string;
  numberValue: string;
  onCodeChange: (code: string) => void;
  onNumberChange: (number: string) => void;
  countryCode?: string;
  onCountryChange?: (countryCode: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export default function PhoneInput({
  codeValue,
  numberValue,
  onCodeChange,
  onNumberChange,
  countryCode,
  onCountryChange,
  label = "Mobile Number",
  required = true,
  error,
}: PhoneInputProps) {
  const matchedCountry =
    (countryCode
      ? countries.find((c) => c.code === countryCode && (!codeValue || c.dialCode === codeValue)) ||
        countries.find((c) => c.code === countryCode)
      : undefined) ||
    (codeValue ? countries.find((c) => c.dialCode === codeValue) : undefined);

  const selectValue =
    matchedCountry && codeValue ? `${matchedCountry.code}:${matchedCountry.dialCode}` : "";

  return (
    <div>
      <label className="block text-sm text-slate-500 mb-1">
        {label}
        {required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex gap-2">
        <SearchableSelect
          value={selectValue}
          onValueChange={(val) => {
            if (!val) {
              onCodeChange("");
              return;
            }
            const [selectedCountryCode, selectedDialCode] = val.split(":");
            onCodeChange(selectedDialCode || val);
            if (selectedCountryCode && onCountryChange) {
              onCountryChange(selectedCountryCode);
            }
          }}
          placeholder="Code"
          searchPlaceholder="Search country or code..."
          className="w-[105px] sm:w-[115px] shrink-0 [&>div:first-child]:h-[42px] [&>div:first-child]:border-slate-200 [&>div:first-child]:rounded"
          dropdownClassName="w-[240px]"
          options={countries.map((c) => ({
            value: `${c.code}:${c.dialCode}`,
            label: `${c.flag} ${c.dialCode}`,
            subLabel: c.name,
          }))}
        />
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
