// NOTE: deliberately NOT a "use server" module. These helpers are only called
// from server code (the Clerk webhook route and Server Components). Marking
// them as Server Actions would expose create/update/delete of arbitrary users
// as public endpoints. Credit mutations live in credits.action.ts (deduction)
// and the Stripe webhook route (addition).

import { revalidatePath } from "next/cache";
import { currentUser } from "@clerk/nextjs/server";

import User from "../database/models/user.model";
import { connectToDatabase } from "../database/mongoose";
import { handleError } from "../utils";

// Clerk allows accounts without a username; the schema requires a unique one.
// Derive a stable fallback from the email plus a clerkId suffix so retried
// webhook deliveries produce the same value and collisions are unlikely.
export function deriveUsername(
  username: string | null | undefined,
  email: string,
  clerkId: string
) {
  if (username) return username;
  const prefix = email.split("@")[0] || "user";
  return `${prefix}-${clerkId.slice(-8)}`;
}

// CREATE
// Idempotent: a duplicate webhook delivery (or a race with getOrCreateUser)
// returns the existing record instead of failing on the unique index.
export async function createUser(user: CreateUserParams) {
  try {
    await connectToDatabase();

    const newUser = await User.findOneAndUpdate(
      { clerkId: user.clerkId },
      { $setOnInsert: user },
      { upsert: true, new: true }
    );

    return JSON.parse(JSON.stringify(newUser));
  } catch (error) {
    handleError(error);
  }
}

// GET OR CREATE
// Ensures a user record exists on first authenticated access instead of
// relying entirely on the asynchronous Clerk webhook having run already.
export async function getOrCreateUser(clerkId: string) {
  try {
    await connectToDatabase();

    const existing = await User.findOne({ clerkId });
    if (existing) return JSON.parse(JSON.stringify(existing));

    const clerkUser = await currentUser();
    if (!clerkUser || clerkUser.id !== clerkId) {
      throw new Error("User not found");
    }

    const email = clerkUser.emailAddresses[0]?.emailAddress;
    if (!email) throw new Error("User has no email address");

    const created = await User.findOneAndUpdate(
      { clerkId },
      {
        $setOnInsert: {
          clerkId,
          email,
          username: deriveUsername(clerkUser.username, email, clerkId),
          firstName: clerkUser.firstName ?? undefined,
          lastName: clerkUser.lastName ?? undefined,
          photo: clerkUser.imageUrl,
        },
      },
      { upsert: true, new: true }
    );

    return JSON.parse(JSON.stringify(created));
  } catch (error) {
    handleError(error);
  }
}

// READ
export async function getUserById(userId: string) {
  try {
    await connectToDatabase();

    const user = await User.findOne({ clerkId: userId });

    if (!user) throw new Error("User not found");

    return JSON.parse(JSON.stringify(user));
  } catch (error) {
    handleError(error);
  }
}

// UPDATE
export async function updateUser(clerkId: string, user: UpdateUserParams) {
  try {
    await connectToDatabase();

    const updatedUser = await User.findOneAndUpdate({ clerkId }, user, {
      new: true,
    });

    if (!updatedUser) throw new Error("User update failed");

    return JSON.parse(JSON.stringify(updatedUser));
  } catch (error) {
    handleError(error);
  }
}

// DELETE
export async function deleteUser(clerkId: string) {
  try {
    await connectToDatabase();

    // Find user to delete
    const userToDelete = await User.findOne({ clerkId });

    if (!userToDelete) {
      throw new Error("User not found");
    }

    // Delete user
    const deletedUser = await User.findByIdAndDelete(userToDelete._id);
    revalidatePath("/");

    return deletedUser ? JSON.parse(JSON.stringify(deletedUser)) : null;
  } catch (error) {
    handleError(error);
  }
}
