import type { Metadata } from "next";

import { AdminGate } from "@/components/app/admin-gate";

export const metadata: Metadata = {
  title: "Quản trị",
};

export default function AdminPage() {
  return <AdminGate />;
}
