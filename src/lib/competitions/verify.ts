import {
  createPublicKey,
  verify,
} from "crypto";

import {
  PublicKey,
} from "@solana/web3.js";

import {
  competitionAuthMessage,
  type CompetitionAuthPayload,
} from "@/lib/competitions/authMessage";

const MAX_MESSAGE_AGE_MS =
  5 * 60 * 1000;

/**
 * Ed25519 SubjectPublicKeyInfo DER prefix.
 * A Solana address is the raw 32-byte Ed25519 public key.
 */
const ED25519_SPKI_PREFIX =
  Buffer.from(
    "302a300506032b6570032100",
    "hex"
  );

export function verifyCompetitionSignature(
  payload: CompetitionAuthPayload,
  signatureBase64: string
) {
  if (
    Math.abs(
      Date.now() -
        payload.issuedAt
    ) >
    MAX_MESSAGE_AGE_MS
  ) {
    return false;
  }

  try {
    const publicKey =
      new PublicKey(
        payload.wallet
      );

    const rawKey =
      Buffer.from(
        publicKey.toBytes()
      );

    const key =
      createPublicKey({
        key:
          Buffer.concat([
            ED25519_SPKI_PREFIX,
            rawKey,
          ]),

        format:
          "der",

        type:
          "spki",
      });

    return verify(
      null,
      Buffer.from(
        competitionAuthMessage(
          payload
        ),
        "utf8"
      ),
      key,
      Buffer.from(
        signatureBase64,
        "base64"
      )
    );
  } catch {
    return false;
  }
}
