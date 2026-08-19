/**
 * Crawler / automation detection. Keep the token list in sync with
 * ecommerce/backend/base_ecommerce/analytics_noise.py (_BOT_UA_RE).
 */

const BOT_UA_RE =
  /googlebot|google-inspectiontool|storebot-google|apis-google|adsbot-google|mediapartners-google|feedfetcher-google|googleother|google-extended|google-read-aloud|googleproducer|bingbot|bingpreview|adidxbot|msnbot|yandex(?:bot|images|mobile)?|baiduspider|duckduckbot|slurp|sogou|exabot|facebookexternalhit|facebot|meta-externalagent|twitterbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterestbot|redditbot|slackbot|telegrambot|applebot|discordbot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|dataforseo|screaming frog|seznambot|mauibot|blexbot|rogerbot|sistrix|megaindex|linkdex|serpstat|serpstatbot|gptbot|chatgpt-user|claudebot|anthropic|ccbot|claude-web|perplexitybot|omgili|diffbot|cohere-ai|youbot|amazonbot|pingdom|uptimerobot|statuscake|site24x7|headlesschrome|phantomjs|selenium|webdriver|puppeteer|playwright|cypress|nightmare|jsdom|\bbot\b|\bcrawler\b|\bspider\b|\bscraper\b|crawl/i;

export function currentUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent || "";
}

export function isBotUserAgent(ua) {
  const value = ua ?? currentUserAgent();
  if (!value.trim()) return true;
  if (BOT_UA_RE.test(value)) return true;
  if (typeof navigator !== "undefined" && navigator.webdriver === true) return true;
  return false;
}

export function isDoNotTrack() {
  if (typeof navigator === "undefined") return false;
  return navigator.doNotTrack === "1" || window.doNotTrack === "1";
}

export function shouldSkipTelemetry() {
  return isDoNotTrack() || isBotUserAgent();
}
