export interface CompetitionAuthPayload {
  action:
    | "join"
    | "predict";

  wallet: string;
  competitionId: string;

  questionId?: string;
  answer?: string;
  displayName?: string;

  issuedAt: number;
}

export function competitionAuthMessage(
  payload: CompetitionAuthPayload
) {
  return [
    "Closing Bell Competition",
    "Sign this message to prove ownership of your wallet.",
    "",
    JSON.stringify(payload),
  ].join("\n");
}
