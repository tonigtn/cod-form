import { useState } from "react";
import {
  Page,
  Layout,
  InlineGrid,
  Card,
  BlockStack,
  Text,
  Select,
  DataTable,
  Badge,
  InlineStack,
  Spinner,
} from "@shopify/polaris";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAnalytics, useOrders } from "../api/hooks";
import { useStore } from "../context/StoreContext";
import { OwnerStoreSelector } from "../components/StoreSelector";
import { StatCard } from "../components/StatCard";
import { OrderTable } from "../components/OrderTable";

const PERIOD_OPTIONS = [
  { label: "Last 7 days", value: "7" },
  { label: "Last 14 days", value: "14" },
  { label: "Last 30 days", value: "30" },
];

export function Dashboard() {
  const { storeId, currency } = useStore();
  const [days, setDays] = useState("7");

  const { data: analytics, isLoading: analyticsLoading } = useAnalytics(
    storeId,
    Number(days)
  );
  const { data: orders, isLoading: ordersLoading } = useOrders(storeId, 1, 5);

  return (
    <Page title="Dashboard">
      <Layout>
        {/* Controls */}
        <Layout.Section>
          <InlineGrid columns={2} gap="400">
            <OwnerStoreSelector />
            <Select
              label="Period"
              options={PERIOD_OPTIONS}
              value={days}
              onChange={setDays}
            />
          </InlineGrid>
        </Layout.Section>

        {/* Stat Cards */}
        <Layout.Section>
          {analyticsLoading ? (
            <InlineStack align="center">
              <Spinner size="large" />
            </InlineStack>
          ) : analytics ? (
            <InlineGrid columns={{ xs: 2, md: 5 }} gap="400">
              <StatCard title="Form Opens" value={analytics.form_opens} />
              <StatCard title="Orders" value={analytics.orders} />
              <StatCard
                title="Revenue"
                value={`${analytics.revenue.toFixed(2)} ${currency}`}
              />
              <StatCard
                title="Conversion"
                value={`${analytics.conversion_rate}%`}
              />
              <StatCard
                title="AOV"
                value={`${analytics.avg_order_value.toFixed(2)} ${currency}`}
              />
            </InlineGrid>
          ) : null}
        </Layout.Section>

        {/* Charts */}
        {analytics && analytics.daily.length > 0 && (
          <>
            <Layout.Section>
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">
                      Form Opens & Orders
                    </Text>
                    <div style={{ width: "100%", height: 250 }}>
                      <ResponsiveContainer>
                        <LineChart data={analytics.daily}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d: string) => d.slice(5)}
                            fontSize={12}
                          />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Line
                            type="monotone"
                            dataKey="form_opens"
                            stroke="#5C6AC4"
                            name="Form Opens"
                            strokeWidth={2}
                          />
                          <Line
                            type="monotone"
                            dataKey="orders"
                            stroke="#50B83C"
                            name="Orders"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </BlockStack>
                </Card>

                <Card>
                  <BlockStack gap="200">
                    <Text as="h3" variant="headingMd">
                      Revenue
                    </Text>
                    <div style={{ width: "100%", height: 250 }}>
                      <ResponsiveContainer>
                        <LineChart data={analytics.daily}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis
                            dataKey="date"
                            tickFormatter={(d: string) => d.slice(5)}
                            fontSize={12}
                          />
                          <YAxis fontSize={12} />
                          <Tooltip
                            formatter={(v) =>
                              `${Number(v ?? 0).toFixed(2)} ${currency}`
                            }
                          />
                          <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#DE3618"
                            name="Revenue"
                            strokeWidth={2}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </BlockStack>
                </Card>
              </InlineGrid>
            </Layout.Section>
          </>
        )}

        {/* UTM Breakdown */}
        {analytics && analytics.utm_data.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  UTM Breakdown
                </Text>
                <DataTable
                  columnContentTypes={[
                    "text",
                    "text",
                    "text",
                    "numeric",
                    "numeric",
                    "numeric",
                  ]}
                  headings={[
                    "Campaign",
                    "Source",
                    "Medium",
                    "Form Opens",
                    "Orders",
                    "Conv. Rate",
                  ]}
                  rows={analytics.utm_data.map((row) => [
                    row.campaign,
                    row.source,
                    row.medium,
                    row.form_opens,
                    row.orders,
                    `${row.conversion_rate}%`,
                  ])}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Top Products */}
        {analytics && analytics.top_products.length > 0 && (
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingMd">
                  Top Products
                </Text>
                {analytics.top_products.map((p) => (
                  <InlineStack key={p.variant_id} align="space-between">
                    <Text as="span" variant="bodySm">
                      Variant {p.variant_id}
                    </Text>
                    <Badge>{`${p.orders} orders`}</Badge>
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Recent Orders */}
        <Layout.Section>
          <BlockStack gap="400">
            <Text as="h2" variant="headingMd">
              Recent Orders
            </Text>
            {ordersLoading ? (
              <InlineStack align="center">
                <Spinner size="large" />
              </InlineStack>
            ) : orders ? (
              <OrderTable orders={orders.orders} />
            ) : null}
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
