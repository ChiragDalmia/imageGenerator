import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, sessionsCreateMock, findOneMock, redirectMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  sessionsCreateMock: vi.fn(),
  findOneMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({ auth: authMock }));
vi.mock("stripe", () => ({
  default: vi.fn(function (this: Record<string, unknown>) {
    this.checkout = { sessions: { create: sessionsCreateMock } };
  }),
}));
vi.mock("@/lib/database/mongoose", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/database/models/user.model", () => ({
  default: { findOne: findOneMock },
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { checkoutCredits } from "@/lib/actions/transaction.action";

describe("checkoutCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    process.env.NEXT_PUBLIC_SERVER_URL = "https://example.com";
    authMock.mockResolvedValue({ userId: "clerk_abc" });
    findOneMock.mockResolvedValue({ _id: { toString: () => "mongo_user_1" } });
    sessionsCreateMock.mockResolvedValue({ url: "https://checkout.stripe.test/s" });
  });

  it("rejects unauthenticated callers", async () => {
    authMock.mockResolvedValue({ userId: null });

    await expect(checkoutCredits("Pro Package")).rejects.toThrow("Unauthorized");
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("rejects unknown plans", async () => {
    await expect(checkoutCredits("Mega Discount Plan")).rejects.toThrow("Invalid plan");
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("rejects the free plan", async () => {
    await expect(checkoutCredits("Free")).rejects.toThrow("Invalid plan");
    expect(sessionsCreateMock).not.toHaveBeenCalled();
  });

  it("uses server-side price, credits and buyer — never client values", async () => {
    // The action only accepts a plan name, so a malicious client cannot pass
    // amount/credits/buyerId at all. Verify server-derived values are used.
    await checkoutCredits("Pro Package");

    expect(sessionsCreateMock).toHaveBeenCalledTimes(1);
    const sessionArgs = sessionsCreateMock.mock.calls[0][0];

    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(4000);
    expect(sessionArgs.metadata).toEqual({
      plan: "Pro Package",
      credits: "120",
      buyerId: "mongo_user_1",
    });
    expect(sessionArgs.mode).toBe("payment");
    expect(redirectMock).toHaveBeenCalledWith("https://checkout.stripe.test/s");
  });

  it("derives the buyer from the Clerk session", async () => {
    await checkoutCredits("Premium Package");

    expect(findOneMock).toHaveBeenCalledWith({ clerkId: "clerk_abc" });
    const sessionArgs = sessionsCreateMock.mock.calls[0][0];
    expect(sessionArgs.metadata.buyerId).toBe("mongo_user_1");
    expect(sessionArgs.line_items[0].price_data.unit_amount).toBe(19900);
    expect(sessionArgs.metadata.credits).toBe("2000");
  });
});
