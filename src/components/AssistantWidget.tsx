import { AssistantChat } from "./AssistantChat";

interface AssistantWidgetProps {
  slug?: string;
  salonName?: string;
  admin?: boolean;
}

/** Renders the AI chat only when the assistant is configured, so customers never see a dead button. */
export function AssistantWidget({ slug, salonName, admin }: AssistantWidgetProps) {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  return <AssistantChat slug={slug} salonName={salonName} admin={admin} />;
}
