const app = require("./app.json");

// Build-time public configuration. The value is intentionally supplied by the
// build environment and is never committed to this repository.
module.exports = {
  expo: {
    ...app.expo,
    extra: {
      ...(app.expo.extra || {}),
      tmdbAccessToken: process.env.EXPO_PUBLIC_TMDB_ACCESS_TOKEN || "",
    },
  },
};
