import {
  createHmac,
  timingSafeEqual,
} from "crypto";

export const COMPETITION_ADMIN_COOKIE =
  "closingbell_admin";

const SESSION_TTL_MS =
  12 * 60 * 60 * 1000;

function configuredSecret() {
  return (
    process.env.COMPETITION_ADMIN_SECRET ??
    ""
  );
}

function safeEqual(
  left: string,
  right: string
) {
  const leftBuffer =
    Buffer.from(left);
  const rightBuffer =
    Buffer.from(right);

  if (
    leftBuffer.length !==
    rightBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    leftBuffer,
    rightBuffer
  );
}

function signature(
  payload: string
) {
  const secret =
    configuredSecret();

  if (!secret) {
    return "";
  }

  return createHmac(
    "sha256",
    secret
  )
    .update(payload)
    .digest("base64url");
}

export function verifyCompetitionAdminSecret(
  supplied: string
) {
  const configured =
    configuredSecret();

  return Boolean(
    configured &&
      supplied &&
      safeEqual(
        supplied,
        configured
      )
  );
}

export function createCompetitionAdminSession() {
  const payload =
    Buffer.from(
      JSON.stringify({
        exp:
          Date.now() +
          SESSION_TTL_MS,
      })
    ).toString("base64url");

  return `${payload}.${signature(payload)}`;
}

export function verifyCompetitionAdminSession(
  token: string | null | undefined
) {
  if (!token) {
    return false;
  }

  const [
    payload,
    suppliedSignature,
  ] = token.split(".");

  if (
    !payload ||
    !suppliedSignature
  ) {
    return false;
  }

  const expectedSignature =
    signature(payload);

  if (
    !expectedSignature ||
    !safeEqual(
      suppliedSignature,
      expectedSignature
    )
  ) {
    return false;
  }

  try {
    const parsed =
      JSON.parse(
        Buffer.from(
          payload,
          "base64url"
        ).toString("utf8")
      );

    return (
      Number.isFinite(parsed?.exp) &&
      Number(parsed.exp) > Date.now()
    );
  } catch {
    return false;
  }
}

function cookieValue(
  request: Request
) {
  const cookieHeader =
    request.headers.get("cookie") ??
    "";

  for (
    const part
    of cookieHeader.split(";")
  ) {
    const [name, ...rest] =
      part.trim().split("=");

    if (
      name ===
      COMPETITION_ADMIN_COOKIE
    ) {
      return decodeURIComponent(
        rest.join("=")
      );
    }
  }

  return null;
}

export function requireCompetitionAdmin(
  request: Request
) {
  const session =
    cookieValue(request);

  if (
    verifyCompetitionAdminSession(
      session
    )
  ) {
    return true;
  }

  // Backwards-compatible header auth for any existing
  // local tooling while the browser uses the session cookie.
  const supplied =
    request.headers.get(
      "x-competition-admin-secret"
    ) ?? "";

  return verifyCompetitionAdminSecret(
    supplied
  );
}

export function competitionAdminSessionMaxAgeSeconds() {
  return Math.floor(
    SESSION_TTL_MS / 1000
  );
}
