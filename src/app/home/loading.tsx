export default function HomeLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #fdfcf9 0%, #f7f5ef 100%)",
        padding: "14px 14px 200px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          height: "430px",
          borderRadius: "32px",
          background:
            "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div
        style={{
          height: "120px",
          borderRadius: "24px",
          background:
            "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div
        style={{
          height: "280px",
          borderRadius: "28px",
          background:
            "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
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
