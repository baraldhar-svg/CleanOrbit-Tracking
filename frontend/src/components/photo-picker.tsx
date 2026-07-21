import { useRef } from "react";
import { Camera, Upload, X } from "lucide-react";

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

interface PhotoPickerProps {
  value: string;
  onChange: (dataUrl: string) => void;
  name: string;
  dark?: boolean;
}

export function PhotoPicker({ value, onChange, name, dark = false }: PhotoPickerProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const avatarSrc =
    value ||
    `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || "?")}&backgroundColor=0F172A&textColor=D97706`;

  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-xl border p-4 ${
        dark ? "border-slate-700 bg-slate-800/60" : "border-border bg-muted/30"
      }`}
    >
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await fileToDataUrl(f));
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (f) onChange(await fileToDataUrl(f));
          e.target.value = "";
        }}
      />

      <div className="relative">
        <img
          src={avatarSrc}
          alt={name}
          className="h-20 w-20 rounded-full border-4 border-amber-500 object-cover shadow-lg"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            title="Remove photo"
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-400 transition-colors shadow"
          >
            <X size={10} />
          </button>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => galleryRef.current?.click()}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
            dark
              ? "border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-400"
              : "border-border text-muted-foreground hover:border-amber-500 hover:text-amber-600"
          }`}
        >
          <Upload size={11} />
          Gallery
        </button>
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-colors ${
            dark
              ? "border-slate-600 text-slate-300 hover:border-amber-500 hover:text-amber-400"
              : "border-border text-muted-foreground hover:border-amber-500 hover:text-amber-600"
          }`}
        >
          <Camera size={11} />
          Camera
        </button>
      </div>

      <p
        className={`text-center text-[10px] leading-snug ${
          dark ? "text-slate-400" : "text-muted-foreground"
        }`}
      >
        Please upload standard uniform photos only!
        <br />
        <span className="font-semibold text-amber-600 dark:text-amber-400">
          (कृपया युनिफर्म सहितको फोटोमात्र मान्य हुने छ !)
        </span>
      </p>
    </div>
  );
}
