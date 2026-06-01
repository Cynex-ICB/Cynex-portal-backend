export function getClientUrl() {
  const raw = process.env.CLIENT_URL || "http://cynexicb.com";
  return raw
    .split(",")[0]
    .trim()
    .replace(/^https?:\/\/www\.cynexicb\.com/i, "http://cynexicb.com")
    .replace(/\/$/, "");
}
