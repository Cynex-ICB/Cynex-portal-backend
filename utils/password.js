import bcrypt from "bcryptjs";

export async function hashPassword(password) {
  if (!password) return "";
  if (/^\$2[aby]\$\d{2}\$/.test(password)) {
    return password;
  }
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export function comparePassword(candidatePassword, hashedPassword) {
  if (!candidatePassword || !hashedPassword) return false;
  return bcrypt.compare(candidatePassword, hashedPassword);
}
