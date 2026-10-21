import { AdminPageHeader } from "@/components/admin/admin-shell";
import { ProductEditor } from "@/components/admin/product-editor";

export default function NewProductPage() {
  return (
    <>
      <AdminPageHeader eyebrow="Catalog" title="New product" />
      <ProductEditor />
    </>
  );
}
