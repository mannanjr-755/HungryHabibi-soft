/**
 * Upsert BonPainer restaurant + admin user without wiping existing data.
 * Run: npx tsx scripts/ensure-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@bonpainer.com";
const ADMIN_PASSWORD = "password123";
const SLUG = "bonpainer";

async function main() {
  let restaurant =
    (await prisma.restaurant.findUnique({ where: { slug: SLUG } })) ??
    (await prisma.restaurant.findUnique({ where: { slug: "BonPainer" } }));

  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: "BonPainer",
        slug: SLUG,
        logo: "/logo.png",
        description: "Modern cafe & restaurant — barista-crafted coffee, fresh brews, and house favorites.",
      },
    });
    console.log("Created restaurant", restaurant.id);
  } else if (restaurant.slug !== SLUG || restaurant.name !== "BonPainer") {
    restaurant = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { slug: SLUG, name: "BonPainer", logo: restaurant.logo || "/logo.png" },
    });
    console.log("Updated restaurant slug/name");
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const legacy = await prisma.user.findUnique({ where: { email: "admin@BonPainer.com" } });
  if (legacy && legacy.email !== ADMIN_EMAIL) {
    await prisma.user.update({
      where: { id: legacy.id },
      data: {
        email: ADMIN_EMAIL,
        passwordHash,
        active: true,
        role: "ADMIN",
        name: "Admin",
        restaurantId: restaurant.id,
      },
    });
    console.log("Migrated legacy admin email →", ADMIN_EMAIL);
  } else {
    await prisma.user.upsert({
      where: { email: ADMIN_EMAIL },
      update: {
        passwordHash,
        active: true,
        role: "ADMIN",
        name: "Admin",
        restaurantId: restaurant.id,
      },
      create: {
        email: ADMIN_EMAIL,
        passwordHash,
        name: "Admin",
        role: "ADMIN",
        restaurantId: restaurant.id,
      },
    });
    console.log("Upserted admin", ADMIN_EMAIL);
  }

  const tableCount = await prisma.table.count({ where: { restaurantId: restaurant.id } });
  if (tableCount === 0) {
    for (let n = 1; n <= 12; n++) {
      await prisma.table.create({
        data: {
          restaurantId: restaurant.id,
          tableNumber: n,
          uniqueCode: `bonpainer-t${n}-${Math.random().toString(36).slice(2, 8)}`,
          active: true,
        },
      });
    }
    console.log("Created 12 tables");
  }

  console.log("OK — login:", ADMIN_EMAIL, "/", ADMIN_PASSWORD);
  console.log("Table URL example: https://BonPainer-menu.vercel.app/r/bonpainer/t/1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
