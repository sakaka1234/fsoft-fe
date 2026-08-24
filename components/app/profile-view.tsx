"use client";

import { useCallback, useRef, useState } from "react";
import { UploadSimple } from "@phosphor-icons/react/UploadSimple";

import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Field, TextArea, TextInput } from "@/components/ui/field";
import { ErrorState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import { getMyProfile, updateMyProfile, uploadAvatar } from "@/lib/api/profile";
import type { ProfileResponse, ProfileUpdateRequest } from "@/lib/api/types";
import { useSession } from "@/lib/auth/use-session";
import { useAsync } from "@/lib/use-async";

/** The link fields, in the order they appear on the form. */
const LINKS = [
  { key: "personalWebsite", label: "Website" },
  { key: "github", label: "GitHub" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "facebook", label: "Facebook" },
  { key: "youtube", label: "YouTube" },
] as const;

type LinkKey = (typeof LINKS)[number]["key"];

/** Empty strings are sent as empty, which is how a field gets cleared. */
function toRequest(form: Record<string, string>): ProfileUpdateRequest {
  return {
    fullName: form.fullName,
    about: form.about,
    personalWebsite: form.personalWebsite,
    github: form.github,
    linkedin: form.linkedin,
    facebook: form.facebook,
    youtube: form.youtube,
  };
}

function toForm(profile: ProfileResponse): Record<string, string> {
  return {
    fullName: profile.fullName ?? "",
    about: profile.about ?? "",
    personalWebsite: profile.personalWebsite ?? "",
    github: profile.github ?? "",
    linkedin: profile.linkedin ?? "",
    facebook: profile.facebook ?? "",
    youtube: profile.youtube ?? "",
  };
}

/**
 * The signed-in user's profile, from /profiles/me.
 *
 * Email is read off the session rather than the profile: /profiles/me does not
 * return one, because the address belongs to the account and not to the
 * editable profile. It is shown read only for the same reason.
 */
export function ProfileView() {
  const session = useSession();
  const fileInput = useRef<HTMLInputElement>(null);

  const profile = useAsync(
    useCallback((signal) => getMyProfile(signal), []),
    "profile-me",
  );

  const [draft, setDraft] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  if (profile.status === "loading") {
    return (
      <Container size="wide">
        <RowSkeleton />
      </Container>
    );
  }

  if (profile.status === "error") {
    return (
      <Container size="wide">
        <ErrorState message={profile.error} onRetry={profile.reload} />
      </Container>
    );
  }

  /* Derived on first render after the fetch rather than synced in an effect,
     which keeps the form editable without a setState-in-effect round trip. */
  const form = draft ?? toForm(profile.data);
  const set = (key: string, value: string) =>
    setDraft({ ...form, [key]: value });

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await updateMyProfile(toRequest(form));
      setDraft(null);
      setSaved(true);
      profile.reload();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not save your profile. Please try again.",
      );
    }
    setSaving(false);
  }

  async function onAvatarPicked(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    try {
      await uploadAvatar(file);
      profile.reload();
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "Could not upload that image.",
      );
    }
    /* Clear it so picking the same file twice still fires a change. */
    event.target.value = "";
  }

  const avatar = profile.data.avatar;

  return (
    <Container size="wide">
      <div className="mx-auto max-w-2xl">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
            Your profile
          </h1>
          <p className="mt-2 text-base text-muted">
            How you appear to other learners on shared decks.
          </p>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 text-center">
          {avatar ? (
            /* Remote host is not known ahead of time, so this stays a plain img
               rather than next/image with a wildcard remotePattern. */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              className="size-24 rounded-full border-2 border-line object-cover shadow-sm"
            />
          ) : (
            <div
              aria-hidden
              className="flex size-24 items-center justify-center rounded-full border-2 border-line bg-surface-2 font-mono text-2xl font-semibold text-muted shadow-sm"
            >
              {(form.fullName || session?.user.email || "?")
                .trim()
                .charAt(0)
                .toUpperCase()}
            </div>
          )}

          <div className="flex flex-col items-center gap-1.5">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              onChange={onAvatarPicked}
              className="hidden"
            />
            <Button
              variant="secondary"
              type="button"
              onClick={() => fileInput.current?.click()}
            >
              <UploadSimple aria-hidden size={16} />
              Change photo
            </Button>
            <p className="max-w-full text-sm font-medium break-all text-muted">
              {session?.user.email}
            </p>
          </div>
        </div>

        <form onSubmit={onSubmit} className="mt-8 w-full">
          <Field id="profile-name" label="Display name">
            <TextInput
              id="profile-name"
              value={form.fullName}
              onChange={(event) => set("fullName", event.target.value)}
            />
          </Field>

          <div className="mt-5">
            <Field id="profile-about" label="About">
              <TextArea
                id="profile-about"
                rows={4}
                value={form.about}
                onChange={(event) => set("about", event.target.value)}
              />
            </Field>
          </div>

          <div className="mt-5 grid gap-5 sm:grid-cols-2">
            {LINKS.map(({ key, label }) => (
              <Field key={key} id={`profile-${key}`} label={label}>
                <TextInput
                  id={`profile-${key}`}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={form[key as LinkKey]}
                  onChange={(event) => set(key, event.target.value)}
                />
              </Field>
            ))}
          </div>

          {error ? (
            <div className="mt-6">
              <ErrorState message={error} />
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save profile"}
            </Button>
            {draft ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDraft(null);
                  setSaved(false);
                }}
              >
                Discard changes
              </Button>
            ) : null}
            {saved && !draft ? (
              <p className="text-sm text-muted">Saved.</p>
            ) : null}
          </div>
        </form>
      </div>
    </Container>
  );
}
