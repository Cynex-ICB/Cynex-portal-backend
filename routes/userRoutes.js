import express from "express";
import multer from "multer";
import XLSX from "xlsx";
import User from "../models/User.js";
import protect, { masterAdminOnly } from "../middleware/authMiddleware.js";
import { buildStudentAccountEmail, buildTeacherAccountEmail } from "../utils/emailTemplates.js";
import sendEmail from "../utils/sendEmail.js";

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

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

function serializeAdmin(user) {
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

function normalizeExcelHeader(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function getExcelValue(row, expectedHeader) {
  const normalizedExpectedHeader = normalizeExcelHeader(expectedHeader);
  const entry = Object.entries(row).find(
    ([key]) => normalizeExcelHeader(key) === normalizedExpectedHeader
  );

  return entry ? String(entry[1] || "").trim() : "";
}

function createStudentTempPassword(usn) {
  return `DeptICB@${normalizeUsn(usn)}`;
}

async function sendStudentAccountNotification(student, password) {
  await sendEmail({
    to: student.collegeEmail,
    ...buildStudentAccountEmail({
      name: student.name,
      email: student.collegeEmail,
      usn: student.usn,
      semester: student.semester,
      password,
    }),
  });
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

router.get("/admins", protect, masterAdminOnly, async (req, res) => {
  const admins = await User.find({ role: { $in: ["admin", "master-admin"] } })
    .sort({ role: 1, name: 1 })
    .select("name collegeEmail role teacherId coordinatorSemesters mentorAssignments");

  return res.json({ admins: admins.map(serializeAdmin) });
});

router.post("/admins", protect, masterAdminOnly, async (req, res) => {
  try {
    const { name, collegeEmail, teacherId, role, password } = req.body;
    const normalizedEmail = String(collegeEmail || "").trim().toLowerCase();
    const normalizedTeacherId = normalizeUsn(teacherId);
    const adminRole = role === "master-admin" ? "master-admin" : "admin";

    if (!name || !normalizedEmail || !normalizedTeacherId || !password) {
      return res.status(400).json({
        message: "Name, email, teacher employee ID, role, and temporary password are required.",
      });
    }

    
    if (password.length < 8) {
      return res.status(400).json({ message: "Temporary password must be at least 8 characters." });
    }

    const existingUser = await User.findOne({ collegeEmail: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({ message: "A user with this email already exists." });
    }

    const admin = await User.create({
      name: String(name).trim(),
      collegeEmail: normalizedEmail,
      teacherId: normalizedTeacherId,
      role: adminRole,
      password,
    });

    try {
      await sendEmail({
        to: admin.collegeEmail,
        ...buildTeacherAccountEmail({
          name: admin.name,
          email: admin.collegeEmail,
          teacherId: admin.teacherId,
          role: admin.role,
          password,
        }),
      });
    } catch (emailError) {
      console.error("Admin account created, but notification email failed:", emailError.message);

      return res.status(201).json({
        admin: serializeAdmin(admin),
        warning: "Admin account created, but the notification email could not be sent.",
      });
    }

    return res.status(201).json({ admin: serializeAdmin(admin) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not create admin." });
  }
});

router.post("/students", protect, masterAdminOnly, async (req, res) => {
  try {
    const { name, collegeEmail, usn, semester, password } = req.body;
    const normalizedEmail = String(collegeEmail || "").trim().toLowerCase();
    const normalizedUsn = normalizeUsn(usn);
    const semesterNumber = Number(semester);

    if (!name || !normalizedEmail || !normalizedUsn || !password || !isValidSemester(semesterNumber)) {
      return res.status(400).json({
        message: "Name, email, USN, semester, and temporary password are required.",
      });
    }

    if (semesterNumber < 3 || semesterNumber > 8) {
      return res.status(400).json({ message: "Student semester must be between 3 and 8." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Temporary password must be at least 8 characters." });
    }

    const existingUser = await User.findOne({
      $or: [{ collegeEmail: normalizedEmail }, { usn: normalizedUsn }],
    });
    if (existingUser) {
      return res.status(409).json({ message: "A user with this email or USN already exists." });
    }

    const student = await User.create({
      name: String(name).trim(),
      collegeEmail: normalizedEmail,
      usn: normalizedUsn,
      semester: semesterNumber,
      role: "student",
      password,
    });

    try {
      await sendStudentAccountNotification(student, password);
    } catch (emailError) {
      await User.deleteOne({ _id: student._id });
      console.error("Student account notification email failed. Account rolled back:", emailError.message);

      return res.status(502).json({
        message: "Student account was not created because the notification email could not be sent.",
      });
    }

    return res.status(201).json({ student: serializeStudent(student) });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not create student." });
  }
});

router.post("/students/bulk", protect, masterAdminOnly, upload.single("file"), async (req, res) => {
  try {
    const semesterNumber = Number(req.body.semester);

    if (!isValidSemester(semesterNumber) || semesterNumber < 3 || semesterNumber > 8) {
      return res.status(400).json({ message: "Student semester must be between 3 and 8." });
    }

    if (!req.file) {
      return res.status(400).json({ message: "Upload an Excel file with student name, usn, and emailid columns." });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
      defval: "",
      raw: false,
    });

    if (!rows.length) {
      return res.status(400).json({ message: "The uploaded Excel sheet does not contain student rows." });
    }

    const createdStudents = [];
    const skippedRows = [];
    const seenEmails = new Set();
    const seenUsns = new Set();

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const name = getExcelValue(row, "student name");
      const normalizedUsn = normalizeUsn(getExcelValue(row, "usn"));
      const normalizedEmail = getExcelValue(row, "emailid").toLowerCase();
      const password = createStudentTempPassword(normalizedUsn);

      if (!name || !normalizedUsn || !normalizedEmail) {
        skippedRows.push({ row: rowNumber, reason: "Missing student name, usn, or emailid." });
        continue;
      }

      if (seenEmails.has(normalizedEmail) || seenUsns.has(normalizedUsn)) {
        skippedRows.push({ row: rowNumber, reason: "Duplicate emailid or USN in uploaded sheet." });
        continue;
      }

      seenEmails.add(normalizedEmail);
      seenUsns.add(normalizedUsn);

      const existingUser = await User.findOne({
        $or: [{ collegeEmail: normalizedEmail }, { usn: normalizedUsn }],
      }).select("collegeEmail usn");

      if (existingUser) {
        skippedRows.push({ row: rowNumber, reason: "A user with this emailid or USN already exists." });
        continue;
      }

      const student = await User.create({
        name,
        collegeEmail: normalizedEmail,
        usn: normalizedUsn,
        semester: semesterNumber,
        role: "student",
        password,
      });

      try {
        await sendStudentAccountNotification(student, password);
      } catch (emailError) {
        await User.deleteOne({ _id: student._id });
        skippedRows.push({
          row: rowNumber,
          reason: "Notification email failed, so the account was not created.",
        });
        console.error(`Student ${student.collegeEmail} email failed:`, emailError.message);
        continue;
      }

      createdStudents.push({
        ...serializeStudent(student),
      });
    }

    if (!createdStudents.length) {
      return res.status(400).json({
        message: "No student accounts were created from the uploaded Excel file.",
        skippedRows,
      });
    }

    return res.status(201).json({
      students: createdStudents,
      created: createdStudents.length,
      skipped: skippedRows.length,
      skippedRows,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not import student accounts." });
  }
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

router.delete("/coordinators/:teacherUserId/:semester", protect, masterAdminOnly, async (req, res) => {
  try {
    const { teacherUserId, semester } = req.params;

    if (!teacherUserId || !isValidSemester(semester)) {
      return res.status(400).json({ message: "Teacher and semester are required." });
    }

    const semesterNumber = Number(semester);
    if (semesterNumber < 3 || semesterNumber > 8) {
      return res.status(400).json({ message: "Class coordinator can be removed only for semesters 3 to 8." });
    }

    const teacher = await User.findOne({ _id: teacherUserId, role: "admin" });
    if (!teacher) {
      return res.status(404).json({ message: "Teacher admin not found." });
    }

    teacher.coordinatorSemesters = (teacher.coordinatorSemesters || []).filter(
      (currentSemester) => Number(currentSemester) !== semesterNumber
    );
    await teacher.save({ validateBeforeSave: false });

    const studentUpdate = await User.updateMany(
      {
        role: "student",
        semester: semesterNumber,
        classCoordinatorId: teacher._id,
      },
      {
        $unset: {
          classCoordinatorId: "",
        },
        $set: {
          classCoordinatorName: "",
        },
      }
    );

    return res.json({
      teacher: serializeTeacher(teacher),
      updatedStudents: studentUpdate.modifiedCount || 0,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Could not remove class coordinator." });
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
