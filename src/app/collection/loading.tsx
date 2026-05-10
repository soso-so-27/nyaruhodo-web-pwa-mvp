export default function CollectionLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f5ef",
        padding: "20px 16px 200px",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div
        style={{
          height: "80px",
          borderRadius: "16px",
          background:
            "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
        }}
      />
      <div
        style={{
          height: "40px",
          borderRadius: "99px",
          background:
            "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          width: "200px",
        }}
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}
      >
        {[...Array(6)].map((_, index) => (
          <div
            key={index}
            style={{
              aspectRatio: "1",
              borderRadius: "16px",
              background:
                "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
              backgroundSize: "200% 100%",
              animation: "shimmer 1.5s infinite",
              animationDelay: `${index * 0.1}s`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}
