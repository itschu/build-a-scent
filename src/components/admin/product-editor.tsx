"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  saveProductAction,
  saveVariantAction,
  setProductActiveAction,
  setVariantActiveAction,
} from "@/app/(admin)/admin/products/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";
import { BOTTLE_FORMATS, type BottleFormat } from "@/lib/domain";
import { FORMAT_LABELS } from "@/lib/labels";
import { parseNairaToKobo } from "@/lib/money";
import { parseNoteList, slugify } from "@/lib/validation/product";
import type { AdminProduct, AdminVariant } from "@/server/dal/products";
import { ImageListEditor } from "./image-uploader";

export function ProductActiveToggle({ id, isActive, hasVariants }: { id: string; isActive: boolean; hasVariants: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <button
      type="button"
      disabled={pending || (!isActive && !hasVariants)}
      title={!isActive && !hasVariants ? "Add an active variant first" : undefined}
      onClick={async () => {
        setPending(true);
        const result = await setProductActiveAction(id, !isActive);
        setPending(false);
        if (!result.ok) return toast(result.error, { tone: "error" });
        router.refresh();
      }}
      className={
        isActive
          ? "border border-success/40 px-2 py-1 text-xs text-success"
          : "border border-line px-2 py-1 text-xs text-muted disabled:opacity-40"
      }
    >
      {isActive ? "Visible" : "Hidden"}
    </button>
  );
}

