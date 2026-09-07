import express from "express";
import prisma, { withMongoId } from "../config/prisma.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

function serializeCieMark(mark) {
  if (!mark) return null;
  const item = withMongoId(mark);
  const student = item.student ? withMongoId(item.student) : item.studentId;
  const subject = item.subject ? withMongoId(item.subject) : item.subjectId;
  const createdBy = item.createdBy ? withMongoId(item.createdBy) : item.createdById;
  return {
    id: mark.id,
    _id: mark.id,
    student,
    subject,
    semester: mark.semester,
    cieNumber: mark.cieNumber,
    marksObtained: mark.marksObtained,
    maxMarks: mark.maxMarks,
    remarks: mark.remarks || "",
    createdBy,
    updatedAt: mark.updatedAt,
  };
}

router.get("/options", protect, adminOnly, async (req, res) => {
  try {
    const [students, subjects] = await Promise.all([
      prisma.user.findMany({
        where: { role: "student" },
        select: { id: true, name: true, collegeEmail: true, usn: true, semester: true },
        orderBy: [{ semester: "asc" }, { usn: "asc" }, { name: "asc" }],
      }),
      prisma.subject.findMany({
        select: { id: true, code: true, name: true, semester: true, credits: true, instructor: true },
        orderBy: [{ semester: "asc" }, { code: "asc" }],
      }),
    ]);

    return res.json({
      students: students.map(withMongoId),
      subjects: subjects.map(withMongoId),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch options." });
  }
});

router.get("/me", protect, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.json({ marks: [] });
    }

    const marks = await prisma.cieMark.findMany({
      where: { studentId: req.user.id || req.user._id },
      include: {
        student: {
          select: { id: true, name: true, collegeEmail: true, usn: true, semester: true },
        },
        subject: {
          select: { id: true, code: true, name: true, semester: true },
        },
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: [{ semester: "asc" }, { cieNumber: "asc" }],
    });

    return res.json({ marks: marks.map(serializeCieMark) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch marks." });
  }
});

router.get("/", protect, adminOnly, async (req, res) => {
  try {
    const where = {};

    if (req.query.semester) {
      where.semester = Number(req.query.semester);
    }

    if (req.query.subject) {
      where.subjectId = req.query.subject;
    }

    if (req.query.student) {
      where.studentId = req.query.student;
    }

    const marks = await prisma.cieMark.findMany({
      where,
      include: {
        student: {
          select: { id: true, name: true, collegeEmail: true, usn: true, semester: true },
        },
        subject: {
          select: { id: true, code: true, name: true, semester: true },
        },
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: [{ semester: "asc" }, { cieNumber: "asc" }, { updatedAt: "desc" }],
    });

    return res.json({ marks: marks.map(serializeCieMark) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not fetch marks." });
  }
});

router.post("/", protect, adminOnly, async (req, res) => {
  try {
    const { student, subject, cieNumber, marksObtained, maxMarks, remarks } = req.body;

    if (!student || !subject || !cieNumber || marksObtained === undefined || !maxMarks) {
      return res.status(400).json({
        message: "Student, subject, CIE number, marks obtained, and max marks are required.",
      });
    }

    const [selectedStudent, selectedSubject] = await Promise.all([
      prisma.user.findFirst({ where: { id: student, role: "student" } }),
      prisma.subject.findUnique({ where: { id: subject } }),
    ]);

    if (!selectedStudent) {
      return res.status(404).json({ message: "Student not found." });
    }

    if (!selectedSubject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    const cieNumberValue = Number(cieNumber);
    const marksValue = Number(marksObtained);
    const maxMarksValue = Number(maxMarks);

    if (!Number.isInteger(cieNumberValue) || cieNumberValue < 1 || cieNumberValue > 3) {
      return res.status(400).json({ message: "CIE number must be 1, 2, or 3." });
    }

    if (Number.isNaN(marksValue) || Number.isNaN(maxMarksValue) || maxMarksValue <= 0) {
      return res.status(400).json({ message: "Marks must be valid numbers." });
    }

    if (marksValue < 0 || marksValue > maxMarksValue) {
      return res.status(400).json({ message: "Marks obtained must be between 0 and max marks." });
    }

    if (selectedStudent.semester !== selectedSubject.semester) {
      return res.status(400).json({
        message: "Selected subject does not belong to the student's semester.",
      });
    }

    const mark = await prisma.cieMark.upsert({
      where: {
        studentId_subjectId_cieNumber: {
          studentId: selectedStudent.id,
          subjectId: selectedSubject.id,
          cieNumber: cieNumberValue,
        },
      },
      update: {
        marksObtained: marksValue,
        maxMarks: maxMarksValue,
        remarks: remarks || "",
        semester: selectedSubject.semester,
        createdById: req.user.id || req.user._id,
      },
      create: {
        studentId: selectedStudent.id,
        subjectId: selectedSubject.id,
        semester: selectedSubject.semester,
        cieNumber: cieNumberValue,
        marksObtained: marksValue,
        maxMarks: maxMarksValue,
        remarks: remarks || "",
        createdById: req.user.id || req.user._id,
      },
      include: {
        student: {
          select: { id: true, name: true, collegeEmail: true, usn: true, semester: true },
        },
        subject: {
          select: { id: true, code: true, name: true, semester: true },
        },
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
    });

    return res.status(201).json({ mark: serializeCieMark(mark) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not save CIE marks." });
  }
});

router.post("/bulk", protect, adminOnly, async (req, res) => {
  try {
    const { subject, cieNumber, maxMarks, entries } = req.body;

    if (!subject || !cieNumber || !maxMarks || !Array.isArray(entries)) {
      return res.status(400).json({
        message: "Subject, CIE number, max marks, and mark entries are required.",
      });
    }

    const selectedSubject = await prisma.subject.findUnique({ where: { id: subject } });
    if (!selectedSubject) {
      return res.status(404).json({ message: "Subject not found." });
    }

    const cieNumberValue = Number(cieNumber);
    const maxMarksValue = Number(maxMarks);

    if (!Number.isInteger(cieNumberValue) || cieNumberValue < 1 || cieNumberValue > 3) {
      return res.status(400).json({ message: "CIE number must be 1, 2, or 3." });
    }

    if (Number.isNaN(maxMarksValue) || maxMarksValue <= 0) {
      return res.status(400).json({ message: "Max marks must be a valid number." });
    }

    const filledEntries = entries.filter((entry) => entry?.student && entry.marksObtained !== "");
    if (!filledEntries.length) {
      return res.status(400).json({ message: "Enter marks for at least one student." });
    }

    const studentIds = filledEntries.map((entry) => entry.student);
    const students = await prisma.user.findMany({
      where: {
        id: { in: studentIds },
        role: "student",
        semester: selectedSubject.semester,
      },
      select: { id: true },
    });
    const validStudentIds = new Set(students.map((s) => s.id));

    if (validStudentIds.size !== studentIds.length) {
      return res.status(400).json({ message: "One or more students do not belong to this subject semester." });
    }

    for (const entry of filledEntries) {
      const marksValue = Number(entry.marksObtained);
      if (Number.isNaN(marksValue) || marksValue < 0 || marksValue > maxMarksValue) {
        return res.status(400).json({ message: "Each mark must be between 0 and max marks." });
      }
    }

    const operations = filledEntries.map((entry) => {
      const marksValue = Number(entry.marksObtained);
      return prisma.cieMark.upsert({
        where: {
          studentId_subjectId_cieNumber: {
            studentId: entry.student,
            subjectId: selectedSubject.id,
            cieNumber: cieNumberValue,
          },
        },
        update: {
          marksObtained: marksValue,
          maxMarks: maxMarksValue,
          remarks: entry.remarks || "",
          semester: selectedSubject.semester,
          createdById: req.user.id || req.user._id,
        },
        create: {
          studentId: entry.student,
          subjectId: selectedSubject.id,
          semester: selectedSubject.semester,
          cieNumber: cieNumberValue,
          marksObtained: marksValue,
          maxMarks: maxMarksValue,
          remarks: entry.remarks || "",
          createdById: req.user.id || req.user._id,
        },
      });
    });

    await prisma.$transaction(operations);

    const marks = await prisma.cieMark.findMany({
      where: {
        subjectId: selectedSubject.id,
        cieNumber: cieNumberValue,
      },
      include: {
        student: {
          select: { id: true, name: true, collegeEmail: true, usn: true, semester: true },
        },
        subject: {
          select: { id: true, code: true, name: true, semester: true },
        },
        createdBy: {
          select: { id: true, name: true, collegeEmail: true },
        },
      },
      orderBy: [{ semester: "asc" }, { cieNumber: "asc" }, { updatedAt: "desc" }],
    });

    return res.json({
      saved: filledEntries.length,
      marks: marks.map(serializeCieMark),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not save CIE marks." });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  try {
    const mark = await prisma.cieMark.findUnique({
      where: { id: req.params.id },
    });

    if (!mark) {
      return res.status(404).json({ message: "CIE mark not found." });
    }

    await prisma.cieMark.delete({
      where: { id: req.params.id },
    });

    return res.json({ message: "CIE mark deleted." });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not delete CIE mark." });
  }
});

export default router;
