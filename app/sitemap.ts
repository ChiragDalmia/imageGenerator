import type { MetadataRoute } from "next";

import { transformationTypes } from "@/constants";

const serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: serverUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    ...Object.keys(transformationTypes).map((type) => ({
      url: `${serverUrl}/transformations/add/${type}`,
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
