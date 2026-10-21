import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ProductEditor } from "@/components/admin/product-editor";
import { getActor } from "@/server/auth/session";
import { NotFoundError } from "@/server/dal/actor";
import { getProductForAdmin } from "@/server/dal/products";

export default function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading product…</p>}>
      <Editor params={params} />
    </Suspense>
  );
}

async function Editor({ params }: { params: PageProps<"/admin/products/[id]">["params"] }) {
  const { id } = await params;
  const product = await getProductForAdmin(await getActor(), id).catch((error: unknown) => {
    if (error instanceof NotFoundError) notFound();
    throw error;
  });
  return (
    <>
      <AdminPageHeader eyebrow="Catalog" title={product.name} />
      <ProductEditor product={product} />
    </>
  );
}
