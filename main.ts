const DEBUG = true;

type BASELINE_STATUS_TYPES = "newly" | "widely";

async function getBaselineData(baselineStatus: BASELINE_STATUS_TYPES) {
  // Default to "newly" available features if the status string is incorrect:
  baselineStatus =
    baselineStatus !== "newly" && baselineStatus !== "widely"
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
    "0"
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
    ].join(" AND ")
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
  console.log(baseline);
}
