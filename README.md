# SelfStats 🚀

Self-hosted, high-performance reverse-proxy gateway and orchestration system for popular GitHub Profile Stats cards.

Keep your cards independent, up to date with upstream submodules, and enforce access control so only your specified username(s) can consume your API quota.

---

## 🌟 Included Stats Cards & Routes

| Route | Card Service | Upstream Repository | Example Usage |
| --- | --- | --- | --- |
| `/trophy` | GitHub Profile Trophy | [ryo-ma/github-profile-trophy](https://github.com/ryo-ma/github-profile-trophy) | `![Trophy](http://your-host:8080/trophy/yourname)` |
| `/streak` | GitHub Readme Streak Stats | [DenverCoder1/github-readme-streak-stats](https://github.com/DenverCoder1/github-readme-streak-stats) | `![Streak](http://your-host:8080/streak/yourname)` |
| `/top-language` | GitHub Readme Stats (Top Languages) | [anuraghazra/github-readme-stats](https://github.com/anuraghazra/github-readme-stats) | `![Top Langs](http://your-host:8080/top-language/yourname)` |
| `/awesome` | Awesome GitHub Stats | [brunobritodev/awesome-github-stats](https://github.com/brunobritodev/awesome-github-stats) | `![Awesome Stats](http://your-host:8080/awesome/user-stats/yourname)` |

---

## 🔒 Username Restriction (Whitelist)

Because self-hosting uses your own GitHub API token, you can restrict access so unauthorized users cannot burn your API quota.

In `.env`:

```env
# Allow specific username(s):
ALLOWED_USERNAMES=your_github_username,another_allowed_user

# Or leave blank / set to * to allow anyone:
# ALLOWED_USERNAMES=
```

If an unauthorized user requests a card, SelfStats returns an HTTP 403 response with a clean, theme-friendly SVG error card:

```text
+-------------------------------------------------------------+
| ⚠️  403 Forbidden                                            |
| User 'unauthorized_user' is not authorized on this instance. |
| Configure ALLOWED_USERNAMES in your SelfStats .env file.    |
+-------------------------------------------------------------+
```

---

## 🛠️ Quick Start

### 1. Clone with Submodules

```bash
git clone --recursive https://github.com/your-username/SelfStats.git
cd SelfStats
```

If already cloned without `--recursive`:

```bash
make update
```

### 2. Configure Environment

Copy `.env.example` to `.env` and set your GitHub token and allowed usernames:

```bash
cp .env.example .env
```

Edit `.env`:

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
ALLOWED_USERNAMES=your_github_username
```

### 3. Build & Run with Docker Compose

```bash
docker compose up -d --build
```

Or:

```bash
make build
make up
```

---

## 🔄 Keeping Repositories Up to Date

Since upstream card repositories are tracked via Git Submodules, update them anytime without breaking your setup:

```bash
make update
```

If you need custom patches for submodules, place `.patch` files under `patches/` and `./scripts/apply-patches.sh` will apply them automatically.

---

## 🧪 Verification & Health Check

Access the health check endpoint:

```bash
curl http://localhost:8080/health
```

Sample response:

```json
{
  "status": "ok",
  "accessControl": {
    "restricted": true,
    "allowedUsersCount": 1
  },
  "services": {
    "awesome": "http://awesome-stats:80",
    "streak": "http://streak-stats:80",
    "topLanguage": "http://readme-stats:9000",
    "trophy": "http://trophy-stats:8080"
  }
}
```
