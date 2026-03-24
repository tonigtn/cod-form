import { useCallback, useEffect, useState } from "react";
import { useProducts, type ShopifyProduct } from "../api/hooks";

interface Props {
  storeId: string;
  selectedIds: number[];
  onSelect: (ids: number[]) => void;
  onClose: () => void;
}

export function ProductPicker({ storeId, selectedIds, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [checked, setChecked] = useState<Set<number>>(new Set(selectedIds));

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useProducts(storeId, debouncedSearch, true);
  const products = data?.products ?? [];

  const toggle = useCallback((id: number) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelect = () => {
    onSelect(Array.from(checked));
    onClose();
  };

  return (
    <div style={{
      position: "fixed",
      top: 0, left: 0, right: 0, bottom: 0,
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0,0,0,0.4)",
    }} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        width: 520,
        maxHeight: "80vh",
        background: "#fff",
        borderRadius: 12,
        boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e1e3e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>Select products</span>
          <button type="button" onClick={onClose} style={{
            background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#666",
          }}>✕</button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid #e1e3e5" }}>
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "8px 12px",
              border: "1px solid #c9cccf",
              borderRadius: 8,
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Product list */}
        <div style={{ flex: 1, overflowY: "auto", minHeight: 200 }}>
          {isLoading && (
            <div style={{ padding: 20, textAlign: "center", color: "#999" }}>Loading products...</div>
          )}
          {!isLoading && products.length === 0 && (
            <div style={{ padding: 20, textAlign: "center", color: "#999" }}>No products found</div>
          )}
          {products.map((p: ShopifyProduct) => (
            <label
              key={p.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 20px",
                cursor: "pointer",
                borderBottom: "1px solid #f1f1f1",
                background: checked.has(p.id) ? "#f0f7ff" : "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={checked.has(p.id)}
                onChange={() => toggle(p.id)}
                style={{ width: 16, height: 16, accentColor: "#2c6ecb", cursor: "pointer" }}
              />
              {p.image_url ? (
                <img
                  src={p.image_url}
                  alt=""
                  style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 6, border: "1px solid #e1e3e5" }}
                />
              ) : (
                <div style={{
                  width: 36, height: 36, borderRadius: 6, background: "#f1f1f1",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "#999", border: "1px solid #e1e3e5",
                }}>IMG</div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 13, fontWeight: 500, color: "#202223",
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "#6d7175" }}>{p.price} RON</div>
              </div>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px",
          borderTop: "1px solid #e1e3e5",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 13, color: "#6d7175" }}>
            {checked.size} product{checked.size !== 1 ? "s" : ""} selected
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={onClose} style={{
              padding: "6px 14px", border: "1px solid #c9cccf", borderRadius: 6,
              background: "#fff", cursor: "pointer", fontSize: 13,
            }}>Cancel</button>
            <button type="button" onClick={handleSelect} style={{
              padding: "6px 14px", border: "none", borderRadius: 6,
              background: "#2c6ecb", color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}>Select</button>
          </div>
        </div>
      </div>
    </div>
  );
}
