import { Suspense } from "react";

import { AppShell } from "@/components/app/app-shell";

/*
  AppShell reads the search params ("Ôn tập" active state) via
  useSearchParams, which bails out of prerendering up to the closest Suspense
  boundary. Wrapping it here keeps every (app) page statically prerenderable
  while the shell renders client side.
*/
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={null}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}