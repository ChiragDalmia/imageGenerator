// NOTE: deliberately NOT a "use server" module. These read helpers are only
// called from Server Components; keeping them out of the Server Action module
// means they are not registered as public POST endpoints.

import { connectToDatabase } from "../database/mongoose";
import { handleError } from "../utils";
import User from "../database/models/user.model";
import Image from "../database/models/image.model";

import { v2 as cloudinary } from 'cloudinary'

// clerkId is deliberately not selected: these results are serialized and
// passed into Client Components, and Clerk IDs should stay server-side.
const populateUser = (query: any) => query.populate({
  path: 'author',
  model: User,
  select: '_id firstName lastName'
})

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

// These values come straight from URL params, so clamp them before they reach
// skip()/limit() — negative or huge values would otherwise hit the database.
const clampPage = (page: unknown) => {
  const n = Math.trunc(Number(page));
  return Number.isFinite(n) && n > 0 ? n : 1;
};
const clampLimit = (limit: unknown) => {
  const n = Math.trunc(Number(limit));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : 9;
};

// GET IMAGE
// Returns null when the image doesn't exist so callers can render a 404
// instead of a generic error page. Database failures still throw.
export async function getImageById(imageId: string) {
  try {
    await connectToDatabase();

    if (!OBJECT_ID_REGEX.test(imageId)) return null;

    const image = await populateUser(Image.findById(imageId));

    if (!image) return null;

    return JSON.parse(JSON.stringify(image));
  } catch (error) {
    handleError(error)
  }
}

// GET IMAGES
export async function getAllImages({ limit = 9, page = 1, searchQuery = '' }: {
  limit?: number;
  page: number;
  searchQuery?: string;
}) {
  try {
    await connectToDatabase();

    let query = {};

    // The search string is user input headed for a Cloudinary search
    // expression; strip expression metacharacters (:, =, ", parentheses,
    // AND/OR operators only match as bare words which the quoting below
    // neutralizes) so it can only ever be a term, never extra clauses.
    const sanitizedSearch = searchQuery
      .replace(/[^\w\s-]/g, " ")
      .trim()
      .slice(0, 100);

    if (sanitizedSearch) {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const apiKey = process.env.CLOUDINARY_API_KEY;
      const apiSecret = process.env.CLOUDINARY_API_SECRET;

      if (cloudName && apiKey && apiSecret) {
        cloudinary.config({
          cloud_name: cloudName,
          api_key: apiKey,
          api_secret: apiSecret,
          secure: true,
        });

        const { resources } = await cloudinary.search
          .expression(`folder=photosynth-ai AND "${sanitizedSearch}"`)
          .execute();

        const resourceIds = resources.map((resource: { public_id: string }) => resource.public_id);

        query = {
          publicId: {
            $in: resourceIds
          }
        }
      } else {
        const escapedSearchQuery = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        query = {
          title: {
            $regex: escapedSearchQuery,
            $options: "i",
          },
        };
      }
    }

    const safeLimit = clampLimit(limit);
    const skipAmount = (clampPage(page) - 1) * safeLimit;

    const images = await populateUser(Image.find(query))
      .sort({ updatedAt: -1 })
      .skip(skipAmount)
      .limit(safeLimit);

    const totalImages = await Image.find(query).countDocuments();
    const savedImages = await Image.find().countDocuments();

    return {
      data: JSON.parse(JSON.stringify(images)),
      totalPage: Math.ceil(totalImages / safeLimit),
      savedImages,
    }
  } catch (error) {
    handleError(error)
  }
}

// GET IMAGES BY USER
export async function getUserImages({
  limit = 9,
  page = 1,
  userId,
}: {
  limit?: number;
  page: number;
  userId: string;
}) {
  try {
    await connectToDatabase();

    const safeLimit = clampLimit(limit);
    const skipAmount = (clampPage(page) - 1) * safeLimit;

    const images = await populateUser(Image.find({ author: userId }))
      .sort({ updatedAt: -1 })
      .skip(skipAmount)
      .limit(safeLimit);

    const totalImages = await Image.find({ author: userId }).countDocuments();

    return {
      data: JSON.parse(JSON.stringify(images)),
      totalPages: Math.ceil(totalImages / safeLimit),
    };
  } catch (error) {
    handleError(error);
  }
}
