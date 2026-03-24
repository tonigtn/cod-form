import { DataTable, Card } from "@shopify/polaris";
import type { OrderRecord } from "../api/types";

interface Props {
  orders: OrderRecord[];
}

export function OrderTable({ orders }: Props) {
  const rows = orders.map((o) => [
    new Date(o.created_at).toLocaleString("ro-RO"),
    o.order_name,
    `***${o.phone_last4}`,
    o.city,
    o.province,
    String(o.quantity),
  ]);

  return (
    <Card>
      <DataTable
        columnContentTypes={[
          "text",
          "text",
          "text",
          "text",
          "text",
          "numeric",
        ]}
        headings={["Date", "Order", "Phone", "City", "Province", "Qty"]}
        rows={rows}
      />
    </Card>
  );
}
