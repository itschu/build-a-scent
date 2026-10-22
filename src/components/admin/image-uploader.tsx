"use client";

/* eslint-disable @next/next/no-img-element -- admin previews of arbitrary uploaded URLs */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";

type Prefix = "ingredients" | "products" | "bottles";

async function uploadFile(file: File, prefix: Prefix): Promise<string> {
  const form = new FormData();
  form.set("prefix", prefix);
  form.set("file", file);
  const res = await fetch("/api/uploads", { method: "POST", body: form });
  const body = (await res.json().catch(() => ({}))) as { publicUrl?: string; error?: string };
  if (!res.ok || !body.publicUrl) throw new Error(body.error ?? "Upload failed");
  return body.publicUrl;
}

/** Ordered list of image URLs: upload to image storage, or paste a URL. */
export function ImageListEditor({
  value,
  onChange,
  prefix,
  max = 8,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  prefix: Prefix;
  max?: number;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError(null);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, max - value.length)) uploaded.push(await uploadFile(file, prefix));
      onChange([...value, ...uploaded]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function addUrl() {
    try {
      const parsed = new URL(url.trim());
      if (!/^https?:$/.test(parsed.protocol)) throw new Error();
      onChange([...value, parsed.toString()]);
      setUrl("");
      setError(null);
    } catch {
      setError("Enter a full image URL starting with https://");
    }
  }

  return (
    <div className="space-y-3">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-3">
          {value.map((src, i) => (
            <li key={`${src}-${i}`} className="relative">
              <img src={src} alt="" className="size-20 border border-line object-cover" />
              <button
                type="button"
                aria-label={`Remove image ${i + 1}`}
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                className="absolute -right-2 -top-2 size-5 rounded-full bg-danger text-xs text-ink"
              >
                ×
              </button>
              {i === 0 && <span className="absolute bottom-0 left-0 bg-gold px-1 text-[0.6rem] text-ink">Main</span>}
            </li>
          ))}
        </ul>
      )}
      {value.length < max && (
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            multiple
            className="sr-only"
            onChange={(e) => onFiles(e.target.files)}
          />
          <Button variant="ghost" size="sm" pending={uploading} onClick={() => fileRef.current?.click()}>
            Upload image
          </Button>
          <span className="text-xs text-faint">or</span>
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://… image URL"
            className="max-w-xs py-1.5"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addUrl();
              }
            }}
          />
          <Button variant="ghost" size="sm" onClick={addUrl} disabled={!url.trim()}>
            Add URL
          </Button>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
