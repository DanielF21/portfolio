"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";

import { API_URL } from "@/lib/api";

/**
 * The live REPL.
 *
 * The session lives HERE, not on the server. Each submission sends the
 * expressions already run so the server can rebuild the environment, evaluate,
 * and then throw it away. The old backend kept one `global_frame` shared by
 * every visitor, so a stranger's `(define x 5)` would show up in your session
 * and yours in theirs.
 *
 * The console keeps its own black-and-green palette on purpose. It is a
 * terminal, so it looks the same in both themes.
 */
export default function SchemeRepl() {
  const [history, setHistory] = useState<string[]>([]);
  /** Just the expressions submitted, in order. Sent as the replay history;
   *  kept separate from `history`, which is the display transcript. */
  const [inputs, setInputs] = useState<string[]>([]);
  const [currentInput, setCurrentInput] = useState("");
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLSpanElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
    if (inputRef.current) {
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(inputRef.current);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [history, currentInput]);

  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent<HTMLSpanElement>) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      if (!currentInput.trim()) return;

      const sent = currentInput;
      setCurrentInput("");
      setPending(true);
      try {
        const response = await fetch(`${API_URL}/scheme/eval`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: sent.trim(), history: inputs }),
        });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        const cleaned = data.output.replace(/^out>\s*/, "").trim();
        setHistory((prev) => [...prev, `in> ${sent}`, `out> ${cleaned}`]);
        // Only remember it once it round-tripped, so a failed request does not
        // poison the replay for every later expression.
        setInputs((prev) => [...prev, sent.trim()]);
      } catch {
        setHistory((prev) => [
          ...prev,
          `in> ${sent}`,
          "out> Error: could not reach the interpreter",
        ]);
      } finally {
        setPending(false);
      }
    },
    [currentInput, inputs]
  );

  const handleInput = useCallback((e: React.FormEvent<HTMLSpanElement>) => {
    setCurrentInput((e.target as HTMLSpanElement).textContent || "");
  }, []);

  return (
    <div
      ref={consoleRef}
      className="h-[60vh] w-full overflow-auto rounded-lg bg-black p-6 font-mono text-body text-green-400 shadow-lg"
    >
      {history.map((line, index) => (
        <div key={`${index}-${line}`}>{line}</div>
      ))}
      <div className="flex">
        <span className="mr-1 select-none">in&gt;</span>
        <span
          ref={inputRef}
          dangerouslySetInnerHTML={{ __html: currentInput }}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          className="flex-1 outline-none"
          contentEditable
          role="textbox"
          aria-label="Scheme expression"
          suppressContentEditableWarning
        />
      </div>
      {pending && <div className="text-green-400/50">evaluating...</div>}
    </div>
  );
}
