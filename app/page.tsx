"use client";

import { useState } from "react";

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export default function Home() {
  const [selectedDigit, setSelectedDigit] = useState(5);

  return (
    <main className="min-h-screen bg-black text-white p-4">
      <div className="mx-auto max-w-md">

        <header className="mb-6">
          <h1 className="text-2xl font-bold">
            Trader JK
          </h1>
          <p className="text-sm text-gray-400">
            Deriv Digit Analysis Tool
          </p>
        </header>

        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">
          <div className="flex justify-between">
            <div>
              <p className="text-xs text-gray-500">MARKET</p>
              <p className="font-semibold">
                Waiting for market
              </p>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-500">
                CONNECTION
              </p>
              <p className="text-yellow-400">
                ● Starting
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-6 text-center mb-4">
          <p className="text-xs text-gray-500">
            CURRENT PRICE
          </p>

          <p className="text-3xl font-bold mt-2">
            Waiting...
          </p>

          <div className="mt-5">
            <p className="text-xs text-gray-500">
              LAST DIGIT
            </p>

            <p className="text-5xl font-bold mt-2">
              —
            </p>
          </div>
        </section>

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
              <p className="text-yellow-400">
                Waiting for ticks
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-900 p-4">
              <p className="text-xs text-gray-500">
                MATCH
              </p>
              <p className="text-2xl font-bold">
                0
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-4">
              <p className="text-xs text-gray-500">
                NON-MATCH
              </p>
              <p className="text-2xl font-bold">
                0
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
