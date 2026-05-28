const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const prisma = new PrismaClient();

/**
 * POST /api/auth/register
 * Register a new user. Students are auto-approved. Seniors are pending.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password, role, collegeId, year } = req.body;

    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ error: "Name, email, and password are required" });
    }

    // Check for existing user
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already registered" });
    }

    // Validate role
    const userRole = role === "SENIOR" ? "SENIOR" : "STUDENT";
    const status = userRole === "SENIOR" ? "PENDING" : "ACTIVE";

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: userRole,
        status,
        collegeId: collegeId || null,
        year: year ? parseInt(year) : null,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    if (status === "PENDING") {
      return res.status(201).json({
        message:
          "Registration successful. Your account is pending admin approval.",
        user,
      });
    }

    // Auto-generate token for students
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({ user, token });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    if (user.status === "PENDING") {
      return res.status(403).json({
        error: "Your account is pending admin approval",
        status: "PENDING",
      });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        collegeId: user.collegeId,
        year: user.year,
      },
      token,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/auth/me
 */
const getMe = async (req, res) => {
  res.json({ user: req.user });
};

/**
 * GET /api/auth/pending
 * Admin only: list all pending senior registrations
 */
const getPending = async (req, res, next) => {
  try {
    const pendingUsers = await prisma.user.findMany({
      where: { status: "PENDING" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        year: true,
        createdAt: true,
        college: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ users: pendingUsers });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/auth/approve/:id
 * Admin only: approve a pending senior
 */
const approveUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.status !== "PENDING") {
      return res.status(400).json({ error: "User is not pending approval" });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
      },
    });

    res.json({ message: "User approved successfully", user: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/auth/reject/:id
 * Admin only: reject (delete) a pending user
 */
const rejectUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.status !== "PENDING") {
      return res.status(400).json({ error: "User is not pending" });
    }

    await prisma.user.delete({ where: { id } });
    res.json({ message: "User rejected and removed" });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/auth/profile
 * Update user profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { collegeId } = req.body;
    
    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        ...(collegeId !== undefined && { collegeId })
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        collegeId: true,
        year: true,
      },
    });
    
    res.json({ message: "Profile updated", user: updated });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe, getPending, approveUser, rejectUser, updateProfile };
