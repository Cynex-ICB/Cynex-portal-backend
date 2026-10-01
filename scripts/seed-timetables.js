import prisma from "../config/prisma.js";

const DEFAULT_TIME_SLOTS = [
  { id: "p1", time: "9.00 To 9.50", label: "Period 1", isBreak: false },
  { id: "p2", time: "9.50 To 10.40", label: "Period 2", isBreak: false },
  { id: "b1", time: "10.40 To 11.00", label: "Break", isBreak: true },
  { id: "p3", time: "11.00 To 11.50", label: "Period 3", isBreak: false },
  { id: "p4", time: "11.50 To 12.40", label: "Period 4", isBreak: false },
  { id: "b2", time: "12.40 To 1.40", label: "Lunch Break", isBreak: true },
  { id: "p5", time: "1.40 To 2.30", label: "Period 5", isBreak: false },
  { id: "p6", time: "2.30 To 3.20", label: "Period 6", isBreak: false },
  { id: "p7", time: "3.20 To 4.20", label: "Period 7", isBreak: false },
];

const timetables = [
  // ==========================================
  // SEMESTER 3
  // ==========================================
  {
    academicYear: "2026-27",
    scheme: "2025",
    semester: 3,
    section: "A",
    classCoordinator: "Prof. SAVITA S K",
    roomNo: "G06",
    effectiveDate: "31-08-2026",
    timeSlots: DEFAULT_TIME_SLOTS,
    courses: [
      { code: "1BMATCS301", shortName: "MATHS", name: "PROBABILITY, DISTRIBUTION & STATISTICS", faculty: "PROF. POOJASHREE", facultyInitial: "POO", credits: 4 },
      { code: "1BCS302", shortName: "JAVA", name: "OBJECT ORIENTED PROGRAMMING WITH JAVA", faculty: "PROF. SAVITA S K", facultyInitial: "SSK", credits: 4 },
      { code: "1BCS303", shortName: "DDCO", name: "DIGITAL DESIGN and COMPUTER ORGANISATION", faculty: "PROF. JYOTIBHA R CHINCHANKAR", facultyInitial: "JRC", credits: 4 },
      { code: "1BCS304", shortName: "OS", name: "OPERATING SYSTEM", faculty: "PROF. SHIBU CHACKO", facultyInitial: "SHC", credits: 4 },
      { code: "1BCS305", shortName: "DSA", name: "DATA STRUCTURE and APPLICATIONS", faculty: "PROF. NAMRATHA H N", facultyInitial: "NHN", credits: 3 },
      { code: "1BCSL306", shortName: "DSA LAB", name: "DATA STRUCTURE LAB", faculty: "PROF. NAMRATHA H N", facultyInitial: "NHN", credits: 1 },
      { code: "1BCSL307", shortName: "GIT LAB", name: "PROJECT MANAGEMENT with GITHUB", faculty: "PROF. FAYAZ AHAMED SHAIKH", facultyInitial: "FAS", credits: 1 },
      { code: "1BCP308", shortName: "SCR", name: "COMMON PROJECT/SOCIEAL PROJECT", faculty: "PROF. JYOTIBHA R CHINCHANKAR", facultyInitial: "JRC", credits: 1 },
      { code: "1BNSS309", shortName: "NSS", name: "NATIONAL SOCIAL SERVICE", faculty: "PROF. JYOTIBHA R CHINCHANKAR", facultyInitial: "JRC", credits: 1 },
      { code: "1BPE309", shortName: "PE", name: "PHYSICAL EDUCATION", faculty: "MR. BHARAT GOWDA K", facultyInitial: "BGK", credits: 1 },
    ],
    grid: {
      MON: [
        { slotId: "p1", subject: "OS", span: 2 },
        { slotId: "p2", isSpanned: true },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "DSA LAB (LAB111)", span: 2 },
        { slotId: "p4", isSpanned: true },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "APTITUDE", span: 2 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", subject: "NSS/PE" },
      ],
      TUE: [
        { slotId: "p1", subject: "MATHS" },
        { slotId: "p2", subject: "OS" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "DDCOLAB (LAB111)", span: 2 },
        { slotId: "p4", isSpanned: true },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "JAVA" },
        { slotId: "p6", subject: "DSA" },
        { slotId: "p7", subject: "DDCO" },
      ],
      WED: [
        { slotId: "p1", subject: "DDCO" },
        { slotId: "p2", subject: "MATHS" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "JAVA LAB (LAB111)", span: 2 },
        { slotId: "p4", isSpanned: true },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "DSA" },
        { slotId: "p6", subject: "PREPINSTA" },
        { slotId: "p7", subject: "COURSERA" },
      ],
      THU: [
        { slotId: "p1", subject: "DDCO" },
        { slotId: "p2", subject: "MATHS" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "JAVA" },
        { slotId: "p4", subject: "DSA" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "GIT HUB LAB (LAB416)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      FRI: [
        { slotId: "p1", subject: "DSA" },
        { slotId: "p2", subject: "OS" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "TOC" },
        { slotId: "p4", subject: "OS" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "MATHS" },
        { slotId: "p6", subject: "JAVA" },
        { slotId: "p7", subject: "DSA" },
      ],
      SAT: [
        { slotId: "p1", subject: "MATHS" },
        { slotId: "p2", subject: "DDCO" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "JAVA" },
        { slotId: "p4", subject: "OS" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "—" },
        { slotId: "p6", subject: "—" },
        { slotId: "p7", subject: "—" },
      ],
    },
  },

  // ==========================================
  // SEMESTER 5
  // ==========================================
  {
    academicYear: "2026-27",
    scheme: "2022",
    semester: 5,
    section: "A",
    classCoordinator: "Prof. JYOTHIBA R C",
    roomNo: "G04",
    effectiveDate: "10-08-2026",
    timeSlots: DEFAULT_TIME_SLOTS,
    courses: [
      { code: "BCS501", shortName: "SEPM", name: "SOFTWARE ENGINEERING and PROJECT MANAGEMENT", faculty: "PROF. NAMRATHA H N", facultyInitial: "NHN", credits: 3 },
      { code: "BCS502", shortName: "CN", name: "COMPUTER NETWORKS", faculty: "PROF. VASUDEV SHAHAPUR", facultyInitial: "VS", credits: 4 },
      { code: "BCS503", shortName: "TOC", name: "THEORY OF COMPUTATION", faculty: "PROF. FAYAZ AHAMED SHAIKH", facultyInitial: "FAS", credits: 3 },
      { code: "BICL504", shortName: "IOT LAB", name: "IOT LAB with MINI PROJECT", faculty: "PROF. VASUDEV SHAHAPUR/PROF. JYOTHIBA R C", facultyInitial: "VS/JRC", credits: 1 },
      { code: "BCS515B", shortName: "AI", name: "ARTIFICIAL INTELLIGENCE", faculty: "PROF. JYOTHIBA R C", facultyInitial: "JRC", credits: 3 },
      { code: "BCS508", shortName: "EVS", name: "ENVIRNMENTAL STUDIES", faculty: "PROF. ASHWINI", facultyInitial: "AS", credits: 1 },
      { code: "BRMK557", shortName: "RMIPR", name: "RESEARCH METHODOLOGY and IPR", faculty: "DR. RAHUL PATHAK", facultyInitial: "RP", credits: 3 },
      { code: "BNSK559", shortName: "NSS", name: "NATIONAL SOCIAL SERVICE", faculty: "PROF. JYOTHIBA R CHINCHANKAR", facultyInitial: "JRC", credits: 1 },
      { code: "BPEK559", shortName: "PE", name: "PHYSICAL EDUCATION", faculty: "MR. BHARATH GOWDA K", facultyInitial: "BGK", credits: 1 },
    ],
    grid: {
      MON: [
        { slotId: "p1", subject: "AI" },
        { slotId: "p2", subject: "TOC" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "RMIPR" },
        { slotId: "p4", subject: "SEPM" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "IOT LAB (ROOM No 111) (VS/JRC)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      TUE: [
        { slotId: "p1", subject: "AI" },
        { slotId: "p2", subject: "SEPM" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "RMIPR" },
        { slotId: "p4", subject: "CN" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "TOC LAB (ROOM No 111) (FAS/SC)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      WED: [
        { slotId: "p1", subject: "APTITUDE (10 SECONDS)", span: 2 },
        { slotId: "p2", isSpanned: true },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "RMIPR" },
        { slotId: "p4", subject: "SEPM" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "CN LAB (ROOM No 111) (VS/JRC)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      THU: [
        { slotId: "p1", subject: "SOFT SKILLS (KA)", span: 2 },
        { slotId: "p2", isSpanned: true },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "CN" },
        { slotId: "p4", subject: "TOC" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "COURSERA (NHN/JRC)" },
        { slotId: "p6", subject: "PREPInSTA (NHN/JRC)" },
        { slotId: "p7", subject: "NSS/PE" },
      ],
      FRI: [
        { slotId: "p1", subject: "AI" },
        { slotId: "p2", subject: "CN" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "TOC" },
        { slotId: "p4", subject: "SEPM" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "EVS" },
        { slotId: "p6", subject: "MENTOR MENTEE" },
        { slotId: "p7", subject: "LIB" },
      ],
      SAT: [
        { slotId: "p1", subject: "TOC" },
        { slotId: "p2", subject: "CN" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "SEPM" },
        { slotId: "p4", subject: "AI" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "—" },
        { slotId: "p6", subject: "—" },
        { slotId: "p7", subject: "—" },
      ],
    },
  },

  // ==========================================
  // SEMESTER 7
  // ==========================================
  {
    academicYear: "2026-27",
    scheme: "2022",
    semester: 7,
    section: "A",
    classCoordinator: "Prof. FAYAZ SHAIKH",
    roomNo: "G05",
    effectiveDate: "20-07-2026",
    timeSlots: DEFAULT_TIME_SLOTS,
    courses: [
      { code: "BCO701", shortName: "ICP", name: "IOT COMMUNICATION PROTOCOL", faculty: "PROF. SHIBU CHACKO", facultyInitial: "SC", credits: 4 },
      { code: "BIC702", shortName: "BT", name: "BLOCKCHAIN TECHNOLOGY", faculty: "PROF. SAVITA S K", facultyInitial: "SSK", credits: 4 },
      { code: "BIC703", shortName: "ML", name: "MACHINE LEARNING", faculty: "PROF. VASUDEV SHAHAPUR", facultyInitial: "VS", credits: 4 },
      { code: "BCY756D", shortName: "CSCG", name: "CYBERSECURITY COMPALIENCE & GOVERNANCE", faculty: "PROF. ALEXANDER K", facultyInitial: "ALEX", credits: 3 },
      { code: "BME755D", shortName: "NCER", name: "NON CONVENTIONAL RESOURCES", faculty: "PROF. SHRINIVAS", facultyInitial: "SHRI", credits: 3 },
      { code: "BCS786", shortName: "PROJ", name: "PROJECT PHASE II", faculty: "PROF. JYOTIBHA R CHINCHANKAR", facultyInitial: "JRC", credits: 4 },
    ],
    grid: {
      MON: [
        { slotId: "p1", subject: "BT" },
        { slotId: "p2", subject: "ML" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "NCER" },
        { slotId: "p4", subject: "CSCG" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "PREPINSTA/COURSERA(416) (JRC/NHN)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      TUE: [
        { slotId: "p1", subject: "BT" },
        { slotId: "p2", subject: "ML" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "SEMINAR", span: 2 },
        { slotId: "p4", isSpanned: true },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "BT LAB (ROOM No 416) (SSK/NHN)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      WED: [
        { slotId: "p1", subject: "ICP" },
        { slotId: "p2", subject: "ML" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "NCER" },
        { slotId: "p4", subject: "CSCG" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "PROJECT (ROOM No G05) (SC/FAIZ)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      THU: [
        { slotId: "p1", subject: "ICP" },
        { slotId: "p2", subject: "CSCG" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "LIB" },
        { slotId: "p4", subject: "MENTOR MENTEE" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "PROJECT ( ROOM No G05) (NHN/SSK)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      FRI: [
        { slotId: "p1", subject: "NCER" },
        { slotId: "p2", subject: "BT" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "ML" },
        { slotId: "p4", subject: "ICP" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "ICP LAB (ROOM No 111) (SC/FAS)", span: 3 },
        { slotId: "p6", isSpanned: true },
        { slotId: "p7", isSpanned: true },
      ],
      SAT: [
        { slotId: "p1", subject: "ICP" },
        { slotId: "p2", subject: "BT" },
        { slotId: "b1", subject: "BREAK" },
        { slotId: "p3", subject: "CSCG" },
        { slotId: "p4", subject: "ML" },
        { slotId: "b2", subject: "LUNCH BREAK" },
        { slotId: "p5", subject: "—" },
        { slotId: "p6", subject: "—" },
        { slotId: "p7", subject: "—" },
      ],
    },
  },
];

async function seed() {
  console.log("Seeding Timetables for Semesters 3, 5, 7...");
  for (const tt of timetables) {
    const res = await prisma.timetable.upsert({
      where: {
        semester_section_academicYear: {
          semester: tt.semester,
          section: tt.section,
          academicYear: tt.academicYear,
        },
      },
      update: tt,
      create: tt,
    });
    console.log(`[SUCCESS] Timetable Sem ${res.semester} Section ${res.section} (${res.academicYear}) saved! ID: ${res.id}`);
  }
}

seed()
  .catch((err) => {
    console.error("Seeding error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
