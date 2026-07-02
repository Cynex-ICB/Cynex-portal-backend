export function getClientUrl() {
  const raw = process.env.CLIENT_URL || "http://app.cynexicb.com";
  return raw
    .split(",")[0]
    .trim()
    .replace(/^https?:\/\/www\.cynexicb\.com/i, "http://app.cynexicb.com")
    .replace(/\/$/, "");
}
