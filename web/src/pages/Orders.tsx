import { useCallback, useState } from "react";
import {
  Page,
  Layout,
  Card,
  InlineGrid,
  InlineStack,
  BlockStack,
  Text,
  TextField,
  Button,
  Pagination,
  Badge,
} from "@shopify/polaris";
import { useOrders, useOrderStats } from "../api/hooks";
import { apiDownload } from "../api/client";
import { useStore } from "../context/StoreContext";
import { OwnerStoreSelector } from "../components/StoreSelector";
import { OrderTable } from "../components/OrderTable";

export function Orders() {
  const { storeId } = useStore();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exporting, setExporting] = useState(false);

  const { data, isLoading } = useOrders(
    storeId,
    page,
    20,
    search,
    dateFrom,
    dateTo
  );
  const { data: stats } = useOrderStats(storeId, 30);

  const handleSearch = useCallback(() => {
    setSearch(searchInput);
    setPage(1);
  }, [searchInput]);

  const handleClearFilters = useCallback(() => {
    setSearch("");
    setSearchInput("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);
      const qs = params.toString();
      await apiDownload(
        `/orders/export${qs ? `?${qs}` : ""}`
      );
    } finally {
      setExporting(false);
    }
  }, [storeId, dateFrom, dateTo]);

  return (
    <Page title="Orders">
      <Layout>
        <Layout.Section>
          <OwnerStoreSelector />
        </Layout.Section>

        {stats && (
          <Layout.Section>
            <InlineGrid columns={4} gap="400">
              <Card>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Last 30 days
                  </Text>
                  <Text as="p" variant="headingLg">
                    {stats.total_orders}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    All time
                  </Text>
                  <Text as="p" variant="headingLg">
                    {stats.total_all_time}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Top city
                  </Text>
                  <Text as="p" variant="headingLg">
                    {stats.top_cities[0]?.city || "—"}
                  </Text>
                </BlockStack>
              </Card>
              <Card>
                <BlockStack gap="100">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Today
                  </Text>
                  <Text as="p" variant="headingLg">
                    {stats.daily_counts[
                      new Date().toISOString().slice(0, 10)
                    ] || 0}
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack gap="300" align="start" blockAlign="end">
                <div
                  style={{ flex: 1 }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSearch();
                  }}
                >
                  <TextField
                    label=""
                    value={searchInput}
                    onChange={setSearchInput}
                    placeholder="Search order, phone, city..."
                    autoComplete="off"
                  />
                </div>
                <TextField
                  label=""
                  value={dateFrom}
                  onChange={(v) => {
                    setDateFrom(v);
                    setPage(1);
                  }}
                  placeholder="From (YYYY-MM-DD)"
                  autoComplete="off"
                />
                <TextField
                  label=""
                  value={dateTo}
                  onChange={(v) => {
                    setDateTo(v);
                    setPage(1);
                  }}
                  placeholder="To (YYYY-MM-DD)"
                  autoComplete="off"
                />
                <Button onClick={handleSearch}>Search</Button>
                {(search || dateFrom || dateTo) && (
                  <Button onClick={handleClearFilters} variant="plain">
                    Clear
                  </Button>
                )}
              </InlineStack>
              <InlineStack gap="200" align="space-between">
                <InlineStack gap="200">
                  {data && (
                    <Badge>
                      {`${data.total} order${data.total !== 1 ? "s" : ""}`}
                    </Badge>
                  )}
                  {search && (
                    <Badge tone="attention">{`Search: ${search}`}</Badge>
                  )}
                </InlineStack>
                <Button
                  onClick={() => void handleExport()}
                  loading={exporting}
                  variant="plain"
                >
                  Export CSV
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {isLoading ? (
            <Text as="p">Loading...</Text>
          ) : data ? (
            <OrderTable orders={data.orders} />
          ) : null}
        </Layout.Section>

        {data && data.pages > 1 && (
          <Layout.Section>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <Pagination
                hasPrevious={page > 1}
                hasNext={page < data.pages}
                onPrevious={() => setPage((p) => p - 1)}
                onNext={() => setPage((p) => p + 1)}
              />
            </div>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
