import { promises as fs } from "fs";
import path from "path";

import {
  COMPETITION_POINTS_PER_CORRECT_CALL,
  OCTOBER_COMPETITION_ID,
  OCTOBER_COMPETITION_SLUG,
} from "@/lib/competitions/config";

import type {
  CompetitionDefinition,
  CompetitionPrize,
  CompetitionQuestion,
  CompetitionSponsor,
  CompetitionStore,
} from "@/types/competitions";

let writeQueue: Promise<unknown> = Promise.resolve();

function competitionsDirectory() {
  return (
    process.env.COMPETITION_DATA_DIR ??
    path.join(process.cwd(), "data", "competitions")
  );
}

function activeCompetitionPath() {
  return path.join(
    competitionsDirectory(),
    "active.json"
  );
}

function safeSlug(slug: string) {
  return slug
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function competitionDirectory(slug: string) {
  return path.join(
    competitionsDirectory(),
    safeSlug(slug)
  );
}

function competitionPath(slug: string) {
  return path.join(
    competitionDirectory(slug),
    "competition.json"
  );
}

async function ensureRootDirectory() {
  await fs.mkdir(
    competitionsDirectory(),
    { recursive: true }
  );
}

async function ensureDirectory(slug: string) {
  await fs.mkdir(
    competitionDirectory(slug),
    { recursive: true }
  );
}

const DEFAULT_SCORING = {
  maxPoints: 100,
  oneAwayPoints: 70,
  twoAwayPoints: 40,
  otherPoints: 0,
};

function binaryOptions() {
  return [
    { id: "yes", label: "Yes", ordinal: 0 },
    { id: "no", label: "No", ordinal: 1 },
  ];
}

function migrateLegacyQuestion(question: any): CompetitionQuestion {
  const resultOptionId =
    question.resultOptionId ?? question.result ?? null;

  return {
    ...question,
    answerFormat: question.answerFormat ?? "binary",
    options:
      Array.isArray(question.options) && question.options.length
        ? question.options
        : binaryOptions(),
    scoring: question.scoring ?? DEFAULT_SCORING,
    plainEnglish:
      question.plainEnglish ??
      question.description ??
      "Make a call using the stored Closing Bell data shown with this question.",
    hint:
      question.hint ??
      "Review the relevant stock page before making your call.",
    dataToWatch: Array.isArray(question.dataToWatch)
      ? question.dataToWatch
      : ["Wall Street vs tokenized wrappers", "Gap Radar"],
    littleChangeBandPct: question.littleChangeBandPct ?? null,
    resultOptionId,
    settlementIndicativePrice:
      question.settlementIndicativePrice ?? null,
    settlementExecutableSellPrice:
      question.settlementExecutableSellPrice ?? null,
    settlementApproxBreakEvenMovePct:
      question.settlementApproxBreakEvenMovePct ?? null,
    source: {
      generatedAt:
        question.source?.generatedAt ??
        question.publishedAt ??
        Date.now(),
      tickerSnapshotAt:
        question.source?.tickerSnapshotAt ??
        question.publishedAt ??
        Date.now(),
      observations:
        question.source?.observations ?? 0,
      currentBuyGapPct:
        question.source?.currentBuyGapPct ?? null,
      currentSellGapPct:
        question.source?.currentSellGapPct ?? null,
      currentIndicativeGapPct:
        question.source?.currentIndicativeGapPct ?? null,
      currentApproxBreakEvenMovePct:
        question.source?.currentApproxBreakEvenMovePct ?? null,
      currentPercentile:
        question.source?.currentPercentile ?? null,
      currentBenchmarkPrice:
        question.source?.currentBenchmarkPrice ?? null,
      currentIndicativePrice:
        question.source?.currentIndicativePrice ?? null,
      currentExecutableBuyPrice:
        question.source?.currentExecutableBuyPrice ?? null,
      currentExecutableSellPrice:
        question.source?.currentExecutableSellPrice ?? null,
    },
  };
}

function nullableText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeSponsor(raw: any): CompetitionSponsor | null {
  if (raw?.sponsor && typeof raw.sponsor === "object") {
    const name = nullableText(raw.sponsor.name);
    if (!name) return null;

    return {
      name,
      tagline: nullableText(raw.sponsor.tagline) ?? "",
      websiteUrl: nullableText(raw.sponsor.websiteUrl),
      logoUrl: nullableText(raw.sponsor.logoUrl),
    };
  }

  const legacyName = nullableText(raw?.sponsorName);
  if (!legacyName) return null;

  return {
    name: legacyName,
    tagline: nullableText(raw?.sponsorTagline) ?? "",
    websiteUrl: nullableText(raw?.sponsorUrl),
    logoUrl: null,
  };
}

function normalizePrizes(raw: any): CompetitionPrize[] {
  if (!Array.isArray(raw?.prizes)) return [];

  return raw.prizes
    .slice(0, 3)
    .map((item: any, index: number) => {
      const place = Math.min(
        3,
        Math.max(1, Number(item?.place) || index + 1)
      ) as 1 | 2 | 3;

      return {
        place,
        title: nullableText(item?.title) ?? "",
        description: nullableText(item?.description) ?? "",
        imageUrl: nullableText(item?.imageUrl),
        valueText: nullableText(item?.valueText),
      };
    })
    .filter((item: CompetitionPrize) => item.title);
}

function normalizeCompetition(raw: any): CompetitionDefinition {
  return {
    id: String(raw?.id ?? OCTOBER_COMPETITION_ID),
    slug: String(raw?.slug ?? OCTOBER_COMPETITION_SLUG),
    name: String(raw?.name ?? "Closing Bell Competition"),
    shortName: String(
      raw?.shortName ?? raw?.name ?? "Closing Bell Competition"
    ),
    description: String(raw?.description ?? ""),
    startsAt: Number(raw?.startsAt ?? Date.now()),
    endsAt: Number(raw?.endsAt ?? Date.now()),
    pointsPerCorrectCall: Number(
      raw?.pointsPerCorrectCall ??
        COMPETITION_POINTS_PER_CORRECT_CALL
    ),
    sponsor: normalizeSponsor(raw),
    prizes: normalizePrizes(raw),
    createdAt: Number(raw?.createdAt ?? Date.now()),
  };
}

function normalizeStore(raw: any): CompetitionStore {
  if (!raw?.competition) {
    throw new Error("Unsupported competition store format");
  }

  return {
    version: 3,
    competition: normalizeCompetition(raw.competition),
    participants: Array.isArray(raw.participants)
      ? raw.participants
      : [],
    questions: (Array.isArray(raw.questions) ? raw.questions : []).map(
      migrateLegacyQuestion
    ),
    predictions: (Array.isArray(raw.predictions) ? raw.predictions : []).map(
      (prediction: any) => ({
        ...prediction,
        answer: String(prediction.answer ?? ""),
        distance: prediction.distance ?? null,
        correct: prediction.correct ?? null,
        pointsAwarded: prediction.pointsAwarded ?? 0,
      })
    ),
  };
}

function initialOctoberStore(): CompetitionStore {
  const createdAt = Date.now();

  return {
    version: 3,
    competition: {
      id: OCTOBER_COMPETITION_ID,
      slug: OCTOBER_COMPETITION_SLUG,
      name: "Closing Bell October Divergence Challenge",
      shortName: "October Divergence Challenge",
      description:
        "Make free calls on how tokenized-stock wrappers will trade versus Wall Street. Accuracy earns points: exact calls score most, while close calls can still earn partial credit.",
      startsAt: Date.parse("2026-10-01T00:00:00Z"),
      endsAt: Date.parse("2026-11-01T00:00:00Z"),
      pointsPerCorrectCall:
        COMPETITION_POINTS_PER_CORRECT_CALL,
      sponsor: null,
      prizes: [],
      createdAt,
    },
    participants: [],
    questions: [],
    predictions: [],
  };
}

async function atomicWrite(
  slug: string,
  store: CompetitionStore
) {
  await ensureDirectory(slug);

  const file = competitionPath(slug);
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(store, null, 2),
    "utf8"
  );
  await fs.rename(temporary, file);
}

