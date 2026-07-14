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
    border: "1px solid rgba(74,63,53,0.18)",
    borderRadius: "999px",
    background: "var(--ink, #4a3f35)",
    color: "var(--paper, #fffdfa)",
    font: "inherit",
    cursor: "pointer",
  },
};
