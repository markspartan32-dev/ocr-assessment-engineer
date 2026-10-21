import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { UnitDetail } from "@/components/units/UnitDetail";
import { getUnit, UNIT_CODES } from "@/lib/content";

export function generateStaticParams() {
  return UNIT_CODES.map((unit) => ({ unit }));
}

export async function generateMetadata({ params }: PageProps<"/units/[unit]">): Promise<Metadata> {
  const unit = getUnit((await params).unit);
  return { title: unit ? `${unit.code}: ${unit.title}` : "Unit" };
}

async function Unit({ params }: { params: PageProps<"/units/[unit]">["params"] }) {
  const unit = getUnit((await params).unit);
  if (!unit) notFound();
  return <UnitDetail code={unit.code} />;
}

export default function UnitPage({ params }: PageProps<"/units/[unit]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Unit params={params} />
    </Suspense>
  );
}
