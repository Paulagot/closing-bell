import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { requireCompetitionAdmin } from "@/lib/competitions/admin";
import {
  COMPETITION_LOCK_BEFORE_SETTLEMENT_MS,
} from "@/lib/competitions/config";
import {
  buildCompetitionSourceEvidence,
} from "@/lib/competitions/questionGenerator";
import { updateCompetitionStore } from "@/lib/competitions/storage";
import { buildHistoryAnalytics } from "@/lib/history/analytics";
import { readHistory } from "@/lib/history/storage";

import type {
  CompetitionQuestionCandidate,
} from "@/types/competitions";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: { slug: string } }
) {
  if (!requireCompetitionAdmin(request)) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const slug = String(context.params.slug ?? "").trim();

  try {
    const body = await request.json();
    const candidate = body?.candidate as CompetitionQuestionCandidate;

    if (
      !candidate ||
      !candidate.candidateId ||
      !candidate.ticker ||
      !candidate.title ||
      !Array.isArray(candidate.options) ||
      candidate.options.length < 2 ||
      !Number.isFinite(candidate.suggestedSettlementAt)
    ) {
      return NextResponse.json(
        { error: "Invalid question candidate." },
        { status: 400 }
      );
    }

    const now = Date.now();

    if (
      candidate.source.tickerSnapshotAt > now ||
      now - candidate.source.generatedAt > 15 * 60 * 1000
    ) {
      return NextResponse.json(
        {
          error:
            "Candidate is stale. Generate a fresh candidate before publishing.",
        },
        { status: 400 }
      );
    }

    const history = (await readHistory(candidate.ticker))
      .filter((snapshot) => snapshot.timestamp <= now)
      .sort((a, b) => a.timestamp - b.timestamp);

    if (history.length === 0) {
      return NextResponse.json(
        {
          error:
            "No stored history was available at publication time.",
        },
        { status: 400 }
      );
    }

    const publicationSnapshot = history[history.length - 1];
    const analytics = buildHistoryAnalytics(
      candidate.ticker,
      history
    );

    const issuerAnalytics =
      analytics.issuers.find(
        (issuer) =>
          issuer.issuer === candidate.issuer ||
          issuer.symbol === candidate.symbol
      ) ??
      analytics.issuers.find(
        (issuer) => issuer.currentBuyGapPct !== null
      ) ??
      null;

    const issuerSnapshot =
      publicationSnapshot.issuers.find(
        (issuer) =>
          issuer.issuer === candidate.issuer ||
          issuer.symbol === candidate.symbol
      ) ??
      publicationSnapshot.issuers.find(
        (issuer) => issuer.buyGapPct !== null
      ) ??
      null;

    if (!issuerAnalytics || !issuerSnapshot) {
      return NextResponse.json(
        {
          error:
            "The latest stored snapshot no longer contains enough data for this question. Generate a fresh candidate.",
        },
        { status: 400 }
      );
    }

    const refreshedSource = buildCompetitionSourceEvidence(
      publicationSnapshot,
      issuerSnapshot,
      issuerAnalytics,
      now
    );

    const question = await updateCompetitionStore(
      slug,
      (store) => {
        const settlementAt = candidate.suggestedSettlementAt;

        const lockAt = Math.max(
          now + 15 * 60 * 1000,
          settlementAt -
            COMPETITION_LOCK_BEFORE_SETTLEMENT_MS
        );

        const published = {
          id: randomUUID(),
          competitionId: store.competition.id,
          type: candidate.type,
          answerFormat: candidate.answerFormat,
          ticker: candidate.ticker,
          stockName: candidate.stockName,
          issuer: candidate.issuer,
          symbol: candidate.symbol,
          sizeUsd: candidate.sizeUsd,
          title: candidate.title,
          description: candidate.description,
          plainEnglish: candidate.plainEnglish,
          hint: candidate.hint,
          dataToWatch: candidate.dataToWatch,
          options: candidate.options,
          scoring: candidate.scoring,
          thresholdPct: candidate.thresholdPct,
          direction: candidate.direction,
          littleChangeBandPct: candidate.littleChangeBandPct,
          publishedAt: now,
          lockAt,
          settlementAt,
          status: "open" as const,
          source: refreshedSource,
          resultOptionId: null,
          settledAt: null,
          settlementSnapshotAt: null,
          settlementBuyGapPct: null,
          settlementBenchmarkPrice: null,
          settlementIndicativePrice: null,
          settlementExecutableBuyPrice: null,
          settlementExecutableSellPrice: null,
          settlementApproxBreakEvenMovePct: null,
          voidReason: null,
        };

        store.questions.push(published);

        return published;
      }
    );

    return NextResponse.json({
      ok: true,
      question,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : String(error),
      },
      { status: 400 }
    );
  }
}
