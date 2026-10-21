import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ExamPractice } from "@/components/exam/ExamPractice";
import { PageSkeleton } from "@/components/ui/Skeleton";
import { getUnit, UNIT_CODES } from "@/lib/content";

export function generateStaticParams() {
  return UNIT_CODES.map((unit) => ({ unit }));
}

export async function generateMetadata({ params }: PageProps<"/exam/[unit]">): Promise<Metadata> {
  const unit = getUnit((await params).unit);
  return { title: unit ? `Exam practice ${unit.code}: ${unit.title}` : "Exam practice" };
}

async function UnitExam({ params }: { params: PageProps<"/exam/[unit]">["params"] }) {
  const unit = getUnit((await params).unit);
  if (!unit) notFound();
  return <ExamPractice unitCode={unit.code} />;
}

export default function UnitExamPage({ params }: PageProps<"/exam/[unit]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <UnitExam params={params} />
    </Suspense>
  );
}
