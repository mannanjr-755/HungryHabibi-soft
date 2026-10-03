/**
 * Upsert Hungry Habibi restaurant + admin user without wiping existing data.
 * Run: npx tsx scripts/ensure-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@hungryhabibi.com";
const ADMIN_PASSWORD = "password123";
const SLUG = "hungryhabibi";
const BRAND_NAME = "Hungry Habibi";

const LEGACY_SLUGS = ["HungryHabibi", "hungry-habibi", "BonPainer", "bonpainer", "4am", "4AM"];
const LEGACY_EMAILS = [
  "admin@HungryHabibi.com",
  "admin@hungryhabibi.com",
  "admin@bonpainer.com",
  "admin@BonPainer.com",
];

async function main() {
  let restaurant =
    (await prisma.restaurant.findUnique({ where: { slug: SLUG } })) ?? null;

  if (!restaurant) {
    for (const legacySlug of LEGACY_SLUGS) {
      restaurant = await prisma.restaurant.findUnique({ where: { slug: legacySlug } });
      if (restaurant) break;
    }
  }

  if (!restaurant) {
    restaurant = await prisma.restaurant.create({
      data: {
        name: BRAND_NAME,
        slug: SLUG,
        logo: "/logo.png",
        description:
          "Modern cafe & restaurant — barista-crafted coffee, fresh brews, and house favorites.",
      },
    });
    console.log("Created restaurant", restaurant.id);
  } else if (restaurant.slug !== SLUG || restaurant.name !== BRAND_NAME) {
    restaurant = await prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { slug: SLUG, name: BRAND_NAME, logo: restaurant.logo || "/logo.png" },
    });
    console.log("Updated restaurant slug/name →", SLUG, BRAND_NAME);
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  let migrated = false;
  for (const legacyEmail of LEGACY_EMAILS) {
    if (legacyEmail === ADMIN_EMAIL) continue;
    const legacy = await prisma.user.findUnique({ where: { email: legacyEmail } });
    if (!legacy) continue;
    const existingTarget = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
    if (existingTarget && existingTarget.id !== legacy.id) {
      await prisma.user.delete({ where: { id: legacy.id } });
      console.log("Removed duplicate legacy admin", legacyEmail);
    } else {
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
      migrated = true;
    }
  }

  if (!migrated) {
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
          uniqueCode: `${SLUG}-t${n}-${Math.random().toString(36).slice(2, 8)}`,
          active: true,
          status: "AVAILABLE",
        },
      });
    }
    console.log("Created 12 tables");
  }

  console.log("OK — login:", ADMIN_EMAIL);
  console.log("Table URL example: https://hungryhabibi-menu.vercel.app/r/hungryhabibi/t/1");
  console.log(
    "Waiting Customer URL: https://hungryhabibi-menu.vercel.app/r/hungryhabibi/waiting-customer"
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
