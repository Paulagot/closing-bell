import { NextResponse } from "next/server";

import { requireCompetitionAdmin } from "@/lib/competitions/admin";
import {
  readCompetitionStore,
  updateCompetitionStore,
} from "@/lib/competitions/storage";

import type {
  CompetitionPrize,
  CompetitionSponsor,
} from "@/types/competitions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableText(value: unknown) {
  const valueText = text(value);
  return valueText || null;
}

function parseSponsor(value: unknown): CompetitionSponsor | null {
  if (!value || typeof value !== "object") return null;

  const raw = value as Record<string, unknown>;
  const name = text(raw.name);

  if (!name) return null;

  return {
    name,
    tagline: text(raw.tagline),
    websiteUrl: nullableText(raw.websiteUrl),
    logoUrl: nullableText(raw.logoUrl),
  };
}

function parsePrizes(value: unknown): CompetitionPrize[] {
  if (!Array.isArray(value)) return [];

  return value.slice(0, 3).map((item, index) => {
    const raw =
      item && typeof item === "object"
        ? (item as Record<string, unknown>)
        : {};

    return {
      place: (index + 1) as 1 | 2 | 3,
      title: text(raw.title),
      description: text(raw.description),
      imageUrl: nullableText(raw.imageUrl),
      valueText: nullableText(raw.valueText),
    };
  }).filter((prize) => prize.title);
}

export async function GET(
  request: Request,
  context: { params: { slug: string } }
) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const store = await readCompetitionStore(
      String(context.params.slug ?? "").trim()
    );

    return NextResponse.json({ competition: store.competition });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to load competition settings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  context: { params: { slug: string } }
) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const name = text(body?.name);
    const shortName = text(body?.shortName);
    const description = text(body?.description);
    const startsAt = Number(body?.startsAt);
    const endsAt = Number(body?.endsAt);

    if (!name || !shortName || !description) {
      return NextResponse.json(
        { error: "Name, short name and description are required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(startsAt) || !Number.isFinite(endsAt)) {
      return NextResponse.json(
        { error: "Valid start and end dates are required." },
        { status: 400 }
      );
    }

    if (endsAt <= startsAt) {
      return NextResponse.json(
        { error: "Competition end date must be after the start date." },
        { status: 400 }
      );
    }

    const sponsor = parseSponsor(body?.sponsor);
    const prizes = parsePrizes(body?.prizes);
    const slug = String(context.params.slug ?? "").trim();

    const competition = await updateCompetitionStore(slug, (store) => {
      store.competition.name = name;
      store.competition.shortName = shortName;
      store.competition.description = description;
      store.competition.startsAt = startsAt;
      store.competition.endsAt = endsAt;
      store.competition.sponsor = sponsor;
      store.competition.prizes = prizes;

      return store.competition;
    });

    return NextResponse.json({ ok: true, competition });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Unable to save competition settings",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
