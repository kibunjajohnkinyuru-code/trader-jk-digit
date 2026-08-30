"use client";

import { useEffect, useState } from "react";

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function Home() {
  const [selectedDigit, setSelectedDigit] = useState(5);

  const [market, setMarket] = useState("1HZ100V");
  const [price, setPrice] = useState<string | null>(null);
  const [lastDigit, setLastDigit] = useState<number | null>(null);

  const [connection, setConnection] = useState("Starting");
  const [status, setStatus] = useState("Waiting for ticks");

  const [match, setMatch] = useState(0);
  const [nonMatch, setNonMatch] = useState(0);

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

        setPrice(String(data.quote));
        setLastDigit(digit);
        setConnection("Connected");
        setStatus("Live");

        if (digit === selectedDigit) {
          setMatch((value) => value + 1);
        } else {
          setNonMatch((value) => value + 1);
        }
      } catch {
        if (!active) return;

        setConnection("Error");
        setStatus("Connection failed");
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
  }, [market, selectedDigit]);

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

        {/* DIGIT ANALYSIS */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Digit Analysis
          </h2>

          <div className="grid grid-cols-5 gap-2">

            {digits.map((digit) => (

              <button
                key={digit}
                onClick={() => {
                  setSelectedDigit(digit);
                  setMatch(0);
                  setNonMatch(0);
                }}
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

        {/* MATCH ANALYSIS */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4">

          <h2 className="font-semibold mb-4">
            Match Analysis
          </h2>

          <div className="flex justify-between mb-4">

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
                STATUS
              </p>

              <p
                className={
                  status === "Live"
                    ? "text-green-400"
                    : "text-yellow-400"
                }
              >
                {status}
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

            </div>

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                NON-MATCH
              </p>

              <p className="text-2xl font-bold">
                {nonMatch}
              </p>

            </div>

          </div>

        </section>

        <footer className="text-center text-xs text-gray-500 mt-6">
          Trader JK • Analysis only • Not financial advice
        </footer>

      </div>
    </main>
  );
 }