async function writeActiveSlug(slug: string) {
  await ensureRootDirectory();

  const file = activeCompetitionPath();
  const temporary = `${file}.${process.pid}.${Date.now()}.tmp`;

  await fs.writeFile(
    temporary,
    JSON.stringify(
      {
        activeCompetitionSlug: safeSlug(slug),
        updatedAt: Date.now(),
      },
      null,
      2
    ),
    "utf8"
  );
  await fs.rename(temporary, file);
}

async function readCompetitionStoreUnsafe(
  slug: string
): Promise<CompetitionStore> {
  await ensureDirectory(slug);

  try {
    const raw = await fs.readFile(
      competitionPath(slug),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    const normalized = normalizeStore(parsed);

    if (parsed.version !== 3) {
      await atomicWrite(slug, normalized);
    }

    return normalized;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;

    if (
      code === "ENOENT" &&
      safeSlug(slug) === OCTOBER_COMPETITION_SLUG
    ) {
      const initial = initialOctoberStore();
      await atomicWrite(slug, initial);
      return initial;
    }

    throw error;
  }
}

export async function readCompetitionStore(slug: string) {
  await writeQueue.catch(() => undefined);
  return readCompetitionStoreUnsafe(slug);
}

export async function writeCompetitionStore(
  slug: string,
  store: CompetitionStore
) {
  const task = writeQueue.then(() =>
    atomicWrite(slug, store)
  );
  writeQueue = task.catch(() => undefined);
  await task;
}

export async function updateCompetitionStore<T>(
  slug: string,
  updater: (
    store: CompetitionStore
  ) => T | Promise<T>
): Promise<T> {
  let result!: T;

  const task = writeQueue.then(async () => {
    const current =
      await readCompetitionStoreUnsafe(slug);
    result = await updater(current);
    await atomicWrite(slug, current);
  });

  writeQueue = task.catch(() => undefined);
  await task;

  return result;
}

export async function listCompetitions() {
  await writeQueue.catch(() => undefined);
  await ensureRootDirectory();

  const entries = await fs.readdir(
    competitionsDirectory(),
    { withFileTypes: true }
  );

  const rows: Array<{
    slug: string;
    competition: CompetitionDefinition;
    participantCount: number;
    questionCount: number;
    predictionCount: number;
  }> = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    try {
      const store =
        await readCompetitionStoreUnsafe(entry.name);

      rows.push({
        slug: store.competition.slug,
        competition: store.competition,
        participantCount: store.participants.length,
        questionCount: store.questions.length,
        predictionCount: store.predictions.length,
      });
    } catch {
      // Ignore non-competition directories.
    }
  }

  return rows.sort(
    (left, right) =>
      right.competition.startsAt -
      left.competition.startsAt
  );
}

