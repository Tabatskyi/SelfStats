import express from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import { renderErrorSvg } from "./error-card.js";

const app = express();
const PORT = process.env.PORT || 8080;

// Read allowed usernames from environment variable (comma separated)
const rawAllowedUsers = process.env.ALLOWED_USERNAMES || "";
const allowedUsersSet = new Set(
  rawAllowedUsers
    .split(",")
    .map((u) => u.trim().toLowerCase())
    .filter(Boolean)
);

const isAccessRestricted = allowedUsersSet.size > 0 && !allowedUsersSet.has("*");

// Backend target endpoints
const TARGETS = {
  awesome: process.env.AWESOME_STATS_URL || "http://awesome-stats:8080",
  streak: process.env.STREAK_STATS_URL || "http://streak-stats:80",
  topLanguage: process.env.README_STATS_URL || "http://readme-stats:9000",
  trophy: process.env.TROPHY_STATS_URL || "http://trophy-stats:8080",
};

/**
 * Extracts username from either query parameters or path segments.
 * Supports:
 *  - ?username=name / ?user=name
 *  - /awesome/user-stats/name
 *  - /awesome/name
 *  - /trophy/name
 *  - /streak/name
 *  - /top-language/name
 */
function extractUsername(req) {
  let username = (req.query.username || req.query.user || "").toString().trim();
  if (username) return username;

  const rawPath = req.originalUrl ? req.originalUrl.split("?")[0] : (req.path || "");

  // Pattern: /awesome/user-stats/:username/...
  const awesomeUserStatsMatch = rawPath.match(/^\/awesome\/user-stats\/([^/?#]+)/i);
  if (awesomeUserStatsMatch) {
    return awesomeUserStatsMatch[1];
  }

  // Pattern: /<route>/:username/...
  const generalMatch = rawPath.match(/^\/(?:awesome|trophy|streak|top-language)\/([^/?#]+)/i);
  if (generalMatch) {
    const candidate = generalMatch[1];
    if (candidate !== "user-stats" && candidate !== "health") {
      return candidate;
    }
  }

  return "";
}

/**
 * Access Control Middleware
 * Checks if target username is permitted.
 */
function enforceUsernameWhitelist(req, res, next) {
  const rawPath = req.originalUrl ? req.originalUrl.split("?")[0] : req.path;
  if (rawPath === "/" || rawPath === "/health") {
    return next();
  }

  const username = extractUsername(req);

  if (isAccessRestricted) {
    if (!username || !allowedUsersSet.has(username.toLowerCase())) {
      res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res
        .status(403)
        .send(renderErrorSvg("403 Forbidden", `User '${username || "unknown"}' is not authorized on this instance.`));
    }
  }

  next();
}

app.use(enforceUsernameWhitelist);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    accessControl: isAccessRestricted
      ? { restricted: true, allowedUsersCount: allowedUsersSet.size }
      : { restricted: false },
    services: TARGETS,
  });
});

// Root endpoint info
app.get("/", (req, res) => {
  res.json({
    name: "SelfStats Gateway",
    endpoints: {
      trophy: ["/trophy?username=<github_user>", "/trophy/<github_user>"],
      streak: ["/streak?user=<github_user>", "/streak/<github_user>"],
      topLanguage: ["/top-language?username=<github_user>", "/top-language/<github_user>"],
      awesome: [
        "/awesome/user-stats/<github_user>",
        "/awesome?username=<github_user>",
        "/awesome/<github_user>",
      ],
    },
    allowedUsersConfigured: isAccessRestricted,
  });
});

/**
 * Helper to build proxy rewrite path for generic routes
 */
function buildRewrittenPath(req, targetParamName, basePath = "/") {
  const username = extractUsername(req);
  const url = new URL(req.url, "http://localhost");

  url.searchParams.delete("username");
  url.searchParams.delete("user");

  if (username) {
    url.searchParams.set(targetParamName, username);
  }

  const queryStr = url.searchParams.toString();
  return `${basePath}${queryStr ? "?" + queryStr : ""}`;
}

/**
 * Route 1: /awesome -> awesome-github-stats
 * Supports:
 *   - /awesome/user-stats/tabatskyi
 *   - /awesome/user-stats/tabatskyi/preview
 *   - /awesome/user-stats/tabatskyi/stats
 *   - /awesome/user-stats/tabatskyi/rank
 *   - /awesome/tabatskyi
 *   - /awesome?username=tabatskyi
 */
app.use(
  "/awesome",
  createProxyMiddleware({
    target: TARGETS.awesome,
    changeOrigin: true,
    pathRewrite: (path, req) => {
      const url = new URL(req.url, "http://localhost");
      const originalPath = req.originalUrl ? req.originalUrl.split("?")[0] : path;

      // 1. Match /awesome/user-stats/:username (or subpaths like /preview)
      const userStatsMatch = originalPath.match(/^\/awesome\/user-stats\/(.+)$/i);
      if (userStatsMatch) {
        url.searchParams.delete("username");
        url.searchParams.delete("user");
        const queryStr = url.searchParams.toString();
        return `/user-stats/${userStatsMatch[1]}${queryStr ? "?" + queryStr : ""}`;
      }

      // 2. Match /awesome?username=...
      const usernameQuery = (req.query.username || req.query.user || "").toString();
      if (usernameQuery) {
        url.searchParams.delete("username");
        url.searchParams.delete("user");
        const queryStr = url.searchParams.toString();
        return `/user-stats/${encodeURIComponent(usernameQuery)}${queryStr ? "?" + queryStr : ""}`;
      }

      // 3. Match /awesome/:username
      const simpleMatch = originalPath.match(/^\/awesome\/([^/?#]+)(.*)$/i);
      if (simpleMatch && simpleMatch[1] !== "user-stats") {
        url.searchParams.delete("username");
        url.searchParams.delete("user");
        const queryStr = url.searchParams.toString();
        return `/user-stats/${encodeURIComponent(simpleMatch[1])}${simpleMatch[2]}${queryStr ? "?" + queryStr : ""}`;
      }

      return path;
    },
  })
);

/**
 * Route 2: /streak -> github-readme-streak-stats (/?user={user})
 */
app.use(
  "/streak",
  createProxyMiddleware({
    target: TARGETS.streak,
    changeOrigin: true,
    pathRewrite: (path, req) => buildRewrittenPath(req, "user", "/"),
  })
);

/**
 * Route 3: /top-language -> github-readme-stats (/api/top-langs?username={username})
 */
app.use(
  "/top-language",
  createProxyMiddleware({
    target: TARGETS.topLanguage,
    changeOrigin: true,
    pathRewrite: (path, req) => buildRewrittenPath(req, "username", "/api/top-langs"),
  })
);

/**
 * Route 4: /trophy -> github-profile-trophy (/?username={username})
 */
app.use(
  "/trophy",
  createProxyMiddleware({
    target: TARGETS.trophy,
    changeOrigin: true,
    pathRewrite: (path, req) => buildRewrittenPath(req, "username", "/"),
  })
);

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SelfStats Gateway running on port ${PORT}`);
  console.log(`Allowed usernames restriction: ${isAccessRestricted ? Array.from(allowedUsersSet).join(", ") : "DISABLED (all allowed)"}`);
});
