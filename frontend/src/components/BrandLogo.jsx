const BRAND_LOGO = "/brand/mascot.png";

export default function BrandLogo({ size = 32, className = "" }) {
  return (
    <img
      src={BRAND_LOGO}
      alt=""
      className={className ? `brand-logo ${className}` : "brand-logo"}
      width={size}
      height={size}
      decoding="async"
    />
  );
}
