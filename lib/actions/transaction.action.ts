"use server";

import { redirect } from 'next/navigation'
import Stripe from "stripe";
import { auth } from "@clerk/nextjs/server";

import { plans } from "@/constants";
import { connectToDatabase } from '../database/mongoose';
import User from '../database/models/user.model';

export async function checkoutCredits(planName: string) {
  // Buyer identity comes from the Clerk session, never from the client.
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  // Price and credits come from the server-side plan list, never from the client.
  const plan = plans.find((p) => p.name === planName && p.price > 0);
  if (!plan) throw new Error("Invalid plan");

  await connectToDatabase();

  const buyer = await User.findOne({ clerkId });
  if (!buyer) throw new Error("User not found");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price_data: {
          currency: 'usd',
          unit_amount: plan.price * 100,
          product_data: {
            name: plan.name,
          }
        },
        quantity: 1
      }
    ],
    metadata: {
      plan: plan.name,
      credits: String(plan.credits),
      buyerId: buyer._id.toString(),
    },
    mode: 'payment',
    // Return to /credits, where the Checkout component reads these params
    // and shows the success/cancel toast.
    success_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/credits?success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_SERVER_URL}/credits?canceled=true`,
  })

  redirect(session.url!)
}
