"use client";

import { useCallback, useState } from "react";
import { Trash } from "@phosphor-icons/react/Trash";
import { UserPlus } from "@phosphor-icons/react/UserPlus";

import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextInput } from "@/components/ui/field";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/app/states";
import { ApiError } from "@/lib/api/client";
import {
  listDeckShares,
  removeDeckShare,
  setSharePermission,
  shareDeck,
} from "@/lib/api/decks";
import type { SharePermission } from "@/lib/api/types";
import { useAsync } from "@/lib/use-async";

type DeckSharePanelProps = {
  deckId: number;
};

/**
 * Who a deck is shared with, and the form to add someone.
 *
 * This screen could not exist until recently: the share endpoint used to name
 * its recipient by profile UUID with nothing to resolve one, so the only
 * possible form would have asked people to paste a UUID. It takes an email
 * now.
 *
 * The share link half of the API is deliberately absent here. Its toggle never
 * sets the flag it is meant to set, so the link it mints can never be redeemed;
 * see toggleShareLink in lib/api/decks.ts.
 */
export function DeckSharePanel({ deckId }: DeckSharePanelProps) {
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<SharePermission>("VIEW");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyProfileId, setBusyProfileId] = useState<string | null>(null);

  const shares = useAsync(
    useCallback(
      (signal) => listDeckShares(deckId, 0, 20, signal),
      [deckId],
    ),
    `deck-shares-${deckId}`,
  );

  /** One place to turn a failed call into a message, for all four actions. */
  async function run(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      shares.reload();
      return true;
    } catch (cause) {
      setError(
        cause instanceof ApiError
          ? cause.message
          : "That did not work. Please try again.",
      );
      return false;
    }
  }

  async function onShare(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setBusy(true);
    const ok = await run(() => shareDeck(deckId, trimmed, permission));
    if (ok) setEmail("");
    setBusy(false);
  }

  async function onChangePermission(
    profileId: string,
    next: SharePermission,
  ) {
    setBusyProfileId(profileId);
    await run(() => setSharePermission(deckId, profileId, next));
    setBusyProfileId(null);
  }

  async function onRemove(profileId: string) {
    setBusyProfileId(profileId);
    await run(() => removeDeckShare(deckId, profileId));
    setBusyProfileId(null);
  }

  const rows = shares.data?.content ?? [];

  return (
    <section className="mt-14" aria-labelledby="share-title">
      <h2 id="share-title" className="text-xl font-semibold tracking-tight">
        Shared with
      </h2>
      <p className="mt-2 text-sm text-muted">
        People you add here can open this deck from their own account. They need
        one already; there is no invite by email yet.
      </p>

      <form onSubmit={onShare} className="mt-5 flex flex-wrap items-end gap-3">
        <Field id="share-email" label="Email" className="min-w-64 flex-1">
          <TextInput
            id="share-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@example.com"
            autoComplete="off"
          />
        </Field>

        <Field id="share-permission" label="Access" className="w-40">
          <SelectInput
            id="share-permission"
            value={permission}
            onChange={(event) =>
              setPermission(event.target.value as SharePermission)
            }
          >
            <option value="VIEW">Can view</option>
            <option value="EDIT">Can edit</option>
          </SelectInput>
        </Field>

        <Button type="submit" disabled={busy || !email.trim()}>
          <UserPlus aria-hidden size={16} />
          {busy ? "Sharing..." : "Share"}
        </Button>
      </form>

      {error ? (
        <div className="mt-4">
          <ErrorState message={error} />
        </div>
      ) : null}

      <div className="mt-6">
        {shares.status === "loading" ? (
          <RowSkeleton />
        ) : shares.status === "error" ? (
          <ErrorState message={shares.error} onRetry={shares.reload} />
        ) : rows.length === 0 ? (
          <EmptyState
            title="Not shared with anyone"
            body="Add someone above and they will show up here."
          />
        ) : (
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {rows.map((share) => (
              <li
                key={share.profileId}
                className="flex flex-wrap items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    {share.fullName?.trim() || share.email}
                  </p>
                  {share.fullName?.trim() ? (
                    <p className="truncate text-sm text-muted">{share.email}</p>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <SelectInput
                    aria-label={`Access for ${share.email}`}
                    value={share.permission}
                    disabled={busyProfileId === share.profileId}
                    onChange={(event) =>
                      onChangePermission(
                        share.profileId,
                        event.target.value as SharePermission,
                      )
                    }
                    className="w-36"
                  >
                    <option value="VIEW">Can view</option>
                    <option value="EDIT">Can edit</option>
                  </SelectInput>

                  <Button
                    variant="secondary"
                    aria-label={`Remove ${share.email}`}
                    disabled={busyProfileId === share.profileId}
                    onClick={() => onRemove(share.profileId)}
                  >
                    <Trash aria-hidden size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
