import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: "admin@hungryhabibi.com" },
    include: { restaurant: true },
  });

  if (!u) {
    console.error("FAIL: admin@hungryhabibi.com not found");
    process.exit(1);
  }

  const passwordOk = await bcrypt.compare("password123", u.passwordHash);
  console.log({
    email: u.email,
    active: u.active,
    role: u.role,
    restaurant: u.restaurant.name,
    slug: u.restaurant.slug,
    passwordOk,
  });

  if (!passwordOk || u.restaurant.slug !== "hungryhabibi" || !u.active) {
    process.exit(1);
  }

  console.log("OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
