import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/PageHeader";
import { UnitGrid } from "@/components/units/UnitGrid";

export const metadata: Metadata = { title: "Units F200–F206" };

export default function UnitsPage() {
  return (
    <>
      <PageHeader
        eyebrow="H019 / H119 specification"
        title="Units F200–F206"
        description="Every unit's topic areas, flashcards and exam-style questions. The Certificate is F200 and F202; the Extended Certificate adds F201 and two optional units from F203–F206."
      />
      <UnitGrid />
    </>
  );
}
