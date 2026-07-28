package main

import (
	"encoding/json"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"regexp"
	"strings"
)

var (
	allowedUsersSet = make(map[string]bool)
	isRestricted    = false

	awesomeURL *url.URL
	streakURL  *url.URL
	readmeURL  *url.URL
	trophyURL  *url.URL

	awesomeProxy *httputil.ReverseProxy
	streakProxy  *httputil.ReverseProxy
	readmeProxy  *httputil.ReverseProxy
	trophyProxy  *httputil.ReverseProxy

	awesomeUserStatsRegex = regexp.MustCompile(`(?i)^/awesome/user-stats/([^/?#]+)`)
	generalRouteRegex     = regexp.MustCompile(`(?i)^/(?:awesome|trophy|streak|top-language)/([^/?#]+)`)
)

func init() {
	rawAllowed := os.Getenv("ALLOWED_USERNAMES")
	if rawAllowed != "" {
		parts := strings.Split(rawAllowed, ",")
		for _, p := range parts {
			trimmed := strings.ToLower(strings.TrimSpace(p))
			if trimmed == "*" {
				isRestricted = false
				allowedUsersSet = make(map[string]bool)
				break
			}
			if trimmed != "" {
				allowedUsersSet[trimmed] = true
			}
		}
		if len(allowedUsersSet) > 0 {
			isRestricted = true
		}
	}

	awesomeStr := getEnvOrDefault("AWESOME_STATS_URL", "http://awesome-stats:8080")
	streakStr := getEnvOrDefault("STREAK_STATS_URL", "http://streak-stats:80")
	readmeStr := getEnvOrDefault("README_STATS_URL", "http://readme-stats:9000")
	trophyStr := getEnvOrDefault("TROPHY_STATS_URL", "http://trophy-stats:8080")

	var err error
	awesomeURL, err = url.Parse(awesomeStr)
	if err != nil {
		log.Fatalf("Invalid AWESOME_STATS_URL: %v", err)
	}
	streakURL, err = url.Parse(streakStr)
	if err != nil {
		log.Fatalf("Invalid STREAK_STATS_URL: %v", err)
	}
	readmeURL, err = url.Parse(readmeStr)
	if err != nil {
		log.Fatalf("Invalid README_STATS_URL: %v", err)
	}
	trophyURL, err = url.Parse(trophyStr)
	if err != nil {
		log.Fatalf("Invalid TROPHY_STATS_URL: %v", err)
	}

	awesomeProxy = httputil.NewSingleHostReverseProxy(awesomeURL)
	streakProxy = httputil.NewSingleHostReverseProxy(streakURL)
	readmeProxy = httputil.NewSingleHostReverseProxy(readmeURL)
	trophyProxy = httputil.NewSingleHostReverseProxy(trophyURL)
}

func getEnvOrDefault(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func extractUsername(r *http.Request) string {
	// 1. Query parameter
	if qUser := r.URL.Query().Get("username"); qUser != "" {
		return strings.TrimSpace(qUser)
	}
	if qUser := r.URL.Query().Get("user"); qUser != "" {
		return strings.TrimSpace(qUser)
	}

	// 2. Path parameter
	path := r.URL.Path

	if match := awesomeUserStatsRegex.FindStringSubmatch(path); len(match) > 1 {
		return strings.TrimSpace(match[1])
	}

	if match := generalRouteRegex.FindStringSubmatch(path); len(match) > 1 {
		cand := strings.TrimSpace(match[1])
		if cand != "user-stats" && cand != "health" {
			return cand
		}
	}

	return ""
}

func renderErrorSvg(title, message string) string {
	safeTitle := html.EscapeString(title)
	safeMessage := html.EscapeString(message)

	return fmt.Sprintf(`<svg xmlns="http://www.w3.org/2000/svg" width="495" height="125" viewBox="0 0 495 125" fill="none">
    <style>
      .header {
        font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif;
        fill: #ff453a;
      }
      .message {
        font: 400 13px 'Segoe UI', Ubuntu, Sans-Serif;
        fill: #8b949e;
      }
      .bg {
        fill: #0d1117;
        stroke: #30363d;
        stroke-width: 1px;
        rx: 6px;
      }
      .icon {
        fill: #ff453a;
      }
    </style>
    <rect width="494" height="124" x="0.5" y="0.5" class="bg" />
    <g transform="translate(25, 25)">
      <path class="icon" d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
      <text x="32" y="16" class="header">%s</text>
      <text x="0" y="55" class="message">%s</text>
      <text x="0" y="75" class="message">Configure ALLOWED_USERNAMES in your SelfStats .env file.</text>
    </g>
  </svg>`, safeTitle, safeMessage)
}

func enforceWhitelist(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" || path == "/health" {
			next.ServeHTTP(w, r)
			return
		}

		if isRestricted {
			username := extractUsername(r)
			if username == "" || !allowedUsersSet[strings.ToLower(username)] {
				w.Header().Set("Content-Type", "image/svg+xml; charset=utf-8")
				w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
				w.WriteHeader(http.StatusForbidden)
				msg := fmt.Sprintf("User '%s' is not authorized on this instance.", username)
				if username == "" {
					msg = "User 'unknown' is not authorized on this instance."
				}
				fmt.Fprint(w, renderErrorSvg("403 Forbidden", msg))
				return
			}
		}

		next.ServeHTTP(w, r)
	})
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]any{
		"status": "ok",
		"accessControl": map[string]any{
			"restricted":        isRestricted,
			"allowedUsersCount": len(allowedUsersSet),
		},
		"services": map[string]string{
			"awesome":     awesomeURL.String(),
			"streak":      streakURL.String(),
			"topLanguage": readmeURL.String(),
			"trophy":      trophyURL.String(),
		},
	}
	json.NewEncoder(w).Encode(resp)
}

func handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]any{
		"name": "SelfStats Go Gateway",
		"endpoints": map[string]any{
			"trophy":      []string{"/trophy?username=<github_user>", "/trophy/<github_user>"},
			"streak":      []string{"/streak?user=<github_user>", "/streak/<github_user>"},
			"topLanguage": []string{"/top-language?username=<github_user>", "/top-language/<github_user>"},
			"awesome": []string{
				"/awesome/user-stats/<github_user>",
				"/awesome?username=<github_user>",
				"/awesome/<github_user>",
			},
		},
		"allowedUsersConfigured": isRestricted,
	}
	json.NewEncoder(w).Encode(resp)
}

func handleAwesome(w http.ResponseWriter, r *http.Request) {
	username := extractUsername(r)
	path := r.URL.Path
	q := r.URL.Query()
	q.Del("username")
	q.Del("user")

	var targetPath string
	if strings.HasPrefix(strings.ToLower(path), "/awesome/user-stats/") {
		sub := path[len("/awesome/user-stats/"):]
		targetPath = "/user-stats/" + sub
	} else if strings.HasPrefix(strings.ToLower(path), "/awesome/") {
		sub := path[len("/awesome/"):]
		targetPath = "/user-stats/" + sub
	} else if username != "" {
		targetPath = "/user-stats/" + url.PathEscape(username)
	} else {
		targetPath = "/user-stats/"
	}

	r.URL.Path = targetPath
	r.URL.RawQuery = q.Encode()
	r.Host = awesomeURL.Host

	awesomeProxy.ServeHTTP(w, r)
}

func handleStreak(w http.ResponseWriter, r *http.Request) {
	username := extractUsername(r)
	q := r.URL.Query()
	q.Del("username")
	q.Del("user")
	if username != "" {
		q.Set("user", username)
	}

	r.URL.Path = "/"
	r.URL.RawQuery = q.Encode()
	r.Host = streakURL.Host

	streakProxy.ServeHTTP(w, r)
}

func handleTopLanguage(w http.ResponseWriter, r *http.Request) {
	username := extractUsername(r)
	q := r.URL.Query()
	q.Del("username")
	q.Del("user")
	if username != "" {
		q.Set("username", username)
	}

	r.URL.Path = "/api/top-langs"
	r.URL.RawQuery = q.Encode()
	r.Host = readmeURL.Host

	readmeProxy.ServeHTTP(w, r)
}

func handleTrophy(w http.ResponseWriter, r *http.Request) {
	username := extractUsername(r)
	q := r.URL.Query()
	q.Del("username")
	q.Del("user")
	if username != "" {
		q.Set("username", username)
	}

	r.URL.Path = "/"
	r.URL.RawQuery = q.Encode()
	r.Host = trophyURL.Host

	trophyProxy.ServeHTTP(w, r)
}

func main() {
	port := getEnvOrDefault("PORT", "8080")

	mux := http.NewServeMux()
	mux.HandleFunc("/health", handleHealth)
	mux.HandleFunc("/awesome/", handleAwesome)
	mux.HandleFunc("/awesome", handleAwesome)
	mux.HandleFunc("/streak/", handleStreak)
	mux.HandleFunc("/streak", handleStreak)
	mux.HandleFunc("/top-language/", handleTopLanguage)
	mux.HandleFunc("/top-language", handleTopLanguage)
	mux.HandleFunc("/trophy/", handleTrophy)
	mux.HandleFunc("/trophy", handleTrophy)
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			handleRoot(w, r)
			return
		}
		http.NotFound(w, r)
	})

	handler := enforceWhitelist(mux)

	log.Printf("SelfStats Go Gateway running on port %s", port)
	if isRestricted {
		log.Printf("Allowed usernames restriction ACTIVE")
	} else {
		log.Printf("Allowed usernames restriction DISABLED (all allowed)")
	}

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server error: %v", err)
	}
}
