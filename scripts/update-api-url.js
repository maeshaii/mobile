// mobile-wny/scripts/update-api-url.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");

(async () => {
  try {
    const { data } = await axios.get("http://127.0.0.1:4040/api/tunnels");
    const httpsTunnel = data.tunnels.find((t) => t.proto === "https");
    if (!httpsTunnel) throw new Error("No HTTPS tunnel found at :4040");

    const publicUrl = httpsTunnel.public_url.replace(/\/+$/, "");

    // path to your app.json (same level as package.json)
    const appJsonPath = path.join(__dirname, "..", "app.json");
    const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));

    appJson.expo = appJson.expo || {};
    appJson.expo.extra = appJson.expo.extra || {};
    appJson.expo.extra.API_BASE_URL = publicUrl;

    fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2));
    console.log("Updated API_BASE_URL to:", publicUrl);
  } catch (err) {
    console.error("Failed to update API_BASE_URL:", err.message);
    process.exit(1);
  }
})();
