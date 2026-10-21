import type { Metadata } from "next";
import { Settings } from "@/components/settings/Settings";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Preferences" title="Settings" description="Tune your daily workload, back up your progress, or start again." />
      <Settings />
    </>
  );
}
