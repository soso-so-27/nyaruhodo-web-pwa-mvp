"use client";

export function OfflineRetryButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      style={styles.button}
    >
      もう一度読み込む
    </button>
  );
}

const styles = {
  button: {
    minWidth: "210px",
    minHeight: "48px",
    marginTop: "24px",
    padding: "0 22px",
    border: "1px solid rgba(168,88,78,0.34)",
    borderRadius: "999px",
    background: "#a8584e",
    color: "#fffdfa",
    font: "inherit",
    cursor: "pointer",
  },
};
