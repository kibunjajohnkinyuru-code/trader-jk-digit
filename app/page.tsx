"use client";

import { useEffect, useMemo, useState } from "react";

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const MAX_HISTORY = 100;

export default function Home() {
  const [selectedDigit, setSelectedDigit] = useState(5);

  const [market] = useState("1HZ100V");
  const [price, setPrice] = useState<string | null>(null);
  const [lastDigit, setLastDigit] = useState<number | null>(null);

  const [connection, setConnection] = useState("Starting");
  const [status, setStatus] = useState("Waiting for ticks");

  const [history, setHistory] = useState<number[]>([]);
  const [tickCount, setTickCount] = useState(0);
const [validationCandidate, setValidationCandidate] =
  useState<number | null>(null);

const [validationStatus, setValidationStatus] = useState<
  "IDLE" | "WAITING" | "HIT" | "MISS"
>("IDLE");

const [validationStartTick, setValidationStartTick] =
  useState<number | null>(null);
const [validationResults, setValidationResults] = useState({
  tested: 0,
  hits: 0,
  misses: 0,
});

const validationAccuracy =
  validationResults.tested > 0
    ? (validationResults.hits / validationResults.tested) * 100
    : 0;
  /*
   * LIVE DERIV TICK FEED
   */
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;

    const getTick = async () => {
      try {
        setConnection("Connecting");

        const response = await fetch(
          `/api/deriv-tick?symbol=${encodeURIComponent(market)}`,
          {
            cache: "no-store",
          }
        );

        const data = await response.json();

        if (!active) return;

        if (!response.ok || !data.ok) {
          setConnection("Error");
          setStatus("Feed error");

          timer = setTimeout(getTick, 3000);
          return;
        }

        const digit = Number(data.last_digit);

        /*
         * Validate the digit before adding it.
         */
        if (
          !Number.isInteger(digit) ||
          digit < 0 ||
          digit > 9
        ) {
          setConnection("Error");
          setStatus("Invalid digit");

          timer = setTimeout(getTick, 3000);
          return;
        }

        setPrice(String(data.quote));
        setLastDigit(digit);
        setConnection("Connected");
        setStatus("Live");

        setTickCount((previous) => previous + 1);

setHistory((previous) => {
  const updated = [...previous, digit];
  return updated.slice(-MAX_HISTORY);
});
      } catch {
        if (!active) return;

        setConnection("Error");
        setStatus("Connection failed");

        timer = setTimeout(getTick, 3000);
        return;
      }

      if (active) {
        timer = setTimeout(getTick, 1000);
      }
    };

    getTick();

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [market]);

  /*
   * DIGIT FREQUENCY COUNTS
   */
  /*
 * NEXT-TICK VALIDATION
 *
 * Tests the selected candidate against exactly
 * one newly received digit.
 *
 * Historical validation only.
 */
useEffect(() => {
  if (
    validationStatus !== "WAITING" ||
    validationCandidate === null ||
    validationStartTick === null
  ) {
    return;
  }

  if (tickCount <= validationStartTick) {
    return;
  }

  const actualDigit = history[history.length - 1];
  const hit = actualDigit === validationCandidate;

  setValidationResults((previous) => ({
    tested: previous.tested + 1,
    hits: previous.hits + (hit ? 1 : 0),
    misses: previous.misses + (hit ? 0 : 1),
  }));

  setValidationStatus(hit ? "HIT" : "MISS");
  setValidationCandidate(null);
  setValidationStartTick(null);
}, [
  tickCount,
  history,
  validationStatus,
  validationCandidate,
  validationStartTick,
]);
  const counts = useMemo(() => {
    const result: Record<number, number> = {};

    digits.forEach((digit) => {
      result[digit] = 0;
    });

    history.forEach((digit) => {
      if (digit >= 0 && digit <= 9) {
        result[digit]++;
      }
    });

    return result;
  }, [history]);

  /*
   * SELECTED DIGIT STATISTICS
   */
  const match = counts[selectedDigit];

  const nonMatch = history.length - match;

  const matchPercentage =
    history.length > 0
      ? ((match / history.length) * 100).toFixed(1)
      : "0.0";

  const nonMatchPercentage =
    history.length > 0
      ? ((nonMatch / history.length) * 100).toFixed(1)
      : "0.0";

  /*
   * MOST FREQUENT DIGIT
   */
  const mostFrequentDigit = useMemo(() => {
    if (history.length === 0) {
      return null;
    }

    return digits.reduce((best, digit) =>
      counts[digit] > counts[best] ? digit : best
    );
  }, [counts, history.length]);

  /*
   * LEAST FREQUENT DIGIT
   */
  const leastFrequentDigit = useMemo(() => {
    if (history.length === 0) {
      return null;
    }

    return digits.reduce((best, digit) =>
      counts[digit] < counts[best] ? digit : best
    );
  }, [counts, history.length]);
