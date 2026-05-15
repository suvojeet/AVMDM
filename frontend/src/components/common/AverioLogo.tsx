interface AverioLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

const HEIGHT: Record<string, number> = {
  sm: 28,
  md: 36,
  lg: 56,
  xl: 80,
};

const LOGO_SRC = "/averio-quantum.jpeg";

export default function AverioLogo({ size = "md", showText = true, className = "" }: AverioLogoProps) {
  const h = HEIGHT[size];

  if (!showText) {
    return (
      <div
        className={`flex-shrink-0 overflow-hidden select-none rounded-lg ${className}`}
        style={{ width: h, height: h }}
      >
        <img
          src={LOGO_SRC}
          alt="Averio"
          draggable={false}
          style={{ width: h, height: h, objectFit: "cover", display: "block" }}
        />
      </div>
    );
  }

  return (
    <div className={`flex-shrink-0 select-none ${className}`}>
      <img
        src={LOGO_SRC}
        alt="Averio Quantum"
        draggable={false}
        style={{ height: h, width: "auto", objectFit: "contain", display: "block" }}
      />
    </div>
  );
}
