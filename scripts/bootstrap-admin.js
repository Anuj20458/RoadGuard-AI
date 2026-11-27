import fs from "node:fs";
import path from "node:path";
import connectDB from "../src/lib/db.js";
import User from "../src/models/User.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

function hasExplicitOverride() {
  return (
    process.argv.includes("--override") ||
    process.env.ADMIN_BOOTSTRAP_OVERRIDE === "true"
  );
}

async function bootstrapAdmin() {
  loadLocalEnv();

  const rawEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || "";
  const rawPassword = process.env.ADMIN_PASSWORD || "";
  const adminName = process.env.ADMIN_NAME?.trim() || "RoadGuard Admin";
  const adminPhone = process.env.ADMIN_PHONE?.trim() || "";
  const allowOverride = hasExplicitOverride();

  if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
    console.error(
      "Error: ADMIN_EMAIL environment variable must be set to a valid email address."
    );
    process.exitCode = 1;
    return;
  }

  if (typeof rawPassword !== "string" || rawPassword.length < 8) {
    console.error(
      "Error: ADMIN_PASSWORD environment variable must be set (minimum 8 characters)."
    );
    process.exitCode = 1;
    return;
  }

  if (rawPassword.length > 128) {
    console.error(
      "Error: ADMIN_PASSWORD cannot exceed 128 characters."
    );
    process.exitCode = 1;
    return;
  }

  let conn = null;

  try {
    conn = await connectDB();

    const existingAdminCount = await User.countDocuments({ role: "admin" });
    if (existingAdminCount > 0 && !allowOverride) {
      console.error(
        `Refused: ${existingAdminCount} admin account(s) already exist in the database. ` +
          "Pass --override (or set ADMIN_BOOTSTRAP_OVERRIDE=true) only if you intentionally want to create/promote another admin."
      );
      process.exitCode = 1;
      return;
    }

    const existingByEmail = await User.findOne({ email: rawEmail }).select(
      "_id name email role"
    );

    if (existingByEmail) {
      if (existingByEmail.role === "admin" && !allowOverride) {
        console.log(`Admin account already exists for ${existingByEmail.email}.`);
        return;
      }

      if (!allowOverride) {
        console.error(
          `Refused: An account with email ${rawEmail} already exists with role '${existingByEmail.role}'. ` +
            "Pass --override (or set ADMIN_BOOTSTRAP_OVERRIDE=true) to explicitly promote it to admin."
        );
        process.exitCode = 1;
        return;
      }

      existingByEmail.role = "admin";
      existingByEmail.name = adminName || existingByEmail.name;
      existingByEmail.passwordHash = rawPassword;
      if (adminPhone) {
        existingByEmail.phone = adminPhone;
      }
      await existingByEmail.save();

      console.log(
        `Success: Promoted/updated admin account for ${existingByEmail.email} (id: ${existingByEmail._id}).`
      );
      return;
    }

    const createdAdmin = await User.create({
      name: adminName,
      email: rawEmail,
      passwordHash: rawPassword,
      role: "admin",
      ...(adminPhone ? { phone: adminPhone } : {}),
    });

    console.log(
      `Success: Created initial admin account for ${createdAdmin.email} (id: ${createdAdmin._id}).`
    );
  } catch (error) {
    console.error(
      "Bootstrap failed:",
      error?.code || error?.name || "BootstrapError"
    );
    process.exitCode = 1;
  } finally {
    if (conn && conn.connection.readyState !== 0) {
      await conn.disconnect();
    }
  }
}

bootstrapAdmin();
