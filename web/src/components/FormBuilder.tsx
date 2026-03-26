import { useCallback, useState } from "react";
import {
  BlockStack,
  InlineStack,
  Button,
  TextField,
  Checkbox,
  Select,
  Card,
  Text,
  Icon,
  Badge,
  Collapsible,
} from "@shopify/polaris";
import { DragHandleIcon } from "@shopify/polaris-icons";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { FormField } from "../api/types";
import type { StoreLocale } from "../api/hooks";

function buildDefaultFields(locale?: StoreLocale): FormField[] {
  const L = locale?.labels || {};
  return [
    { id: "first_name", label: L.first_name || "First Name", placeholder: "", field_type: "text", visible: true, required: true, order: 0, half_width: true, options: [] },
    { id: "last_name", label: L.last_name || "Last Name", placeholder: "", field_type: "text", visible: true, required: true, order: 1, half_width: true, options: [] },
    { id: "phone", label: L.phone || "Phone", placeholder: locale?.phone_placeholder || "", field_type: "tel", visible: true, required: true, order: 2, half_width: false, options: [] },
    { id: "province", label: L.province || "Province", placeholder: "", field_type: "select", visible: true, required: true, order: 3, half_width: false, options: [] },
    { id: "city", label: L.city || "City", placeholder: "", field_type: "text", visible: true, required: true, order: 4, half_width: false, options: [] },
    { id: "address1", label: L.address || "Address", placeholder: L.address_placeholder || "", field_type: "text", visible: true, required: true, order: 5, half_width: false, options: [] },
    { id: "zip", label: L.zip || "Postal Code", placeholder: "", field_type: "text", visible: true, required: false, order: 6, half_width: true, options: [] },
    { id: "email", label: L.email || "Email", placeholder: "", field_type: "email", visible: true, required: false, order: 7, half_width: true, options: [] },
  ];
}

const DEFAULT_FIELDS = buildDefaultFields();

const ADDITIONAL_SHOPIFY_FIELDS: FormField[] = [
  { id: "address2", label: "Address 2", placeholder: "", field_type: "text", visible: true, required: false, order: 99, half_width: false, options: [] },
  { id: "company", label: "Company", placeholder: "", field_type: "text", visible: true, required: false, order: 99, half_width: false, options: [] },
  { id: "note", label: "Order note", placeholder: "", field_type: "textarea", visible: true, required: false, order: 99, half_width: false, options: [] },
  { id: "accepts_marketing", label: "Accept marketing", placeholder: "", field_type: "checkbox", visible: true, required: false, order: 99, half_width: false, options: [] },
];

const ALL_STANDARD_IDS = new Set([
  ...DEFAULT_FIELDS.map((f) => f.id),
  ...ADDITIONAL_SHOPIFY_FIELDS.map((f) => f.id),
]);

const FIELD_TYPE_OPTIONS = [
  { label: "Text", value: "text" },
  { label: "Phone", value: "tel" },
  { label: "Email", value: "email" },
  { label: "Textarea", value: "textarea" },
  { label: "Dropdown", value: "select" },
  { label: "Date", value: "date" },
  { label: "Radio (single choice)", value: "radio" },
  { label: "Checkbox group", value: "checkbox_group" },
  { label: "Checkbox (single)", value: "checkbox" },
];

const NEEDS_OPTIONS = new Set(["select", "radio", "checkbox_group"]);

interface Props {
  fields: FormField[];
  onChange: (fields: FormField[]) => void;
  onSave: () => void;
  locale?: StoreLocale;
}

function OptionsEditor({
  options,
  onChange,
}: {
  options: string[];
  onChange: (opts: string[]) => void;
}) {
  const [newOpt, setNewOpt] = useState("");
  return (
    <BlockStack gap="200">
      <Text as="p" fontWeight="semibold" variant="bodySm">
        Options
      </Text>
      {options.map((opt, i) => (
        <InlineStack key={i} gap="200" blockAlign="center">
          <div style={{ flex: 1 }}>
            <TextField
              label=""
              labelHidden
              value={opt}
              onChange={(v) => {
                const u = [...options];
                u[i] = v;
                onChange(u);
              }}
              autoComplete="off"
              size="slim"
            />
          </div>
          <Button
            size="slim"
            variant="plain"
            tone="critical"
            onClick={() => onChange(options.filter((_, j) => j !== i))}
          >
            Remove
          </Button>
        </InlineStack>
      ))}
      <InlineStack gap="200" blockAlign="end">
        <div style={{ flex: 1 }}>
          <TextField
            label=""
            labelHidden
            value={newOpt}
            onChange={setNewOpt}
            placeholder="Add option..."
            autoComplete="off"
            size="slim"
          />
        </div>
        <Button
          size="slim"
          onClick={() => {
            if (newOpt.trim()) {
              onChange([...options, newOpt.trim()]);
              setNewOpt("");
            }
          }}
        >
          Add
        </Button>
      </InlineStack>
    </BlockStack>
  );
}

