import { retrieveAndPostNewlyAvailableFeatures } from "./main.ts";

Deno.cron(
  "Query for new Web Platform features and post to Bluesky",
  "0 0 * * *",
  async () => {
    await retrieveAndPostNewlyAvailableFeatures();
  },
);
