"""Pydantic schemas for COD order API."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class CodOrderRequest(BaseModel, frozen=True):
    model_config = ConfigDict(populate_by_name=True)
    """Incoming COD order from the storefront form."""

    shop: str = Field(default="", description="myshopify.com domain")
    store_id_legacy: str | None = Field(
        default=None, alias="store_id", description="Legacy store_id"
    )
    product_id: int = Field(default=0, description="Shopify product ID")
    variant_id: int = Field(description="Shopify variant GID numeric ID")
    quantity: int = Field(default=1, ge=1, le=10)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: str = Field(min_length=9, max_length=15)
    city: str = Field(min_length=1, max_length=100)
    province: str = Field(min_length=1, max_length=100)
    address1: str = Field(min_length=1, max_length=300)
    zip: str = Field(default="", max_length=10)
    email: str = Field(default="", max_length=200)
    note: str = Field(default="", max_length=500)
    shipping_price: str = Field(description="Shipping cost as string, e.g. '20.00'")
    discount_code: str = Field(default="", max_length=50)
    bump_variant_ids: list[int] = Field(
        default_factory=list, description="Accepted order bump variant IDs"
    )
    variant_ids: list[int] = Field(
        default_factory=list,
        description="Per-unit variant IDs for multi-variant quantity offers",
    )
    upsell_variant_ids: list[int] = Field(
        default_factory=list,
        description="Accepted post-purchase upsell variant IDs (included in same order)",
    )
    upsell_discounts: list[str] = Field(
        default_factory=list,
        description="Discount amount per upsell, parallel to upsell_variant_ids",
    )
    custom_fields: dict[str, str] | None = Field(
        default=None, description="Custom form field values"
    )


class CodOrderResponse(BaseModel, frozen=True):
    """Response after COD order creation."""

    success: bool
    order_name: str = ""
    order_id: int = 0
    error: str = ""


class QuantityOffer(BaseModel, frozen=True):
    """A quantity-based discount tier."""

    min_qty: int = Field(ge=2)
    title: str = ""
    discount_type: str = Field(default="percentage")
    discount_percent: int = Field(default=0, ge=0, le=100)
    discount_fixed: float = Field(default=0, ge=0)
    tag: str = ""
    tag_bg: str = ""
    label: str = ""
    image_url: str = ""
    preselect: bool = False


class QuantityTier(BaseModel, frozen=True):
    """A single quantity tier within an offer group."""

    min_qty: int = Field(ge=2, default=2)
    title: str = ""
    discount_type: str = "percentage"
    discount_percent: int = Field(default=10, ge=0, le=100)
    discount_fixed: float = Field(default=0, ge=0)
    tag: str = ""
    tag_bg: str = ""
    label: str = ""
    image_url: str = ""
    preselect: bool = False


class OfferGroup(BaseModel, frozen=True):
    """A per-product offer group with quantity tiers."""

    name: str = "Default Offer"
    product_ids: list[int] = Field(default_factory=list)
    enabled: bool = True
    tiers: list[QuantityTier] = Field(default_factory=list)


class QuantityOffersResponse(BaseModel, frozen=True):
    """Response for quantity offers endpoint."""

    offers: list[QuantityOffer] = []


class DiscountValidationRequest(BaseModel, frozen=True):
    model_config = ConfigDict(populate_by_name=True)
    """Request to validate a Shopify discount code."""

    shop: str = ""
    store_id_legacy: str | None = Field(default=None, alias="store_id")
    code: str = Field(min_length=1, max_length=50)


class DiscountValidationResponse(BaseModel, frozen=True):
    """Response after validating a discount code."""

    valid: bool
    discount_type: str = ""
    value: float = 0.0
    title: str = ""
    error: str = ""


class FraudResult(BaseModel, frozen=True):
    """Result of fraud check on an order request."""

    passed: bool
    reason: str = ""


class OrderBumpItem(BaseModel, frozen=True):
    """An order bump offer shown in the form."""

    variant_id: int
    title: str
    price: str = "0.00"
    image_url: str = ""
    text: str = ""


class OrderBumpsResponse(BaseModel, frozen=True):
    """Available order bumps for a product."""

    bumps: list[OrderBumpItem] = Field(default_factory=list)


class UpsellVariant(BaseModel, frozen=True):
    """A single variant of an upsell product."""

    variant_id: int
    title: str
    price: str = "0.00"
    compare_at_price: str = ""
    image_url: str = ""


class UpsellProduct(BaseModel, frozen=True):
    """Product recommended as an upsell."""

    product_id: int
    variant_id: int
    title: str
    image_url: str = ""
    price: str = "0.00"
    compare_at_price: str = ""
    currency: str = "RON"
    variants: list[UpsellVariant] = Field(default_factory=list)


class UpsellsResponse(BaseModel, frozen=True):
    """Upsell products for a given product."""

    products: list[UpsellProduct] = Field(default_factory=list)


class UpsellAddRequest(BaseModel, frozen=True):
    model_config = ConfigDict(populate_by_name=True)
    """Request to add an upsell variant to an existing order."""

    shop: str = ""
    store_id_legacy: str | None = Field(default=None, alias="store_id")
    order_id: int
    variant_id: int
    quantity: int = Field(default=1, ge=1, le=5)
    price: str = ""
    compare_at_price: str = ""


class UpsellAddResponse(BaseModel, frozen=True):
    """Result of adding an upsell to an order."""

    success: bool
    error: str = ""


class OtpSendRequest(BaseModel, frozen=True):
    model_config = ConfigDict(populate_by_name=True)
    """Request to send an OTP code."""

    shop: str = ""
    store_id_legacy: str | None = Field(default=None, alias="store_id")
    phone: str = Field(min_length=9, max_length=15)


class OtpSendResponse(BaseModel, frozen=True):
    """Response after sending OTP."""

    sent: bool
    error: str = ""


class OtpVerifyRequest(BaseModel, frozen=True):
    model_config = ConfigDict(populate_by_name=True)
    """Request to verify an OTP code."""

    shop: str = ""
    store_id_legacy: str | None = Field(default=None, alias="store_id")
    phone: str = Field(min_length=9, max_length=15)
    code: str = Field(min_length=4, max_length=8)


class OtpVerifyResponse(BaseModel, frozen=True):
    """Response after OTP verification."""

    verified: bool
    error: str = ""
