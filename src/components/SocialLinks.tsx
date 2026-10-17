import { SOCIAL_LABELS, SOCIAL_NETWORKS, safeSocialUrl, type SocialNetwork } from "@/lib/socialLinks";

const ICONS: Record<SocialNetwork, string> = {
  instagram:
    "M7.5 2h9A5.5 5.5 0 0 1 22 7.5v9a5.5 5.5 0 0 1-5.5 5.5h-9A5.5 5.5 0 0 1 2 16.5v-9A5.5 5.5 0 0 1 7.5 2Zm0 2A3.5 3.5 0 0 0 4 7.5v9A3.5 3.5 0 0 0 7.5 20h9a3.5 3.5 0 0 0 3.5-3.5v-9A3.5 3.5 0 0 0 16.5 4h-9ZM12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10Zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6Zm5.25-3.25a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5Z",
  facebook: "M13.5 22v-8.2h2.8l.5-3.3h-3.3V8.4c0-.9.4-1.7 1.8-1.7h1.6V3.8S15.6 3.5 14.3 3.5c-2.7 0-4.3 1.6-4.3 4.5v2.5H7.2v3.3H10V22h3.5Z",
  tiktok: "M16.5 2h-3.2v13.2a2.8 2.8 0 1 1-2.8-2.8c.3 0 .6 0 .8.1V9.2a6 6 0 1 0 5.2 5.9V8.8a7.3 7.3 0 0 0 4.2 1.3V6.9A4.3 4.3 0 0 1 16.5 2Z",
};

type Props = { instagram?: string | null; facebook?: string | null; tiktok?: string | null };

// Icon links for the social profiles a salon filled in; renders nothing when there are none.
export function SocialLinks(props: Props) {
  const links = SOCIAL_NETWORKS.flatMap((network) => {
    const href = safeSocialUrl(network, props[network]);
    return href ? [{ network, href }] : [];
  });
  if (links.length === 0) return null;
  return (
    <ul className="mt-3 flex gap-2" aria-label="Društvene mreže">
      {links.map(({ network, href }) => (
        <li key={network}>
          <a href={href} target="_blank" rel="noopener noreferrer" aria-label={SOCIAL_LABELS[network]} title={SOCIAL_LABELS[network]} className="btn-secondary btn-sm !px-2.5">
            <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden>
              <path d={ICONS[network]} />
            </svg>
          </a>
        </li>
      ))}
    </ul>
  );
}
