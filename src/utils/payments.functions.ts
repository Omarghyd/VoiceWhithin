import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  type StripeEnv,
  createStripeClient,
  getStripeErrorMessage,
} from "@/lib/stripe.server";
import {
  isStripeSubscriptionActive,
  resolveOrCreateCustomer,
  upsertSubscriptionFromStripe,
} from "./payments.server";

type CheckoutResult = { clientSecret: string } | { error: string };
type PortalResult = { url: string } | { error: string };
type CheckoutConfirmationResult =
  | { status: "active" }
  | { status: "pending" }
  | { error: string };

export const createCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    priceId: string;
    returnUrl: string;
    environment: StripeEnv;
  }) => {
    if (!/^[a-zA-Z0-9_-]+$/.test(data.priceId)) throw new Error("Invalid priceId");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    try {
      const { userId, supabase } = context;
      const { data: userData } = await supabase.auth.getUser();
      const email = userData.user?.email;

      const { data: activeSubscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("environment", data.environment)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (activeSubscription) return { error: "Your subscription is already active." };

      const stripe = createStripeClient(data.environment);
      const prices = await stripe.prices.list({ lookup_keys: [data.priceId] });
      if (!prices.data.length) throw new Error("Price not found");
      const stripePrice = prices.data[0];
      const isRecurring = stripePrice.type === "recurring";

      const customerId = await resolveOrCreateCustomer(stripe, { email, userId });

      // Free 3-day trial for first-time subscribers only. If this customer has
      // ever had a subscription (any status), skip the trial so refunds / churn
      // / re-subscribes can't be gamed for repeat free periods.
      let offerTrial = false;
      if (isRecurring) {
        const prior = await stripe.subscriptions.list({
          customer: customerId,
          status: "all",
          limit: 1,
        });
        offerTrial = prior.data.length === 0;
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [{ price: stripePrice.id, quantity: 1 }],
        mode: isRecurring ? "subscription" : "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer: customerId,
        metadata: { userId },
        ...(isRecurring && {
          subscription_data: {
            metadata: { userId },
            ...(offerTrial && { trial_period_days: 3 }),
          },
        }),
        managed_payments: { enabled: true },
      } as any);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const confirmCheckoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { sessionId: string; environment: StripeEnv }) => {
    if (!/^cs_[a-zA-Z0-9_]+$/.test(data.sessionId)) throw new Error("Invalid checkout session");
    return data;
  })
  .handler(async ({ data, context }): Promise<CheckoutConfirmationResult> => {
    try {
      const stripe = createStripeClient(data.environment);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId, {
        expand: ["subscription", "subscription.items.data.price"],
      });

      const sessionUserId = session.metadata?.userId;
      if (sessionUserId && sessionUserId !== context.userId) {
        return { error: "This checkout belongs to another account." };
      }

      if (!session.subscription) return { status: "pending" };

      const subscription =
        typeof session.subscription === "string"
          ? await stripe.subscriptions.retrieve(session.subscription, {
              expand: ["items.data.price"],
            })
          : session.subscription;

      const subscriptionUserId = subscription.metadata?.userId;
      if (subscriptionUserId && subscriptionUserId !== context.userId) {
        return { error: "This subscription belongs to another account." };
      }

      await upsertSubscriptionFromStripe(subscription, data.environment, context.userId);

      return isStripeSubscriptionActive(subscription) ? { status: "active" } : { status: "pending" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { returnUrl?: string; environment: StripeEnv }) => data)
  .handler(async ({ data, context }): Promise<PortalResult> => {
    const { supabase, userId } = context;
    const { data: sub, error: subError } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .eq("environment", data.environment)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subError || !sub?.stripe_customer_id) {
      return { error: "No subscription found" };
    }

    try {
      const stripe = createStripeClient(data.environment);
      const portal = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id as string,
        ...(data.returnUrl && { return_url: data.returnUrl }),
      });
      return { url: portal.url };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });