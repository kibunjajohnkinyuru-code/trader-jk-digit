"use client";

import { useEffect, useMemo, useState } from "react";

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const MAX_HISTORY = 100;
const BASELINE = 10;

export default function Home() {
  const [selectedDigit, setSelectedDigit] = useState(5);
  const [market] = useState("1HZ100V");

  const [price, setPrice] = useState<string | null>(null);
  const [lastDigit, setLastDigit] = useState<number | null>(null);

  const [connection, setConnection] = useState("Starting");
  const [status, setStatus] = useState("Waiting for ticks");

  const [history, setHistory] = useState<number[]>([]);

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

        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
          setConnection("Error");
          setStatus("Invalid digit");

          timer = setTimeout(getTick, 3000);
          return;
        }

        setPrice(String(data.quote));
        setLastDigit(digit);
        setConnection("Connected");
        setStatus("Live");

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

  const counts = useMemo(() => {
    const result: Record<number, number> = {};

    digits.forEach((digit) => {
      result[digit] = 0;
    });

    history.forEach((digit) => {
      result[digit]++;
    });

    return result;
  }, [history]);

  const match = counts[selectedDigit];
  const nonMatch = history.length - match;

  const matchPercentage =
    history.length > 0
      ? (match / history.length) * 100
      : 0;

  const nonMatchPercentage =
    history.length > 0
      ? (nonMatch / history.length) * 100
      : 0;

  const selectedDifference =
    matchPercentage - BASELINE;

  const ranking = useMemo(() => {
    return [...digits].sort((a, b) => {
      if (counts[b] !== counts[a]) {
        return counts[b] - counts[a];
      }

      return a - b;
    });
  }, [counts]);

  const mostFrequentDigit =
    history.length > 0 ? ranking[0] : null;

  const leastFrequentDigit = useMemo(() => {
    if (history.length === 0) return null;

    return [...digits].sort((a, b) => {
      if (counts[a] !== counts[b]) {
        return counts[a] - counts[b];
      }

      return a - b;
    })[0];
  }, [counts, history.length]);

  const selectedStreak = useMemo(() => {
    let streak = 0;

    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i] === selectedDigit) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }, [history, selectedDigit]);

  const recentTargetCount = useMemo(() => {
    const recent = history.slice(-20);

    return recent.filter(
      (digit) => digit === selectedDigit
    ).length;
  }, [history, selectedDigit]);

  const recentTargetRate =
    history.length > 0
      ? (recentTargetCount /
          Math.min(history.length, 20)) *
        100
      : 0;

  const signal = useMemo(() => {
    if (history.length < 100) {
      return {
        title: "COLLECTING DATA",
        detail: `${history.length}/100 digits`,
        className: "text-yellow-400",
      };
    }

    if (matchPercentage >= 15) {
      return {
        title: "WATCH",
        detail: "Target is above the 10% baseline",
        className: "text-green-400",
      };
    }

    if (matchPercentage <= 5) {
      return {
        title: "LOW FREQUENCY",
        detail: "Target is below the 10% baseline",
        className: "text-orange-400",
      };
    }

    return {
      title: "NO CLEAR EDGE",
      detail: "Target is near the 10% baseline",
      className: "text-yellow-400",
    };
  }, [history.length, matchPercentage]);

  const resetAnalysis = () => {
    setHistory([]);
    setLastDigit(null);
    setPrice(null);
    setStatus("Waiting for ticks");
  };

  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="mx-auto max-w-md">

        <header className="mb-6">
          <h1 className="text-3xl font-bold">
            Trader JK
          </h1>

          <p className="text-sm text-gray-400">
            Deriv Digit Analysis Tool
          </p>
        </header>

        {/* MARKET */}
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

        {/* PRICE */}
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

        {/* TARGET DIGIT */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Select Target Digit
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

        {/* FREQUENCY */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            100-Digit Frequency
          </h2>

          <div className="space-y-2">

            {ranking.map((digit, index) => {

              const count = counts[digit];

              const percentage =
                history.length > 0
                  ? (count / history.length) * 100
                  : 0;

              return (
                <div
                  key={digit}
                  className={`flex items-center gap-2 rounded-lg p-2 ${
                    digit === selectedDigit
                      ? "bg-gray-800"
                      : ""
                  }`}
                >

                  <span className="w-5 text-xs text-gray-500">
                    {index + 1}
                  </span>

                  <span className="w-6 font-bold">
                    {digit}
                  </span>

                  <div className="flex-1 h-3 rounded-full bg-gray-800 overflow-hidden">

                    <div
                      className="h-full bg-white"
                      style={{
                        width: `${Math.min(
                          percentage * 5,
                          100
                        )}%`,
                      }}
                    />

                  </div>

                  <span className="w-16 text-right text-xs">
                    {count} ({percentage.toFixed(1)}%)
                  </span>

                </div>
              );
            })}

          </div>

        </section>

        {/* TARGET ANALYSIS */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Target Analysis
          </h2>

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-xl bg-gray-900 p-4">
              <p className="text-xs text-gray-500">
                TARGET
              </p>

              <p className="text-3xl font-bold">
                {selectedDigit}
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <p className="text-xs text-gray-500">
                FREQUENCY
              </p>

              <p className="text-3xl font-bold">
                {match}
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <p className="text-xs text-gray-500">
                MATCH RATE
              </p>

              <p className="text-2xl font-bold">
                {matchPercentage.toFixed(1)}%
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <p className="text-xs text-gray-500">
                BASELINE
              </p>

              <p className="text-2xl font-bold">
                {BASELINE}%
              </p>
            </div>

          </div>

          <div className="mt-3 rounded-xl bg-gray-900 p-4">

            <p className="text-xs text-gray-500">
              VS 10% BASELINE
            </p>

            <p className="text-xl font-bold">
              {selectedDifference >= 0 ? "+" : ""}
              {selectedDifference.toFixed(1)}%
            </p>

          </div>

        </section>

        {/* STREAK */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Recent Pattern
          </h2>

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                CURRENT TARGET STREAK
              </p>

              <p className="text-3xl font-bold">
                {selectedStreak}
              </p>

            </div>

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                LAST 20 RATE
              </p>

              <p className="text-3xl font-bold">
                {recentTargetRate.toFixed(1)}%
              </p>

            </div>

          </div>

        </section>

        {/* SIGNAL */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Analysis Signal
          </h2>

          <p className={`text-2xl font-bold ${signal.className}`}>
            {signal.title}
          </p>

          <p className="text-sm text-gray-400 mt-2">
            {signal.detail}
          </p>

          <p className="text-xs text-gray-600 mt-4">
            Statistical analysis only. This does not guarantee
            the next digit.
          </p>

        </section>

        {/* MATCH */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Match Analysis
          </h2>

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                MATCH
              </p>

              <p className="text-2xl font-bold">
                {match}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {matchPercentage.toFixed(1)}%
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
                {nonMatchPercentage.toFixed(1)}%
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

        <footer className="text-center text-xs text-gray-500 mt-6">
          Trader JK • Analysis only • Not financial advice
        </footer>

      </div>
    </main>
  );
      }
