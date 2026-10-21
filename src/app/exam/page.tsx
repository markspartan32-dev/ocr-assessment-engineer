import type { Metadata } from "next";
import { ExamHub } from "@/components/exam/ExamHub";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = { title: "Exam practice" };

export default function ExamPage() {
  return (
    <>
      <PageHeader
        eyebrow="OCR exam technique"
        title="Exam practice"
        description="Answer OCR-style questions under the real command words, then mark yourself against points-based and levels-of-response mark schemes. F200 and F201 are the externally examined units; the NEA units test the knowledge your set assignments rely on."
      />
      <ExamHub />
    </>
  );
}
