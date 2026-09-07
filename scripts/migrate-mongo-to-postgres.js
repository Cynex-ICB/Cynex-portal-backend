import dotenv from "dotenv";
import mongoose from "mongoose";
import { PrismaClient } from "@prisma/client";

dotenv.config({ path: ["server/.env", ".env"] });

const prisma = new PrismaClient();

const MONGO_URI =
  process.env.MONGODB_DIRECT_URI ||
  "mongodb://cynexctf_db_user:uv4Mn6mHRvVOYuBg@ac-6uvpzjq-shard-00-00.5c3whsq.mongodb.net:27017,ac-6uvpzjq-shard-00-01.5c3whsq.mongodb.net:27017,ac-6uvpzjq-shard-00-02.5c3whsq.mongodb.net:27017/test?ssl=true&replicaSet=atlas-n4ro7i-shard-0&authSource=admin&retryWrites=true&w=majority";

async function main() {
  console.log("=== Starting MongoDB to PostgreSQL Migration ===");
  console.log("Connecting to MongoDB Atlas...");
  await mongoose.connect(MONGO_URI);
  console.log("MongoDB connected.");

  console.log("Connecting to PostgreSQL via Prisma...");
  await prisma.$connect();
  console.log("PostgreSQL connected.");

  const db = mongoose.connection.client.db("test");

  // 1. MIGRATE USERS
  console.log("\n--- Migrating Users ---");
  const mongoUsers = await db.collection("users").find({}).toArray();
  console.log(`Found ${mongoUsers.length} users in MongoDB.`);

  const userIds = new Set();
  for (const u of mongoUsers) {
    const id = String(u._id);
    userIds.add(id);
    await prisma.user.upsert({
      where: { id },
      update: {
        name: u.name || "Unknown",
        collegeEmail: u.collegeEmail,
        usn: u.usn || "",
        semester: u.semester || 1,
        teacherId: u.teacherId || "",
        coordinatorSemesters: Array.isArray(u.coordinatorSemesters) ? u.coordinatorSemesters : [],
        classCoordinatorName: u.classCoordinatorName || "",
        mentorName: u.mentorName || "",
        mentorAssignments: u.mentorAssignments || [],
        password: u.password,
        role: u.role || "student",
        passwordResetToken: u.passwordResetToken || null,
        passwordResetExpires: u.passwordResetExpires ? new Date(u.passwordResetExpires) : null,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      },
      create: {
        id,
        name: u.name || "Unknown",
        collegeEmail: u.collegeEmail,
        usn: u.usn || "",
        semester: u.semester || 1,
        teacherId: u.teacherId || "",
        coordinatorSemesters: Array.isArray(u.coordinatorSemesters) ? u.coordinatorSemesters : [],
        classCoordinatorName: u.classCoordinatorName || "",
        mentorName: u.mentorName || "",
        mentorAssignments: u.mentorAssignments || [],
        password: u.password,
        role: u.role || "student",
        passwordResetToken: u.passwordResetToken || null,
        passwordResetExpires: u.passwordResetExpires ? new Date(u.passwordResetExpires) : null,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        updatedAt: u.updatedAt ? new Date(u.updatedAt) : new Date(),
      },
    });
  }

  // Update coordinator & mentor relations
  for (const u of mongoUsers) {
    const id = String(u._id);
    const coordinatorId = u.classCoordinatorId ? String(u.classCoordinatorId) : null;
    const mentorId = u.mentorId ? String(u.mentorId) : null;

    await prisma.user.update({
      where: { id },
      data: {
        classCoordinatorId: coordinatorId && userIds.has(coordinatorId) ? coordinatorId : null,
        mentorId: mentorId && userIds.has(mentorId) ? mentorId : null,
      },
    });
  }
  console.log(`Migrated ${mongoUsers.length} users.`);

  // 2. MIGRATE SUBJECTS
  console.log("\n--- Migrating Subjects ---");
  const mongoSubjects = await db.collection("subjects").find({}).toArray();
  console.log(`Found ${mongoSubjects.length} subjects in MongoDB.`);

  const subjectIds = new Set();
  for (const s of mongoSubjects) {
    const id = String(s._id);
    subjectIds.add(id);
    const createdById = s.createdBy ? String(s.createdBy) : null;

    await prisma.subject.upsert({
      where: { id },
      update: {
        code: String(s.code || "").toUpperCase(),
        name: s.name || "",
        semester: Number(s.semester) || 1,
        credits: Number(s.credits) || 1,
        instructor: s.instructor || "",
        description: s.description || "",
        createdById: createdById && userIds.has(createdById) ? createdById : null,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
      },
      create: {
        id,
        code: String(s.code || "").toUpperCase(),
        name: s.name || "",
        semester: Number(s.semester) || 1,
        credits: Number(s.credits) || 1,
        instructor: s.instructor || "",
        description: s.description || "",
        createdById: createdById && userIds.has(createdById) ? createdById : null,
        createdAt: s.createdAt ? new Date(s.createdAt) : new Date(),
        updatedAt: s.updatedAt ? new Date(s.updatedAt) : new Date(),
      },
    });
  }
  console.log(`Migrated ${mongoSubjects.length} subjects.`);

  // 3. MIGRATE MATERIALS
  console.log("\n--- Migrating Materials ---");
  const mongoMaterials = await db.collection("materials").find({}).toArray();
  console.log(`Found ${mongoMaterials.length} materials in MongoDB.`);

  for (const m of mongoMaterials) {
    const id = String(m._id);
    const subjectId = m.subject ? String(m.subject) : null;
    const createdById = m.createdBy ? String(m.createdBy) : null;

    await prisma.material.upsert({
      where: { id },
      update: {
        title: m.title || "",
        category: m.category || "study-material",
        description: m.description || "",
        subjectId: subjectId && subjectIds.has(subjectId) ? subjectId : null,
        semester: m.semester ? Number(m.semester) : null,
        link: m.link || "",
        file: m.file || null,
        dueDate: m.dueDate ? new Date(m.dueDate) : null,
        createdById: createdById && userIds.has(createdById) ? createdById : null,
        createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
      },
      create: {
        id,
        title: m.title || "",
        category: m.category || "study-material",
        description: m.description || "",
        subjectId: subjectId && subjectIds.has(subjectId) ? subjectId : null,
        semester: m.semester ? Number(m.semester) : null,
        link: m.link || "",
        file: m.file || null,
        dueDate: m.dueDate ? new Date(m.dueDate) : null,
        createdById: createdById && userIds.has(createdById) ? createdById : null,
        createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
        updatedAt: m.updatedAt ? new Date(m.updatedAt) : new Date(),
      },
    });
  }
  console.log(`Migrated ${mongoMaterials.length} materials.`);

  // 4. MIGRATE CONTENT POSTS
  console.log("\n--- Migrating Content Posts ---");
  const mongoContentPosts = await db.collection("contentposts").find({}).toArray();
  console.log(`Found ${mongoContentPosts.length} content posts in MongoDB.`);

  for (const c of mongoContentPosts) {
    const id = String(c._id);
    const createdById = c.createdBy ? String(c.createdBy) : null;

    await prisma.contentPost.upsert({
      where: { id },
      update: {
        type: c.type || "activity-alert",
        title: c.title || "",
        description: c.description || "",
        name: c.name || "",
        roleTitle: c.roleTitle || "",
        ctcLpa: c.ctcLpa || "",
        imageUrl: c.imageUrl || "",
        image: c.image || null,
        link: c.link || "",
        createdById: createdById && userIds.has(createdById) ? createdById : null,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      },
      create: {
        id,
        type: c.type || "activity-alert",
        title: c.title || "",
        description: c.description || "",
        name: c.name || "",
        roleTitle: c.roleTitle || "",
        ctcLpa: c.ctcLpa || "",
        imageUrl: c.imageUrl || "",
        image: c.image || null,
        link: c.link || "",
        createdById: createdById && userIds.has(createdById) ? createdById : null,
        createdAt: c.createdAt ? new Date(c.createdAt) : new Date(),
        updatedAt: c.updatedAt ? new Date(c.updatedAt) : new Date(),
      },
    });
  }
  console.log(`Migrated ${mongoContentPosts.length} content posts.`);

  // 5. MIGRATE CIE MARKS
  console.log("\n--- Migrating CIE Marks ---");
  const mongoCieMarks = await db.collection("ciemarks").find({}).toArray();
  console.log(`Found ${mongoCieMarks.length} CIE marks in MongoDB.`);

  for (const cm of mongoCieMarks) {
    const id = String(cm._id);
    const studentId = cm.student ? String(cm.student) : null;
    const subjectId = cm.subject ? String(cm.subject) : null;
    const createdById = cm.createdBy ? String(cm.createdBy) : null;

    if (!subjectId || !subjectIds.has(subjectId)) {
      console.warn(`Skipping CIE mark ${id}: referenced subject ${subjectId} not found.`);
      continue;
    }

    await prisma.cieMark.upsert({
      where: { id },
      update: {
        studentId: studentId && userIds.has(studentId) ? studentId : null,
        subjectId,
        semester: Number(cm.semester) || 1,
        cieNumber: Number(cm.cieNumber) || 1,
        marksObtained: Number(cm.marksObtained) || 0,
        maxMarks: Number(cm.maxMarks) || 50,
        remarks: cm.remarks || "",
        createdById: createdById && userIds.has(createdById) ? createdById : null,
        createdAt: cm.createdAt ? new Date(cm.createdAt) : new Date(),
        updatedAt: cm.updatedAt ? new Date(cm.updatedAt) : new Date(),
      },
      create: {
        id,
        studentId: studentId && userIds.has(studentId) ? studentId : null,
        subjectId,
        semester: Number(cm.semester) || 1,
        cieNumber: Number(cm.cieNumber) || 1,
        marksObtained: Number(cm.marksObtained) || 0,
        maxMarks: Number(cm.maxMarks) || 50,
        remarks: cm.remarks || "",
        createdById: createdById && userIds.has(createdById) ? createdById : null,
        createdAt: cm.createdAt ? new Date(cm.createdAt) : new Date(),
        updatedAt: cm.updatedAt ? new Date(cm.updatedAt) : new Date(),
      },
    });
  }
  console.log(`Migrated ${mongoCieMarks.length} CIE marks.`);

  // 6. VALIDATION REPORT
  console.log("\n=== PostgreSQL Migration Summary ===");
  const pgUsers = await prisma.user.count();
  const pgSubjects = await prisma.subject.count();
  const pgMaterials = await prisma.material.count();
  const pgContent = await prisma.contentPost.count();
  const pgMarks = await prisma.cieMark.count();

  console.log(`Users in PostgreSQL: ${pgUsers} (MongoDB: ${mongoUsers.length})`);
  console.log(`Subjects in PostgreSQL: ${pgSubjects} (MongoDB: ${mongoSubjects.length})`);
  console.log(`Materials in PostgreSQL: ${pgMaterials} (MongoDB: ${mongoMaterials.length})`);
  console.log(`Content Posts in PostgreSQL: ${pgContent} (MongoDB: ${mongoContentPosts.length})`);
  console.log(`CIE Marks in PostgreSQL: ${pgMarks} (MongoDB: ${mongoCieMarks.length})`);

  console.log("\n=== Migration Completed Successfully! ===");
}

main()
  .catch((err) => {
    console.error("Migration failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await mongoose.disconnect();
    await prisma.$disconnect();
  });
