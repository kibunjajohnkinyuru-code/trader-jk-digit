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

const [validation, setValidation] = useState({
  tested: 0,
  hits: 0,
});
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
      confidence: 0,
      className: "text-yellow-400",
    };
  }

  const recent10 = history.slice(-10);
  const recent20 = history.slice(-20);

  const recent10Count = recent10.filter(
    (digit) => digit === selectedDigit
  ).length;

  const recent20Count = recent20.filter(
    (digit) => digit === selectedDigit
  ).length;

  const recent10Rate =
    (recent10Count / recent10.length) * 100;

  const recent20Rate =
    (recent20Count / recent20.length) * 100;

  const overallRate = matchRate;

  const overallDeviation =
  Math.abs(overallRate - BASELINE);

const recent20Deviation =
  Math.abs(recent20Rate - BASELINE);

const recent10Deviation =
  Math.abs(recent10Rate - BASELINE);
  /*
   * Conservative statistical strength.
   * This is a ranking/analysis score only.
   * It is NOT the probability of the next digit.
   */
  /*
 * Statistical confidence measures how consistent
 * the observed sample is across different windows.
 *
 * This is NOT the probability of the next digit.
 */
/*
 * Conservative statistical confidence.
 *
 * This measures consistency in the observed
 * 100 / 20 / 10 tick samples.
 *
 * It is NOT the probability of the next digit.
 */

const overallEvidence =
  Math.min(overallRate / 15, 1) * 35;

const recent20Evidence =
  Math.min(recent20Rate / 20, 1) * 25;

const recent10Evidence =
  Math.min(recent10Rate / 30, 1) * 15;

const consistency =
  Math.max(
    0,
    10 -
      Math.abs(overallRate - recent20Rate) * 0.4 -
      Math.abs(recent20Rate - recent10Rate) * 0.4
  );

let confidence =
  overallEvidence +
  recent20Evidence +
  recent10Evidence +
  consistency;

/*
 * Penalize a target that is below
 * the 10% baseline.
 */
if (overallRate < BASELINE) {
  confidence *= 0.70;
}

/*
 * Never present statistical strength
 * as an extremely high percentage.
 */
confidence = Math.min(
  Math.max(confidence, 0),
  85
);

