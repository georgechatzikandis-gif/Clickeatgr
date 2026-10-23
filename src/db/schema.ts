import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

// All money values are integer euro cents. Commission rates are basis points (500 = 5%).

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => "bytea",
});

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

export const businessStatus = pgEnum("business_status", ["active", "inactive", "suspended"]);
export const userRole = pgEnum("user_role", ["admin", "business"]);
export const orderStatus = pgEnum("order_status", [
  "pending",
  "accepted",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "rejected",
  "cancelled",
]);
export const fulfillmentType = pgEnum("fulfillment_type", ["delivery", "pickup"]);
export const paymentMethod = pgEnum("payment_method", ["cash_on_delivery", "pay_at_pickup"]);
export const paymentStatus = pgEnum("payment_status", ["unpaid", "paid", "refunded"]);
export const commissionStatus = pgEnum("commission_status", [
  "not_applicable",
  "pending",
  "due",
  "settled",
]);
export const commissionBase = pgEnum("commission_base", ["subtotal", "subtotal_plus_delivery"]);

// ---------------------------------------------------------------- platform

export const platformSettings = pgTable(
  "platform_settings",
  {
    id: smallint("id").primaryKey().default(1),
    // Global master switch. While false, every order is recorded with 0% commission.
    commissionEnabled: boolean("commission_enabled").notNull().default(false),
    defaultCommissionRateBps: integer("default_commission_rate_bps").notNull().default(500),
    defaultCommissionBase: commissionBase("default_commission_base").notNull().default("subtotal"),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("platform_settings_singleton", sql`${t.id} = 1`),
    check("platform_rate_range", sql`${t.defaultCommissionRateBps} between 0 and 5000`),
  ],
);

export const regions = pgTable("regions", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon").notNull().default("🍽️"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  // null = platform image (uploaded by admin)
  businessId: uuid("business_id"),
  mimeType: text("mime_type").notNull(),
  data: bytea("data").notNull(),
  width: integer("width").notNull(),
  height: integer("height").notNull(),
  bytes: integer("bytes").notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------- businesses

export const businesses = pgTable(
  "businesses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    regionId: uuid("region_id")
      .notNull()
      .references(() => regions.id),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    address: text("address").notNull().default(""),
    // Legal / trader information (P2B & DSA traceability), shown on the business page.
    legalName: text("legal_name").notNull().default(""),
    vatNumber: text("vat_number").notNull().default(""),
    logoImageId: uuid("logo_image_id").references(() => images.id, { onDelete: "set null" }),
    coverImageId: uuid("cover_image_id").references(() => images.id, { onDelete: "set null" }),
    status: businessStatus("status").notNull().default("active"),
    // Marks clearly-labelled demo data so it can never be confused with real partners.
    isDemo: boolean("is_demo").notNull().default(false),
    temporarilyClosed: boolean("temporarily_closed").notNull().default(false),
    acceptsDelivery: boolean("accepts_delivery").notNull().default(true),
    acceptsPickup: boolean("accepts_pickup").notNull().default(true),
    prepTimeMinutes: integer("prep_time_minutes").notNull().default(20),
    deliveryTimeMinutes: integer("delivery_time_minutes").notNull().default(30),
    pickupMinOrderCents: integer("pickup_min_order_cents").notNull().default(0),
    // Commission & free trial. trial_ends_at = null means "in trial until the admin sets an end date".
    trialEndsAt: timestamp("trial_ends_at", { withTimezone: true }),
    commissionRateBps: integer("commission_rate_bps"), // null = platform default
    commissionBase: commissionBase("commission_base"), // null = platform default
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("business_rate_range", sql`${t.commissionRateBps} is null or ${t.commissionRateBps} between 0 and 5000`),
    check("business_times_positive", sql`${t.prepTimeMinutes} >= 0 and ${t.deliveryTimeMinutes} >= 0`),
  ],
);

export const businessCategories = pgTable(
  "business_categories",
  {
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.businessId, t.categoryId] })],
);

export const businessHours = pgTable(
  "business_hours",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    // 0 = Sunday ... 6 = Saturday (JavaScript convention), Europe/Athens local time.
    weekday: smallint("weekday").notNull(),
    opensAt: time("opens_at").notNull(),
    // If closes_at <= opens_at the range continues past midnight into the next day.
    closesAt: time("closes_at").notNull(),
  },
  (t) => [
    check("weekday_range", sql`${t.weekday} between 0 and 6`),
    index("business_hours_business_idx").on(t.businessId),
  ],
);

export const deliveryZones = pgTable(
  "delivery_zones",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    feeCents: integer("fee_cents").notNull().default(0),
    minOrderCents: integer("min_order_cents").notNull().default(0),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    check("zone_money_positive", sql`${t.feeCents} >= 0 and ${t.minOrderCents} >= 0`),
    index("delivery_zones_business_idx").on(t.businessId),
  ],
);

// ---------------------------------------------------------------- menu

export const menuCategories = pgTable(
  "menu_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    active: boolean("active").notNull().default(true),
  },
  (t) => [index("menu_categories_business_idx").on(t.businessId)],
);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "cascade" }),
    menuCategoryId: uuid("menu_category_id").references(() => menuCategories.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    allergens: text("allergens").notNull().default(""),
    priceCents: integer("price_cents").notNull(),
    imageId: uuid("image_id").references(() => images.id, { onDelete: "set null" }),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("product_price_positive", sql`${t.priceCents} >= 0`),
    index("products_business_idx").on(t.businessId),
  ],
);