function SortableField({
  field,
  onUpdate,
  onRemove,
  isExpanded,
  onToggle,
}: {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onRemove?: () => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: field.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const isStandard = ALL_STANDARD_IDS.has(field.id);

  return (
    <div ref={setNodeRef} style={style}>
      <div
        style={{
          border: "1px solid #e1e3e5",
          borderRadius: 8,
          background: field.visible ? "#fff" : "#f6f6f7",
          overflow: "hidden",
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "8px 12px",
          }}
        >
          <div
            {...attributes}
            {...listeners}
            style={{ cursor: "grab", touchAction: "none", display: "flex" }}
          >
            <Icon source={DragHandleIcon} tone="subdued" />
          </div>
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
            }}
          >
            <Text as="span" fontWeight="semibold" variant="bodySm">
              {field.label || field.id}
            </Text>
            <Badge tone={isStandard ? "info" : "magic"} size="small">
              {isStandard ? "Shopify" : "Custom"}
            </Badge>
            {field.required && (
              <Badge tone="warning" size="small">
                Required
              </Badge>
            )}
            {field.half_width && <Badge size="small">Half</Badge>}
          </div>
          <Button onClick={onToggle} size="slim" variant="plain">
            {isExpanded ? "Close" : "Edit"}
          </Button>
          <Button
            onClick={() => onUpdate({ visible: !field.visible })}
            size="slim"
            variant="plain"
            tone={field.visible ? undefined : "critical"}
          >
            {field.visible ? "Hide" : "Show"}
          </Button>
          {!isStandard && onRemove && (
            <Button
              onClick={onRemove}
              size="slim"
              variant="plain"
              tone="critical"
            >
              Delete
            </Button>
          )}
        </div>

        {/* Edit panel */}
        <Collapsible open={isExpanded} id={`field-edit-${field.id}`}>
          <div
            style={{
              padding: "12px 12px 12px",
              borderTop: "1px solid #e1e3e5",
            }}
          >
            <BlockStack gap="300">
              <InlineStack gap="300">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Label"
                    value={field.label}
                    onChange={(v) => onUpdate({ label: v })}
                    autoComplete="off"
                    size="slim"
                  />
                </div>
                {field.field_type !== "checkbox" && (
                  <div style={{ flex: 1 }}>
                    <TextField
                      label="Placeholder"
                      value={field.placeholder}
                      onChange={(v) => onUpdate({ placeholder: v })}
                      autoComplete="off"
                      size="slim"
                    />
                  </div>
                )}
              </InlineStack>
              {!isStandard && (
                <Select
                  label="Field type"
                  options={FIELD_TYPE_OPTIONS}
                  value={field.field_type}
                  onChange={(v) => onUpdate({ field_type: v })}
                />
              )}
              <InlineStack gap="400">
                <Checkbox
                  label="Required"
                  checked={field.required}
                  onChange={(v) => onUpdate({ required: v })}
                />
                <Checkbox
                  label="Half width"
                  checked={field.half_width}
                  onChange={(v) => onUpdate({ half_width: v })}
                />
              </InlineStack>
              {NEEDS_OPTIONS.has(field.field_type) && (
                <OptionsEditor
                  options={field.options}
                  onChange={(opts) => onUpdate({ options: opts })}
                />
              )}
            </BlockStack>
          </div>
        </Collapsible>
      </div>
    </div>
  );
}

