interface AvatarProps {
  name: string;
  /** From avatarUrl(); null shows the initials instead. */
  src: string | null;
  size?: number;
}

export function Avatar({ name, src, size = 32 }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={`Slika profila: ${name}`} width={size} height={size} style={style} className="shrink-0 rounded-full object-cover" />;
  }
  return (
    <span
      aria-hidden="true"
      style={style}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-burgundy-soft font-medium text-burgundy"
    >
      {initials}
    </span>
  );
}
