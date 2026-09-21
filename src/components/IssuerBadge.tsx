import {
  ISSUER_META,
} from "@/lib/tokens";


interface Props {
  issuer: string;
}


export default function IssuerBadge({
  issuer,
}: Props) {

  const meta =
    ISSUER_META[
      issuer
    ];


  const color =
    meta?.color ||
    "#6b7280";


  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold whitespace-nowrap"
      style={{
        background:
          `${color}12`,

        color,

        border:
          `1px solid ${color}25`,
      }}
    >
      {issuer}
    </span>
  );
}