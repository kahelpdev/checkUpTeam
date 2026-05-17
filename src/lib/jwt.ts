import { SignJWT, jwtVerify } from "jose";

export type JwtPayload = {
  userId: string;
  email: string;
  name: string;
  role: "admin" | "lider" | "viewer";
};

const SECRET_RAW = process.env.AUTH_SECRET;
if (!SECRET_RAW) {
  throw new Error("AUTH_SECRET environment variable is required and must not be empty");
}
export const COOKIE_NAME = "checkup_session";
export const MAX_AGE = 60 * 60 * 24; // 24h

function getSecret() {
  return new TextEncoder().encode(SECRET_RAW);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("24h")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}
