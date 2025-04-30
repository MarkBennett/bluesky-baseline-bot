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
  const endTimestamp = new Date().getTime();

  // Determine whether to calculate for Newly or Widely available status:
  let startTimestamp = endTimestamp;

  if (baselineStatus === "newly") {
    startTimestamp -= 60 * 60 * 24 * 7 * 1000;
  } else if (baselineStatus === "widely") {
    startTimestamp -= 60 * 60 * 24 * 365.25 * 2.5 * 1000;
  }

  // Build the start date:
  const startDateObj = new Date(startTimestamp);
  const startMonth = new String(startDateObj.getMonth() + 1).padStart(
    2,
    "0",
  );
  const startDate = new String(startDateObj.getDate()).padStart(2, "0");
  const startYear = new String(startDateObj.getFullYear());
  let availableStart;

  // If we're in debug mode, we want to ensure we get output, so set a date
  // in the far past to make sure something gets sent. This is because
  // sometimes there's no Newly available features in the last week
  if (DEBUG) {
    availableStart = "2020-01-01";
  } else {
    availableStart = `${startYear}-${startMonth}-${startDate}`;
  }

  // Build the end date:
  const endDateObj = new Date(endTimestamp);
  const endMonth = new String(endDateObj.getMonth() + 1).padStart(2, "0");
  const endDate = new String(endDateObj.getDate()).padStart(2, "0");
  const endYear = new String(endDateObj.getFullYear());
  let availableEnd;

  if (DEBUG) {
    availableEnd = "2025-01-01";
  } else {
    availableEnd = `${endYear}-${endMonth}-${endDate}`;
  }

  const queryParams = encodeURI(
    [
      `baseline_date:${availableStart}..${availableEnd}`,
      `baseline_status:${baselineStatus}`,
    ].join(" AND "),
  );

  // Construct the fetch URL:
  const fetchUrl = `https://api.webstatus.dev/v1/features?q=${queryParams}`;

  // If in debug mode, output the fetch URL to the console:
  if (DEBUG) {
    console.log(fetchUrl);
  }

  // Fetch the data and get its JSON representation:
  const response = await fetch(fetchUrl);
  const jsonData = await response.json();

  if (DEBUG) {
    console.log(jsonData);
  }

  return jsonData;
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  await getBaselineData("newly");
}
