/**
 * Generates an SVG card displaying access restriction or error messages.
 * Designed to look clean on dark or light GitHub profile themes.
 *
 * @param {string} title - Error title
 * @param {string} message - Error details or allowed users info
 * @returns {string} SVG string
 */
export function renderErrorSvg(title, message) {
  const safeTitle = escapeXml(title);
  const safeMessage = escapeXml(message);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="125" viewBox="0 0 495 125" fill="none">
    <style>
      .header {
        font: 600 16px 'Segoe UI', Ubuntu, Sans-Serif;
        fill: #ff453a;
        animation: fadeIn 0.8s ease-in-out;
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
      <text x="32" y="16" class="header">${safeTitle}</text>
      <text x="0" y="55" class="message">${safeMessage}</text>
      <text x="0" y="75" class="message">Configure ALLOWED_USERNAMES in your SelfStats .env file.</text>
    </g>
  </svg>`;
}

function escapeXml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
