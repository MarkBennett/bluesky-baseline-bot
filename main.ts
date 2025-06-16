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
type FeatureStatus = "available";

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

const NEWLY_AVAILABLE_FEATURES_URL = "https://web-platform-dx.github.io/web-features-explorer/newly-available.xml";
const NEW_WIDELY_AVAILABLE_FEATURES_URL = "https://web-platform-dx.github.io/web-features-explorer/widely-available.xml";

async function hashFeature(feature: any): string {
  const featureString = JSON.stringify(feature);
  const featureStringUtf8 = new TextEncoder().encode(featureString);

  const hashBuffer = await crypto.subtle.digest("SHA-256", featureStringUtf8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

async function getFeatureHashFromDB(featureId: string): Promise<string | null> {
  const existingHash = await kv.get<string>(["features", featureId]);
  if (existingHash) {
    return existingHash.value;
  }
  return null;
}

async function setFeatureHashInDB(featureId: string, hash: string): Promise<void> {
  await kv.set(["features", featureId], hash);
}

async function getNewFeaturesFromRSS() {
  // Retrieve the RSS feed for newly available features
  const parser = new Parser();
  const newlyAvailableFeaturesFeed = await parser.parseURL(NEWLY_AVAILABLE_FEATURES_URL);

  // For each item in the feed, compare a hash of the item to one stored in the Deno.KV store
  // If the hash is not found, publish the feature to Bluesky and store the hash in Deno.KV
  const newlyAvailableFeatures = newlyAvailableFeaturesFeed.items || [];
  const newNewlyAvailableFeatures: Feature[] = [];
  for (const item of newlyAvailableFeatures) {
    const featureId = item.title;

    if (!featureId) {
      console.warn("Feature ID is missing in item:", item);
      continue;
    }

    const featureHash = await hashFeature(item);

    const existingHash = await getFeatureHashFromDB(featureId);
    if (existingHash === null || existingHash !== featureHash) {
      newNewlyAvailableFeatures.push(item);
      await setFeatureHashInDB(featureId, featureHash);
    }
  }

  return { newNewlyAvailableFeatures };
}


// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const { newNewlyAvailableFeatures, newWidelyAvailableFeatures } = await getNewFeaturesFromRSS();
}
