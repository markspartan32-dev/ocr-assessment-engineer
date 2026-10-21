import type { Metadata } from "next";
import { ReviewSession } from "@/components/review/ReviewSession";

export const metadata: Metadata = { title: "Flashcard review" };

export default function ReviewPage() {
  return <ReviewSession />;
}