export async function getActiveCompetitionSlug() {
  await ensureRootDirectory();

  try {
    const raw = await fs.readFile(
      activeCompetitionPath(),
      "utf8"
    );
    const parsed = JSON.parse(raw);
    const active = safeSlug(
      String(
        parsed?.activeCompetitionSlug ?? ""
      )
    );

    if (active) {
      await fs.access(competitionPath(active));
      return active;
    }
  } catch {
    // Fall back below.
  }

  try {
    await fs.access(
      competitionPath(OCTOBER_COMPETITION_SLUG)
    );
    await writeActiveSlug(
      OCTOBER_COMPETITION_SLUG
    );
    return OCTOBER_COMPETITION_SLUG;
  } catch {
    const competitions =
      await listCompetitions();

    if (!competitions.length) {
      const initial = initialOctoberStore();
      await atomicWrite(
        OCTOBER_COMPETITION_SLUG,
        initial
      );
      await writeActiveSlug(
        OCTOBER_COMPETITION_SLUG
      );
      return OCTOBER_COMPETITION_SLUG;
    }

    const fallback =
      competitions[0].slug;
    await writeActiveSlug(fallback);
    return fallback;
  }
}

export async function setActiveCompetitionSlug(
  slug: string
) {
  const normalized = safeSlug(slug);

  if (!normalized) {
    throw new Error(
      "Competition slug is required."
    );
  }

  await fs.access(
    competitionPath(normalized)
  );
  await writeActiveSlug(normalized);

  return normalized;
}

export async function createCompetition(input: {
  slug: string;
  name: string;
  shortName: string;
  description: string;
  startsAt: number;
  endsAt: number;
}) {
  const slug = safeSlug(input.slug);

  if (
    !slug ||
    !/^[a-z0-9][a-z0-9._-]{1,79}$/.test(slug)
  ) {
    throw new Error(
      "Use a slug of at least 2 characters containing lowercase letters, numbers, dots, dashes or underscores."
    );
  }

  if (
    !input.name.trim() ||
    !input.shortName.trim() ||
    !input.description.trim()
  ) {
    throw new Error(
      "Name, short name and description are required."
    );
  }

  if (
    !Number.isFinite(input.startsAt) ||
    !Number.isFinite(input.endsAt) ||
    input.endsAt <= input.startsAt
  ) {
    throw new Error(
      "Valid competition start and end dates are required."
    );
  }

  try {
    await fs.access(competitionPath(slug));
    throw new Error(
      "A competition with that slug already exists."
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "A competition with that slug already exists."
    ) {
      throw error;
    }
  }

  const createdAt = Date.now();
  const store: CompetitionStore = {
    version: 3,
    competition: {
      id: `closing-bell-${slug}`,
      slug,
      name: input.name.trim(),
      shortName: input.shortName.trim(),
      description: input.description.trim(),
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      pointsPerCorrectCall:
        COMPETITION_POINTS_PER_CORRECT_CALL,
      sponsor: null,
      prizes: [],
      createdAt,
    },
    participants: [],
    questions: [],
    predictions: [],
  };

  await atomicWrite(slug, store);

  return store.competition;
}
