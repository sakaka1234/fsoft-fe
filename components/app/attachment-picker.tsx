"use client";

import { useEffect, useRef, useState } from "react";
import { Paperclip } from "@phosphor-icons/react/Paperclip";
import { X } from "@phosphor-icons/react/X";

import { cn } from "@/lib/cn";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp", "image/avif"]);
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function isImageFile(file: File | null): boolean {
  return Boolean(file && (IMAGE_TYPES.has(file.type) || /\.(jpe?g|png|gif|webp|avif)$/i.test(file.name)));
}

export function isVideoFile(file: File | null): boolean {
  return Boolean(file && (VIDEO_TYPES.has(file.type) || /\.(mp4|webm|mov)$/i.test(file.name)));
}

type AttachmentPickerProps = {
  disabled?: boolean;
  /** Controlled file, when the caller owns the state. */
  file?: File | null;
  /** Required when `file` is provided. */
  onFileChange?: (file: File | null) => void;
  /** Fires when a file is picked in uncontrolled usage. */
  onFilePicked?: (file: File) => void;
  /** Accessible label for the pick button. */
  label: string;
  className?: string;
};

/**
 * Paperclip button, selected-file chip and, for images and videos, an inline
 * preview of the picked file. Uncontrolled when only onFilePicked is given;
 * controlled with file + onFileChange otherwise.
 */
export function AttachmentPicker({
  disabled,
  file,
  onFileChange,
  onFilePicked,
  label,
  className,
}: AttachmentPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controlled = onFileChange !== undefined;

  const shown = controlled ? file : null;

  function pick(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0] ?? null;
    if (controlled) onFileChange?.(picked);
    else if (picked) onFilePicked?.(picked);
    // Allow picking the same file again after clearing.
    event.target.value = "";
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*,.pdf,.doc,.docx,.txt"
          className="hidden"
          onChange={pick}
          disabled={disabled}
          aria-hidden="true"
          tabIndex={-1}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          aria-label={label}
          title={label}
          className="cursor-pointer rounded-full p-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-ink disabled:opacity-50"
        >
          <Paperclip size={16} />
        </button>
        {shown ? (
          <span className="inline-flex max-w-[16rem] items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-muted">
            <span className="truncate">{shown.name}</span>
            {controlled ? (
              <button
                type="button"
                onClick={() => onFileChange?.(null)}
                aria-label="Bỏ file đính kèm"
                className="cursor-pointer rounded-full p-0.5 transition-colors hover:text-danger"
              >
                <X size={11} />
              </button>
            ) : null}
          </span>
        ) : null}
      </div>
      {shown ? <AttachmentPreview file={shown} /> : null}
    </div>
  );
}

/** Inline preview for images and videos; a plain chip for anything else. */
export function AttachmentPreview({
  file,
  className,
}: {
  file: File | null;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || (!isImageFile(file) && !isVideoFile(file))) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => {
      URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [file]);

  if (!file) return null;

  if (url && isImageFile(file)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={`Xem trước ${file.name}`}
        className={cn(
          "max-h-48 w-auto max-w-full rounded-field border border-line object-cover",
          className,
        )}
      />
    );
  }

  if (url && isVideoFile(file)) {
    return (
      <video
        src={url}
        controls
        className={cn("max-h-48 w-auto max-w-full rounded-field border border-line", className)}
      />
    );
  }

  return null;
}
type ServerAttachmentProps = {
  url: string;
  name?: string | null;
  className?: string;
};

const SERVER_IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i;
const SERVER_VIDEO_EXT = /\.(mp4|webm|mov)(\?|$)/i;

/**
 * Preview for a server-hosted attachment: images and
 * videos render inline, anything else stays a download chip.
 */
export function ServerAttachment({
  url,
  name,
  className,
}: ServerAttachmentProps) {
  const label = name || "File đính kèm";

  if (SERVER_IMAGE_EXT.test(url)) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className={cn("group block w-fit max-w-full", className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={label}
          className="max-h-72 w-auto max-w-full rounded-field border border-line object-cover transition-opacity group-hover:opacity-90"
        />
      </a>
    );
  }

  if (SERVER_VIDEO_EXT.test(url)) {
    return (
      <video
        src={url}
        controls
        className={cn("max-h-72 w-auto max-w-full rounded-field border border-line", className)}
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex w-fit items-center gap-2 rounded-field border border-line bg-surface-2 px-3 py-1.5 text-xs text-muted transition-colors hover:border-ink/25 hover:text-ink",
        className,
      )}
    >
      <Paperclip size={14} className="shrink-0 text-accent" />
      {label}
    </a>
  );
}
