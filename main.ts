import { AtpAgent, RichText } from "npm:@atproto/api";
import { type Record as AptRecord } from "npm:@atproto/api/dist/client/types/app/bsky/feed/post.js";
import Parser from "npm:rss-parser";

const BLUESKY_HOST = Deno.env.get("BLUESKY_HOST") || "https://bsky.social";
const BLUESKY_USERNAME = Deno.env.get("BLUESKY_USERNAME");
const BLUESKY_PASSWORD = Deno.env.get("BLUESKY_PASSWORD");

type BaselineStatus = "newly" | "widely";
type BrowserKey =
  | "chrome"
  | "chrome_android"
  | "edge"
  | "firefox"
  | "firefox_android"
  | "safari"
  | "safari_ios";
type FeatureStage = "newly" | "widely";
interface Feature {

}

interface FeatureResponse {
  data: Feature[];
  meta: {
    next_page_token: string;
    total: number;
  };
}

const kv = await Deno.openKv();

async function publishNewlyAvailableFeaturesToBluesky(features: Feature[]) {
  for (const feature of features) {
    await publishFeatureToBluesky(feature);
  }
}

async function publishFeatureToBluesky(feature: Feature) {
  const { name, feature_id } = feature;

  const webStatusUrl = `https://webstatus.dev/features/${feature_id}`;

  const description = await fetchFeatureDescription(feature_id);

  // Construct the message to be sent to Bluesky:
  const message = `Newly available feature: ${name}\n\n` +
    `Description: ${description}\n\n` +
    `Learn More: ${webStatusUrl}`;

  // Get the Bluesky agent
  const agent = await getBlueskyAgent();

  // Send the message to Bluesky:
  await sendMessageToBluesky(agent, message);
}

async function sendMessageToBluesky(agent: AtpAgent, message: string) {
  const rt = new RichText({ text: message });
  await rt.detectFacets(agent);
  const postRecord: AptRecord = {
    $type: "app.bsky.feed.post",
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  };
  const record = await agent.post(postRecord);
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

const WEB_PLATFORM_REPO = "web-platform-dx/web-features";

async function getLatestWebPlatformReleaseData() {
  // Use the GitHub API to get the latest release data
  const response = await fetch(
    `https://api.github.com/repos/${WEB_PLATFORM_REPO}/releases/latest`,
    {
      headers: {
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "web-features-bot",
      },
    },
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch latest release data: ${response.statusText}`);
  }
  const releaseData = await response.json();

  // Check the release assets for the url of the "data.json" file
  const dataAsset = releaseData.assets.find((asset: any) => asset.name === "data.json");
  if (!dataAsset) {
    throw new Error("No data.json asset found in the latest release");
  }
  const dataUrl = dataAsset.browser_download_url;
  if (!dataUrl) {
    throw new Error("No download URL found for data.json asset");
  }

  const dataResponse = await fetch(dataUrl);
  if (!dataResponse.ok) {
    throw new Error(`Failed to fetch data.json: ${dataResponse.statusText}`);
  }
  const latestData = await dataResponse.json();

  return latestData;
}

async function hashFeature(feature: any): Promise<string> {
  const featureString = JSON.stringify(feature);
  const featureStringUtf8 = new TextEncoder().encode(featureString);

  const hashBuffer = await crypto.subtle.digest("SHA-256", featureStringUtf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

async function getFeatureHashFromDB(featureId: string): Promise<string | null> {
  const existingHash = await kv.get<string>([`features`, featureId]);
  if (existingHash) {
    return existingHash.value;
  }
  return null;
}

async function setFeatureHashInDB(featureId: string, hash: string): Promise<void> {
  await kv.set(["features", featureId], hash);
}

async function extractNewFeaturesFromData(): Promise<Feature[]> {
  // Retrieve the newest web-features data
  const latestData = await getLatestWebPlatformReleaseData();

  // For each item in the data, compare a hash of the item to one stored in the Deno.KV store
  // If the hash is not found, publish the feature to Bluesky and store the hash in Deno.KV
  const featureItems = latestData.features;
  const newFeatureItems: Feature[] = [];
  for (const featureKey of Object.keys(featureItems)) {
    const item = featureItems[featureKey];
    const featureHash = await hashFeature(item);

    const existingHash = await getFeatureHashFromDB(featureKey);
    if (existingHash === null || existingHash !== featureHash) {
      newFeatureItems.push(item);
      await setFeatureHashInDB(featureKey, featureHash);
    }
  }

  return newFeatureItems;
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const newFeatures = await extractNewFeaturesFromData();
}
