import { AtpAgent, RichText } from "npm:@atproto/api";
import { type Record as AptRecord } from "npm:@atproto/api/dist/client/types/app/bsky/feed/post.js";

const DEBUG = Deno.env.get("DEBUG") === "true" ? true : false;
const BLUESKY_HOST = Deno.env.get("BLUESKY_HOST") || "https://bsky.social";
const BLUESKY_USERNAME = Deno.env.get("BLUESKY_USERNAME");
const BLUESKY_PASSWORD = Deno.env.get("BLUESKY_PASSWORD");

const PREAMBLE_LIMITED = "🟠 Limited Availability";
const PREAMBLE_NEWLY = "🔵 Newly Available";
const PREAMBLE_WIDELY = "🟢 Widely Available";

/**
 * The time offset in milliseconds for the baseline start time. This script runs once a day, so we want to get the
 * features that have become available in the last 24 hours.
 */
const BASELINE_START_TIME_OFFSET = 60 * 60 * 24; // 24 hours in seconds

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
    links: {
      link: string;
    }[];
  };
  usage: Record<BrowserKey, { daily: number }>;
}

interface FeatureResponse {
  data: Feature[];
  meta: {
    next_page_token: string;
    total: number;
  };
}

/**
 * Extract the baseline data from the WebStatus API.
 *
 * By default, this retrieves features available in the last day. In debug mode, it retrieves going back to
 * "2020-01-01".
 *
 * This is shamelessly copied from:
 *
 * https://github.com/GoogleChromeLabs/baseline-demos/blob/main/tooling/email-digest/index.js
 *
 * See the Web Platform Baseline page to understand the difference between the baseline statuses:
 *
 * https://web-platform-dx.github.io/web-features/#how-do-features-become-part-of-baseline%3F
 *
 * @returns the available features in the last 24 hours
 */
async function getBaselineData(): Promise<FeatureResponse> {
  // Get the ending timestamp (now):
  const endTimestamp = new Date().getTime();

  // Build the start date:
  let availableStart;

  // If we're in debug mode, we want to ensure we get output, so set a date
  // in the far past to make sure something gets sent. This is because
  // sometimes there's no Newly available features in the last week
  if (DEBUG) {
    availableStart = "2020-01-01";
  } else {
    const startTimestamp = endTimestamp - BASELINE_START_TIME_OFFSET;
    const startDateObj = new Date(startTimestamp);
    const startMonth = new String(startDateObj.getMonth() + 1).padStart(
      2,
      "0",
    );
    const startDate = new String(startDateObj.getDate()).padStart(2, "0");
    const startYear = new String(startDateObj.getFullYear());
    availableStart = `${startYear}-${startMonth}-${startDate}`;
  }

  // Build the end date:
  let availableEnd;

  if (DEBUG) {
    availableEnd = "2025-01-01";
  } else {
    const endDateObj = new Date(endTimestamp);
    const endMonth = new String(endDateObj.getMonth() + 1).padStart(2, "0");
    const endDate = new String(endDateObj.getDate()).padStart(2, "0");
    const endYear = new String(endDateObj.getFullYear());

    availableEnd = `${endYear}-${endMonth}-${endDate}`;
  }

  const queryParams = encodeURI(
    `baseline_date:${availableStart}..${availableEnd} AND (baseline_status:widely OR baseline_status:newly)`,
  );

  // Construct the fetch URL:
  const fetchUrl = `https://api.webstatus.dev/v1/features?q=${queryParams}`;

  // Fetch the data and get its JSON representation:
  const response = await fetch(fetchUrl);
  const jsonData = await response.json();

  return jsonData;
}
async function publishNewlyAvailableFeaturesToBluesky(features: Feature[]) {
  for (const feature of features) {
    await publishFeatureToBluesky(feature);
  }
}

async function publishFeatureToBluesky(feature: Feature) {
  const { name, feature_id } = feature;

  const webStatusUrl = `https://webstatus.dev/features/${feature_id}`;

  const description = await fetchFeatureDescription(feature_id);

  // Construct the message to be sent to Bluesky
  const messagePreamble = feature.baseline.status === "newly"
    ? PREAMBLE_NEWLY
    : feature.baseline.status === "widely"
    ? PREAMBLE_WIDELY
    : PREAMBLE_LIMITED;
  const message = `${messagePreamble}: ${name}\n\n` +
    `Description: ${description}\n\n`;

  const embedTitle = `Web Platform Status: ${name}`;
  const embedDescription = `${messagePreamble}: ${description}`;

  // Get the Bluesky agent
  const agent = await getBlueskyAgent();

  // Send the message to Bluesky:
  await sendMessageToBluesky(
    agent,
    message,
    embedTitle,
    embedDescription,
    webStatusUrl,
  );
}

async function fetchFeatureDescription(feature_id: string) {
  const descriptionRequest = await fetch(
    `https://api.webstatus.dev/v1/features/${feature_id}/feature-metadata`,
  );
  const { description } = await descriptionRequest.json();

  return description;
}

async function sendMessageToBluesky(
  agent: AtpAgent,
  message: string,
  embedItitle: string,
  embedDescription: string,
  embedUrl: string,
) {
  const rt = new RichText({ text: message });
  await rt.detectFacets(agent);
  const postRecord: AptRecord = {
    $type: "app.bsky.feed.post",
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: embedUrl,
        title: embedItitle,
        description: embedDescription,
      },
    },
  };
  await agent.post(postRecord);
}

async function getBlueskyAgent(): Promise<AtpAgent> {
  if (!BLUESKY_USERNAME || !BLUESKY_PASSWORD || !BLUESKY_HOST) {
    throw new Error("Missing Bluesky credentials");
  }

  const agent = new AtpAgent({
    service: BLUESKY_HOST,
  });
  const sessionResponse = await agent.login({
    identifier: BLUESKY_USERNAME,
    password: BLUESKY_PASSWORD,
  });
  if (!sessionResponse.success) {
    throw new Error(`Failed to login to Bluesky!`, { cause: sessionResponse });
  }

  return agent;
}

export async function retrieveAndPostNewlyAvailableFeatures() {
  const { data: features } = await getBaselineData();

  if (features.length > 0) {
    console.log("Newly available features!");
  } else {
    console.log("No newly available features!");
    Deno.exit(0);
  }

  if (DEBUG) {
    await publishFeatureToBluesky(features[0]);
  } else {
    await publishNewlyAvailableFeaturesToBluesky(features);
  }
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  await retrieveAndPostNewlyAvailableFeatures();
}
