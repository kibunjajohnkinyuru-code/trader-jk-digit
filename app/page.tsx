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
          { cache: "no-store" }
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
          return [...previous, digit].slice(-MAX_HISTORY);
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
    const result = Array(10).fill(0) as number[];

    for (const digit of history) {
      if (digit >= 0 && digit <= 9) {
        result[digit]++;
      }
    }

    return result;
  }, [history]);

  const targetCount = counts[selectedDigit];

  const nonMatch = history.length - targetCount;

  const matchRate =
    history.length > 0
      ? (targetCount / history.length) * 100
      : 0;

  const nonMatchRate =
    history.length > 0
      ? (nonMatch / history.length) * 100
      : 0;

  const ranking = useMemo(() => {
    return digits
      .map((digit) => ({
        digit,
        count: counts[digit],
        rate:
          history.length > 0
            ? (counts[digit] / history.length) * 100
            : 0,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) {
          return b.count - a.count;
        }

        return a.digit - b.digit;
      });
  }, [counts, history.length]);

  const mostFrequent = ranking[0];

  const leastFrequent = useMemo(() => {
    return [...ranking].sort((a, b) => {
      if (a.count !== b.count) {
        return a.count - b.count;
      }

      return a.digit - b.digit;
    })[0];
  }, [ranking]);

  const recent20 = history.slice(-20);

  const recentTargetCount = recent20.filter(
    (digit) => digit === selectedDigit
  ).length;

  const recentTargetRate =
    recent20.length > 0
      ? (recentTargetCount / recent20.length) * 100
      : 0;

  const currentStreak = useMemo(() => {
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

  const differenceFromBaseline = matchRate - BASELINE;

  const signal = useMemo(() => {
    if (history.length < 100) {
      return {
        title: "COLLECTING DATA",
        detail: `${history.length}/100 digits collected`,
        className: "text-yellow-400",
      };
    }

    if (matchRate >= 15) {
      return {
        title: "WATCH",
        detail: "Target frequency is above baseline",
        className: "text-green-400",
      };
    }

    if (matchRate <= 5) {
      return {
        title: "LOW FREQUENCY",
        detail: "Target frequency is below baseline",
        className: "text-orange-400",
      };
    }

    return {
      title: "NO CLEAR EDGE",
      detail: "Target is near the 10% baseline",
      className: "text-yellow-400",
    };
  }, [history.length, matchRate]);

  const resetAnalysis = () => {
    setHistory([]);
    setPrice(null);
    setLastDigit(null);
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

        {/* TARGET */}
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

            {ranking.map((item, index) => (

              <div
                key={item.digit}
                className={`grid grid-cols-[24px_28px_1fr_72px] items-center gap-2 rounded-lg p-2 ${
                  item.digit === selectedDigit
                    ? "bg-gray-800"
                    : ""
                }`}
              >

                <span className="text-xs text-gray-500">
                  {index + 1}
                </span>

                <span className="font-bold">
                  {item.digit}
                </span>

                <div className="h-3 rounded-full bg-gray-800 overflow-hidden">

                  <div
                    className="h-full bg-white"
                    style={{
                      width: `${Math.min(
                        item.rate * 5,
                        100
                      )}%`,
                    }}
                  />

                </div>

                <span className="text-right text-xs whitespace-nowrap">
                  {item.count} ({item.rate.toFixed(1)}%)
                </span>

              </div>

            ))}

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
                {targetCount}
              </p>

            </div>

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                MATCH RATE
              </p>

              <p className="text-2xl font-bold">
                {matchRate.toFixed(1)}%
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
              {differenceFromBaseline >= 0 ? "+" : ""}
              {differenceFromBaseline.toFixed(1)}%
            </p>

          </div>

        </section>

        {/* PATTERN */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Recent Pattern
          </h2>

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                TARGET STREAK
              </p>

              <p className="text-3xl font-bold">
                {currentStreak}
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
            Statistical analysis only. This does not predict
            or guarantee the next digit.
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
                {targetCount}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {matchRate.toFixed(1)}%
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
                {nonMatchRate.toFixed(1)}%
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
                {mostFrequent?.digit ?? "—"}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {mostFrequent?.count ?? 0} occurrences
              </p>

            </div>

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                LEAST FREQUENT
              </p>

              <p className="text-3xl font-bold">
                {leastFrequent?.digit ?? "—"}
              </p>

              <p className="text-xs text-gray-400 mt-1">
                {leastFrequent?.count ?? 0} occurrences
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
