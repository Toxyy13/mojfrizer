"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "./Avatar";

interface AvatarUploaderProps {
  name: string;
  src: string | null;
}

const SIZE = 400;

/** Center-crops to a square and shrinks to a small JPEG, so uploads stay far below the server limit. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available");
  context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Encoding failed"))), "image/jpeg", 0.85),
  );
}

export function AvatarUploader({ name, src }: AvatarUploaderProps) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      const body = new FormData();
      body.set("photo", await shrink(file), "profil.jpg");
      const response = await fetch("/api/profile/avatar", { method: "POST", body });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "Čuvanje slike nije uspelo.");
        return;
      }
      router.refresh();
    } catch {
      setError("Ova slika ne može da se učita. Probajte drugu.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  const remove = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      await fetch("/api/profile/avatar", { method: "DELETE" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-6">
      <Avatar name={name} src={src} size={96} />
      <div className="grid gap-2 text-sm">
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="sr-only"
          id="photo"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <label
          htmlFor="photo"
          className="cursor-pointer justify-self-start border border-neutral-300 px-4 py-2 transition-colors hover:border-burgundy hover:text-burgundy"
        >
          {busy ? "Čuvam…" : src ? "Promeni sliku" : "Dodaj sliku"}
        </label>
        {src && (
          <button type="button" onClick={() => void remove()} disabled={busy} className="justify-self-start text-neutral-500 underline underline-offset-4 hover:text-burgundy">
            Ukloni sliku
          </button>
        )}
        {error && (
          <p className="text-burgundy" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
