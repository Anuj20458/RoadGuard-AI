import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import assert from "node:assert/strict";
import connectDB from "../src/lib/db.js";
import User from "../src/models/User.js";

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!process.env.MONGODB_URI && fs.existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

async function runDatabaseTest() {
  loadLocalEnv();

  const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  const testEmail = `roadguard-test-${uniqueSuffix}@example.com`;
  const testPassword = `RgTest-${crypto.randomBytes(12).toString("hex")}`;

  let conn = null;
  let createdUserId = null;

  try {
    console.log("1. Connecting to MongoDB via src/lib/db.js...");
    conn = await connectDB();
    assert.equal(
      conn.connection.readyState,
      1,
      "Expected Mongoose connection readyState to be 1 (connected)."
    );
    console.log("   Connected (readyState: 1).");

    console.log("2. Creating one temporary test user...");
    const createdUser = await User.create({
      name: "RoadGuard Integration Test User",
      email: testEmail,
      passwordHash: testPassword,
      role: "citizen",
      phone: "+91 98765 43210",
    });
    createdUserId = createdUser._id;
    assert.ok(createdUserId, "Created user must have an _id.");
    console.log(`   Created test user (${testEmail}).`);

    console.log("3. Retrieving test user from MongoDB and verifying password hash...");
    const storedUser = await User.findById(createdUserId).select("+passwordHash");
    assert.ok(storedUser, "Expected to retrieve the created test user.");
    assert.notEqual(
      storedUser.passwordHash,
      testPassword,
      "Stored passwordHash must never equal the plain-text password."
    );
    assert.match(
      storedUser.passwordHash,
      BCRYPT_HASH_PATTERN,
      "Stored passwordHash must be a valid bcrypt hash."
    );
    console.log("   Verified password is stored as a bcrypt hash (not plaintext).");

    console.log("4. Verifying comparePassword()...");
    const matchesCorrect = await storedUser.comparePassword(testPassword);
    const matchesWrong = await storedUser.comparePassword("Invalid-Candidate-Pass");
    assert.equal(matchesCorrect, true, "comparePassword should return true for the valid password.");
    assert.equal(matchesWrong, false, "comparePassword should return false for a wrong password.");
    console.log("   comparePassword() passed for both valid and invalid passwords.");

    console.log("5. Deleting only the temporary test user...");
    const deleteResult = await User.deleteOne({ _id: createdUserId });
    assert.equal(deleteResult.deletedCount, 1, "Expected deletedCount to equal 1.");

    const afterDelete = await User.findById(createdUserId);
    assert.equal(afterDelete, null, "Test user should no longer exist after deletion.");
    createdUserId = null;
    console.log("   Confirmed temporary test user was deleted.");

    console.log("PASS: Real MongoDB User integration test succeeded.");
  } catch (error) {
    console.error(
      "FAIL: Database integration test failed:",
      error?.name || "Error",
      error?.code ? `(code: ${error.code})` : ""
    );
    process.exitCode = 1;
  } finally {
    if (conn && createdUserId) {
      try {
        await User.deleteOne({ _id: createdUserId });
        console.log("   Cleanup: removed temporary test user after error.");
      } catch {
        console.error("   Cleanup warning: failed to remove temporary test user.");
      }
    }

    if (conn && conn.connection.readyState !== 0) {
      await conn.disconnect();
      console.log("6. Closed MongoDB connection cleanly.");
    }
  }
}

runDatabaseTest();
