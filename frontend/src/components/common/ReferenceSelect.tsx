import { useQuery } from "@tanstack/react-query";
import { referenceDataApi } from "../../services/api";

type RefItem = { id: string; code: number; value: string; isActive: boolean };

interface Props {
  category: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  required?: boolean;
}

/**
 * Dropdown populated from a reference data category fetched from the API.
 * Stores the item's `value` string as the selected value.
 */
export default function ReferenceSelect({
  category,
  value,
  onChange,
  placeholder = "— Select —",
  className = "",
  disabled = false,
}: Props) {
  const { data: items = [], isLoading } = useQuery<RefItem[]>({
    queryKey: ["reference-data-active", category],
    queryFn: () => referenceDataApi.getActiveByCategory(category),
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });

  const active = items as RefItem[];

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || isLoading}
      className={className}
    >
      <option value="">{isLoading ? "Loading…" : placeholder}</option>
      {active.map((item) => (
        <option key={item.id} value={item.value}>
          {item.value}
        </option>
      ))}
    </select>
  );
}
