import express from "express";
import User from "../models/User.js";
import protect, { masterAdminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

function serializeStudent(user) {
  return {
    id: user._id,
    name: user.name,
    collegeEmail: user.collegeEmail,
    usn: user.usn || "",
    semester: user.semester || 1,
    role: user.role,
    classCoordinatorId: user.classCoordinatorId || "",
    classCoordinatorName: user.classCoordinatorName || "",
    mentorId: user.mentorId || "",
    mentorName: user.mentorName || "",
  };
}

function serializeTeacher(user) {
  return {
    id: user._id,
    name: user.name,
    collegeEmail: user.collegeEmail,
    role: user.role,
    teacherId: user.teacherId || "",
    coordinatorSemesters: user.coordinatorSemesters || [],
    mentorAssignments: user.mentorAssignments || [],
  };
}

function isValidSemester(value) {
  const semester = Number(value);
  return Number.isInteger(semester) && semester >= 1 && semester <= 8;
}

function normalizeUsn(value) {
  return String(value || "").trim().toUpperCase();
}

function isUsnInRange(usn, startUsn, endUsn) {
  return usn.localeCompare(startUsn) >= 0 && usn.localeCompare(endUsn) <= 0;
}

router.get("/students", protect, masterAdminOnly, async (req, res) => {
  const students = await User.find({ role: "student" })
    .sort({ semester: 1, name: 1 })
    .select("name collegeEmail usn semester role classCoordinatorId classCoordinatorName mentorId mentorName");

  return res.json({ students: students.map(serializeStudent) });
});

router.get("/teachers", protect, masterAdminOnly, async (req, res) => {
  const teachers = await User.find({ role: "admin" })
    .sort({ name: 1 })
    .select("name collegeEmail role teacherId coordinatorSemesters mentorAssignments");

  return res.json({ teachers: teachers.map(serializeTeacher) });
});

router.post("/coordinators", protect, masterAdminOnly, async (req, res) => {
  try {
    const { teacherUserId, teacherId, semester } = req.body;

    if (!teacherUserId || !isValidSemester(semester)) {
      return res.status(400).json({ message: "Teacher and semester are required." });
    }

    const semesterNumber = Number(semester);
    if (semesterNumber < 3 || semesterNumber > 8) {
      return res.status(400).json({ message: "Class coordinator can be assigned only for semesters 3 to 8." });
    }

    const teacher = await User.findOne({ _id: teacherUserId, role: "admin" });
    if (!teacher) {
      return res.status(404).json({ message: "Teacher admin not found." });
    }

    teacher.teacherId = normalizeUsn(teacherId || teacher.teacherId);
    teacher.coordinatorSemesters = Array.from(
      new Set([...(teacher.coordinatorSemesters || []), semesterNumber])
    ).sort((a, b) => a - b);
    await teacher.save({ validateBeforeSave: false });

    const studentUpdate = await User.updateMany(
      { role: "student", semester: semesterNumber },
      {
        $set: {
          classCoordinatorId: teacher._id,
          classCoordinatorName: teacher.name,
        },
      }
    );

    return res.json({
      teacher: serializeTeacher(teacher),
      updatedStudents: studentUpdate.modifiedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not assign class coordinator." });
  }
});

router.post("/mentors", protect, masterAdminOnly, async (req, res) => {
  try {
    const { teacherUserId, teacherId, startUsn, endUsn } = req.body;
    const normalizedStartUsn = normalizeUsn(startUsn);
    const normalizedEndUsn = normalizeUsn(endUsn);

    if (!teacherUserId || !normalizedStartUsn || !normalizedEndUsn) {
      return res.status(400).json({ message: "Teacher, start USN, and end USN are required." });
    }

    if (normalizedStartUsn.localeCompare(normalizedEndUsn) > 0) {
      return res.status(400).json({ message: "Start USN must be before end USN." });
    }

    const teacher = await User.findOne({ _id: teacherUserId, role: "admin" });
    if (!teacher) {
      return res.status(404).json({ message: "Teacher admin not found." });
    }

    const students = await User.find({ role: "student" }).select("usn");
    const studentIds = students
      .filter((student) => isUsnInRange(normalizeUsn(student.usn), normalizedStartUsn, normalizedEndUsn))
      .map((student) => student._id);

    if (!studentIds.length) {
      return res.status(404).json({ message: "No students found in that USN range." });
    }

    teacher.teacherId = normalizeUsn(teacherId || teacher.teacherId);
    teacher.mentorAssignments = [
      ...(teacher.mentorAssignments || []),
      {
        startUsn: normalizedStartUsn,
        endUsn: normalizedEndUsn,
      },
    ];
    await teacher.save({ validateBeforeSave: false });

    await User.updateMany(
      { _id: { $in: studentIds } },
      {
        $set: {
          mentorId: teacher._id,
          mentorName: teacher.name,
        },
      }
    );

    return res.json({
      teacher: serializeTeacher(teacher),
      updatedStudents: studentIds.length,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not assign mentor." });
  }
});

export default router;