export function ProductEditor({ product }: { product?: AdminProduct }) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [images, setImages] = useState<string[]>(product?.images ?? []);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    const result = await saveProductAction({
      id: product?.id,
      name,
      slug: slug || slugify(name),
      description: String(form.get("description") ?? ""),
      scentFamily: String(form.get("scentFamily") ?? ""),
      notes: {
        base: parseNoteList(String(form.get("notesBase") ?? "")),
        heart: parseNoteList(String(form.get("notesHeart") ?? "")),
        top: parseNoteList(String(form.get("notesTop") ?? "")),
      },
      images,
    });
    setPending(false);
    if (!result.ok) return setError(result.error);
    toast("Product saved.");
    if (!product) router.replace(`/admin/products/${result.data.id}`);
    else router.refresh();
  }

  return (
    <div className="space-y-12">
      <form onSubmit={handleSubmit} className="max-w-3xl space-y-5" noValidate>
        {error && <Notice tone="error">{error}</Notice>}
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Name">
            {({ id }) => (
              <Input
                id={id}
                value={name}
                required
                onChange={(e) => {
                  setName(e.target.value);
                  if (!slugTouched) setSlug(slugify(e.target.value));
                }}
              />
            )}
          </Field>
          <Field label="URL slug" hint={`/shop/${slug || "…"}`}>
            {({ id, describedBy }) => (
              <Input
                id={id}
                value={slug}
                aria-describedby={describedBy}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(e.target.value);
                }}
              />
            )}
          </Field>
        </div>
        <Field label="Scent family" hint="e.g. Woody, Floral, Citrus">
          {({ id, describedBy }) => (
            <Input id={id} name="scentFamily" defaultValue={product?.scentFamily} aria-describedby={describedBy} required />
          )}
        </Field>
        <Field label="Description">
          {({ id }) => <Textarea id={id} name="description" defaultValue={product?.description} rows={5} />}
        </Field>
        <div className="grid gap-5 sm:grid-cols-3">
          {(
            [
              ["notesBase", "Base notes", product?.notes.base],
              ["notesHeart", "Heart notes", product?.notes.heart],
              ["notesTop", "Top notes", product?.notes.top],
            ] as const
          ).map(([fieldName, label, value]) => (
            <Field key={fieldName} label={label} hint="Comma-separated">
              {({ id, describedBy }) => <Input id={id} name={fieldName} defaultValue={value?.join(", ")} aria-describedby={describedBy} />}
            </Field>
          ))}
        </div>
        <div>
          <p className="mb-2 font-serif text-[0.7rem] uppercase tracking-label text-muted">Images</p>
          <ImageListEditor value={images} onChange={setImages} prefix="products" />
        </div>
        <Button type="submit" pending={pending}>
          {product ? "Save product" : "Create product"}
        </Button>
        {!product && <p className="text-xs text-faint">New products stay hidden until you add a variant and make them visible.</p>}
      </form>

      {product && (
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="font-serif text-sm uppercase tracking-label text-gold">Variants & stock</h2>
            <ProductActiveToggle id={product.id} isActive={product.isActive} hasVariants={product.variants.some((v) => v.isActive)} />
          </div>
          <div className="overflow-x-auto border border-line">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line bg-coal font-serif text-[0.65rem] uppercase tracking-label text-muted">
                <tr>
                  <th className="px-3 py-3">Size</th>
                  <th className="px-3 py-3">Format</th>
                  <th className="px-3 py-3">Price (₦)</th>
                  <th className="px-3 py-3">Stock</th>
                  <th className="px-3 py-3">Status</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {product.variants.map((v) => (
                  <VariantRow key={v.id} productId={product.id} variant={v} />
                ))}
                <VariantRow key={`new-${product.variants.length}`} productId={product.id} />
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function VariantRow({ productId, variant }: { productId: string; variant?: AdminVariant }) {
  const router = useRouter();
  const [sizeLabel, setSizeLabel] = useState(variant?.sizeLabel ?? "");
  const [format, setFormat] = useState<BottleFormat>(variant?.format ?? "spray");
  const [price, setPrice] = useState(variant ? String(variant.priceKobo / 100) : "");
  const [stock, setStock] = useState(variant ? String(variant.stockQty) : "0");
  const [pending, setPending] = useState(false);

  async function save() {
    const priceKobo = parseNairaToKobo(price);
    if (priceKobo === null) return toast("Enter a valid price in naira.", { tone: "error" });
    setPending(true);
    const result = await saveVariantAction({
      id: variant?.id,
      productId,
      sizeLabel,
      format,
      priceKobo,
      stockQty: Number.parseInt(stock, 10),
    });
    setPending(false);
    if (!result.ok) return toast(result.error, { tone: "error" });
    toast(variant ? "Variant saved." : "Variant added.");
    router.refresh();
  }

  async function toggle() {
    if (!variant) return;
    setPending(true);
    const result = await setVariantActiveAction(variant.id, !variant.isActive);
    setPending(false);
    if (!result.ok) return toast(result.error, { tone: "error" });
    router.refresh();
  }

  return (
    <tr className={variant && !variant.isActive ? "opacity-60" : undefined}>
      <td className="px-3 py-2">
        <Input aria-label="Size" value={sizeLabel} placeholder="50ml" onChange={(e) => setSizeLabel(e.target.value)} className="py-1.5" />
      </td>
      <td className="px-3 py-2">
        <Select aria-label="Format" value={format} onChange={(e) => setFormat(e.target.value as BottleFormat)} className="py-1.5">
          {BOTTLE_FORMATS.map((f) => (
            <option key={f} value={f}>
              {FORMAT_LABELS[f]}
            </option>
          ))}
        </Select>
      </td>
      <td className="px-3 py-2">
        <Input aria-label="Price in naira" value={price} inputMode="decimal" placeholder="18,000" onChange={(e) => setPrice(e.target.value)} className="py-1.5" />
      </td>
      <td className="px-3 py-2">
        <Input aria-label="Stock" type="number" min={0} value={stock} onChange={(e) => setStock(e.target.value)} className="w-24 py-1.5" />
      </td>
      <td className="px-3 py-2 text-xs">
        {variant ? (
          <button type="button" onClick={toggle} disabled={pending} className={variant.isActive ? "text-success" : "text-muted"}>
            {variant.isActive ? "Active" : "Inactive"}
          </button>
        ) : (
          <span className="text-faint">New</span>
        )}
      </td>
      <td className="px-3 py-2 text-right">
        <Button size="sm" variant={variant ? "ghost" : "primary"} pending={pending} onClick={save} disabled={!sizeLabel || !price}>
          {variant ? "Save" : "Add"}
        </Button>
      </td>
    </tr>
  );
}
