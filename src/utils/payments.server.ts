import type Stripe from "stripe";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { StripeEnv } from "@/lib/stripe.server";

export async function resolveOrCreateCustomer(
  stripe: Stripe,
  options: { email?: string; userId: string },
): Promise<string> {
  if (!/^[a-zA-Z0-9_-]+$/.test(options.userId)) throw new Error("Invalid userId");

  const bySub = await stripe.customers.search({
    query: `metadata['userId']:'${options.userId}'`,
    limit: 1,
  });
  if (bySub.data.length) return bySub.data[0].id;

  if (options.email) {
    const list = await stripe.customers.list({ email: options.email, limit: 1 });
    if (list.data.length) {
      const c = list.data[0];
      if (c.metadata?.userId !== options.userId) {
        await stripe.customers.update(c.id, {
          metadata: { ...c.metadata, userId: options.userId },
        });
      }
      return c.id;
    }
  }

  const created = await stripe.customers.create({
    ...(options.email && { email: options.email }),
    metadata: { userId: options.userId },
  });
  return created.id;
}

export function isStripeSubscriptionActive(subscription: Stripe.Subscription): boolean {
  const periodEnd = getPeriodEnd(subscription);
  const endOk = !periodEnd || periodEnd * 1000 > Date.now();
  if (["active", "trialing", "past_due"].includes(subscription.status) && endOk) return true;
  return subscription.status === "canceled" && Boolean(periodEnd && periodEnd * 1000 > Date.now());
}

export async function upsertSubscriptionFromStripe(
  subscription: Stripe.Subscription,
  environment: StripeEnv,
  fallbackUserId?: string,
): Promise<void> {
  const userId = subscription.metadata?.userId || fallbackUserId;
  if (!userId) throw new Error("Subscription is missing a user link");

  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const product = price?.product;
  const productId = typeof product === "string" ? product : product?.id;
  const rawSubscription = subscription as Stripe.Subscription & {
    current_period_start?: number | null;
    current_period_end?: number | null;
  };
  const periodStart = item?.current_period_start ?? rawSubscription.current_period_start;
  const periodEnd = getPeriodEnd(subscription);
  const priceId = price?.lookup_key || price?.metadata?.lovable_external_id || price?.id;

  if (!priceId || !productId) throw new Error("Subscription is missing price details");

  const { error } = await supabaseAdmin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id:
        typeof subscription.customer === "string" ? subscription.customer : subscription.customer.id,
      product_id: productId,
      price_id: priceId,
      status: subscription.status,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      environment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "stripe_subscription_id" },
  );

  if (error) throw error;
}

function getPeriodEnd(subscription: Stripe.Subscription): number | null {
  const rawSubscription = subscription as Stripe.Subscription & {
    current_period_end?: number | null;
  };
  const itemEnd = subscription.items?.data?.[0]?.current_period_end;
  return itemEnd ?? rawSubscription.current_period_end ?? null;
}