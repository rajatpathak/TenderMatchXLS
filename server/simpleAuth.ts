import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcrypt";
import { storage } from "./storage";

// Read admin credentials from environment variables
const getAdminConfig = () => {
  const username = process.env.ADMIN_USERNAME || "admin";
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const email = process.env.ADMIN_EMAIL || "admin@tendermatch.com";
  
  // For development, allow plain password if hash not set
  const plainPassword = process.env.ADMIN_PASSWORD;
  
  return {
    id: "admin",
    username,
    passwordHash,
    plainPassword,
    firstName: "Admin",
    lastName: "User",
    email,
  };
};

async function verifyPassword(inputPassword: string): Promise<boolean> {
  const config = getAdminConfig();
  
  // In production, use bcrypt hash comparison
  if (config.passwordHash) {
    try {
      return await bcrypt.compare(inputPassword, config.passwordHash);
    } catch (error) {
      console.error("Password verification error:", error);
      return false;
    }
  }
  
  // In development/fallback, allow plain password comparison
  if (config.plainPassword) {
    return inputPassword === config.plainPassword;
  }
  
  // Default fallback for development only (NOT recommended for production)
  if (process.env.NODE_ENV !== "production") {
    console.warn("⚠️  WARNING: Using default development credentials. Set ADMIN_PASSWORD_HASH for production!");
    return inputPassword === "admin";
  }
  
  console.error("❌ No admin password configured. Set ADMIN_PASSWORD_HASH environment variable.");
  return false;
}

async function ensureAdminUserExists() {
  const config = getAdminConfig();
  try {
    const existingUser = await storage.getUser(config.id);
    if (!existingUser) {
      await storage.upsertUser({
        id: config.id,
        email: config.email,
        firstName: config.firstName,
        lastName: config.lastName,
      });
      console.log("Admin user created in database");
    }
  } catch (error) {
    console.error("Error ensuring admin user exists:", error);
  }
}

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  // Validate session secret in production
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET environment variable is required in production");
    }
    console.warn("⚠️  WARNING: Using default session secret. Set SESSION_SECRET for production!");
  }
  
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  
  return session({
    secret: sessionSecret || "dev-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
      sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Login endpoint
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const config = getAdminConfig();
    
    if (username === config.username && await verifyPassword(password)) {
      // Ensure admin user exists in database for foreign key references
      await ensureAdminUserExists();
      
      (req.session as any).user = {
        id: config.id,
        username: config.username,
        firstName: config.firstName,
        lastName: config.lastName,
        email: config.email,
      };
      res.json({ 
        success: true, 
        user: {
          id: config.id,
          firstName: config.firstName,
          lastName: config.lastName,
          email: config.email,
        }
      });
    } else {
      res.status(401).json({ message: "Invalid username or password" });
    }
  });

  // Logout endpoint
  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        res.status(500).json({ message: "Failed to logout" });
      } else {
        res.json({ success: true });
      }
    });
  });

  // Get current user
  app.get("/api/auth/user", (req, res) => {
    const user = (req.session as any)?.user;
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ message: "Not authenticated" });
    }
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  const user = (req.session as any)?.user;
  
  if (user) {
    (req as any).user = user;
    return next();
  }
  
  return res.status(401).json({ message: "Unauthorized" });
};
