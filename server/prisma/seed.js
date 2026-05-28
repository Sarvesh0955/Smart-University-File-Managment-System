const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // --- Seed Admin User ---
  const adminEmail = process.env.ADMIN_EMAIL || "admin@academichub.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Admin@123";
  const adminName = process.env.ADMIN_NAME || "System Admin";

  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail },
  });

  if (existingAdmin) {
    console.log(`✅ Admin already exists: ${adminEmail}`);
  } else {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    const admin = await prisma.user.create({
      data: {
        name: adminName,
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    console.log(`✅ Admin created: ${admin.email} (role: ${admin.role})`);
  }

  // --- Seed a sample College + Department + Semester + Subject ---
  let college = await prisma.college.findUnique({
    where: { code: "UOT" },
  });

  if (!college) {
    college = await prisma.college.create({
      data: { name: "University of Technology", code: "UOT" },
    });
    console.log(`✅ College created: ${college.name}`);
  } else {
    console.log(`✅ College already exists: ${college.name}`);
  }

  let dept = await prisma.department.findUnique({
    where: { code_collegeId: { code: "CSE", collegeId: college.id } },
  });

  if (!dept) {
    dept = await prisma.department.create({
      data: {
        name: "Computer Science Engineering",
        code: "CSE",
        collegeId: college.id,
      },
    });
    console.log(`✅ Department created: ${dept.name}`);
  } else {
    console.log(`✅ Department already exists: ${dept.name}`);
  }

  let semester = await prisma.semester.findUnique({
    where: {
      number_departmentId: { number: 5, departmentId: dept.id },
    },
  });

  if (!semester) {
    semester = await prisma.semester.create({
      data: { number: 5, departmentId: dept.id },
    });
    console.log(`✅ Semester created: Semester ${semester.number}`);
  } else {
    console.log(`✅ Semester already exists: Semester ${semester.number}`);
  }

  const subjectsData = [
    { name: "Operating Systems", code: "CS501" },
    { name: "Data Structures", code: "CS502" },
    { name: "Database Management", code: "CS503" },
  ];

  for (const sub of subjectsData) {
    const existing = await prisma.subject.findFirst({
      where: {
        code: sub.code,
        semesterId: semester.id,
      },
    });

    if (!existing) {
      await prisma.subject.create({
        data: {
          name: sub.name,
          code: sub.code,
          semesterId: semester.id,
          departmentId: dept.id,
        },
      });
      console.log(`✅ Subject created: ${sub.name} (${sub.code})`);
    } else {
      console.log(`✅ Subject already exists: ${sub.name}`);
    }
  }

  console.log("\n🎉 Seeding complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
