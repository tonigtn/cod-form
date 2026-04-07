import { useState } from "react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  ProgressBar,
  Badge,
  Divider,
} from "@shopify/polaris";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../api/client";
import { useStore } from "../context/StoreContext";
import { OwnerStoreSelector } from "../components/StoreSelector";

interface Plan {
  key: string;
  name: string;
  price: number;
  order_limit: number;
  trial_days?: number;
  features: string[];
}

interface Usage {
  plan: string;
  plan_name: string;
  orders_used: number;
  order_limit: number;
  has_subscription: boolean;
  features: string[];
}

const FEATURE_LABELS: Record<string, string> = {
  basic_form: "Basic COD order form",
  basic_config: "Basic configuration",
  upsells: "Post-purchase upsells",
  bumps: "Order bumps",
  multi_product_cart: "Multi-product cart",
  quantity_offers: "Quantity-based offers",
  discount_codes: "Discount code validation",
  analytics: "Analytics dashboard",
  auto_discounts: "Automatic discounts",
  downsell: "Exit-intent downsell",
  otp: "OTP phone verification",
  priority_support: "Priority support",
};

export function Billing() {
  const { storeId } = useStore();
  const [subscribing, setSubscribing] = useState<string | null>(null);

  const { data: plansData } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: () => apiFetch<{ plans: Plan[] }>("/billing/plans"),
  });

  const { data: usageData, refetch: refetchUsage } = useQuery({
    queryKey: ["billing-usage", storeId],
    queryFn: () => apiFetch<Usage>("/billing/usage"),
    enabled: !!storeId,
  });

  const subscribeMutation = useMutation({
    mutationFn: (planKey: string) =>
      apiFetch<{ success: boolean; confirmation_url?: string; error?: string }>(
        `/billing/subscribe/${planKey}`,
        { method: "POST" }
      ),
    onSuccess: (data) => {
      if (data.confirmation_url) {
        window.top!.location.href = data.confirmation_url;
      }
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () =>
      apiFetch<{ success: boolean }>("/billing/cancel", { method: "POST" }),
    onSuccess: () => {
      void refetchUsage();
    },
  });

  const plans = plansData?.plans ?? [];
  const usage = usageData;
  const currentPlan = usage?.plan ?? "free";
  const usagePercent = usage
    ? Math.min(100, (usage.orders_used / usage.order_limit) * 100)
    : 0;

  return (
    <Page title="Billing & Plans">
      <Layout>
        <Layout.Section>
          <OwnerStoreSelector />
        </Layout.Section>

        {/* Current Usage */}
        {usage && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Current Plan: {usage.plan_name}
                  </Text>
                  <Badge tone={currentPlan === "free" ? "info" : "success"}>
                    {currentPlan === "free" ? "Free" : "Active"}
                  </Badge>
                </InlineStack>
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" variant="bodySm" tone="subdued">
                      Orders this month
                    </Text>
                    <Text as="p" variant="bodySm">
                      {usage.orders_used} / {usage.order_limit >= 999_999 ? "Unlimited" : usage.order_limit}
                    </Text>
                  </InlineStack>
                  {usage.order_limit < 999_999 && (
                    <ProgressBar
                      progress={usagePercent}
                      size="small"
                      tone={usagePercent > 80 ? "critical" : "primary"}
                    />
                  )}
                </BlockStack>
                {usagePercent > 80 && currentPlan === "free" && (
                  <Banner tone="warning">
                    You are approaching your monthly order limit. Upgrade to avoid disruptions.
                  </Banner>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Plan Cards */}
        <Layout.Section>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
            {plans.map((plan) => {
              const isCurrent = plan.key === currentPlan;
              const isUpgrade = !isCurrent && (
                (currentPlan === "free" && plan.key !== "free") ||
                (currentPlan === "pro" && plan.key === "premium")
              );

              return (
                <Card key={plan.key}>
                  <BlockStack gap="400">
                    <BlockStack gap="100">
                      <InlineStack align="space-between">
                        <Text as="h3" variant="headingMd">{plan.name}</Text>
                        {isCurrent && <Badge tone="success">Current</Badge>}
                      </InlineStack>
                      <InlineStack gap="100" blockAlign="baseline">
                        <Text as="p" variant="headingXl">
                          {plan.price === 0 ? "Free" : `$${plan.price}`}
                        </Text>
                        {plan.price > 0 && (
                          <Text as="p" variant="bodySm" tone="subdued">/month</Text>
                        )}
                      </InlineStack>
                      <Text as="p" variant="bodySm" tone="subdued">
                        {plan.order_limit >= 999_999
                          ? "Unlimited orders"
                          : `${plan.order_limit} orders/month`}
                      </Text>
                      {plan.trial_days && plan.trial_days > 0 && !isCurrent && (
                        <Text as="p" variant="bodySm" tone="success">
                          {plan.trial_days}-day free trial
                        </Text>
                      )}
                    </BlockStack>

                    <Divider />

                    <BlockStack gap="100">
                      {plan.features.map((f) => (
                        <Text as="p" variant="bodySm" key={f}>
                          ✓ {FEATURE_LABELS[f] ?? f}
                        </Text>
                      ))}
                    </BlockStack>

                    <div>
                      {isCurrent ? (
                        plan.key !== "free" ? (
                          <Button
                            tone="critical"
                            onClick={() => cancelMutation.mutate()}
                            loading={cancelMutation.isPending}
                          >
                            Cancel Plan
                          </Button>
                        ) : null
                      ) : isUpgrade ? (
                        <Button
                          variant="primary"
                          onClick={() => {
                            setSubscribing(plan.key);
                            subscribeMutation.mutate(plan.key);
                          }}
                          loading={subscribing === plan.key && subscribeMutation.isPending}
                        >
                          {plan.trial_days ? `Start ${plan.trial_days}-Day Trial` : `Upgrade to ${plan.name}`}
                        </Button>
                      ) : null}
                    </div>
                  </BlockStack>
                </Card>
              );
            })}
          </div>
        </Layout.Section>

        {subscribeMutation.isError && (
          <Layout.Section>
            <Banner tone="critical">
              Failed to create subscription. Please try again.
            </Banner>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
