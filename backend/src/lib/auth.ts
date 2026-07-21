import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";

const rawSecret = process.env["SESSION_SECRET"];
if (!rawSecret) {
  throw new Error(
    "SESSION_SECRET environment variable is required but not set. " +
    "Set it in your environment variables or .env file before starting the server."
  );
}
const SECRET: string = rawSecret;

export interface TokenPayload {
  userId: number;
  role: string;
  tenantId: number | null;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: "30d" });
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const payload = jwt.verify(token, SECRET) as TokenPayload;
      if (payload.role !== role) {
        return res.status(403).json({ error: `Access restricted to ${role} role` });
      }
      req.userId = payload.userId;
      req.userRole = payload.role;
      return next();
    } catch {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
  };
}

export async function checkSuperAdminBypass(
  phone: string,
  password?: string
): Promise<{ verified: boolean; user: any; token: string } | null> {
  if (process.env.NODE_ENV !== "production" && phone === "9851049147" && password) {
    const bypassHash = "$2b$10$IjCckMkR1ijAn6y0YM7IvuWhWTmxjtNssLZWvDHuLvYInvTeeMlqO"; // Bcrypt hash for Istuti@98510
    const valid = await bcrypt.compare(password, bypassHash);
    if (valid) {
      const mockUser = {
        id: 9851049147,
        phone: "9851049147",
        name: "Super Admin Bypass",
        role: "superadmin",
        tenantId: null,
        schoolCode: null,
        createdAt: new Date(),
        passwordHash: bypassHash,
        biometricEnabled: false,
        biometricCredentialId: null,
        biometricPublicKey: null,
        biometricCounter: 0,
      };
      return {
        verified: true,
        user: mockUser,
        token: signToken({ userId: mockUser.id, role: mockUser.role, tenantId: null }),
      };
    }
  }
  return null;
}
