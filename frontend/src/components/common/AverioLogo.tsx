interface AverioLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
  showText?: boolean;
  className?: string;
  removeBackground?: boolean;
}

const HEIGHT: Record<string, number> = {
  sm:    28,
  md:    36,
  lg:    56,
  xl:    80,
  "2xl": 120,
};

export default function AverioLogo({
  size = "md",
  showText = true,
  className = "",
}: AverioLogoProps) {
  const h = HEIGHT[size];

  // Icon-only (square): contain the full PNG within the square; dark areas vanish via screen blend
  if (!showText) {
    return (
      <img
        src="/averio-quantum.png"
        alt="Averio Quantum"
        className={className}
        style={{
          height: h,
          width: h,
          objectFit: "contain",
          display: "block",
          flexShrink: 0,
          mixBlendMode: "screen",
        }}
      />
    );
  }

  // Full logo (icon + AVERIO QUANTUM text)
  return (
    <img
      src="/averio-quantum.png"
      alt="Averio Quantum"
      className={className}
      style={{
        height: h,
        width: "auto",
        display: "block",
        flexShrink: 0,
        mixBlendMode: "screen",
      }}
    />
  );
}
