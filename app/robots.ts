import type { MetadataRoute } from "next";

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/profile", "/credits"],
    },
    sitemap: `${serverUrl}/sitemap.xml`,
  };
}
