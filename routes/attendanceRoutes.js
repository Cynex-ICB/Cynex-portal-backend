import express from "express";
import prisma, { withMongoId } from "../config/prisma.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

const STUDENT_SELECT = { id: true, name: true, collegeEmail: true, usn: true, semester: true };
const SUBJECT_SELECT = { id: true, code: true, name: true, semester: true };

function serializeRecord(record) {
  if (!record) return null;
  const item = withMongoId(record);
  return {
    id: record.id,
    _id: record.id,
    student: item.student ? withMongoId(item.student) : record.studentId,
    subject: item.subject ? withMongoId(item.subject) : record.subjectId,
    semester: record.semester,
    date: record.date,
    status: record.status,
    markedBy: item.markedBy ? withMongoId(item.markedBy) : record.markedById,
    updatedAt: record.updatedAt,
  };
}

function toDateOnly(value) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate()));
}

function summarize(records) {
  const bySubject = {};
  for (const record of records) {
    const key = record.subject?.id || record.subjectId;
    if (!bySubject[key]) {
      bySubject[key] = { subject: record.subject, present: 0, total: 0 };
    }
    bySubject[key].total += 1;
    if (record.status === "present") bySubject[key].present += 1;
  }
  const summary = Object.values(bySubject).map((entry) => ({
    subject: entry.subject,
    present: entry.present,
    total: entry.total,
    percentage: entry.total ? Math.round((entry.present / entry.total) * 100) : 0,
  }));
  const present = summary.reduce((sum, entry) => sum + entry.present, 0);
  const total = summary.reduce((sum, entry) => sum + entry.total, 0);
  return {
    summary,
    overall: {
      present,
      total,
      percentage: total ? Math.round((present / total) * 100) : 0,
    },
  };
}

// Teacher options: roster + subjects
router.get("/options", protect, adminOnly, async (req, res) => {
  try {
    const where = { role: "student" };
    if (req.query.semester) {
      where.semester = Number(req.query.semester);
    }
    const [students, subjects] = await Promise.all([
      prisma.user.findMany({
        where,
        select: STUDENT_SELECT,
        orderBy: [{ semester: "asc" }, { usn: "asc" }, { name: "asc" }],
      }),
      prisma.subject.findMany({
        select: { ...SUBJECT_SELECT, credits: true, instructor: true },
        orderBy: [{ semester: "asc" }, { code: "asc" }],
      }),
    ]);
    return res.json({ students: students.map(withMongoId), subjects: subjects.map(withMongoId) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch options." });
  }
});

// Logged-in student's own records + per-subject summary
router.get("/me", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.json({ records: [], summary: [], overall: { present: 0, total: 0, percentage: 0 } });
    }
    const where = { studentId: req.user.id || req.user._id };
    if (req.query.subject) {
      where.subjectId = req.query.subject;
    }
    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: { select: STUDENT_SELECT },
        subject: { select: SUBJECT_SELECT },
        markedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }],
    });
    const serialized = records.map(serializeRecord);
    return res.json({ records: serialized, ...summarize(serialized) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch attendance." });
  }
});

// Teacher view with filters
router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const where = {};
    if (req.query.semester) where.semester = Number(req.query.semester);
    if (req.query.subject) where.subjectId = req.query.subject;
    if (req.query.student) where.studentId = req.query.student;
    if (req.query.date) {
      const day = toDateOnly(req.query.date);
      if (!day) return res.status(400).json({ message: "Invalid date." });
      where.date = day;
    }
    const records = await prisma.attendance.findMany({
      where,
      include: {
        student: { select: STUDENT_SELECT },
        subject: { select: SUBJECT_SELECT },
        markedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ date: "desc" }, { updatedAt: "desc" }],
      take: 500,
    });
    return res.json({ records: records.map(serializeRecord) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch attendance." });
  }
});

// Teacher bulk marking for one subject + date (upsert per student)
router.post("/mark", protect, adminOnly, async (req, res) => {
  try {
    const { subject, date, entries } = req.body;

    if (!subject || !date || !Array.isArray(entries)) {
      return res.status(400).json({ message: "Subject, date, and entries are required." });
    }
    const day = toDateOnly(date);
    if (!day) return res.status(400).json({ message: "Invalid date." });

    const selectedSubject = await prisma.subject.findUnique({ where: { id: subject } });
    if (!selectedSubject) return res.status(404).json({ message: "Subject not found." });

    const filled = entries.filter(
      (entry) => entry?.student && (entry.status === "present" || entry.status === "absent")
    );
    if (!filled.length) {
      return res.status(400).json({ message: "Mark present/absent for at least one student." });
    }

    const studentIds = filled.map((entry) => entry.student);
    const students = await prisma.user.findMany({
      where: { id: { in: studentIds }, role: "student", semester: selectedSubject.semester },
      select: { id: true },
    });
    if (students.length !== studentIds.length) {
      return res.status(400).json({ message: "One or more students do not belong to this subject semester." });
    }

    const markedById = req.user.id || req.user._id;
    const operations = filled.map((entry) =>
      prisma.attendance.upsert({
        where: {
          studentId_subjectId_date: {
            studentId: entry.student,
            subjectId: selectedSubject.id,
            date: day,
          },
        },
        update: { status: entry.status, markedById },
        create: {
          studentId: entry.student,
          subjectId: selectedSubject.id,
          semester: selectedSubject.semester,
          date: day,
          status: entry.status,
          markedById,
        },
      })
    );
    await prisma.$transaction(operations);

    const records = await prisma.attendance.findMany({
      where: { subjectId: selectedSubject.id, date: day },
      include: {
        student: { select: STUDENT_SELECT },
        subject: { select: SUBJECT_SELECT },
        markedBy: { select: { id: true, name: true } },
      },
      orderBy: [{ updatedAt: "desc" }],
    });
    return res.json({ saved: filled.length, records: records.map(serializeRecord) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not save attendance." });
  }
});

export default router;
