/*
 * LIVE DERIV TICK FEED
 *
 * Collects live digits from the Deriv endpoint.
 */
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

      setHistory((previous) => [
        ...previous,
        digit,
      ].slice(-MAX_HISTORY));

      if (active) {
        timer = setTimeout(getTick, 1000);
      }

    } catch {
      if (!active) return;

      setConnection("Error");
      setStatus("Connection failed");

      timer = setTimeout(getTick, 3000);
    }
  };

  getTick();

  return () => {
    active = false;
    clearTimeout(timer);
  };
}, [market]);


/*
 * NEXT-TICK VALIDATION
 *
 * Tests the previously selected candidate
 * against the next received digit.
 *
 * This is historical validation only.
 * It is NOT a prediction or probability.
 */
useEffect(() => {
  if (
    validationStatus !== "WAITING" ||
    validationCandidate === null ||
    validationStartLength === null
  ) {
    return;
  }

  if (history.length <= validationStartLength) {
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
  setValidationStartLength(null);

}, [
  history,
  validationStatus,
  validationCandidate,
  validationStartLength,
]);


/*
 * DIGIT FREQUENCY COUNTS
 */
const counts = useMemo(() => {
  const result = Array(10).fill(0) as number[];

  for (const digit of history) {
    if (digit >= 0 && digit <= 9) {
      result[digit]++;
    }
  }

  return result;
}, [history]);
