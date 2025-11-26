import { db } from "../server/db";
import { users, companyCriteria, negativeKeywords } from "../shared/schema";
import { sql } from "drizzle-orm";

async function validateEnvironment() {
  const errors: string[] = [];
  
  if (!process.env.DATABASE_URL) {
    errors.push("DATABASE_URL is required");
  }
  
  if (process.env.NODE_ENV === "production") {
    if (!process.env.SESSION_SECRET) {
      errors.push("SESSION_SECRET is required in production");
    }
    if (!process.env.ADMIN_PASSWORD_HASH && !process.env.ADMIN_PASSWORD) {
      errors.push("ADMIN_PASSWORD_HASH (or ADMIN_PASSWORD for dev) is required");
    }
  }
  
  if (errors.length > 0) {
    console.error("❌ Environment validation failed:\n");
    errors.forEach(err => console.error(`   - ${err}`));
    console.error("\n📋 See .env.example for required environment variables\n");
    process.exit(1);
  }
}

async function seed() {
  console.log("🌱 Starting database seeding...\n");

  await validateEnvironment();

  const adminUsername = process.env.ADMIN_USERNAME || "admin";
  const adminEmail = process.env.ADMIN_EMAIL || "admin@tendermatch.com";

  try {
    // Create sessions table if not exists
    console.log("📦 Ensuring sessions table exists...");
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions (expire)
    `);
    console.log("   ✅ Sessions table ready");

    // Create admin user (for foreign key references only - credentials are in env vars)
    console.log("👤 Creating admin user profile...");
    const existingUser = await db.select().from(users).where(sql`id = 'admin'`).limit(1);
    
    if (existingUser.length === 0) {
      await db.insert(users).values({
        id: "admin",
        email: adminEmail,
        firstName: "Admin",
        lastName: "User",
      });
      console.log(`   ✅ Admin user profile created`);
    } else {
      await db.update(users)
        .set({ email: adminEmail })
        .where(sql`id = 'admin'`);
      console.log("   ℹ️  Admin user profile already exists, email updated");
    }

    // Create default company criteria
    console.log("🏢 Setting up company criteria...");
    const existingCriteria = await db.select().from(companyCriteria).limit(1);
    
    if (existingCriteria.length === 0) {
      await db.insert(companyCriteria).values({
        id: 1,
        turnoverCr: "4", // 4 Crore = 400 Lakhs
        projectTypes: ["Software", "Website", "Mobile", "IT Projects", "Manpower Deployment"],
        updatedBy: "admin",
      });
      console.log("   ✅ Default company criteria created (Turnover: 4 Crore)");
    } else {
      console.log("   ℹ️  Company criteria already exists");
    }

    // Create default negative keywords
    console.log("🚫 Setting up negative keywords...");
    const defaultKeywords = [
      { keyword: "catia", description: "CAD/CAM software not in scope" },
      { keyword: "autodesk", description: "Design software not in scope" },
      { keyword: "spares", description: "Spare parts procurement" },
      { keyword: "auto cad", description: "Design software not in scope" },
      { keyword: "signal generator", description: "Electronic equipment" },
      { keyword: "digital signature certificate", description: "Certificate services" },
      { keyword: "equipment", description: "General equipment procurement" },
      { keyword: "openeye", description: "Surveillance equipment" },
      { keyword: "desktop computer", description: "Hardware procurement" },
      { keyword: "laptop", description: "Hardware procurement" },
      { keyword: "smart class equipment", description: "Educational hardware" },
    ];

    let keywordsAdded = 0;
    for (const kw of defaultKeywords) {
      try {
        await db.insert(negativeKeywords).values({
          keyword: kw.keyword,
          description: kw.description,
          createdBy: "admin",
        }).onConflictDoNothing();
        keywordsAdded++;
      } catch (e) {
        // Ignore duplicate key errors
      }
    }
    console.log(`   ✅ Negative keywords configured (${keywordsAdded} defaults)`);

    // Success summary
    console.log("\n" + "=".repeat(55));
    console.log("✨ Database seeding completed successfully!");
    console.log("=".repeat(55));
    console.log("\n📋 Admin Login:");
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: (set via ADMIN_PASSWORD_HASH env var)`);
    console.log("\n⚠️  Required environment variables for production:");
    console.log("   - DATABASE_URL");
    console.log("   - SESSION_SECRET");
    console.log("   - ADMIN_PASSWORD_HASH (generate with scripts/generate-password-hash.js)");
    console.log("\n📖 See .env.example for full configuration\n");

  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }

  process.exit(0);
}

seed();
