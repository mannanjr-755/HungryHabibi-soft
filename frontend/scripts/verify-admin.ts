import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const u = await prisma.user.findUnique({
    where: { email: "admin@bonpainer.com" },
    include: { restaurant: true },
  });
  if (!u) {
    console.log("NO USER");
    process.exit(1);
  }
  const passwordOk = await bcrypt.compare("password123", u.passwordHash);
  const tables = await prisma.table.count({ where: { restaurantId: u.restaurantId } });
  console.log(
    JSON.stringify(
      {
        email: u.email,
        role: u.role,
        active: u.active,
        passwordOk,
        slug: u.restaurant.slug,
        name: u.restaurant.name,
        tables,
      },
      null,
      2
    )
  );
  if (!passwordOk || u.restaurant.slug !== "bonpainer") process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
