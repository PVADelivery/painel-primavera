import React from "react";
import { cn } from "@/lib/utils";

interface CurrencyInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string | number;
  onChangeValue: (value: string) => void;
}

export function CurrencyInput({ value, onChangeValue, className, ...props }: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState("");

  React.useEffect(() => {
    if (value === undefined || value === null || value === "") {
      setDisplayValue("");
      return;
    }
    const num = typeof value === "number" ? value : parseFloat(value.toString());
    if (isNaN(num)) {
      setDisplayValue("");
    } else {
      setDisplayValue(num.toFixed(2).replace(".", ","));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (!val) {
      onChangeValue("");
      return;
    }
    const num = parseInt(val, 10) / 100;
    onChangeValue(num.toFixed(2));
  };

  return (
    <input
      type="text"
      value={displayValue}
      onChange={handleChange}
      className={cn(
        "flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-base font-bold shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      placeholder="0,00"
      {...props}
    />
  );
}
