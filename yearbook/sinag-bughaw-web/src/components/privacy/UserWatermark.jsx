function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function tile(name, email) {
  const label = escapeXml([name, email].filter(Boolean).join("  ·  "));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="460" height="220" viewBox="0 0 460 220">
    <text x="24" y="128" fill="#1d2b4b" font-size="15" font-family="Inter, sans-serif" transform="rotate(-26 230 110)">${label}</text>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export default function UserWatermark({ name, email }) {
  if (!name && !email) return null;

  return (
    <div
      aria-hidden="true"
      className="sb-user-watermark pointer-events-none fixed inset-0 z-[80] overflow-hidden"
      style={{
        backgroundImage: tile(name, email),
        backgroundRepeat: "repeat",
        opacity: 0.16,
        mixBlendMode: "multiply",
      }}
    />
  );
}
