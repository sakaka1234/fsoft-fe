import { Warning } from "@phosphor-icons/react/dist/ssr/Warning";

/**
 * Errors that belong to the whole submission rather than one field: bad
 * credentials, a duplicate email, an unreachable server.
 */
export function FormMessage({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-2.5 rounded-field border border-danger/40 bg-danger/8 px-4 py-3 text-sm text-ink"
    >
      <Warning
        aria-hidden
        size={17}
        weight="fill"
        className="mt-px shrink-0 text-danger"
      />
      {children}
    </p>
  );
}
