import { NextResponse } from "next/server";
import { z } from "zod";
import { BRAND_SLUG, tableMenuUrl, waitingCustomerMenuUrl } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tables = await prisma.table.findMany({
    where: { restaurantId: session.user.restaurantId },
    orderBy: { tableNumber: "asc" },
    include: {
      waitingAssignments: {
        where: { status: { in: ["WAITING", "RESERVED"] } },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          customerName: true,
          waitingNumber: true,
          status: true,
          tableStatus: true,
        },
      },
      orders: {
        where: { status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] }, orderSource: "TABLE" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { id: true, orderNumber: true, status: true, customerName: true },
      },
    },
  });

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
    select: { slug: true },
  });

  const slug = restaurant?.slug || BRAND_SLUG;

  return NextResponse.json({
    tables: tables.map((t) => {
      const activeOrder = t.orders[0] ?? null;
      const reservation = t.waitingAssignments[0] ?? null;
      let displayStatus = t.status || "AVAILABLE";
      if (activeOrder) displayStatus = "OCCUPIED";
      else if (reservation?.tableStatus === "RESERVED" || reservation?.status === "RESERVED") {
        displayStatus = "RESERVED";
      } else if (reservation?.status === "WAITING") {
        displayStatus = "WAITING";
      }

      return {
        id: t.id,
        tableNumber: t.tableNumber,
        uniqueCode: t.uniqueCode,
        active: t.active,
        status: displayStatus,
        menuUrl: tableMenuUrl(t.tableNumber, slug),
        activeOrder,
        reservation,
      };
    }),
    slug,
    waitingCustomerUrl: waitingCustomerMenuUrl(slug),
  });
}

const createSchema = z.object({
  tableNumber: z.number().int().positive(),
});

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid table number" }, { status: 400 });
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.user.restaurantId },
  });
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const exists = await prisma.table.findUnique({
    where: {
      restaurantId_tableNumber: {
        restaurantId: restaurant.id,
        tableNumber: parsed.data.tableNumber,
      },
    },
  });

  if (exists) {
    return NextResponse.json({ error: "Table number already exists" }, { status: 409 });
  }

  const table = await prisma.table.create({
    data: {
      restaurantId: restaurant.id,
      tableNumber: parsed.data.tableNumber,
      uniqueCode: `${restaurant.slug}-t${parsed.data.tableNumber}-${Math.random().toString(36).slice(2, 8)}`,
      active: true,
    },
  });

  const url = tableMenuUrl(table.tableNumber, restaurant.slug);
  return NextResponse.json(
    {
      table,
      url,
      absoluteUrl: url,
    },
    { status: 201 }
  );
}
