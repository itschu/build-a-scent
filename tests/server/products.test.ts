import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthorizationError, GUEST, ValidationError } from "@/server/dal/actor";
import {
  getShopProduct,
  listProductsForAdmin,
  listShopProducts,
  saveProduct,
  saveVariant,
  setProductActive,
  setVariantActive,
} from "@/server/dal/products";
import { seed } from "../../scripts/seed-data";
import { freshTestDatabase, testDatabaseUrl } from "../support/db";
import { actorFor, createUser } from "../support/factories";

type Connection = Awaited<ReturnType<typeof freshTestDatabase>>;

describe.skipIf(!testDatabaseUrl)("products DAL", () => {
  let conn: Connection;
  let admin: ReturnType<typeof actorFor>;

  beforeAll(async () => {
    conn = await freshTestDatabase();
    await seed(conn.db, { sampleData: true });
    admin = actorFor(await createUser(conn.db, { role: "admin" }));
  });

  afterAll(async () => {
    await conn?.close();
  });

  const product = { name: "Velvet Oud", slug: "velvet-oud", description: "", scentFamily: "Woody", notes: { base: [], heart: [], top: [] }, images: [] };

  it("only admins can manage products", async () => {
    const user = actorFor(await createUser(conn.db));
    await expect(saveProduct(user, product)).rejects.toBeInstanceOf(AuthorizationError);
    await expect(listProductsForAdmin(GUEST)).rejects.toBeInstanceOf(AuthorizationError);
  });

  it("new products stay hidden until made visible, and slugs must be unique", async () => {
    const { id } = await saveProduct(admin, product);
    expect((await listShopProducts()).some((p) => p.id === id)).toBe(false);
    await expect(saveProduct(admin, { ...product, name: "Copy" })).rejects.toBeInstanceOf(ValidationError);

    await saveVariant(admin, { productId: id, sizeLabel: "50ml", format: "spray", priceKobo: 3_000_000, stockQty: 10 });
    await setProductActive(admin, id, true);
    const card = (await listShopProducts()).find((p) => p.id === id);
    expect(card).toMatchObject({ slug: "velvet-oud", minPriceKobo: 3_000_000, formats: ["spray"], inStock: true });
  });

  it("public product pages show only active variants, with stock minus holds", async () => {
    const shop = await getShopProduct("noir-classic");
    const big = shop!.variants.find((v) => v.sizeLabel === "100ml")!;
    expect(big.available).toBe(3);

    const [order] = await conn.db
      .insert(conn.schema.orders)
      .values({
        orderNumber: "BAS-HOLD01",
        email: "x@example.com",
        paymentGateway: "paystack",
        subtotalKobo: 0,
        shippingFeeKobo: 0,
        totalKobo: 0,
        deliveryAddress: { fullName: "A", phone: "1", address: "x", city: "y", state: "Lagos" },
      })
      .returning();
    await conn.db.insert(conn.schema.inventoryReservations).values({
      productVariantId: big.id,
      orderId: order.id,
      quantity: 2,
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect((await getShopProduct("noir-classic"))!.variants.find((v) => v.id === big.id)!.available).toBe(1);

    await setVariantActive(admin, big.id, false);
    expect((await getShopProduct("noir-classic"))!.variants.map((v) => v.sizeLabel)).toEqual(["50ml"]);
  });

  it("hidden products are not public", async () => {
    const [p] = await conn.db.select().from(conn.schema.products).where(eq(conn.schema.products.slug, "citrus-harmattan"));
    await setProductActive(admin, p.id, false);
    expect(await getShopProduct("citrus-harmattan")).toBeNull();
    expect((await listShopProducts()).some((c) => c.slug === "citrus-harmattan")).toBe(false);
  });

  it("validates variant input", async () => {
    const [p] = await conn.db.select().from(conn.schema.products).where(eq(conn.schema.products.slug, "lagos-bloom"));
    await expect(saveVariant(admin, { productId: p.id, sizeLabel: "", format: "spray", priceKobo: 0, stockQty: -1 })).rejects.toThrow();
  });
});
