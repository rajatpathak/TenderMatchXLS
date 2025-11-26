import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";

const ADMIN_USER = {
  id: "admin",
  username: "admin",
  password: "admin",
  firstName: "Admin",
  lastName: "User",
  email: "admin@tendermatch.com",
};

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());

  // Login endpoint
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    
    if (username === ADMIN_USER.username && password === ADMIN_USER.password) {
      (req.session as any).user = {
        id: ADMIN_USER.id,
        username: ADMIN_USER.username,
        firstName: ADMIN_USER.firstName,
        lastName: ADMIN_USER.lastName,
        email: ADMIN_USER.email,
      };
      res.json({ 
        success: true, 
        user: {
          id: ADMIN_USER.id,
          firstName: ADMIN_USER.firstName,
          lastName: ADMIN_USER.lastName,
          email: ADMIN_USER.email,
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
