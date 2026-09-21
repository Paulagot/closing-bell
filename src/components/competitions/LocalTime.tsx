"use client";

import {
  useEffect,
  useState,
} from "react";

interface Props {
  timestamp: number;
  prefix?: string;
  includeZone?: boolean;
}

export default function LocalTime({
  timestamp,
  prefix,
  includeZone = true,
}: Props) {
  const [
    text,
    setText,
  ] =
    useState(
      ""
    );

  useEffect(
    () => {
      const zone =
        Intl.DateTimeFormat()
          .resolvedOptions()
          .timeZone;

      const date =
        new Date(
          timestamp
        );

      const formatted =
        new Intl.DateTimeFormat(
          undefined,
          {
            weekday:
              "short",

            day:
              "numeric",

            month:
              "short",

            hour:
              "2-digit",

            minute:
              "2-digit",

            timeZoneName:
              includeZone
                ? "short"
                : undefined,
          }
        ).format(
          date
        );

      setText(
        includeZone &&
          zone
          ? `${formatted} · ${zone}`
          : formatted
      );
    },
    [
      timestamp,
      includeZone,
    ]
  );

  if (!text) {
    return (
      <span suppressHydrationWarning>
        {prefix
          ? `${prefix}…`
          : "…"}
      </span>
    );
  }

  return (
    <span>
      {prefix
        ? `${prefix} `
        : ""}
      {text}
    </span>
  );
}
