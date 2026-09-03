"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const MAX_HISTORY = 100;

type ValidationStatus = "IDLE" | "WAITING" | "HIT" | "MISS";

type ValidationItem = {
  candidate: number;
  actual: number;
  result: "HIT" | "MISS";
};

export default function Home() {
  const [selectedDigit, setSelectedDigit] = useState(5);

  const [market] = useState("1HZ100V");
  const [price, setPrice] = useState<string | null>(null);
  const [lastDigit, setLastDigit] = useState<number | null>(null);

  const [connection, setConnection] = useState("Starting");
  const [status, setStatus] = useState("Waiting for ticks");

  const [history, setHistory] = useState<number[]>([]);
  const [tickCount, setTickCount] = useState(0);

  /*
   * NEXT-TICK VALIDATION
   */
  const [validationCandidate, setValidationCandidate] =
    useState<number | null>(null);

  const [validationTestedCandidate, setValidationTestedCandidate] =
    useState<number | null>(null);

  const [validationStatus, setValidationStatus] =
    useState<ValidationStatus>("IDLE");

  const [validationResults, setValidationResults] = useState({
    tested: 0,
    hits: 0,
    misses: 0,
  });

  const [validationHistory, setValidationHistory] = useState<
    ValidationItem[]
  >([]);

  /*
   * REF USED TO VALIDATE THE VERY NEXT TICK.
   *
   * This avoids the race condition that can happen when
   * validation depends on several asynchronously updated states.
   */
  const validationRef = useRef<{
    candidate: number | null;
    waiting: boolean;
  }>({
    candidate: null,
    waiting: false,
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
         * Validate the received digit before using it.
         */
        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
          setConnection("Error");
          setStatus("Invalid digit");

          timer = setTimeout(getTick, 3000);
          return;
        }

        /*
         * IMPORTANT:
         *
         * If a validation test is waiting, this newly received
         * digit is the ONE and ONLY tick used for that test.
         */
        if (
          validationRef.current.waiting &&
          validationRef.current.candidate !== null
        ) {
          const candidate = validationRef.current.candidate;
          const actual = digit;
          const hit = candidate === actual;

          setValidationTestedCandidate(candidate);

          setValidationHistory((previous) => [
            ...previous,
            {
              candidate,
              actual,
              result: hit ? "HIT" : "MISS",
            },
          ]);

          setValidationResults((previous) => ({
            tested: previous.tested + 1,
            hits: previous.hits + (hit ? 1 : 0),
            misses: previous.misses + (hit ? 0 : 1),
          }));

          setValidationStatus(hit ? "HIT" : "MISS");

          /*
           * Clear the waiting state immediately so the same
           * tick can never be validated twice.
           */
          validationRef.current = {
            candidate: null,
            waiting: false,
          };
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
   * RECENCY SCORE
   *
   * More recent digits receive more weight.
   */
  const recencyScores = useMemo(() => {
    const scores: Record<number, number> = {};

    digits.forEach((digit) => {
      scores[digit] = 0;
    });

    history.forEach((digit, index) => {
      const weight = index + 1;
      scores[digit] += weight;
    });

    return scores;
  }, [history]);

  /*
   * TRANSITION MATRIX
   *
   * Counts which digit historically followed another digit.
   */
  const transitionData = useMemo(() => {
    const transitions: Record<number, Record<number, number>> = {};

    digits.forEach((from) => {
      transitions[from] = {};

      digits.forEach((to) => {
        transitions[from][to] = 0;
      });
    });

    for (let i = 0; i < history.length - 1; i++) {
      const from = history[i];
      const to = history[i + 1];

      if (
        from >= 0 &&
        from <= 9 &&
        to >= 0 &&
        to <= 9
      ) {
        transitions[from][to]++;
      }
    }

    return transitions;
  }, [history]);

  /*
   * COMBINED NEXT-TICK ANALYSIS
   *
   * The candidate is based on:
   *
   * 1. Overall frequency
   * 2. Recent occurrence weighting
   * 3. Transition frequency from the current last digit
   * 4. Short-term frequency
   *
   * This is an analysis score, NOT a guarantee of the next digit.
   */
  const candidateAnalysis = useMemo(() => {
    if (history.length < MAX_HISTORY) {
      return null;
    }

    const last = history[history.length - 1];

    if (last === undefined) {
      return null;
    }

    const shortHistory = history.slice(-20);

    const shortCounts: Record<number, number> = {};

    digits.forEach((digit) => {
      shortCounts[digit] = 0;
    });

    shortHistory.forEach((digit) => {
      shortCounts[digit]++;
    });

    const transitionCounts = transitionData[last];

    const maxFrequency = Math.max(...digits.map((d) => counts[d]), 1);

    const maxRecency = Math.max(
      ...digits.map((d) => recencyScores[d]),
      1
    );

    const maxTransition = Math.max(
      ...digits.map((d) => transitionCounts[d]),
      1
    );

    const maxShort = Math.max(
      ...digits.map((d) => shortCounts[d]),
      1
    );

    const scores: Record<number, number> = {};

    digits.forEach((digit) => {
      const frequencyScore =
        (counts[digit] / maxFrequency) * 35;

      const recencyScore =
        (recencyScores[digit] / maxRecency) * 25;

      const transitionScore =
        (transitionCounts[digit] / maxTransition) * 30;

      const shortTermScore =
        (shortCounts[digit] / maxShort) * 10;

      scores[digit] =
        frequencyScore +
        recencyScore +
        transitionScore +
        shortTermScore;
    });

    const ranked = [...digits].sort(
      (a, b) => scores[b] - scores[a]
    );

    const candidate = ranked[0];

    const secondCandidate = ranked[1];

    const candidateScore = scores[candidate];
    const secondScore = scores[secondCandidate];

    /*
     * Confidence represents separation between the top
     * two analysis scores. It is not a probability.
     */
    const confidence =
      candidateScore > 0
        ? Math.max(
            0,
            Math.min(
              100,
              ((candidateScore - secondScore) /
                candidateScore) *
                100
            )
          )
        : 0;

    return {
      candidate,
      confidence,
      scores,
      frequencyScore:
        (counts[candidate] / maxFrequency) * 35,
      recencyScore:
        (recencyScores[candidate] / maxRecency) * 25,
      transitionScore:
        (transitionCounts[candidate] / maxTransition) * 30,
      shortTermScore:
        (shortCounts[candidate] / maxShort) * 10,
      transitionCount: transitionCounts[candidate],
      shortTermCount: shortCounts[candidate],
    };
  }, [
    history,
    counts,
    recencyScores,
    transitionData,
  ]);

  const topCandidate =
    candidateAnalysis?.candidate ?? null;

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

  /*
   * BASIC SELECTED-DIGIT ANALYSIS
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
   * START NEXT-TICK VALIDATION
   *
   * Captures the current candidate and waits for exactly
   * one future tick.
   */
  const startNextTickValidation = () => {
    if (
      history.length < MAX_HISTORY ||
      topCandidate === null ||
      validationRef.current.waiting
    ) {
      return;
    }

    validationRef.current = {
      candidate: topCandidate,
      waiting: true,
    };

    setValidationCandidate(topCandidate);
    setValidationTestedCandidate(topCandidate);
    setValidationStatus("WAITING");
  };

  /*
   * RESET
   */
  const resetAnalysis = () => {
    validationRef.current = {
      candidate: null,
      waiting: false,
    };

    setHistory([]);
    setPrice(null);
    setLastDigit(null);
    setTickCount(0);

    setValidationCandidate(null);
    setValidationTestedCandidate(null);
    setValidationStatus("IDLE");

    setValidationResults({
      tested: 0,
      hits: 0,
      misses: 0,
    });

    setValidationHistory([]);
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

        {/* DIGIT FREQUENCY */}
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

        {/* NEXT-TICK ANALYSIS */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

          <h2 className="font-semibold mb-4">
            Next-Tick Analysis
          </h2>

          <div className="rounded-xl bg-gray-900 p-4 mb-3">

            <p className="text-xs text-gray-500">
              CANDIDATE
            </p>

            <p className="text-5xl font-bold mt-1">
              {validationCandidate ??
                validationTestedCandidate ??
                topCandidate ??
                "—"}
            </p>

            <div className="mt-3">

              <p className="text-xs text-gray-500">
                CONFIDENCE
              </p>

              <p className="text-xl font-bold">
                {candidateAnalysis
                  ? `${candidateAnalysis.confidence.toFixed(1)}%`
                  : "—"}
              </p>

            </div>

            <p className="text-xs text-gray-400 mt-3">
              {history.length < MAX_HISTORY
                ? "Collecting 100 ticks before analysis..."
                : validationStatus === "WAITING"
                ? "Waiting for the next tick..."
                : validationStatus === "HIT"
                ? "HIT — candidate matched the next digit"
                : validationStatus === "MISS"
                ? "MISS — candidate did not match"
                : "Ready to test the analysis candidate"}
            </p>

          </div>

          {/* ANALYSIS */}
