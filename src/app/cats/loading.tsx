export default function CatsLoading() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f7f5ef",
        padding: "20px 16px 200px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div
        style={{
          height: "60px",
          borderRadius: "12px",
          background:
            "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 1.5s infinite",
          width: "120px",
        }}
      />
      <div
        style={{
          display: "flex",
          gap: "16px",
        }}
      >
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <div
              style={{
                width: "72px",
                height: "72px",
                borderRadius: "50%",
                background:
                  "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
                animationDelay: `${index * 0.1}s`,
              }}
            />
            <div
              style={{
                width: "40px",
                height: "12px",
                borderRadius: "6px",
                background:
                  "linear-gradient(90deg, #f0ede6 25%, #e8e5de 50%, #f0ede6 75%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 1.5s infinite",
              }}
            />
          </div>
        ))}
      </div>
      <div
        style={{
          height: "300px",
          borderRadius: "24px",
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
