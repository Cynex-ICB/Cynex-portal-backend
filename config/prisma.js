import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export async function connectDB() {
  await prisma.$connect();
  console.log("PostgreSQL database connected via Prisma.");
}

export function withMongoId(item) {
  if (!item) return item;
  if (Array.isArray(item)) {
    return item.map(withMongoId);
  }
  if (typeof item === "object" && item !== null) {
    const copy = { ...item };
    if (copy.id && !copy._id) {
      copy._id = copy.id;
    }
    // recursively format populated relations
    for (const key of Object.keys(copy)) {
      if (copy[key] && typeof copy[key] === "object" && !(copy[key] instanceof Date)) {
        copy[key] = withMongoId(copy[key]);
      }
    }
    return copy;
  }
  return item;
}

export default prisma;