confidence = Number(confidence.toFixed(0));
  // Strong evidence
  if (
    overallRate >= 15 &&
    recent20Rate >= 15 &&
    recent10Rate >= 20
  ) {
    return {
      title: "STRONG MATCH",
      detail:
        `Digit ${selectedDigit} has strong overall and recent frequency`,
      confidence,
      className: "text-green-400",
    };
  }

  // Moderate evidence
  if (
    overallRate >= 12 &&
    recent20Rate >= 10 &&
    recent10Rate >= 10
  ) {
    return {
      title: "MATCH",
      detail:
        `Digit ${selectedDigit} is showing elevated frequency`,
      confidence,
      className: "text-green-300",
    };
  }

  // Mixed evidence
  if (
    overallRate >= 10 &&
    confidence >= 10 &&
    (recent20Rate >= 10 || recent10Rate >= 10)
  ) {
    return {
      title: "WATCH",
      detail:
        `Digit ${selectedDigit} is ranked well but evidence is mixed`,
      confidence,
      className: "text-yellow-300",
    };
  }

  // Weak or insufficient evidence
  return {
    title: "NO CLEAR EDGE",
    detail:
      `Digit ${selectedDigit} does not meet the minimum match thresholds`,
    confidence,
    className: "text-yellow-400",
  };
}, [
  history,
  selectedDigit,
  matchRate,
]);
  const matchCandidates = useMemo(() => {
  if (history.length < 100) {
    return [];
  }

  const recent10 = history.slice(-10);
  const recent20 = history.slice(-20);

  return digits
    .map((digit) => {
      const overallCount = counts[digit];

      const overallRate =
        (overallCount / history.length) * 100;

      const recent10Count = recent10.filter(
        (value) => value === digit
      ).length;

      const recent20Count = recent20.filter(
        (value) => value === digit
      ).length;

      const recent10Rate =
        (recent10Count / recent10.length) * 100;

      const recent20Rate =
        (recent20Count / recent20.length) * 100;

      // Distance from the 10% baseline.
      const overallDeviation =
        Math.abs(overallRate - BASELINE);

      const recent20Deviation =
        Math.abs(recent20Rate - BASELINE);

      const recent10Deviation =
        Math.abs(recent10Rate - BASELINE);

      /*
       * Conservative ranking:
       *
       * 50% overall frequency
       * 25% last 20
       * 10% last 10
       * 15% baseline deviation
       *
       * This is a ranking strength only.
       * It is NOT the probability of the next digit.
       */
      /*
 * Conservative Match Strength.
 *
 * 60% = overall 100-tick frequency
 * 25% = last 20 ticks
 * 15% = last 10 ticks
 *
 * Baseline deviation is used as a small
 * supporting factor, not as a prediction.
 *
 * This is a ranking strength only.
 * It is NOT the probability of the next digit.
 */
/*
 * Conservative Match Strength.
 *
 * Overall frequency has the largest weight.
 * Recent windows confirm consistency but cannot
 * dominate the 100-tick sample.
 *
 * This is a statistical ranking score only.
 * It is NOT the probability of the next digit.
 */

/*
 * Conservative Match Strength.
 *
 * 60% = overall 100-tick frequency
 * 25% = last 20 ticks
 * 15% = last 10 ticks
 *
 * This is a statistical ranking score only.
 * It is NOT the probability of the next digit.
 */

let strength =
  overallRate * 0.60 +
  recent20Rate * 0.25 +
  recent10Rate * 0.15;

/*
 * Small consistency bonus.
 * Only applied when all three windows
 * are at or above the 10% baseline.
 */
if (
  overallRate >= BASELINE &&
  recent20Rate >= BASELINE &&
  recent10Rate >= BASELINE
) {
  strength += 2;
}

/*
 * Penalize digits below the 10% baseline
 * in the full 100-tick sample.
 */
if (overallRate < BASELINE) {
  strength *= 0.75;
}

/*
 * Prevent a short-term spike from
 * dominating the ranking.
 */
if (
  recent10Rate >= 30 &&
  overallRate < 12
) {
  strength *= 0.80;
}

/*
 * Strong penalty for very weak
 * overall support.
 */
if (overallRate < 5) {
  strength *= 0.50;
}

/*
 * Keep score between 0 and 100.
 */
strength = Math.min(
  Math.max(strength, 0),
  100
);
      return {
        digit,
        overallCount,
        overallRate,
        recent10Rate,
        recent20Rate,
        strength,
        overallDeviation,
        recent20Deviation,
        recent10Deviation,
      };
    })
    .sort((a, b) => {
      if (b.strength !== a.strength) {
        return b.strength - a.strength;
      }

      if (b.overallRate !== a.overallRate) {
        return b.overallRate - a.overallRate;
      }

      return b.recent20Rate - a.recent20Rate;
    });
}, [history, counts]);
  const topCandidate = matchCandidates[0];

const topSignal = useMemo(() => {
  if (history.length < 100 || !topCandidate) {
    return {
      title: "COLLECTING DATA",
      detail: "Collecting 100 digits before ranking",
      className: "text-yellow-400",
    };
  }

  const {
    overallRate,
    recent20Rate,
    recent10Rate,
    strength,
  } = topCandidate;

  /*
   * STRONG MATCH
   *
   * Requires strong support across:
   * - 100-tick sample
   * - last 20 ticks
   * - last 10 ticks
   * - ranking strength
   */
  if (
    strength >= 22 &&
    overallRate >= 15 &&
    recent20Rate >= 15 &&
    recent10Rate >= 20
  ) {
    return {
      title: "STRONG MATCH",
      detail:
        `Digit ${topCandidate.digit} has strong overall and recent frequency`,
      className: "text-green-400",
    };
  }

  /*
   * MATCH
   *
   * Good overall support with
   * reasonable recent confirmation.
   */
  if (
    strength >= 16 &&
    overallRate >= 12 &&
    recent20Rate >= 10 &&
    recent10Rate >= 10
  ) {
    return {
      title: "MATCH",
      detail:
        `Digit ${topCandidate.digit} is showing elevated frequency`,
      className: "text-green-300",
    };
  }

  /*
   * WATCH
   *
   * Candidate is interesting, but
   * evidence is not strong enough.
   */
  if (
    strength >= 10 &&
    overallRate >= 10 &&
    (recent20Rate >= 10 || recent10Rate >= 10)
  ) {
    return {
      title: "WATCH",
      detail:
        `Digit ${topCandidate.digit} is ranked highly but evidence is mixed`,
      className: "text-yellow-300",
    };
  }

  /*
   * NO CLEAR EDGE
   */
  return {
    title: "NO CLEAR EDGE",
    detail:
      `Digit ${topCandidate.digit} does not meet the minimum match thresholds`,
    className: "text-yellow-400",
  };
}, [history.length, topCandidate]);
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
        {/* TOP MATCH SIGNAL */}
