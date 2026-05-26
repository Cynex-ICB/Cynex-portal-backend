import express from "express";
import CieMark from "../models/CieMark.js";
import Subject from "../models/Subject.js";
import User from "../models/User.js";
import protect, { adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

function serializeCieMark(mark) {
  return {
    id: mark._id,
    student: mark.student,
    subject: mark.subject,
    semester: mark.semester,
    cieNumber: mark.cieNumber,
    marksObtained: mark.marksObtained,
    maxMarks: mark.maxMarks,
    remarks: mark.remarks || "",
    createdBy: mark.createdBy,
    updatedAt: mark.updatedAt,
  };
}

router.get("/options", protect, adminOnly, async (req, res) => {
  const [students, subjects] = await Promise.all([
    User.find({ role: "student" })
      .sort({ semester: 1, usn: 1, name: 1 })
      .select("name collegeEmail usn semester"),
    Subject.find({})
      .sort({ semester: 1, code: 1 })
      .select("code name semester credits instructor"),
  ]);

  return res.json({ students, subjects });
});

router.get("/me", protect, async (req, res) => {
  if (req.user.role !== "student") {
    return res.json({ marks: [] });
  }

  const marks = await CieMark.find({ student: req.user._id })
    .sort({ semester: 1, subject: 1, cieNumber: 1 })
    .populate("student", "name collegeEmail usn semester")
    .populate("subject", "code name semester")
    .populate("createdBy", "name collegeEmail");

  return res.json({ marks: marks.map(serializeCieMark) });
});

router.get("/", protect, adminOnly, async (req, res) => {
  const filter = {};

  if (req.query.semester) {
    filter.semester = Number(req.query.semester);
  }

  if (req.query.subject) {
    filter.subject = req.query.subject;
  }

  if (req.query.student) {
    filter.student = req.query.student;
  }

  const marks = await CieMark.find(filter)
    .sort({ semester: 1, subject: 1, cieNumber: 1, updatedAt: -1 })
    .populate("student", "name collegeEmail usn semester")
    .populate("subject", "code name semester")
    .populate("createdBy", "name collegeEmail");

  return res.json({ marks: marks.map(serializeCieMark) });
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
      User.findOne({ _id: student, role: "student" }),
      Subject.findById(subject),
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

    const mark = await CieMark.findOneAndUpdate(
      {
        student: selectedStudent._id,
        subject: selectedSubject._id,
        cieNumber: cieNumberValue,
      },
      {
        student: selectedStudent._id,
        subject: selectedSubject._id,
        semester: selectedSubject.semester,
        cieNumber: cieNumberValue,
        marksObtained: marksValue,
        maxMarks: maxMarksValue,
        remarks: remarks || "",
        createdBy: req.user._id,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    )
      .populate("student", "name collegeEmail usn semester")
      .populate("subject", "code name semester")
      .populate("createdBy", "name collegeEmail");

    return res.status(201).json({ mark: serializeCieMark(mark) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "CIE mark already exists for this student and subject." });
    }

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

    const selectedSubject = await Subject.findById(subject);
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
    const students = await User.find({
      _id: { $in: studentIds },
      role: "student",
      semester: selectedSubject.semester,
    }).select("_id");
    const validStudentIds = new Set(students.map((student) => String(student._id)));

    if (validStudentIds.size !== studentIds.length) {
      return res.status(400).json({ message: "One or more students do not belong to this subject semester." });
    }

    const operations = filledEntries.map((entry) => {
      const marksValue = Number(entry.marksObtained);

      if (Number.isNaN(marksValue) || marksValue < 0 || marksValue > maxMarksValue) {
        throw new Error("Each mark must be between 0 and max marks.");
      }

      return {
        updateOne: {
          filter: {
            student: entry.student,
            subject: selectedSubject._id,
            cieNumber: cieNumberValue,
          },
          update: {
            $set: {
              student: entry.student,
              subject: selectedSubject._id,
              semester: selectedSubject.semester,
              cieNumber: cieNumberValue,
              marksObtained: marksValue,
              maxMarks: maxMarksValue,
              remarks: entry.remarks || "",
              createdBy: req.user._id,
            },
          },
          upsert: true,
        },
      };
    });

    await CieMark.bulkWrite(operations, { ordered: true });

    const marks = await CieMark.find({
      subject: selectedSubject._id,
      cieNumber: cieNumberValue,
    })
      .sort({ semester: 1, subject: 1, cieNumber: 1, updatedAt: -1 })
      .populate("student", "name collegeEmail usn semester")
      .populate("subject", "code name semester")
      .populate("createdBy", "name collegeEmail");

    return res.json({
      saved: filledEntries.length,
      marks: marks.map(serializeCieMark),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not save CIE marks." });
  }
});

router.delete("/:id", protect, adminOnly, async (req, res) => {
  const mark = await CieMark.findById(req.params.id);

  if (!mark) {
    return res.status(404).json({ message: "CIE mark not found." });
  }

  await mark.deleteOne();
  return res.json({ message: "CIE mark deleted." });
});

export default router;
