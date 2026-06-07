const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  console.log("🗑️ Clearing database...\n");

  // Deleting in reverse order of relationships to avoid foreign key constraint errors
  const deletedResources = await prisma.resource.deleteMany({});
  console.log(`✅ Deleted ${deletedResources.count} resources`);

  const deletedSubjects = await prisma.subject.deleteMany({});
  console.log(`✅ Deleted ${deletedSubjects.count} subjects`);

  const deletedSemesters = await prisma.semester.deleteMany({});
  console.log(`✅ Deleted ${deletedSemesters.count} semesters`);

  const deletedDepartments = await prisma.department.deleteMany({});
  console.log(`✅ Deleted ${deletedDepartments.count} departments`);

  const deletedColleges = await prisma.college.deleteMany({});
  console.log(`✅ Deleted ${deletedColleges.count} colleges`);

  const deletedUsers = await prisma.user.deleteMany({});
  console.log(`✅ Deleted ${deletedUsers.count} users`);

  console.log("\n🎉 Database cleared successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Clearing failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
