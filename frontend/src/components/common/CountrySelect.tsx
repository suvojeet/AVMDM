import { useQuery } from "@tanstack/react-query";
import { referenceDataApi } from "../../services/api";
import { ISO_COUNTRIES } from "../../data/countries";

type RefItem = { id: string; code: number; value: string; description: string; isActive: boolean };

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Country dropdown backed by the COUNTRY reference-data category.
 * Falls back to the built-in ISO 3166-1 alpha-2 list when the category
 * hasn't been seeded yet.  Always stores the 2-letter ISO code as the value.
 */
export default function CountrySelect({
  value,
  onChange,
  placeholder = "— Select country —",
  className = "",
  disabled = false,
}: Props) {
  const { data: refItems = [], isLoading } = useQuery<RefItem[]>({
    queryKey: ["reference-data-active", "COUNTRY"],
    queryFn: () => referenceDataApi.getActiveByCategory("COUNTRY"),
    staleTime: 300_000,
  });

  const active = refItems as RefItem[];
  const useRefData = !isLoading && active.length > 0;

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
      className={className}
    >
      <option value="">{isLoading ? "Loading…" : placeholder}</option>
      {useRefData
        ? active.map((item) => (
            <option key={item.id} value={item.value}>
              {item.value} — {item.description}
            </option>
          ))
        : ISO_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} — {c.name}
            </option>
          ))}
    </select>
  );
}
