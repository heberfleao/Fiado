import React, { useState, useEffect } from "react";

export default function PinPad({ length = 6, onComplete, busy = false, resetKey, compact = false }) {
  const [digits, setDigits] = useState("");

  // Parent changes resetKey to force-clear the pad (e.g. after a wrong PIN).
  useEffect(() => {
    setDigits("");
  }, [resetKey]);

  useEffect(() => {
    if (digits.length === length) {
      onComplete(digits);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits]);

  const press = (d) => {
    if (busy || digits.length >= length) return;
    setDigits((prev) => prev + d);
  };
  const backspace = () => {
    if (busy) return;
    setDigits((prev) => prev.slice(0, -1));
  };

  return (
    <div>
      <div className={"pinpad-dots" + (compact ? " compact" : "")}>
        {Array.from({ length }).map((_, i) => (
          <div key={i} className={"pinpad-dot" + (i < digits.length ? " filled" : "")} />
        ))}
      </div>
      <div className={"pinpad-grid" + (compact ? " compact" : "")}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
          <button key={n} type="button" className="pinpad-key" onClick={() => press(String(n))} disabled={busy}>
            {n}
          </button>
        ))}
        <div className="pinpad-key empty" />
        <button type="button" className="pinpad-key" onClick={() => press("0")} disabled={busy}>0</button>
        <button type="button" className="pinpad-key action" onClick={backspace} disabled={busy}>⌫</button>
      </div>
    </div>
  );
}