<section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

  <h2 className="font-semibold mb-4">
    Top Match Signal
  </h2>

  {history.length < 100 || !topCandidate ? (
    <div>
      <p className="text-2xl font-bold text-yellow-400">
        COLLECTING DATA
      </p>

      <p className="text-sm text-gray-400 mt-2">
        Collecting 100 digits before ranking
      </p>
    </div>
  ) : (
    <div>

      <div className="flex justify-between items-center">

        <div>
          <p className="text-xs text-gray-500">
            TOP CANDIDATE
          </p>

          <p className="text-5xl font-bold mt-1">
            {topCandidate.digit}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-gray-500">
            MATCH STRENGTH
          </p>

          <p className={`text-4xl font-bold ${topSignal.className}`}>
            {topCandidate.strength.toFixed(0)}%
          </p>
        </div>

      </div>

      <p className={`text-xl font-bold mt-4 ${topSignal.className}`}>
        {topSignal.title}
      </p>

      <p className="text-sm text-gray-400 mt-2">
        {topSignal.detail}
      </p>

      <div className="grid grid-cols-3 gap-2 mt-4 text-center">

        <div className="rounded-lg bg-gray-900 p-3">
          <p className="text-xs text-gray-500">
            100 TICKS
          </p>

          <p className="font-bold mt-1">
            {topCandidate.overallRate.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-lg bg-gray-900 p-3">
          <p className="text-xs text-gray-500">
            LAST 20
          </p>

          <p className="font-bold mt-1">
            {topCandidate.recent20Rate.toFixed(1)}%
          </p>
        </div>

        <div className="rounded-lg bg-gray-900 p-3">
          <p className="text-xs text-gray-500">
            LAST 10
          </p>

          <p className="font-bold mt-1">
            {topCandidate.recent10Rate.toFixed(1)}%
          </p>
        </div>

      </div>

    </div>
  )}

  <p className="text-xs text-gray-600 mt-4">
    This is a statistical ranking of observed digits,
    not a prediction or probability of the next digit.
  </p>

</section>
  {/* MATCH SCANNER */}
<section className="rounded-2xl border border-gray-800 bg-gray-950 p-4 mb-4">

  <h2 className="font-semibold mb-4">
    Match Scanner
  </h2>

  {history.length < 100 ? (
    <p className="text-sm text-yellow-400">
      Collecting 100 digits before scanning...
    </p>
  ) : (
    <div className="space-y-3">

      {matchCandidates.slice(0, 3).map((candidate, index) => (

        <div
          key={candidate.digit}
          className="rounded-xl bg-gray-900 p-4"
        >

          <div className="flex justify-between items-center">

            <div>
              <p className="text-xs text-gray-500">
                #{index + 1} CANDIDATE
              </p>

              <p className="text-3xl font-bold">
                Digit {candidate.digit}
              </p>
            </div>

            <div className="text-right">

              <p className="text-xs text-gray-500">
                MATCH STRENGTH
              </p>

              <p className="text-3xl font-bold">
                {candidate.strength.toFixed(0)}%
              </p>

            </div>

          </div>

          <div className="grid grid-cols-3 gap-2 mt-4 text-center">

            <div>
              <p className="text-xs text-gray-500">
                100 TICKS
              </p>

              <p className="font-bold">
                {candidate.overallRate.toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">
                LAST 20
              </p>

              <p className="font-bold">
                {candidate.recent20Rate.toFixed(1)}%
              </p>
            </div>

            <div>
              <p className="text-xs text-gray-500">
                LAST 10
              </p>

              <p className="font-bold">
                {candidate.recent10Rate.toFixed(1)}%
              </p>
            </div>

          </div>

        </div>

      ))}

    </div>
  )}

  <p className="text-xs text-gray-600 mt-4">
    Match Strength is a statistical ranking score,
    not the probability of the next digit.
  </p>

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

  <div className="mt-4 rounded-xl bg-gray-900 p-4">

    <p className="text-xs text-gray-500">
      STATISTICAL CONFIDENCE
    </p>

    <p className="text-3xl font-bold mt-1">
      {signal.confidence.toFixed(0)}%
    </p>

  </div>

  <p className="text-xs text-gray-600 mt-4">
    Confidence measures statistical strength in the
    observed sample. It is not a probability that the
    next digit will be the target.
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
