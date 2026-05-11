import { Request, Response, NextFunction } from "express";
import { authMiddleware } from "./auth";

export function adminOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    if (req.userRole !== "ADMIN" && req.userRole !== "SUPERADMIN") {
      res.status(403).json({ error: "Access denied. Admin role required." });
      return;
    }
    next();
  });
}

export function superAdminOnlyMiddleware(req: Request, res: Response, next: NextFunction): void {
  authMiddleware(req, res, () => {
    if (req.userRole !== "SUPERADMIN") {
      res.status(403).json({ error: "Access denied. Super Admin role required." });
      return;
    }
    next();
  });
}