export const optionGroups = pgTable(
  "option_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    minSelect: integer("min_select").notNull().default(0),
    maxSelect: integer("max_select").notNull().default(1),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    check("option_group_select_range", sql`${t.minSelect} >= 0 and ${t.maxSelect} >= 1 and ${t.minSelect} <= ${t.maxSelect}`),
    index("option_groups_product_idx").on(t.productId),
  ],
);

export const options = pgTable(
  "options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    groupId: uuid("group_id")
      .notNull()
      .references(() => optionGroups.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    priceDeltaCents: integer("price_delta_cents").notNull().default(0),
    isAvailable: boolean("is_available").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    check("option_price_positive", sql`${t.priceDeltaCents} >= 0`),
    index("options_group_idx").on(t.groupId),
  ],
);

// ---------------------------------------------------------------- orders

export type OrderItemOptionSnapshot = { group: string; name: string; priceDeltaCents: number };

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reference: text("reference").notNull().unique(),
    // Secret included in the customer's confirmation link; required to view the order publicly.
    accessToken: text("access_token").notNull(),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending"),
    fulfillment: fulfillmentType("fulfillment").notNull(),
    paymentMethod: paymentMethod("payment_method").notNull(),
    paymentStatus: paymentStatus("payment_status").notNull().default("unpaid"),

    customerName: text("customer_name").notNull(),
    customerPhone: text("customer_phone").notNull(),
    customerEmail: text("customer_email"),
    deliveryZoneId: uuid("delivery_zone_id").references(() => deliveryZones.id, { onDelete: "set null" }),
    deliveryZoneName: text("delivery_zone_name"),
    address: text("address"),
    addressDetails: text("address_details"),
    notes: text("notes"),

    subtotalCents: integer("subtotal_cents").notNull(),
    deliveryFeeCents: integer("delivery_fee_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),

    // Commission snapshot at the moment the order was placed.
    isTrial: boolean("is_trial").notNull(),
    commissionBase: commissionBase("commission_base").notNull(),
    commissionableCents: integer("commissionable_cents").notNull(),
    commissionRateBps: integer("commission_rate_bps").notNull(),
    commissionCents: integer("commission_cents").notNull(),
    commissionStatus: commissionStatus("commission_status").notNull(),

    rejectionReason: text("rejection_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    // Set when personal data is anonymised under the retention policy.
    anonymizedAt: timestamp("anonymized_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "order_money_consistent",
      sql`${t.subtotalCents} >= 0 and ${t.deliveryFeeCents} >= 0 and ${t.discountCents} >= 0
          and ${t.totalCents} = ${t.subtotalCents} + ${t.deliveryFeeCents} - ${t.discountCents}`,
    ),
    check(
      "order_trial_zero_commission",
      sql`(not ${t.isTrial}) or (${t.commissionCents} = 0 and ${t.commissionRateBps} = 0)`,
    ),
    check(
      "order_delivery_has_address",
      sql`${t.fulfillment} <> 'delivery' or (${t.address} is not null and ${t.deliveryZoneName} is not null)`,
    ),
    index("orders_business_created_idx").on(t.businessId, t.createdAt),
    index("orders_status_idx").on(t.status),
    index("orders_created_idx").on(t.createdAt),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    productName: text("product_name").notNull(),
    basePriceCents: integer("base_price_cents").notNull(),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalCents: integer("line_total_cents").notNull(),
    selectedOptions: jsonb("selected_options").$type<OrderItemOptionSnapshot[]>().notNull().default([]),
    notes: text("notes"),
  },
  (t) => [
    check("order_item_qty", sql`${t.quantity} between 1 and 99`),
    check("order_item_total", sql`${t.lineTotalCents} = ${t.unitPriceCents} * ${t.quantity}`),
    index("order_items_order_idx").on(t.orderId),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    fromStatus: orderStatus("from_status"),
    toStatus: orderStatus("to_status").notNull(),
    userId: uuid("user_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

// Append-only record of every commission calculation and reversal.
export const commissionLedger = pgTable(
  "commission_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    businessId: uuid("business_id")
      .notNull()
      .references(() => businesses.id, { onDelete: "restrict" }),
    event: text("event").notNull(), // 'calculated' | 'due' | 'reversed' | 'settled'
    isTrial: boolean("is_trial").notNull(),
    baseCents: integer("base_cents").notNull(),
    rateBps: integer("rate_bps").notNull(),
    amountCents: integer("amount_cents").notNull(),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("commission_ledger_business_idx").on(t.businessId, t.createdAt)],
);

// ---------------------------------------------------------------- auth

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull(),
    businessId: uuid("business_id").references(() => businesses.id, { onDelete: "cascade" }),
    active: boolean("active").notNull().default(true),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(sql`lower(${t.email})`),
    check(
      "user_role_business",
      sql`(${t.role} = 'admin' and ${t.businessId} is null) or (${t.role} = 'business' and ${t.businessId} is not null)`,
    ),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the cookie token; the raw token is never stored.
    tokenHash: text("token_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
});

export type Business = typeof businesses.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type OrderStatus = (typeof orderStatus.enumValues)[number];
