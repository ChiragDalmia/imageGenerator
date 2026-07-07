import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  authMock,
  userFindOneMock,
  userFindOneAndUpdateMock,
  userFindByIdAndUpdateMock,
  imageModelMock,
  redirectMock,
} = vi.hoisted(() => ({
  authMock: vi.fn(),
  userFindOneMock: vi.fn(),
  userFindOneAndUpdateMock: vi.fn(),
  userFindByIdAndUpdateMock: vi.fn(),
  imageModelMock: {
    findById: vi.fn(),
    findByIdAndDelete: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    create: vi.fn(),
  },
  redirectMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("@/lib/database/mongoose", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/database/models/user.model", () => ({
  default: {
    findOne: userFindOneMock,
    findOneAndUpdate: userFindOneAndUpdateMock,
    findByIdAndUpdate: userFindByIdAndUpdateMock,
  },
}));
vi.mock("@/lib/database/models/image.model", () => ({ default: imageModelMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { addImage, deleteImage, updateImage } from "@/lib/actions/image.actions";

const IMAGE_ID = "64a000000000000000000001";

const imageData = {
  title: "t",
  publicId: "p",
  transformationType: "restore",
  width: 100,
  height: 100,
  config: {},
  secureURL: "https://res.cloudinary.com/demo/y.png",
  transformationUrl: "https://res.cloudinary.com/demo/z.png",
  aspectRatio: undefined,
  prompt: undefined,
  color: undefined,
};

describe("image action authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "clerk_owner" });
    userFindOneMock.mockResolvedValue({ _id: "user_authenticated" });
    // Default: the credit deduction in addImage succeeds.
    userFindOneAndUpdateMock.mockResolvedValue({ _id: "user_authenticated" });
  });

  it("deleteImage refuses when the caller does not own the image", async () => {
    imageModelMock.findById.mockResolvedValue({ _id: IMAGE_ID, author: "someone_else" });

    await expect(deleteImage(IMAGE_ID)).rejects.toThrow();
    expect(imageModelMock.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("deleteImage refuses unauthenticated callers", async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(deleteImage(IMAGE_ID)).rejects.toThrow();
    expect(imageModelMock.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("deleteImage rejects malformed image ids before touching the database", async () => {
    await expect(deleteImage("not-an-object-id")).rejects.toThrow();
    expect(imageModelMock.findById).not.toHaveBeenCalled();
    expect(imageModelMock.findByIdAndDelete).not.toHaveBeenCalled();
  });

  it("deleteImage deletes when the caller owns the image", async () => {
    imageModelMock.findById.mockResolvedValue({ _id: IMAGE_ID, author: "user_authenticated" });
    imageModelMock.findByIdAndDelete.mockResolvedValue({});

    await deleteImage(IMAGE_ID);

    expect(imageModelMock.findByIdAndDelete).toHaveBeenCalledWith(IMAGE_ID);
    expect(redirectMock).toHaveBeenCalledWith("/");
  });

  it("updateImage refuses when the caller does not own the image", async () => {
    imageModelMock.findById.mockResolvedValue({ _id: IMAGE_ID, author: "someone_else" });

    await expect(
      updateImage({ image: { ...imageData, _id: IMAGE_ID }, userId: "user_authenticated", path: "/" })
    ).rejects.toThrow();
    expect(imageModelMock.findByIdAndUpdate).not.toHaveBeenCalled();
  });

  it("updateImage cannot reassign the image author", async () => {
    imageModelMock.findById.mockResolvedValue({ _id: IMAGE_ID, author: "user_authenticated" });
    imageModelMock.findByIdAndUpdate.mockResolvedValue({ _id: IMAGE_ID });

    await updateImage({
      image: { ...imageData, _id: IMAGE_ID, author: "attacker" } as never,
      userId: "user_authenticated",
      path: "/",
    });

    const updatePayload = imageModelMock.findByIdAndUpdate.mock.calls[0][1];
    expect(updatePayload.author).toBe("user_authenticated");
  });

  it("addImage uses the authenticated user as author, ignoring client userId", async () => {
    imageModelMock.create.mockResolvedValue({ _id: IMAGE_ID });

    await addImage({ image: imageData, userId: "attacker_supplied_id", path: "/" });

    expect(imageModelMock.create).toHaveBeenCalledWith(
      expect.objectContaining({ author: "user_authenticated" })
    );
  });

  it("addImage rejects payloads that fail schema validation", async () => {
    await expect(
      addImage({
        image: { ...imageData, transformationType: "not-a-real-type", secureURL: "javascript:alert(1)" },
        userId: "user_authenticated",
        path: "/",
      })
    ).rejects.toThrow();
    expect(imageModelMock.create).not.toHaveBeenCalled();
  });

  it("addImage rejects malformed revalidation paths", async () => {
    await expect(
      addImage({ image: imageData, userId: "user_authenticated", path: "https://evil.example/x" })
    ).rejects.toThrow();
    expect(imageModelMock.create).not.toHaveBeenCalled();
  });

  it("addImage charges one credit atomically before saving", async () => {
    imageModelMock.create.mockResolvedValue({ _id: IMAGE_ID });

    await addImage({ image: imageData, userId: "user_authenticated", path: "/" });

    // Balance check + decrement in one conditional update: a user below the
    // cost never matches, so concurrent saves cannot go negative.
    expect(userFindOneAndUpdateMock).toHaveBeenCalledWith(
      { _id: "user_authenticated", creditBalance: { $gte: 1 } },
      { $inc: { creditBalance: -1 } }
    );
  });

  it("addImage refuses to save when credits are insufficient", async () => {
    userFindOneAndUpdateMock.mockResolvedValue(null);

    await expect(
      addImage({ image: imageData, userId: "user_authenticated", path: "/" })
    ).rejects.toThrow(/Insufficient credits/);
    expect(imageModelMock.create).not.toHaveBeenCalled();
  });

  it("addImage refunds the credit when the save fails", async () => {
    imageModelMock.create.mockRejectedValue(new Error("db unavailable"));

    await expect(
      addImage({ image: imageData, userId: "user_authenticated", path: "/" })
    ).rejects.toThrow();
    expect(userFindByIdAndUpdateMock).toHaveBeenCalledWith("user_authenticated", {
      $inc: { creditBalance: 1 },
    });
  });
});
