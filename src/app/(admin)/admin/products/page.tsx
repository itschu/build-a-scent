/* eslint-disable @next/next/no-img-element -- admin thumbnails of arbitrary URLs */
import Link from "next/link";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ProductActiveToggle } from "@/components/admin/product-editor";
import { buttonClasses } from "@/components/ui/button";
import { formatNaira } from "@/lib/money";
import { getActor } from "@/server/auth/session";
import { listProductsForAdmin } from "@/server/dal/products";

export default function AdminProductsPage() {
  return (
    <>
      <AdminPageHeader
        eyebrow="Catalog"
        title="Products"
        actions={
          <Link href="/admin/products/new" className={buttonClasses({ size: "sm" })}>
            New product
          </Link>
        }
      />
      <Suspense fallback={<p className="text-sm text-muted">Loading products…</p>}>
        <ProductTable />
      </Suspense>
    </>
  );
}

async function ProductTable() {
  const products = await listProductsForAdmin(await getActor());
  if (products.length === 0) {
    return <p className="border border-dashed border-line p-10 text-center text-sm text-muted">No products yet. Create your first one.</p>;
  }
  return (
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-line bg-coal font-serif text-[0.65rem] uppercase tracking-label text-muted">
          <tr>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Family</th>
            <th className="px-4 py-3">Variants</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Stock</th>
            <th className="px-4 py-3">Visible</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line-soft">
          {products.map((p) => {
            const active = p.variants.filter((v) => v.isActive);
            const prices = active.map((v) => v.priceKobo);
            return (
              <tr key={p.id} className="hover:bg-raised">
                <td className="px-4 py-3">
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 text-champagne hover:text-gold">
                    {p.images[0] ? (
                      <img src={p.images[0]} alt="" className="size-10 border border-line object-cover" />
                    ) : (
                      <span className="size-10 border border-line bg-coal" />
                    )}
                    <span>
                      {p.name}
                      <span className="block text-xs text-faint">/shop/{p.slug}</span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{p.scentFamily}</td>
                <td className="px-4 py-3 text-muted">
                  {active.length} active{p.variants.length > active.length && ` / ${p.variants.length}`}
                </td>
                <td className="px-4 py-3 text-muted">
                  {prices.length ? `${formatNaira(Math.min(...prices))}${prices.length > 1 ? ` – ${formatNaira(Math.max(...prices))}` : ""}` : "—"}
                </td>
                <td className="px-4 py-3 text-muted">{active.reduce((s, v) => s + v.stockQty, 0)}</td>
                <td className="px-4 py-3">
                  <ProductActiveToggle id={p.id} isActive={p.isActive} hasVariants={active.length > 0} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
