import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";

export async function GET() {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const waiting = await prisma.waitingCustomer.findMany({
    where: { restaurantId: session.user.restaurantId },
    include: {
      assignedTable: { select: { id: true, tableNumber: true, status: true } },
      order: {
        include: {
          items: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { waitingNumber: "asc" }],
    take: 200,
  });

  const tables = await prisma.table.findMany({
    where: { restaurantId: session.user.restaurantId, active: true },
    orderBy: { tableNumber: "asc" },
    select: { id: true, tableNumber: true, status: true },
  });

  return NextResponse.json({
    waitingCustomers: waiting.map((w) => ({
      id: w.id,
      customerName: w.customerName,
      customerPhone: w.customerPhone,
      peopleCount: w.peopleCount,
      waitingNumber: w.waitingNumber,
      tableRequirement: w.tableRequirement,
      notes: w.notes,
      status: w.status,
      tableStatus: w.tableStatus,
      reservedAt: w.reservedAt,
      assignedAt: w.assignedAt,
      createdAt: w.createdAt,
      waitingMinutes: Math.max(
        0,
        Math.floor((Date.now() - new Date(w.createdAt).getTime()) / 60000)
      ),
      assignedTable: w.assignedTable,
      order: w.order
        ? {
            id: w.order.id,
            orderNumber: w.order.orderNumber,
            status: w.order.status,
            total: w.order.total,
            orderSource: w.order.orderSource,
            createdAt: w.order.createdAt,
            items: w.order.items,
          }
        : null,
    })),
    tables,
  });
}

const assignSchema = z.object({
  waitingCustomerId: z.string().min(1),
  tableId: z.string().min(1),
  /** RESERVED | SEATED */
  action: z.enum(["RESERVED", "SEATED"]).default("RESERVED"),
});

export async function PATCH(request: Request) {
  const session = await requireStaff();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assignment data" }, { status: 400 });
  }

  const { waitingCustomerId, tableId, action } = parsed.data;

  const waiting = await prisma.waitingCustomer.findFirst({
    where: { id: waitingCustomerId, restaurantId: session.user.restaurantId },
  });
  if (!waiting) {
    return NextResponse.json({ error: "Waiting customer not found" }, { status: 404 });
  }

  const table = await prisma.table.findFirst({
    where: { id: tableId, restaurantId: session.user.restaurantId, active: true },
  });
  if (!table) {
    return NextResponse.json({ error: "Table not found" }, { status: 404 });
  }

  const now = new Date();
  const updated = await prisma.$transaction(async (tx) => {
    if (waiting.assignedTableId && waiting.assignedTableId !== tableId) {
      await tx.table.update({
        where: { id: waiting.assignedTableId },
        data: { status: "AVAILABLE" },
      });
    }

    const wc = await tx.waitingCustomer.update({
      where: { id: waiting.id },
      data: {
        assignedTableId: table.id,
        status: action,
        tableStatus: action === "SEATED" ? "OCCUPIED" : "RESERVED",
        reservedAt: waiting.reservedAt ?? now,
        assignedAt: now,
      },
      include: {
        assignedTable: true,
        order: { include: { items: true } },
      },
    });

    await tx.table.update({
      where: { id: table.id },
      data: { status: action === "SEATED" ? "OCCUPIED" : "RESERVED" },
    });

    if (wc.orderId) {
      await tx.order.update({
        where: { id: wc.orderId },
        data: { tableId: table.id },
      });
    }

    return wc;
  });

  return NextResponse.json({ waitingCustomer: updated });
}
