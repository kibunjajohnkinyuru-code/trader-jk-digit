"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const digits = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
const MAX_HISTORY = 100;
const SHORT_WINDOW = 20;
const MEDIUM_WINDOW = 50;
const RANDOM_BASELINE = 10;

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
   * The ref stores the candidate being tested.
   * This guarantees that exactly the next valid tick
   * is used for validation.
   */
  const validationRef = useRef<{
    candidate: number | null;
    waiting: boolean;
  }>({
    candidate: null,
    waiting: false,
  });

  /*
   * -------------------------------------------------------
   * LIVE DERIV FEED
   * -------------------------------------------------------
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

        if (!Number.isInteger(digit) || digit < 0 || digit > 9) {
          setConnection("Error");
          setStatus("Invalid digit");

          timer = setTimeout(getTick, 3000);
          return;
        }

        /*
         * NEXT-TICK VALIDATION
         *
         * The current digit is compared against the candidate
         * captured immediately before this tick arrived.
         */
        if (
          validationRef.current.waiting &&
          validationRef.current.candidate !== null
        ) {
          const candidate = validationRef.current.candidate;
          const hit = candidate === digit;

          setValidationTestedCandidate(candidate);

          setValidationHistory((previous) => [
            ...previous,
            {
              candidate,
              actual: digit,
              result: hit ? "HIT" : "MISS",
            },
          ]);

          setValidationResults((previous) => ({
            tested: previous.tested + 1,
            hits: previous.hits + (hit ? 1 : 0),
            misses: previous.misses + (hit ? 0 : 1),
          }));

          setValidationStatus(hit ? "HIT" : "MISS");

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
   * -------------------------------------------------------
   * FREQUENCY
   * -------------------------------------------------------
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
   * -------------------------------------------------------
   * WINDOW COUNTS
   * -------------------------------------------------------
   */
  const shortCounts = useMemo(() => {
    const result: Record<number, number> = {};

    digits.forEach((digit) => {
      result[digit] = 0;
    });

    history.slice(-SHORT_WINDOW).forEach((digit) => {
      result[digit]++;
    });

    return result;
  }, [history]);

  const mediumCounts = useMemo(() => {
    const result: Record<number, number> = {};

    digits.forEach((digit) => {
      result[digit] = 0;
    });

    history.slice(-MEDIUM_WINDOW).forEach((digit) => {
      result[digit]++;
    });

    return result;
  }, [history]);

  /*
   * -------------------------------------------------------
   * RECENCY
   * -------------------------------------------------------
   */
  const recencyScores = useMemo(() => {
    const result: Record<number, number> = {};

    digits.forEach((digit) => {
      result[digit] = 0;
    });

    history.forEach((digit, index) => {
      result[digit] += index + 1;
    });

    return result;
  }, [history]);

  /*
   * -------------------------------------------------------
   * TRANSITIONS
   * -------------------------------------------------------
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
        Number.isInteger(from) &&
        Number.isInteger(to)
      ) {
        transitions[from][to]++;
      }
    }

    return transitions;
  }, [history]);

  /*
   * -------------------------------------------------------
   * CANDIDATE ENGINE
   *
   * IMPORTANT:
   * This is a statistical ranking system.
   * It does NOT guarantee the next digit.
   *
   * The engine deliberately rejects weak signals.
   * -------------------------------------------------------
   */
  const candidateAnalysis = useMemo(() => {
    if (history.length < MAX_HISTORY) {
      return null;
    }

    const current = history[history.length - 1];

    if (current === undefined) {
      return null;
    }

    const currentTransitions = transitionData[current];

    const scores: Record<number, number> = {};

    /*
     * Raw evidence.
     */
    digits.forEach((digit) => {
      const overallRate =
        counts[digit] / MAX_HISTORY;

      const mediumRate =
        mediumCounts[digit] / MEDIUM_WINDOW;

      const shortRate =
        shortCounts[digit] / SHORT_WINDOW;

      const transitionTotal = digits.reduce(
        (sum, d) => sum + currentTransitions[d],
        0
      );

      const transitionRate =
        transitionTotal > 0
          ? currentTransitions[digit] / transitionTotal
          : 0;

      /*
       * Compare the observed rate against the
       * theoretical 10% digit baseline.
       */
      const frequencyEdge =
        overallRate / 0.1;

      const mediumEdge =
        mediumRate / 0.1;

      const shortEdge =
        shortRate / 0.1;

      const transitionEdge =
        transitionRate / 0.1;

      /*
       * Weighted statistical score.
       *
       * Overall frequency: 30
       * Medium window:     25
       * Short window:      20
       * Transition:        25
       */
      scores[digit] =
        frequencyEdge * 30 +
        mediumEdge * 25 +
        shortEdge * 20 +
        transitionEdge * 25;
    });

    const ranked = [...digits].sort(
      (a, b) => scores[b] - scores[a]
    );

    const candidate = ranked[0];
    const second = ranked[1];

    const firstScore = scores[candidate];
    const secondScore = scores[second];

    /*
     * Difference between first and second.
     */
    const separation =
      firstScore > 0
        ? ((firstScore - secondScore) / firstScore) * 100
        : 0;

    /*
     * Evidence for the selected candidate.
     */
    const overallRate =
      counts[candidate] / MAX_HISTORY;

    const mediumRate =
      mediumCounts[candidate] / MEDIUM_WINDOW;

    const shortRate =
      shortCounts[candidate] / SHORT_WINDOW;

    const transitionTotal = digits.reduce(
      (sum, digit) => sum + currentTransitions[digit],
      0
    );

    const transitionRate =
      transitionTotal > 0
        ? currentTransitions[candidate] / transitionTotal
        : 0;

    /*
     * Convert evidence into an analysis score.
     *
     * This is intentionally conservative.
     */
    const frequencyStrength = Math.min(
      100,
      (overallRate / 0.1) * 50
    );

    const mediumStrength = Math.min(
      100,
      (mediumRate / 0.1) * 50
    );

    const shortStrength = Math.min(
      100,
      (shortRate / 0.1) * 50
    );

    const transitionStrength = Math.min(
      100,
      (transitionRate / 0.1) * 50
    );

    const evidenceScore =
      frequencyStrength * 0.30 +
      mediumStrength * 0.25 +
      shortStrength * 0.20 +
      transitionStrength * 0.25;

    /*
     * Candidate is considered strong enough only when:
     *
     * - Evidence score >= 70
     * - Separation >= 5%
     * - At least 2 transition observations
     */
    const transitionObservations =
      currentTransitions[candidate];

    const strongEnough =
      evidenceScore >= 70 &&
      separation >= 5 &&
      transitionObservations >= 2;

    let strength:
      | "STRONG"
      | "MODERATE"
      | "WEAK"
      | "NO CLEAR SIGNAL";

    if (!strongEnough) {
      strength = "NO CLEAR SIGNAL";
    } else if (evidenceScore >= 85 && separation >= 10) {
      strength = "STRONG";
    } else if (evidenceScore >= 70) {
      strength = "MODERATE";
    } else {
      strength = "WEAK";
    }

    return {
      candidate,
      confidence: Math.min(
        100,
        Math.max(0, separation)
      ),
      evidenceScore,
      separation,
      strength,
      frequencyRate: overallRate * 100,
      mediumRate: mediumRate * 100,
      shortRate: shortRate * 100,
      transitionRate: transitionRate * 100,
      transitionObservations,
      score: firstScore,
      secondScore,
      currentDigit: current,
      scores,
    };
  }, [
    history,
    counts,
    shortCounts,
    mediumCounts,
    transitionData,
  ]);

  /*
   * Only expose a candidate when the analysis engine
   * considers the evidence sufficient.
   */
  const topCandidate =
    candidateAnalysis?.strength !== "NO CLEAR SIGNAL"
      ? candidateAnalysis?.candidate ?? null
      : null;

  /*
   * -------------------------------------------------------
   * SELECTED DIGIT
   * -------------------------------------------------------
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

  const analysis =
    history.length < 20
      ? "Collecting data"
      : Number(matchPercentage) > 15
      ? "Above recent average"
      : Number(matchPercentage) < 5
      ? "Below recent average"
      : "Normal range";

  /*
   * -------------------------------------------------------
   * MOST FREQUENT
   * -------------------------------------------------------
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
   * -------------------------------------------------------
   * LEAST FREQUENT
   * -------------------------------------------------------
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
   * -------------------------------------------------------
   * VALIDATION
   * -------------------------------------------------------
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

  const validationAccuracy =
    validationResults.tested > 0
      ? (validationResults.hits /
          validationResults.tested) *
        100
      : 0;

  const validationEdge =
    validationAccuracy - RANDOM_BASELINE;

  /*
   * -------------------------------------------------------
   * RESET
   * -------------------------------------------------------
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
                onClick={() =>
                  setSelectedDigit(digit)
                }
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

          <h2 className="font-semibold mb-4">
            Digit Frequency
          </h2>

          <p className="text-xs text-gray-500 mb-4">
            Latest {history.length} digits
          </p>

          <div className="space-y-2">

            {digits.map((digit) => {

              const count = counts[digit];

              const percentage =
                history.length > 0
                  ? (count / history.length) * 100
                  : 0;

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
                          percentage * 5,
                          100
                        )}%`,
                      }}
                    />

                  </div>

                  <div className="w-16 text-right text-xs text-gray-400">
                    {count} ({percentage.toFixed(1)}%)
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

            <div className="mt-4">

              <p className="text-xs text-gray-500">
                SIGNAL STRENGTH
              </p>

              <p
                className={`text-xl font-bold ${
                  candidateAnalysis?.strength ===
                  "STRONG"
                    ? "text-green-400"
                    : candidateAnalysis?.strength ===
                      "MODERATE"
                    ? "text-yellow-400"
                    : "text-gray-400"
                }`}
              >
                {history.length < MAX_HISTORY
                  ? "COLLECTING"
                  : candidateAnalysis?.strength ??
                    "NO CLEAR SIGNAL"}
              </p>

            </div>

            <div className="mt-3">

              <p className="text-xs text-gray-500">
                CONFIDENCE
              </p>

              <p className="text-xl font-bold">
                {candidateAnalysis
                  ? `${candidateAnalysis.confidence.toFixed(
                      1
                    )}%`
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
                : topCandidate === null
                ? "No sufficiently strong candidate."
                : "Ready to test the analysis candidate"}
            </p>

          </div>

          {/* ANALYSIS EVIDENCE */}
          {candidateAnalysis && (
            <div className="rounded-xl bg-gray-900 p-4 mb-3">

              <p className="text-xs text-gray-500 mb-3">
                ANALYSIS EVIDENCE
              </p>

              <div className="space-y-2 text-sm">

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Overall frequency
                  </span>

                  <span>
                    {candidateAnalysis.frequencyRate.toFixed(
                      1
                    )}
                    %
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Last 50
                  </span>

                  <span>
                    {candidateAnalysis.mediumRate.toFixed(
                      1
                    )}
                    %
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Last 20
                  </span>

                  <span>
                    {candidateAnalysis.shortRate.toFixed(
                      1
                    )}
                    %
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Transition rate
                  </span>

                  <span>
                    {candidateAnalysis.transitionRate.toFixed(
                      1
                    )}
                    %
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Transition observations
                  </span>

                  <span>
                    {candidateAnalysis.transitionObservations}
                  </span>
                </div>

                <div className="border-t border-gray-800 pt-2 flex justify-between">
                  <span className="text-gray-400">
                    Previous digit
                  </span>

                  <span>
                    {candidateAnalysis.currentDigit}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Evidence score
                  </span>

                  <span>
                    {candidateAnalysis.evidenceScore.toFixed(
                      1
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Signal separation
                  </span>

                  <span>
                    {candidateAnalysis.separation.toFixed(
                      1
                    )}
                    %
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-gray-400">
                    Random baseline
                  </span>

                  <span>
                    {RANDOM_BASELINE.toFixed(1)}%
                  </span>
                </div>

              </div>

            </div>
          )}

          <button
            onClick={startNextTickValidation}
            disabled={
              history.length < MAX_HISTORY ||
              topCandidate === null ||
              validationStatus === "WAITING"
            }
            className="w-full rounded-xl bg-white text-black p-3 font-bold disabled:opacity-40"
          >
            {validationStatus === "WAITING"
              ? "Waiting for Next Tick..."
              : topCandidate === null
              ? "No Strong Candidate"
              : "Test Next Tick"}
          </button>

          {/* VALIDATION STATS */}
          <div className="grid grid-cols-4 gap-2 mt-3">

            <div className="rounded-xl bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">
                TESTED
              </p>

              <p className="text-xl font-bold">
                {validationResults.tested}
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">
                HITS
              </p>

              <p className="text-xl font-bold text-green-400">
                {validationResults.hits}
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">
                MISSES
              </p>

              <p className="text-xl font-bold text-red-400">
                {validationResults.misses}
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 p-3 text-center">
              <p className="text-xs text-gray-500">
                ACCURACY
              </p>

              <p className="text-xl font-bold">
                {validationAccuracy.toFixed(2)}%
              </p>
            </div>

          </div>

          {/* BASELINE */}
          {validationResults.tested > 0 && (
            <div className="rounded-xl bg-gray-900 p-3 mt-3 text-center">

              <p className="text-xs text-gray-500">
                PERFORMANCE VS 10% BASELINE
              </p>

              <p
                className={`text-lg font-bold mt-1 ${
                  validationEdge > 0
                    ? "text-green-400"
                    : validationEdge < 0
                    ? "text-red-400"
                    : "text-gray-300"
                }`}
              >
                {validationEdge >= 0 ? "+" : ""}
                {validationEdge.toFixed(2)}%
              </p>

            </div>
          )}

          {/* VALIDATION HISTORY */}
          <div className="mt-4">

            <p className="text-xs text-gray-500 mb-2">
              VALIDATION HISTORY
            </p>

            {validationHistory.length === 0 ? (
              <div className="rounded-xl bg-gray-900 p-3 text-sm text-gray-500">
                No validation tests yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">

                {validationHistory
                  .slice()
                  .reverse()
                  .map((item, index) => (
                    <div
                      key={`${item.candidate}-${item.actual}-${index}`}
                      className="flex items-center justify-between rounded-xl bg-gray-900 p-3"
                    >

                      <span className="text-sm">
                        Candidate{" "}
                        <strong>
                          {item.candidate}
                        </strong>
                      </span>

                      <span className="text-sm">
                        Actual{" "}
                        <strong>
                          {item.actual}
                        </strong>
                      </span>

                      <span
                        className={
                          item.result === "HIT"
                            ? "text-green-400 font-bold"
                            : "text-red-400 font-bold"
                        }
                      >
                        {item.result}
                      </span>

                    </div>
                  ))}

              </div>
            )}

          </div>

        </section>

        {/* STATISTICS */}
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

              {mostFrequentDigit !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  {counts[mostFrequentDigit]} /{" "}
                  {history.length}
                </p>
              )}

            </div>

            <div className="rounded-xl bg-gray-900 p-4">

              <p className="text-xs text-gray-500">
                LEAST FREQUENT
              </p>

              <p className="text-3xl font-bold">
                {leastFrequentDigit ?? "—"}
              </p>

              {leastFrequentDigit !== null && (
                <p className="text-xs text-gray-400 mt-1">
                  {counts[leastFrequentDigit]} /{" "}
                  {history.length}
                </p>
              )}

            </div>

          </div>

        </section>

        {/* RECENT DIGITS */}
        <section className="rounded-2xl border border-gray-800 bg-gray-950 p-4">

          <h2 className="font-semibold mb-3">
            Recent Digits
          </h2>

          <div className="flex flex-wrap gap-2">

            {history.length === 0 ? (
              <p className="text-sm text-gray-500">
                Waiting for digits...
              </p>
            ) : (
              history
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
                ))
            )}

          </div>

        </section>

        {/* FOOTER */}
        <footer className="text-center text-xs text-gray-500 mt-6 pb-4">
          Trader JK • Analysis only • Not financial advice
        </footer>

      </div>
    </main>
  );
 }
  
