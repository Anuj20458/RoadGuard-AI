import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const USER_ROLES = ["citizen", "admin", "worker"];

const BCRYPT_HASH_PATTERN = /^\$2[aby]\$\d{2}\$.{53}$/;
const SALT_ROUNDS = 12;

/**
 * Hashes a plain-text password using bcrypt.
 *
 * @param {string} plainPassword
 * @returns {Promise<string>}
 */
async function hashPlainPassword(plainPassword) {
  if (typeof plainPassword !== "string" || plainPassword.length < 8) {
    throw new Error("Password must be at least 8 characters long.");
  }
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required."],
      trim: true,
      minlength: [2, "Name must be at least 2 characters."],
      maxlength: [100, "Name cannot exceed 100 characters."],
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Please provide a valid email address."],
    },
    passwordHash: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password must be at least 8 characters."],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: USER_ROLES,
        message: "Role must be citizen, admin, or worker.",
      },
      default: "citizen",
      required: true,
    },
    phone: {
      type: String,
      trim: true,
      maxlength: [20, "Phone number cannot exceed 20 characters."],
      match: [/^[+\d\s()-]{7,20}$/, "Please provide a valid phone number."],
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
    toObject: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

userSchema.index({ role: 1, createdAt: -1 });

// Automatically hash plain-text passwords before saving if not already bcrypt-hashed.
userSchema.pre("save", async function () {
  if (!this.isModified("passwordHash")) {
    return;
  }

  if (BCRYPT_HASH_PATTERN.test(this.passwordHash)) {
    return;
  }

  this.passwordHash = await hashPlainPassword(this.passwordHash);
});

userSchema.statics.hashPassword = hashPlainPassword;

userSchema.methods.comparePassword = async function (candidatePassword) {
  if (!candidatePassword || !this.passwordHash) {
    return false;
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
