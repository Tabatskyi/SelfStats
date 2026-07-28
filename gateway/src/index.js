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
 * Access Control Middleware
 * Checks if target username is permitted.
 */
function enforceUsernameWhitelist(req, res, next) {
  // Allow system/info endpoints
  if (req.path === "/" || req.path === "/health") {
    return next();
  }

  const username = (
    req.query.username ||
    req.query.user ||
    ""
  ).toString().trim();

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
      trophy: "/trophy?username=<github_user>",
      streak: "/streak?user=<github_user>",
      topLanguage: "/top-language?username=<github_user>",
      awesome: "/awesome?username=<github_user>",
    },
    allowedUsersConfigured: isAccessRestricted,
  });
});

/**
 * Helper to build proxy rewrite path
 */
function buildRewrittenPath(req, targetParamName, basePath = "/") {
  const username = (req.query.username || req.query.user || "").toString();
  const url = new URL(req.url, "http://localhost");

  // Remove generic user params
  url.searchParams.delete("username");
  url.searchParams.delete("user");

  if (username) {
    url.searchParams.set(targetParamName, username);
  }

  const queryStr = url.searchParams.toString();
  return `${basePath}${queryStr ? "?" + queryStr : ""}`;
}

/**
 * Route 1: /awesome -> awesome-github-stats (/user-stats/{username})
 */
app.use(
  "/awesome",
  createProxyMiddleware({
    target: TARGETS.awesome,
    changeOrigin: true,
    pathRewrite: (path, req) => {
      const username = (req.query.username || req.query.user || "").toString();
      const url = new URL(req.url, "http://localhost");
      url.searchParams.delete("username");
      url.searchParams.delete("user");
      const queryStr = url.searchParams.toString();
      return `/user-stats/${encodeURIComponent(username)}${queryStr ? "?" + queryStr : ""}`;
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