export function FormBuilder({ fields, onChange, onSave, locale }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddShopify, setShowAddShopify] = useState(false);
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldLabel, setNewFieldLabel] = useState("");
  const [newFieldType, setNewFieldType] = useState("text");

  const activeFields = fields.length > 0 ? fields : buildDefaultFields(locale);
  const existingIds = new Set(activeFields.map((f) => f.id));
  const availableShopify = ADDITIONAL_SHOPIFY_FIELDS.filter(
    (f) => !existingIds.has(f.id)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const oldIndex = activeFields.findIndex((f) => f.id === active.id);
      const newIndex = activeFields.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      onChange(
        arrayMove(activeFields, oldIndex, newIndex).map((f, i) => ({
          ...f,
          order: i,
        }))
      );
    },
    [activeFields, onChange]
  );

  const updateField = useCallback(
    (id: string, updates: Partial<FormField>) => {
      onChange(
        activeFields.map((f) => (f.id === id ? { ...f, ...updates } : f))
      );
    },
    [activeFields, onChange]
  );

  const removeField = useCallback(
    (id: string) => {
      onChange(activeFields.filter((f) => f.id !== id));
      if (expandedId === id) setExpandedId(null);
    },
    [activeFields, onChange, expandedId]
  );

  const addShopifyField = useCallback(
    (field: FormField) => {
      const added = { ...field, order: activeFields.length };
      onChange([...activeFields, added]);
      setExpandedId(added.id);
    },
    [activeFields, onChange]
  );

  const addCustomField = useCallback(() => {
    if (!newFieldName.trim()) return;
    const id =
      "custom_" +
      newFieldName
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_");
    if (activeFields.some((f) => f.id === id)) return;
    const nf: FormField = {
      id,
      label: newFieldLabel || newFieldName,
      placeholder: "",
      field_type: newFieldType,
      visible: true,
      required: false,
      order: activeFields.length,
      half_width: false,
      options: [],
    };
    onChange([...activeFields, nf]);
    setNewFieldName("");
    setNewFieldLabel("");
    setNewFieldType("text");
    setExpandedId(id);
  }, [activeFields, onChange, newFieldName, newFieldLabel, newFieldType]);

  return (
    <BlockStack gap="400">
      <Text as="p" variant="bodySm" tone="subdued">
        Drag to reorder. Click Edit to customize labels, placeholders, and
        options.
      </Text>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={activeFields.map((f) => f.id)}
          strategy={verticalListSortingStrategy}
        >
          <BlockStack gap="200">
            {activeFields.map((f) => (
              <SortableField
                key={f.id}
                field={f}
                onUpdate={(u) => updateField(f.id, u)}
                onRemove={
                  !ALL_STANDARD_IDS.has(f.id)
                    ? () => removeField(f.id)
                    : undefined
                }
                isExpanded={expandedId === f.id}
                onToggle={() =>
                  setExpandedId(expandedId === f.id ? null : f.id)
                }
              />
            ))}
          </BlockStack>
        </SortableContext>
      </DndContext>

      {/* Add Shopify Fields */}
      {availableShopify.length > 0 && (
        <Card>
          <BlockStack gap="200">
            <Button
              onClick={() => setShowAddShopify(!showAddShopify)}
              variant="plain"
              fullWidth
              textAlign="start"
            >
              {`${showAddShopify ? "\u25BE" : "\u25B8"} Add Shopify Fields (${availableShopify.length} available)`}
            </Button>
            <Collapsible open={showAddShopify} id="add-shopify">
              <BlockStack gap="200">
                {availableShopify.map((f) => (
                  <InlineStack key={f.id} gap="300" blockAlign="center">
                    <div style={{ flex: 1 }}>
                      <Text as="span" variant="bodySm">
                        {f.label}
                      </Text>
                      <Text as="span" variant="bodySm" tone="subdued">
                        {" "}
                        &mdash; {f.field_type}
                      </Text>
                    </div>
                    <Button size="slim" onClick={() => addShopifyField(f)}>
                      Add
                    </Button>
                  </InlineStack>
                ))}
              </BlockStack>
            </Collapsible>
          </BlockStack>
        </Card>
      )}

      {/* Add Custom Field */}
      <Card>
        <BlockStack gap="200">
          <Button
            onClick={() => setShowAddCustom(!showAddCustom)}
            variant="plain"
            fullWidth
            textAlign="start"
          >
            {showAddCustom ? "\u25BE" : "\u25B8"} Add Custom Field
          </Button>
          <Collapsible open={showAddCustom} id="add-custom">
            <BlockStack gap="300">
              <InlineStack gap="300">
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Field name"
                    value={newFieldName}
                    onChange={setNewFieldName}
                    placeholder="e.g. company_name"
                    autoComplete="off"
                    size="slim"
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <TextField
                    label="Label"
                    value={newFieldLabel}
                    onChange={setNewFieldLabel}
                    placeholder="e.g. Company name"
                    autoComplete="off"
                    size="slim"
                  />
                </div>
              </InlineStack>
              <Select
                label="Type"
                options={FIELD_TYPE_OPTIONS}
                value={newFieldType}
                onChange={setNewFieldType}
              />
              <Button onClick={addCustomField}>Add Custom Field</Button>
            </BlockStack>
          </Collapsible>
        </BlockStack>
      </Card>

      <Button variant="primary" onClick={onSave}>
        Save Form Layout
      </Button>
    </BlockStack>
  );
}

export { DEFAULT_FIELDS };
