import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { StorePort, UserAccount } from "./store-port";

const scryptAsync = promisify(scrypt);

export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h
export const KEY_LEN = 64;

/** Hash de senha com scrypt (N=16384) — sem deps nativas. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  return `scrypt$16384$${salt}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "scrypt") return false;
  const [, n, salt, hex] = parts;
  if (n !== "16384" || !salt || !hex) return false;
  const key = (await scryptAsync(password, salt, KEY_LEN)) as Buffer;
  const expected = Buffer.from(hex, "hex");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function newSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: sha256(token) };
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export interface LoginResult {
  ok: boolean;
  reason?: "invalid_credentials" | "user_disabled";
  sessionToken?: string;
  user?: { id: string; email: string; name: string; role: UserAccount["role"] };
}

/** Login local: verifica senha scrypt e emite sessão persistida. */
export async function login(
  store: StorePort,
  email: string,
  password: string,
): Promise<LoginResult> {
  const user = await store.findUserByEmail(email);
  if (!user) {
    // equaliza tempo contra enumeração de usuários
    await verifyPassword(password, "scrypt$16384$" + "0".repeat(32) + "$" + "0".repeat(128));
    return { ok: false, reason: "invalid_credentials" };
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return { ok: false, reason: "invalid_credentials" };
  const { token, tokenHash } = newSessionToken();
  await store.createSession({
    userId: user.id,
    workspaceId: store.workspace.id,
    role: user.role,
    tokenHash,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
  });
  return {
    ok: true,
    sessionToken: token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

export async function logout(store: StorePort, tokenHash: string): Promise<void> {
  await store.revokeSession(tokenHash);
}

/** Resolve sessão → usuário. Retorna null se inválida/expirada/revogada. */
export async function resolveSession(
  store: StorePort,
  tokenHash: string,
): Promise<{ user: UserAccount; session: { role: UserAccount["role"]; expiresAt: string } } | null> {
  const session = await store.getSessionByTokenHash(tokenHash);
  if (!session) return null;
  const user = await store.getUser(session.userId);
  if (!user) return null;
  await store.touchSession(tokenHash);
  return { user, session: { role: session.role, expiresAt: session.expiresAt } };
}
