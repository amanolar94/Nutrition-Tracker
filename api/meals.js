// Keep a terminal response for old GPT Actions. Never redirect a write to MCP:
// it has a different protocol and requires the existing OAuth connection.
export function makeHandler() {
  return function handler(_req, res) {
    const site = (
      process.env.MCP_SITE_URL ||
      "https://nutrition-tracker-gamma-flax.vercel.app"
    ).replace(/\/$/, "");
    res.setHeader("Cache-Control", "no-store");
    return res.status(410).json({
      error: "legacy_action_retired",
      message:
        "Personal-key GPT Actions have been retired. Use the existing Nutrition Tracker MCP connection with OAuth.",
      mcp_url: site + "/mcp",
    });
  };
}
export default makeHandler();
