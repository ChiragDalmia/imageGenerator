import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, notFoundMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  redirectMock: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  }),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("next/navigation", () => ({ notFound: notFoundMock, redirect: redirectMock }));
vi.mock("@/lib/actions/user.action", () => ({
  getOrCreateUser: vi.fn().mockResolvedValue({ _id: "user_1", creditBalance: 10 }),
}));
vi.mock("@/components/shared/Header", () => ({ default: () => null }));
vi.mock("@/components/shared/TransformationForm", () => ({ default: () => null }));

import AddTransformationTypePage from "@/app/(root)/transformations/add/[type]/page";

const props = (type: string) =>
  ({
    params: Promise.resolve({ id: "unused", type }),
    searchParams: Promise.resolve({}),
  }) as unknown as Parameters<typeof AddTransformationTypePage>[0];

describe("transformations/add/[type] page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: "clerk_abc" });
  });

  it("calls notFound() for an invalid transformation type", async () => {
    await expect(AddTransformationTypePage(props("not-a-real-type"))).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
    expect(notFoundMock).toHaveBeenCalled();
  });

  it("does not treat inherited object properties as valid types", async () => {
    await expect(AddTransformationTypePage(props("constructor"))).rejects.toThrow(
      "NEXT_NOT_FOUND"
    );
  });

  it("renders for a valid transformation type", async () => {
    const result = await AddTransformationTypePage(props("restore"));

    expect(notFoundMock).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });

  it("redirects unauthenticated users to sign-in", async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(AddTransformationTypePage(props("restore"))).rejects.toThrow(
      "NEXT_REDIRECT:/sign-in"
    );
  });
});
