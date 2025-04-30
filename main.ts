const DEBUG = Deno.env.get("DEBUG") === "true" ? true : false;

type BaselineStatus = "newly" | "widely";
type BrowserKey =
  | "chrome"
  | "chrome_android"
  | "edge"
  | "firefox"
  | "firefox_android"
  | "safari"
  | "safari_ios";
type FeatureStatus = "available";

interface Feature {
  baseline: {
    low_date: string;
    status: BaselineStatus;
  };

  browser_implementations: Record<BrowserKey, {
    date: string;
    status: FeatureStatus;
    version: string;
  }>;

  feature_id: string;
  name: string;
  spec: {
    links: any[];
  };
  usage: Record<BrowserKey, { daily: number }>;
}

/**
 * Extract the baseline data from the WebStatus API. This retrieves the features going back by POLLING_INTERVAL_MS.
 *
 * This is shamelessly copied from:
 *
 * https://github.com/GoogleChromeLabs/baseline-demos/blob/main/tooling/email-digest/index.js
 *
 * See the Web Platform Baseline page to understand the difference between the baseline statuses:
 *
 * https://web-platform-dx.github.io/web-features/#how-do-features-become-part-of-baseline%3F
 *
 * @param baselineStatus indicates whether to get "newly" or "widely" available features
 * @returns the available features in the last 24 hours
 */
async function getBaselineData(baselineStatus: BaselineStatus) {
  // Default to "newly" available features if the status string is incorrect:
  baselineStatus = baselineStatus !== "newly" && baselineStatus !== "widely"
    ? "newly"
    : baselineStatus;

  // Get the ending timestamp (now):
  const END_TIMESTAMP = new Date().getTime();

  // Determine whether to calculate for Newly or Widely available status:
  let START_TIMESTAMP = END_TIMESTAMP;

  if (baselineStatus === "newly") {
    START_TIMESTAMP -= 60 * 60 * 24 * 7 * 1000;
  } else if (baselineStatus === "widely") {
    START_TIMESTAMP -= 60 * 60 * 24 * 365.25 * 2.5 * 1000;
  }

  // Build the start date:
  const START_DATE_OBJ = new Date(START_TIMESTAMP);
  const START_MONTH = new String(START_DATE_OBJ.getMonth() + 1).padStart(
    2,
    "0",
  );
  const START_DATE = new String(START_DATE_OBJ.getDate()).padStart(2, "0");
  const START_YEAR = new String(START_DATE_OBJ.getFullYear());
  let AVAILABLE_START;

  // If we're in debug mode, we want to ensure we get output, so set a date
  // in the far past to make sure something gets sent. This is because
  // sometimes there's no Newly available features in the last week
  if (DEBUG) {
    AVAILABLE_START = "2020-01-01";
  } else {
    AVAILABLE_START = `${START_YEAR}-${START_MONTH}-${START_DATE}`;
  }

  // Build the end date:
  const END_DATE_OBJ = new Date(END_TIMESTAMP);
  const END_MONTH = new String(END_DATE_OBJ.getMonth() + 1).padStart(2, "0");
  const END_DATE = new String(END_DATE_OBJ.getDate()).padStart(2, "0");
  const END_YEAR = new String(END_DATE_OBJ.getFullYear());
  let AVAILABLE_END;

  if (DEBUG) {
    AVAILABLE_END = "2025-01-01";
  } else {
    AVAILABLE_END = `${END_YEAR}-${END_MONTH}-${END_DATE}`;
  }

  const QUERY_PARAMS = encodeURI(
    [
      `baseline_date:${AVAILABLE_START}..${AVAILABLE_END}`,
      `baseline_status:${baselineStatus}`,
    ].join(" AND "),
  );

  // Construct the fetch URL:
  const FETCH_URL = `https://api.webstatus.dev/v1/features?q=${QUERY_PARAMS}`;

  // If in debug mode, output the fetch URL to the console:
  if (DEBUG) {
    console.log(FETCH_URL);
  }

  // Fetch the data and get its JSON representation:
  const RESPONSE = await fetch(FETCH_URL);
  const JSON_DATA = await RESPONSE.json();

  if (DEBUG) {
    console.log(JSON_DATA);
  }

  return JSON_DATA;
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const baseline = await getBaselineData("newly");
}
