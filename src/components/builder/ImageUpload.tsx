import { useRef, useState } from "react"
import { supabase } from "@/lib/supabase"
import { friendlyError } from "@/lib/errors"
import { Upload, X } from "lucide-react"

interface ImageUploadProps {
  value: string | undefined
  onChange: (url: string | undefined) => void
  storagePath: string // e.g. "{id}/hero.jpg"
  label: string
  hint?: string
  aspectHint?: string // e.g. "16:9 recommended"
}

const ImageUpload = ({ value, onChange, storagePath, label, hint, aspectHint }: ImageUploadProps) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.")
      return
    }
    setError(null)
    setUploading(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from("proposal-assets")
        .upload(storagePath, file, { upsert: true, contentType: file.type })

      if (uploadError) {
        setError(friendlyError(uploadError.message))
        return
      }

      const { data } = supabase.storage.from("proposal-assets").getPublicUrl(storagePath)
      // Bust cache so preview refreshes after re-upload
      onChange(data.publicUrl + `?t=${Date.now()}`)
    } finally {
      setUploading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const remove = async () => {
    onChange(undefined)
    // Best-effort delete from storage
    await supabase.storage.from("proposal-assets").remove([storagePath])
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {aspectHint && <p className="text-xs text-muted-foreground/60">{aspectHint}</p>}
      </div>

      {value ? (
        <div className="relative overflow-hidden rounded-lg border border-border">
          <img src={value} alt="" className="h-32 w-full object-cover" />
          <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
            <button
              onClick={() => inputRef.current?.click()}
              className="rounded-full bg-white/90 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-white transition-colors"
            >
              Replace
            </button>
            <button
              onClick={remove}
              className="rounded-full bg-white/90 p-1.5 text-foreground hover:bg-white transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <div
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-6 text-muted-foreground hover:border-foreground hover:text-foreground transition-colors"
        >
          <Upload className="h-4 w-4" />
          <p className="text-xs font-medium">
            {uploading ? "Uploading..." : "Click or drag to upload"}
          </p>
          {hint && <p className="text-xs text-muted-foreground/60">{hint}</p>}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
    </div>
  )
}

export default ImageUpload
