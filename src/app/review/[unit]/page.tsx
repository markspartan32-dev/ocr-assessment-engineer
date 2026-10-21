import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ReviewSession } from "@/components/review/ReviewSession";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { getUnit, UNIT_CODES } from "@/lib/content";

export function generateStaticParams() {
  return UNIT_CODES.map((unit) => ({ unit }));
}

export async function generateMetadata({ params }: PageProps<"/review/[unit]">): Promise<Metadata> {
  const unit = getUnit((await params).unit);
  return { title: unit ? `Review ${unit.code}: ${unit.title}` : "Review" };
}

async function UnitReview({ params }: { params: PageProps<"/review/[unit]">["params"] }) {
  const unit = getUnit((await params).unit);
  if (!unit) notFound();
  return <ReviewSession unitCode={unit.code} />;
}

export default function UnitReviewPage({ params }: PageProps<"/review/[unit]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UnitReview params={params} />
    </Suspense>
  );
}
