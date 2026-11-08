import "server-only";
import { createHash, createHmac, randomBytes } from "node:crypto";

const secret = () => process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

/**
 * An invitation's token is derived from its id with a server secret, so the same link can be shown
 * and copied again later, while the database still keeps only its hash.
 */
export function inviteToken(id: string): string {
  const s = secret();
  return s ? createHmac("sha256", s).update(`invite:${id}`).digest("base64url") : randomBytes(24).toString("base64url");
}

export const tokenHash = (token: string) => createHash("sha256").update(token, "utf8").digest("hex");

/** The link again, when this invitation's token came from inviteToken (older ones were random). */
export function recoverToken(id: string, hash: string): string | null {
  if (!secret()) return null;
  const t = inviteToken(id);
  return tokenHash(t) === hash ? t : null;
}
