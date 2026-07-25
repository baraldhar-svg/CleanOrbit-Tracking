declare namespace Express {
  interface Request {
    tenantId: number;
    userId?: number;
    userRole?: string;
  }
}
