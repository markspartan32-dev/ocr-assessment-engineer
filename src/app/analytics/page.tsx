import type { Metadata } from "next";
import { Analytics } from "@/components/analytics/Analytics";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Analytics" };

export default function AnalyticsPage() {
  return (
    <>
      <PageHeader eyebrow="Progress" title="Analytics" description="Where you are strong, where you are slipping, and what SM-2 has lined up next." />
      <Analytics />
    </>
  );
}
