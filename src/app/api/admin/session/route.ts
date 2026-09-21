import {
  NextResponse,
} from "next/server";

import {
  COMPETITION_ADMIN_COOKIE,
  competitionAdminSessionMaxAgeSeconds,
  createCompetitionAdminSession,
  verifyCompetitionAdminSecret,
} from "@/lib/competitions/admin";

export const dynamic =
  "force-dynamic";

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const secret =
      String(
        body?.secret ?? ""
      );

    if (
      !verifyCompetitionAdminSecret(
        secret
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Invalid admin password",
        },
        {
          status: 401,
        }
      );
    }

    const response =
      NextResponse.json({
        ok: true,
      });

    response.cookies.set({
      name:
        COMPETITION_ADMIN_COOKIE,
      value:
        createCompetitionAdminSession(),
      httpOnly: true,
      sameSite: "strict",
      secure:
        process.env.NODE_ENV ===
        "production",
      path: "/",
      maxAge:
        competitionAdminSessionMaxAgeSeconds(),
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to sign in",
      },
      {
        status: 400,
      }
    );
  }
}

export async function DELETE() {
  const response =
    NextResponse.json({
      ok: true,
    });

  response.cookies.set({
    name:
      COMPETITION_ADMIN_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV ===
      "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
