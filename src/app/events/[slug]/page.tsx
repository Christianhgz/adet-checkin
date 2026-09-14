import { notFound } from "next/navigation";
import { getSimpleEvent } from "@/lib/events";
import CheckInView from "./check-in-view";

export default async function EventCheckInPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = getSimpleEvent(slug);
  if (!event) notFound();

  return <CheckInView slug={slug} label={event.label} />;
}
