export default function HomeLoading() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        height: "100dvh",
        background: "linear-gradient(180deg, #1a1a18 0%, #24231f 100%)",
        padding: "14px 14px 200px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          height: "430px",
          borderRadius: "32px",
          background:
            "linear-gradient(90deg, rgba(247,245,239,0.18) 25%, rgba(247,245,239,0.28) 50%, rgba(247,245,239,0.18) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div
        style={{
          height: "120px",
          borderRadius: "24px",
          background:
            "linear-gradient(90deg, rgba(247,245,239,0.14) 25%, rgba(247,245,239,0.24) 50%, rgba(247,245,239,0.14) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div
        style={{
          height: "280px",
          borderRadius: "28px",
          background:
            "linear-gradient(90deg, rgba(247,245,239,0.14) 25%, rgba(247,245,239,0.24) 50%, rgba(247,245,239,0.14) 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
