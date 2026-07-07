'use client'

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useToast } from "@/components/ui/use-toast";
import { checkoutCredits } from "@/lib/actions/transaction.action";

import { Button } from "../ui/button";

// Shows the post-checkout toast. Rendered once on the credits page (the
// Stripe success/cancel URLs point back at /credits) — kept separate from
// the Checkout button, which is rendered once per plan.
export const CheckoutStatus = () => {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success")) {
      toast({
        title: "Order placed!",
        description: "Your credits will be added to your account shortly",
        duration: 5000,
        className: "success-toast",
      });
    }

    if (searchParams.get("canceled")) {
      toast({
        title: "Order canceled!",
        description: "Continue to shop around and checkout when you're ready",
        duration: 5000,
        className: "error-toast",
      });
    }

    // Strip the status params so a refresh doesn't repeat the toast.
    if (searchParams.get("success") || searchParams.get("canceled")) {
      router.replace("/credits", { scroll: false });
    }
  }, [toast, router, searchParams]);

  return null;
};

// Only the plan name is sent to the server; price, credits and buyer are
// resolved server-side in checkoutCredits so they cannot be tampered with.
// Stripe.js is not needed here: the Server Action redirects straight to the
// Stripe-hosted Checkout page.
const Checkout = ({ plan }: { plan: string }) => {
  const onCheckout = async () => {
    await checkoutCredits(plan);
  };

  return (
    <form action={onCheckout}>
      <section>
        <Button
          type="submit"
          role="link"
          className="w-full rounded-full  bg-white text-black hover:bg-slate-200 bg-cover"
        >
          Buy Credit
        </Button>
      </section>
    </form>
  );
};

export default Checkout;
