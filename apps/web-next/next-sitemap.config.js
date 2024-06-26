/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: process.env.URL_PREFIX || "https://peated.com",
  generateRobotsTxt: true, // (optional)
  robotsTxtOptions: {
    policies: [
      { userAgent: "SemrushBot", disallow: "/" },
      { userAgent: "GPTBot", disallow: "/" },
      { userAgent: "PerplexityBot", disallow: "/" },

      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/_health",
          "/admin",
          "/settings",
          "/flights",
          "/friends",
          "/addBottle",
          "/addEntity",
          "/addFlight",
        ],
      },
    ],
  },
  // ...other options
};
