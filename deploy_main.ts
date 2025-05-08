import { retrieveAndPostNewlyAvailableFeatures } from "./main.ts";

const CRON_SCHEDULE = Deno.env.get("CRON_SCHEDULE") || "0 0 * * *"; // Every day at midnight by default

Deno.cron(
  "Query for new Web Platform features and post to Bluesky",
  CRON_SCHEDULE,
  async () => {
    await retrieveAndPostNewlyAvailableFeatures();
  },
);

// Run a simple Deno Deploy server that responds with "Hello, world!"
Deno.serve(() =>
  new Response(
    `Hi! You can find me on Bluesky at <a href="https://bsky.app/profile/baselinebot.bsky.social">@baselinebot.bsky.social</a>!`,
    {
      headers: { "content-type": "text/html" },
    },
  )
);
