import prisma from "../config/prisma.js";

const subjectsToInsert = [
  // ==========================================
  // SEMESTER 3 (Scheme 2022/2025, Section A)
  // ==========================================
  {
    code: "1BMATCS301",
    name: "Probability, Distribution & Statistics (MATHS)",
    semester: 3,
    credits: 4,
    instructor: "Prof. Poojashree",
    description: "Short: MATHS | Coordinator: Prof. Savitha S. K. | Room: G06",
  },
  {
    code: "1BCS302",
    name: "Object Oriented Programming with Java (JAVA)",
    semester: 3,
    credits: 4,
    instructor: "Prof. Savitha S. K.",
    description: "Short: JAVA | Coordinator: Prof. Savitha S. K. | Room: G06",
  },
  {
    code: "1BCS303",
    name: "Digital Design and Computer Organisation (DDCO)",
    semester: 3,
    credits: 4,
    instructor: "Prof. Jyotibha R. Chinchankar",
    description: "Short: DDCO | Coordinator: Prof. Savitha S. K. | Room: G06",
  },
  {
    code: "1BCS304",
    name: "Operating System (OS)",
    semester: 3,
    credits: 4,
    instructor: "Prof. Shibu Chacko",
    description: "Short: OS | Coordinator: Prof. Savitha S. K. | Room: G06",
  },
  {
    code: "1BCS305",
    name: "Data Structure and Applications (DSA)",
    semester: 3,
    credits: 3,
    instructor: "Prof. Namratha H. N.",
    description: "Short: DSA | Coordinator: Prof. Savitha S. K. | Room: G06",
  },
  {
    code: "1BCSL306",
    name: "Data Structure Lab (DSA LAB)",
    semester: 3,
    credits: 1,
    instructor: "Prof. Namratha H. N.",
    description: "Short: DSA LAB | Room: LAB 111",
  },
  {
    code: "1BCSL307",
    name: "Project Management with GitHub (GIT LAB)",
    semester: 3,
    credits: 1,
    instructor: "Prof. Fayaz Ahamed Shaikh",
    description: "Short: GIT LAB | Room: LAB 416",
  },
  {
    code: "1BCP308",
    name: "Common Project / Social Project (SCR)",
    semester: 3,
    credits: 1,
    instructor: "Prof. Jyotibha R. Chinchankar",
    description: "Short: SCR | Social Connect & Responsibility Project",
  },
  {
    code: "1BNSS309",
    name: "National Social Service (NSS)",
    semester: 3,
    credits: 1,
    instructor: "Prof. Jyotibha R. Chinchankar",
    description: "Short: NSS | National Social Service",
  },
  {
    code: "1BPE309",
    name: "Physical Education (PE)",
    semester: 3,
    credits: 1,
    instructor: "Mr. Bharat Gowda K.",
    description: "Short: PE | Physical Education",
  },

  // ==========================================
  // SEMESTER 5 (Scheme 2022, Section A)
  // ==========================================
  {
    code: "BCS501",
    name: "Software Engineering and Project Management (SEPM)",
    semester: 5,
    credits: 3,
    instructor: "Prof. Namratha H. N.",
    description: "Short: SEPM | Coordinator: Prof. Jyothiba R. C. | Room: G04",
  },
  {
    code: "BCS502",
    name: "Computer Networks (CN)",
    semester: 5,
    credits: 4,
    instructor: "Prof. Vasudev S. Shahapur",
    description: "Short: CN | Coordinator: Prof. Jyothiba R. C. | Room: G04",
  },
  {
    code: "BCS503",
    name: "Theory of Computation (TOC)",
    semester: 5,
    credits: 3,
    instructor: "Prof. Fayaz Ahamed Shaikh",
    description: "Short: TOC | Coordinator: Prof. Jyothiba R. C. | Room: G04",
  },
  {
    code: "BICL504",
    name: "IoT Lab with Mini Project (IOT LAB)",
    semester: 5,
    credits: 1,
    instructor: "Prof. Vasudev S. Shahapur / Prof. Jyothiba R. C.",
    description: "Short: IOT LAB | Room: LAB 111",
  },
  {
    code: "BCS515B",
    name: "Artificial Intelligence (AI)",
    semester: 5,
    credits: 3,
    instructor: "Prof. Jyothiba R. C.",
    description: "Short: AI | Professional Elective",
  },
  {
    code: "BCS508",
    name: "Environmental Studies (EVS)",
    semester: 5,
    credits: 1,
    instructor: "Prof. Ashwini",
    description: "Short: EVS | Environmental Studies",
  },
  {
    code: "BRMK557",
    name: "Research Methodology and IPR (RMIPR)",
    semester: 5,
    credits: 3,
    instructor: "Dr. Rahul Pathak",
    description: "Short: RMIPR | Research Methodology and IPR",
  },
  {
    code: "BNSK559",
    name: "National Social Service (NSS)",
    semester: 5,
    credits: 1,
    instructor: "Prof. Jyothiba R. Chinchankar",
    description: "Short: NSS | National Social Service",
  },
  {
    code: "BPEK559",
    name: "Physical Education (PE)",
    semester: 5,
    credits: 1,
    instructor: "Mr. Bharath Gowda K.",
    description: "Short: PE | Physical Education",
  },

  // ==========================================
  // SEMESTER 7 (Scheme 2022, Section A)
  // ==========================================
  {
    code: "BCO701",
    name: "IoT Communication Protocol (ICP)",
    semester: 7,
    credits: 4,
    instructor: "Prof. Shibu Chacko",
    description: "Short: ICP | Coordinator: Prof. Fayaz Shaikh | Room: G05",
  },
  {
    code: "BIC702",
    name: "Blockchain Technology (BT)",
    semester: 7,
    credits: 4,
    instructor: "Prof. Savitha S. K.",
    description: "Short: BT | Coordinator: Prof. Fayaz Shaikh | Room: G05",
  },
  {
    code: "BIC703",
    name: "Machine Learning (ML)",
    semester: 7,
    credits: 4,
    instructor: "Prof. Vasudev S. Shahapur",
    description: "Short: ML | Coordinator: Prof. Fayaz Shaikh | Room: G05",
  },
  {
    code: "BCY756D",
    name: "Cybersecurity Compliance & Governance (CSCG)",
    semester: 7,
    credits: 3,
    instructor: "Prof. Alexander K.",
    description: "Short: CSCG | Professional Elective",
  },
  {
    code: "BME755D",
    name: "Non Conventional Resources (NCER)",
    semester: 7,
    credits: 3,
    instructor: "Prof. Shrinivas",
    description: "Short: NCER | Open Elective",
  },
  {
    code: "BCS786",
    name: "Project Phase II (PROJ)",
    semester: 7,
    credits: 4,
    instructor: "Prof. Jyothiba R. Chinchankar",
    description: "Short: PROJ | Major Project Phase II",
  },
];

async function seedSubjects() {
  console.log(`Starting subject seed for Semesters 3, 5, and 7 (${subjectsToInsert.length} total subjects)...`);

  let addedCount = 0;
  let updatedCount = 0;

  for (const item of subjectsToInsert) {
    const existing = await prisma.subject.findUnique({
      where: {
        code_semester: {
          code: item.code,
          semester: item.semester,
        },
      },
    });

    if (existing) {
      await prisma.subject.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          credits: item.credits,
          instructor: item.instructor,
          description: item.description,
        },
      });
      console.log(`[UPDATED] Sem ${item.semester} - ${item.code}: ${item.name}`);
      updatedCount++;
    } else {
      await prisma.subject.create({
        data: item,
      });
      console.log(`[CREATED] Sem ${item.semester} - ${item.code}: ${item.name}`);
      addedCount++;
    }
  }

  console.log(`\nSeed completed! Added: ${addedCount}, Updated: ${updatedCount}, Total: ${subjectsToInsert.length}`);
}

seedSubjects()
  .catch((err) => {
    console.error("Failed to seed subjects:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
