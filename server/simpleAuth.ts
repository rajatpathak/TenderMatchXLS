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
  const isProduction = process.env.NODE_ENV === "production";
  
  console.log(`🔐 Login attempt - Production mode: ${isProduction}`);
  console.log(`🔐 Password hash configured: ${!!config.passwordHash}`);
  console.log(`🔐 Hash starts with: ${config.passwordHash ? config.passwordHash.substring(0, 10) + '...' : 'N/A'}`);
  
  // In production, ONLY accept bcrypt hash - reject plaintext passwords
  if (isProduction) {
    if (!config.passwordHash) {
      console.error("❌ ADMIN_PASSWORD_HASH is required in production. Plaintext passwords are not allowed.");
      return false;
    }
    try {
      const result = await bcrypt.compare(inputPassword, config.passwordHash);
      console.log(`🔐 Bcrypt comparison result: ${result}`);
      return result;
    } catch (error) {
      console.error("Password verification error:", error);
      return false;
    }
  }
  
  // Development mode: prefer hash, but allow fallbacks
  if (config.passwordHash) {
    try {
      return await bcrypt.compare(inputPassword, config.passwordHash);
    } catch (error) {
      console.error("Password verification error:", error);
      return false;
    }
  }
  
  // Development fallback: allow plain password from env
  if (config.plainPassword) {
    console.warn("⚠️  WARNING: Using plaintext ADMIN_PASSWORD. Use ADMIN_PASSWORD_HASH for production!");
    return inputPassword === config.plainPassword;
  }
  
  // Development fallback: allow default credentials
  console.warn("⚠️  WARNING: Using default dev credentials (admin/admin). Set ADMIN_PASSWORD_HASH for production!");
  return inputPassword === "admin";
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
  
  // Allow disabling secure cookies for HTTP-only deployments (testing/internal)
  const isProduction = process.env.NODE_ENV === "production";
  const disableSecureCookies = process.env.DISABLE_SECURE_COOKIES === "true";
  
  if (isProduction && disableSecureCookies) {
    console.warn("⚠️  WARNING: Secure cookies disabled. Only use this for testing or internal networks!");
  }
  
  return session({
    secret: sessionSecret || "dev-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction && !disableSecureCookies,
      maxAge: sessionTtl,
      sameSite: (isProduction && !disableSecureCookies) ? "strict" : "lax",
    },
  });
}

export async function setupAuth(app: Express) {
  // Runtime validation for production
  if (process.env.NODE_ENV === "production") {
    if (!process.env.ADMIN_PASSWORD_HASH) {
      throw new Error(
        "ADMIN_PASSWORD_HASH is required in production. " +
        "Generate with: node scripts/generate-password-hash.js <password>"
      );
    }
    if (!process.env.SESSION_SECRET) {
      throw new Error("SESSION_SECRET is required in production");
    }
    console.log("✅ Production authentication configured with bcrypt hash");
  } else {
    if (!process.env.ADMIN_PASSWORD_HASH) {
      console.warn("⚠️  Development mode: Using fallback admin credentials (admin/admin)");
    }
  }

  app.set("trust proxy", 1);
  app.use(getSession());

  // Login endpoint - supports both admin and team members
  app.post("/api/login", async (req, res) => {
    const { username, password } = req.body;
    const config = getAdminConfig();
    
    // Check admin credentials first
    if (username === config.username && await verifyPassword(password)) {
      // Ensure admin user exists in database for foreign key references
      await ensureAdminUserExists();
      
      (req.session as any).user = {
        id: config.id,
        username: config.username,
        firstName: config.firstName,
        lastName: config.lastName,
        email: config.email,
        role: 'admin',
      };
      
      // Log admin login
      try {
        await storage.createAuditLog({
          action: 'login',
          category: 'auth',
          userId: config.id,
          userName: username,
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log admin login:", e);
      }
      
      res.json({ 
        success: true, 
        user: {
          id: config.id,
          firstName: config.firstName,
          lastName: config.lastName,
          email: config.email,
          role: 'admin',
        }
      });
      return;
    }
    
    // Check team members
    try {
      const teamMember = await storage.getTeamMemberByUsername(username);
      console.log(`🔐 Team member found: ${!!teamMember}`);
      if (teamMember) {
        console.log(`🔐 Team member active: ${teamMember.isActive}`);
        console.log(`🔐 Team member password exists: ${!!teamMember.password}`);
        console.log(`🔐 Team member password starts with: ${teamMember.password ? teamMember.password.substring(0, 10) + '...' : 'N/A'}`);
      }
      if (teamMember && teamMember.isActive) {
        // Compare hashed password
        const passwordMatch = await bcrypt.compare(password, teamMember.password);
        console.log(`🔐 Team member password match: ${passwordMatch}`);
        if (passwordMatch) {
        // Update last login time
        await storage.updateTeamMemberLastLogin(teamMember.id);
        
        const nameParts = teamMember.fullName.split(' ');
        const firstName = nameParts[0] || teamMember.fullName;
        const lastName = nameParts.slice(1).join(' ') || '';
        
        (req.session as any).user = {
          id: `team_${teamMember.id}`,
          username: teamMember.username,
          firstName,
          lastName,
          email: teamMember.email || `${teamMember.username}@tendermatch.com`,
          role: teamMember.role,
          teamMemberId: teamMember.id,
        };
        
        // Log team member login
        try {
          await storage.createAuditLog({
            action: 'login',
            category: 'auth',
            userId: `team_${teamMember.id}`,
            userName: username,
            ipAddress: req.ip || 'unknown',
          });
        } catch (e) {
          console.error("Failed to log team member login:", e);
        }
        
        res.json({ 
          success: true, 
          user: {
            id: `team_${teamMember.id}`,
            firstName,
            lastName,
            email: teamMember.email || `${teamMember.username}@tendermatch.com`,
            role: teamMember.role,
          }
        });
        return;
        }
      }
    } catch (error) {
      console.error("Team member login check error:", error);
    }
    
    res.status(401).json({ message: "Invalid username or password" });
  });

  // Logout endpoint
  app.post("/api/logout", async (req, res) => {
    const user = (req.session as any)?.user;
    
    // Log logout
    if (user) {
      try {
        await storage.createAuditLog({
          action: 'logout',
          category: 'auth',
          userId: user.id,
          userName: user.username || user.email,
          ipAddress: req.ip || 'unknown',
        });
      } catch (e) {
        console.error("Failed to log logout:", e);
      }
    }
    
    const isProduction = process.env.NODE_ENV === "production";
    const disableSecureCookies = process.env.DISABLE_SECURE_COOKIES === "true";
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        res.status(500).json({ message: "Failed to logout" });
      } else {
        // Clear the session cookie
        res.clearCookie("connect.sid", {
          httpOnly: true,
          secure: isProduction && !disableSecureCookies,
          sameSite: (isProduction && !disableSecureCookies) ? "strict" : "lax",
        });
        res.status(200).json({ success: true });
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
