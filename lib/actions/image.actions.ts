"use server";

import { revalidatePath } from "next/cache";
import { connectToDatabase } from "../database/mongoose";
import { handleError } from "../utils";
import User from "../database/models/user.model";
import Image from "../database/models/image.model";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { v2 as cloudinary } from "cloudinary";

import { creditFee, transformationTypes } from "@/constants";

// Server Actions are public endpoints, so every payload is validated here
// regardless of what the client-side form enforces. Unknown keys (e.g. an
// injected `author`) are stripped by zod.
const imagePayloadSchema = z.object({
  title: z.string().trim().min(1).max(200),
  publicId: z.string().min(1).max(300),
  transformationType: z.enum(
    Object.keys(transformationTypes) as [string, ...string[]]
  ),
  width: z.number().positive().max(20000).optional(),
  height: z.number().positive().max(20000).optional(),
  config: z.record(z.string(), z.unknown()).nullish(),
  secureURL: z.string().url().startsWith("https://").max(2000),
  transformationUrl: z.string().url().startsWith("https://").max(2000).optional(),
  aspectRatio: z.string().max(20).optional(),
  prompt: z.string().max(500).optional(),
  color: z.string().max(100).optional(),
});

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid id");

const revalidationPathSchema = z
  .string()
  .regex(/^\/[A-Za-z0-9/_-]*$/, "Invalid path");

// Resolves the currently authenticated user from the Clerk session.
// Client-supplied user IDs are never trusted for writes.
async function requireAuthenticatedUser() {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  await connectToDatabase();

  const user = await User.findOne({ clerkId });
  if (!user) throw new Error("User not found");

  return user;
}

// ADD IMAGE
// The userId field in AddImageParams is ignored; the author is always the
// authenticated user.
//
// Credits are defined as "saved transformations", so the credit is charged
// here — atomically and server-side — rather than trusting the client to
// call a separate deduction endpoint.
export async function addImage({ image, path }: AddImageParams) {
  try {
    const parsedImage = imagePayloadSchema.parse(image);
    const parsedPath = revalidationPathSchema.parse(path);

    const author = await requireAuthenticatedUser();

    // Balance check + decrement in one conditional update so concurrent
    // saves cannot drive the balance below zero.
    const cost = Math.abs(creditFee);
    const payer = await User.findOneAndUpdate(
      { _id: author._id, creditBalance: { $gte: cost } },
      { $inc: { creditBalance: -cost } }
    );

    if (!payer) throw new Error("Insufficient credits");

    let newImage;
    try {
      newImage = await Image.create({
        ...parsedImage,
        author: author._id,
      });
    } catch (createError) {
      // The save failed after the charge — refund the credit.
      await User.findByIdAndUpdate(author._id, {
        $inc: { creditBalance: cost },
      });
      throw createError;
    }

    revalidatePath(parsedPath);

    return JSON.parse(JSON.stringify(newImage));
  } catch (error) {
    handleError(error)
  }
}

// UPDATE IMAGE
// Only the owning user may update, and the author field cannot be reassigned.
export async function updateImage({ image, path }: UpdateImageParams) {
  try {
    const imageId = objectIdSchema.parse(image._id);
    const parsedImage = imagePayloadSchema.parse(image);
    const parsedPath = revalidationPathSchema.parse(path);

    const user = await requireAuthenticatedUser();

    const imageToUpdate = await Image.findById(imageId);

    if (!imageToUpdate || String(imageToUpdate.author) !== String(user._id)) {
      throw new Error("Unauthorized or image not found");
    }

    const updatedImage = await Image.findByIdAndUpdate(
      imageToUpdate._id,
      { ...parsedImage, author: imageToUpdate.author },
      { new: true }
    )

    revalidatePath(parsedPath);

    return JSON.parse(JSON.stringify(updatedImage));
  } catch (error) {
    handleError(error)
  }
}

// DELETE IMAGE
// Only the owning user may delete.
export async function deleteImage(imageId: string) {
  try {
    const parsedImageId = objectIdSchema.parse(imageId);

    const user = await requireAuthenticatedUser();

    const imageToDelete = await Image.findById(parsedImageId);

    if (!imageToDelete || String(imageToDelete.author) !== String(user._id)) {
      throw new Error("Unauthorized or image not found");
    }

    await Image.findByIdAndDelete(imageToDelete._id);

    // Remove the underlying Cloudinary asset so deleted images don't keep
    // accumulating storage. Best-effort: the database record is already gone,
    // so a Cloudinary failure only leaves an orphaned asset behind.
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (cloudName && apiKey && apiSecret && imageToDelete.publicId) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });

      try {
        await cloudinary.uploader.destroy(imageToDelete.publicId, {
          invalidate: true,
        });
      } catch (cloudinaryError) {
        console.error("Failed to delete Cloudinary asset:", cloudinaryError);
      }
    }
  } catch (error) {
    handleError(error)
  }

  // Reached only when the delete succeeded; handleError rethrows otherwise.
  redirect('/')
}
