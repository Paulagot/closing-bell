import {
  cookies,
} from "next/headers";
import {
  redirect,
} from "next/navigation";

import {
  COMPETITION_ADMIN_COOKIE,
  verifyCompetitionAdminSession,
} from "@/lib/competitions/admin";

export function requireCompetitionAdminPage(
  destination: string
) {
  const session =
    cookies().get(
      COMPETITION_ADMIN_COOKIE
    )?.value;

  if (
    !verifyCompetitionAdminSession(
      session
    )
  ) {
    redirect(
      `/admin/login?next=${encodeURIComponent(
        destination
      )}`
    );
  }
}
