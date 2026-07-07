/* eslint-disable camelcase */
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import Stripe from "stripe";

import Transaction from "@/lib/database/models/transactions.model";
import User from "@/lib/database/models/user.model";
import { connectToDatabase } from "@/lib/database/mongoose";

export async function POST(request: Request) {
  const body = await request.text();

  const sig = request.headers.get("stripe-signature") as string;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event;

  try {
    event = Stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ message: "Invalid signature" }, { status: 400 });
  }

  // checkout.session.completed fires even for delayed payment methods that
  // have not settled yet; checkout.session.async_payment_succeeded fires when
  // such a payment later succeeds. Fulfill on either, but only once the
  // session is actually paid.
  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const { id, amount_total, metadata, payment_status } = event.data.object;

    if (payment_status !== "paid") {
      return NextResponse.json({ message: "Payment not settled yet" });
    }

    const buyerId = metadata?.buyerId;
    const credits = Number(metadata?.credits);

    // Metadata is set server-side when the session is created; if it is
    // missing this session was not created by this app, so acknowledge it.
    if (!buyerId || !Number.isFinite(credits) || credits <= 0) {
      return NextResponse.json({ message: "Ignored" });
    }

    await connectToDatabase();

    // The transaction record (unique stripeId) and the credit grant commit
    // atomically: a duplicate delivery aborts on the unique index before any
    // credits are added, and a failed credit update rolls back the record so
    // Stripe's retry can fulfill from scratch.
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        await Transaction.create(
          [
            {
              stripeId: id,
              amount: amount_total ? amount_total / 100 : 0,
              plan: metadata?.plan || "",
              credits,
              buyer: buyerId,
              createdAt: new Date(),
            },
          ],
          { session: dbSession }
        );

        const buyer = await User.findByIdAndUpdate(
          buyerId,
          { $inc: { creditBalance: credits } },
          { session: dbSession }
        );

        // If the buyer record doesn't exist yet (e.g. the Clerk webhook has
        // not created it), abort the transaction and fail the delivery so
        // Stripe retries — otherwise the paid credits are permanently lost.
        if (!buyer) {
          throw new Error(`Buyer ${buyerId} not found`);
        }
      });
    } catch (err) {
      if ((err as { code?: number })?.code === 11000) {
        return NextResponse.json({ message: "Already processed" });
      }
      // Fail with a 500 so Stripe retries the delivery.
      console.error("Stripe fulfillment failed:", err);
      return NextResponse.json({ message: "Fulfillment failed" }, { status: 500 });
    } finally {
      await dbSession.endSession();
    }

    return NextResponse.json({ message: "OK" });
  }

  return new Response("", { status: 200 });
}
