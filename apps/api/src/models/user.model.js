import mongoose from 'mongoose'
import bcrypt from "bcryptjs"

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: ["VIEWER", "DEVELOPER", "OPERATOR", "ADMIN"],
      default: "VIEWER",
    },
    permissions: [
      {
        type: String,
        enum: [
          "cluster:read",
          "incident:read",
          "incident:diagnose",
          "remediation:request",
          "remediation:approve",
          "remediation:execute",
          "audit:read",
          "cluster:manage",
        ],
      },
    ],
    refreshToken: {
      type: String,
    },
    lastLogin: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Pre-save middleware to hash password
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to get permissions based on role
userSchema.methods.getPermissions = function () {
  const rolePermissions = {
    VIEWER: ["cluster:read", "incident:read"],
    DEVELOPER: ["cluster:read", "incident:read", "incident:diagnose"],
    OPERATOR: [
      "cluster:read",
      "incident:read",
      "incident:diagnose",
      "remediation:request",
    ],
    ADMIN: [
      "cluster:read",
      "incident:read",
      "incident:diagnose",
      "remediation:request",
      "remediation:approve",
      "remediation:execute",
      "audit:read",
      "cluster:manage",
    ],
  };

  return rolePermissions[this.role] || [];
};

// Method to check if user has specific permission
userSchema.methods.hasPermission = function (permission) {
  const permissions =
    this.permissions.length > 0 ? this.permissions : this.getPermissions();
  return permissions.includes(permission);
};

const User = mongoose.model("User", userSchema);

module.exports = User;
