**THIS IS A WORK IN PROGRESS. PULL REQUESTS ARE WELCOME!**

# Bluesky Baseline Bot

This project is a Deno-based bot that interacts with the WebStatus API to
retrieve baseline data for web features. It polls the api every week and then
posts the results to Bluesky for easy sharing!

You can find this bot on Bluesky at
[@baselinebot.bsky.social](https://bsky.app/profile/baselinebot.bsky.social).

Pull requests are welcome! If you have any suggestions or improvements, feel
free to contribute.

## Features

- Fetches baseline data for web features.
- Supports two baseline statuses: "newly" and "widely".
- Debug mode for enhanced logging and testing.

## Prerequisites

- [Deno](https://deno.land/) installed on your system.

## Setup

1. Clone this repository:
   ```bash
   git clone <repository-url>
   cd bluesky-baseline-bot
   ```
2. Ensure Deno is installed and available in your PATH.

## Usage

Run the bot with the following command:

```bash
deno run --allow-net main.ts
```

### Debug Mode

To enable debug mode, set the `DEBUG` environment variable to `true`:

```bash
DEBUG=true deno run --allow-net main.ts
```

## Testing

Run the tests using Deno's built-in test runner:

```bash
deno test
```

## File Structure

- `main.ts`: The main script for fetching baseline data.
- `main_test.ts`: Contains tests for the bot.
- `deno.json`: Configuration file for Deno.
- `deno.lock`: Lock file for dependencies.

## License

This project is licensed under the MIT License.