const topCandidate = mostFrequentDigit;

const startNextTickValidation = () => {
  if (history.length < MAX_HISTORY || topCandidate === null) {
    return;
  }

  setValidationCandidate(topCandidate);
  setValidationStartTick(tickCount);
  setValidationStatus("WAITING");
};
  /*
   * BASIC ANALYSIS
   *
   * This describes observed frequency only.
   * It does not predict the next digit.
   */
  const analysis =
    history.length < 20
      ? "Collecting data"
      : Number(matchPercentage) > 15
      ? "Above recent average"
      : Number(matchPercentage) < 5
      ? "Below recent average"
      : "Normal range";

  /*
   * RESET
   */
  const resetAnalysis = () => {
    setHistory([]);
  };

  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="mx-auto max-w-md">

        {/* HEADER */}
        <header className="mb-6">
          <h1 className="text-3xl font-bold">
            Trader JK
          </h1>

          <p className="text-sm text-gray-400">
            Deriv Digit Analysis Tool
          </p>
        </header>

        {/* MARKET / CONNECTION */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">
          <div className="flex justify-between gap-4">

            <div>
              <p className="text-xs text-gray-500">
                MARKET
              </p>

              <p className="font-semibold">
                {market}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                Volatility 100 (1s) Index
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-500">
                CONNECTION
              </p>

              <p
                className={
                  connection === "Connected"
                    ? "text-green-400"
                    : connection === "Error"
                    ? "text-red-400"
                    : "text-yellow-400"
                }
              >
                ● {connection}
              </p>
            </div>

          </div>
        </section>

        {/* CURRENT PRICE */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-center mb-4">

          <p className="text-xs text-gray-500">
            CURRENT PRICE
          </p>

          <p className="text-3xl font-bold mt-2">
            {price ?? "Waiting..."}
          </p>

          <div className="mt-5">

            <p className="text-xs text-gray-500">
              LAST DIGIT
            </p>

            <p className="text-6xl font-bold mt-2">
              {lastDigit ?? "—"}
            </p>

          </div>

          <p className="text-xs text-gray-500 mt-4">
            {status}
          </p>

        </section>

        {/* DIGIT SELECTOR */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Digit Analysis
          </h2>

          <div className="grid grid-cols-5 gap-2">

            {digits.map((digit) => (
              <button
                key={digit}
                onClick={() => setSelectedDigit(digit)}
                className={`rounded-xl border p-3 font-bold ${
                  selectedDigit === digit
                    ? "border-white bg-white text-black"
                    : "border-gray-700 bg-gray-900"
                }`}
              >
                {digit}
              </button>
            ))}

          </div>

        </section>

        {/* SAMPLE */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <div className="flex justify-between items-center">

            <div>
              <p className="text-xs text-gray-500">
                SAMPLE
              </p>

              <p className="text-2xl font-bold">
                {history.length}/100
              </p>
            </div>

            <button
              onClick={resetAnalysis}
              className="rounded-lg border border-gray-700 px-3 py-2 text-xs bg-gray-900"
            >
              Reset
            </button>

          </div>

          <div className="mt-4 h-2 rounded-full bg-gray-800 overflow-hidden">

            <div
              className="h-full bg-white"
              style={{
                width: `${history.length}%`,
              }}
            />

          </div>

        </section>

        {/* 0-9 FREQUENCY */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <div className="flex justify-between items-center mb-4">

            <div>
              <h2 className="font-semibold">
                Digit Frequency
              </h2>

              <p className="text-xs text-gray-500 mt-1">
                Latest {history.length} digits
              </p>
            </div>

          </div>

          <div className="space-y-2">

            {digits.map((digit) => {

              const count = counts[digit];

              const percentage =
                history.length > 0
                  ? ((count / history.length) * 100).toFixed(1)
                  : "0.0";

              return (
                <div
                  key={digit}
                  className="flex items-center gap-3"
                >

                  <div className="w-6 font-bold">
                    {digit}
                  </div>

                  <div className="flex-1 h-3 rounded-full bg-gray-800 overflow-hidden">

                    <div
                      className="h-full bg-white"
                      style={{
                        width: `${Math.min(
                          Number(percentage) * 5,
                          100
                        )}%`,
                      }}
                    />

                  </div>

                  <div className="w-16 text-right text-xs text-gray-400">
                    {count} ({percentage}%)
                  </div>

                </div>
              );
            })}

          </div>

        </section>

      {/* MATCH ANALYSIS */}
       <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Match Analysis
          </h2>

          <div className="flex justify-between mb-5">

            <div>
              <p className="text-xs text-gray-500">
                Selected target digit
              </p>

              <p className="text-4xl font-bold">
                {selectedDigit}
              </p>
            </div>

            <div className="text-right">

              <p className="text-xs text-gray-500">
                ANALYSIS
              </p>

              <p
                className={
                  analysis === "Above recent average"
                    ? "text-green-400"
                    : analysis === "Below recent average"
                    ? "text-red-400"
                    : "text-yellow-400"
                }
              >
                {analysis}
              </p>

            </div>

          </div>

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                MATCH
              </p>

              <p className="text-2xl font-bold">
                {match}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {matchPercentage}%
              </p>

            </div>

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                NON-MATCH
              </p>

              <p className="text-2xl font-bold">
                {nonMatch}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {nonMatchPercentage}%
              </p>

            </div>

          </div>

        </section>
        
        {/* NEXT-TICK VALIDATION */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Next-Tick Validation
          </h2>

          <div className="rounded-xl bg-gray-900 p-4 mb-3">

            <p className="text-xs text-gray-500">
              CANDIDATE
            </p>

            <p className="text-4xl font-bold mt-1">
              {validationCandidate ?? topCandidate ?? "—"}
            </p>

            <p className="text-xs text-gray-400 mt-2">
              {validationStatus === "WAITING"
                ? "Waiting for the next tick..."
                : validationStatus === "HIT"
                ? "HIT — candidate matched the next digit"
                : validationStatus === "MISS"
                ? "MISS — candidate did not match"
                : "Ready to test the top-frequency digit"}
            </p>

          </div>

          <button
            onClick={startNextTickValidation}
            disabled={
              history.length < MAX_HISTORY ||
              validationStatus === "WAITING" ||
              topCandidate === null
            }
            className="w-full rounded-xl bg-white text-black p-3 font-bold disabled:opacity-40"
          >
            {validationStatus === "WAITING"
              ? "Waiting for Next Tick..."
              : "Test Next Tick"}
          </button>

          <div className="grid grid-cols-3 gap-2 mt-3">

            <div className="rounded-xl bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">TESTED</p>
              <p className="text-xl font-bold">
                {validationResults.tested}
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">HITS</p>
              <p className="text-xl font-bold text-green-400">
                {validationResults.hits}
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">MISSES</p>
              <p className="text-xl font-bold text-red-400">
                {validationResults.misses}
              </p>
            </div>

          </div>

        </section>

        {/* SUMMARY */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Statistics
          </h2>

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                MOST FREQUENT
              </p>

              <p className="text-3xl font-bold">
                {mostFrequentDigit ?? "—"}
              </p>

            </div>

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                LEAST FREQUENT
              </p>

              <p className="text-3xl font-bold">
                {leastFrequentDigit ?? "—"}
              </p>

            </div>

          </div>

        </section>

        {/* RECENT DIGITS */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4">

          <h2 className="font-semibold mb-3">
            Recent Digits
          </h2>

          <div className="flex flex-wrap gap-2">

            {history
              .slice(-30)
              .reverse()
              .map((digit, index) => (

                <span
                  key={`${digit}-${index}`}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${
                    digit === selectedDigit
                      ? "bg-white text-black"
                      : "bg-gray-900"
                  }`}
                >
                  {digit}
                </span>

              ))}

          </div>

        </section>

        {/* FOOTER */}
        <footer className="text-center text-xs text-gray-500 mt-6">
          Trader JK • Analysis only • Not financial advice
        </footer>

      </div>
    </main>
  );
 }
