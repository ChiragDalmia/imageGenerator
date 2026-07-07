import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructEventMock, transactionCreateMock, userUpdateMock, withTransactionMock } =
  vi.hoisted(() => ({
    constructEventMock: vi.fn(),
    transactionCreateMock: vi.fn(),
    userUpdateMock: vi.fn(),
    withTransactionMock: vi.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
  }));

vi.mock("stripe", () => ({
  default: { webhooks: { constructEvent: constructEventMock } },
}));
vi.mock("mongoose", () => ({
  default: {
    startSession: vi.fn(async () => ({
      withTransaction: withTransactionMock,
      endSession: vi.fn(),
    })),
  },
}));
vi.mock("@/lib/database/mongoose", () => ({ connectToDatabase: vi.fn() }));
vi.mock("@/lib/database/models/transactions.model", () => ({
  default: { create: transactionCreateMock },
}));
vi.mock("@/lib/database/models/user.model", () => ({
  default: { findByIdAndUpdate: userUpdateMock },
}));

import { POST } from "@/app/api/webhooks/stripe/route";

const makeRequest = () =>
  new Request("http://localhost/api/webhooks/stripe", {
    method: "POST",
    body: "raw-payload",
    headers: { "stripe-signature": "sig_test" },
  });

const sessionEvent = (
  type = "checkout.session.completed",
  overrides: Record<string, unknown> = {}
) => ({
  type,
  data: {
    object: {
      id: "cs_test_1",
      amount_total: 4000,
      payment_status: "paid",
      metadata: {
        plan: "Pro Package",
        credits: "120",
        buyerId: "mongo_user_1",
      },
      ...overrides,
    },
  },
});

describe("Stripe webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
    transactionCreateMock.mockResolvedValue([{}]);
    userUpdateMock.mockResolvedValue({});
  });

  it("returns 400 and adds no credits when the signature is invalid", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("Invalid signature");
    });

    const res = await POST(makeRequest());

    expect(res.status).toBe(400);
    expect(transactionCreateMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("adds credits for a verified, paid checkout.session.completed event", async () => {
    constructEventMock.mockReturnValue(sessionEvent());

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(transactionCreateMock).toHaveBeenCalledWith(
      [expect.objectContaining({ stripeId: "cs_test_1", credits: 120, buyer: "mongo_user_1" })],
      expect.objectContaining({ session: expect.anything() })
    );
    expect(userUpdateMock).toHaveBeenCalledWith(
      "mongo_user_1",
      { $inc: { creditBalance: 120 } },
      expect.objectContaining({ session: expect.anything() })
    );
  });

  it("does not grant credits while the payment is not settled", async () => {
    constructEventMock.mockReturnValue(
      sessionEvent("checkout.session.completed", { payment_status: "unpaid" })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(transactionCreateMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("grants credits when a delayed payment later succeeds", async () => {
    constructEventMock.mockReturnValue(
      sessionEvent("checkout.session.async_payment_succeeded")
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(userUpdateMock).toHaveBeenCalledWith(
      "mongo_user_1",
      { $inc: { creditBalance: 120 } },
      expect.anything()
    );
  });

  it("does not double-add credits on duplicate event delivery", async () => {
    constructEventMock.mockReturnValue(sessionEvent());
    transactionCreateMock.mockRejectedValue(
      Object.assign(new Error("duplicate key"), { code: 11000 })
    );

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 500 (→ Stripe retry) when the credit grant fails inside the transaction", async () => {
    constructEventMock.mockReturnValue(sessionEvent());
    userUpdateMock.mockRejectedValue(new Error("db unavailable"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
    // Both writes ran inside withTransaction, so the transaction record is
    // rolled back with the failed credit grant and the retry starts clean.
    expect(withTransactionMock).toHaveBeenCalledTimes(1);
  });

  it("returns 500 (→ Stripe retry) when the buyer does not exist yet", async () => {
    constructEventMock.mockReturnValue(sessionEvent());
    // findByIdAndUpdate resolves null when no user matches buyerId — e.g. the
    // Clerk webhook has not created the record yet. The paid credits must not
    // be silently dropped.
    userUpdateMock.mockResolvedValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
  });

  it("ignores completed sessions without server-set metadata", async () => {
    constructEventMock.mockReturnValue(sessionEvent("checkout.session.completed", { metadata: {} }));

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(transactionCreateMock).not.toHaveBeenCalled();
    expect(userUpdateMock).not.toHaveBeenCalled();
  });

  it("returns 200 for other verified event types", async () => {
    constructEventMock.mockReturnValue({ type: "charge.refunded", data: { object: {} } });

    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    expect(userUpdateMock).not.toHaveBeenCalled();
  });
});
