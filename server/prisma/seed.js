const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...\n");

  // --- Seed Admin User ---
  const adminEmail = process.env.ADMIN_EMAIL || "admin@gmail.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "123456";
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
    where: { code: "IIITA" },
  });

  if (!college) {
    college = await prisma.college.create({
      data: { name: "Indian Institute of Information Technology Allahabad", code: "IIITA" },
    });
    console.log(`✅ College created: ${college.name}`);
  } else {
    console.log(`✅ College already exists: ${college.name}`);
  }

  let dept = await prisma.department.findUnique({
    where: { code_collegeId: { code: "IT", collegeId: college.id } },
  });

  if (!dept) {
    dept = await prisma.department.create({
      data: {
        name: "Information Technology",
        code: "IT",
        collegeId: college.id,
      },
    });
    console.log(`✅ Department created: ${dept.name}`);
  } else {
    console.log(`✅ Department already exists: ${dept.name}`);
  }

  let semester = await prisma.semester.findUnique({
    where: {
      number_departmentId: { number: 6, departmentId: dept.id },
    },
  });

  if (!semester) {
    semester = await prisma.semester.create({
      data: { number: 6, departmentId: dept.id },
    });
    console.log(`✅ Semester created: Semester ${semester.number}`);
  } else {
    console.log(`✅ Semester already exists: Semester ${semester.number}`);
  }

  const subjectsData = [
    { name: "Data Analytics", code: "DA" },
    { name: "Big Data Analytics", code: "BDA" },
    { name: "Biology", code: "BIO" },
    { name: "Data Visualization", code: "DV" },
    { name: "Japanese", code: "JAP" },
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

  // --- Seed Student (Junior) User ---
  const studentEmail = process.env.STUDENT_EMAIL || "student@gmail.com";
  const studentPassword = process.env.STUDENT_PASSWORD || "123456";

  const existingStudent = await prisma.user.findUnique({
    where: { email: studentEmail },
  });

  if (!existingStudent) {
    const hashedPassword = await bcrypt.hash(studentPassword, 12);
    await prisma.user.create({
      data: {
        name: "Temp Junior",
        email: studentEmail,
        password: hashedPassword,
        role: "STUDENT",
        status: "ACTIVE",
        collegeId: college.id,
      },
    });
    console.log(`✅ Student (Junior) created: ${studentEmail}`);
  } else {
    console.log(`✅ Student (Junior) already exists`);
  }

  // --- Seed Senior User ---
  const seniorEmail = process.env.SENIOR_EMAIL || "senior@gmail.com";
  const seniorPassword = process.env.SENIOR_PASSWORD || "123456";

  const existingSenior = await prisma.user.findUnique({
    where: { email: seniorEmail },
  });

  if (!existingSenior) {
    const hashedPassword = await bcrypt.hash(seniorPassword, 12);
    await prisma.user.create({
      data: {
        name: "Temp Senior",
        email: seniorEmail,
        password: hashedPassword,
        role: "SENIOR",
        status: "ACTIVE",
        collegeId: college.id,
      },
    });
    console.log(`✅ Senior created: ${seniorEmail}`);
  } else {
    console.log(`✅ Senior already exists`);
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
