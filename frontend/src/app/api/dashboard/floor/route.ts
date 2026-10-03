import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/session";
import { completeBill, loadServiceFloor, serveReadyOrder } from "@/lib/serviceFloor";

const TX = { maxWait: 20_000, timeout: 30_000 };

export async function GET() {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const floor = await loadServiceFloor(session.user.restaurantId);
    return NextResponse.json(floor);
  } catch (error) {
    console.error("Service floor error:", error);
    return NextResponse.json({ error: "Could not load the service floor" }, { status: 500 });
  }
}

const actionSchema = z.object({
  action: z.enum([
    "call",
    "seat",
    "cancel-wait",
    "accept",
    "prepare",
    "ready",
    "serve",
    "ack",
    "complete-bill",
  ]),
  id: z.string().min(1),
});

export async function POST(request: Request) {
  const session = await requireStaff();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const restaurantId = session.user.restaurantId;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  try {
    const { action, id } = parsed.data;

    if (action === "call" || action === "seat" || action === "cancel-wait") {
      const entry = await prisma.waitingCustomer.findFirst({
        where: { id, restaurantId },
      });
      if (!entry) return NextResponse.json({ error: "Waitlist entry not found" }, { status: 404 });

      if (action === "cancel-wait") {
        await prisma.$transaction(async (tx) => {
          await tx.waitingCustomer.update({
            where: { id: entry.id },
            data: { status: "CANCELLED" },
          });
          if (entry.visitId) {
            await tx.visit.updateMany({
              where: { id: entry.visitId, status: "ACTIVE" },
              data: { status: "CANCELLED", completedAt: new Date() },
            });
          }
        }, TX);
      } else if (action === "call") {
        if (entry.status !== "WAITING" && entry.status !== "RESERVED") {
          return NextResponse.json({ error: "This guest is not waiting" }, { status: 409 });
        }
        await prisma.waitingCustomer.update({
          where: { id: entry.id },
          data: { status: "CALLED" },
        });
      } else {
        if (!["WAITING", "CALLED", "RESERVED"].includes(entry.status)) {
          return NextResponse.json({ error: "This guest cannot be seated" }, { status: 409 });
        }
        if (!entry.assignedTableId) {
          return NextResponse.json({ error: "No table is assigned" }, { status: 409 });
        }
        const blocking = await prisma.visit.findFirst({
          where: {
            tableId: entry.assignedTableId,
            status: "ACTIVE",
            ...(entry.visitId ? { NOT: { id: entry.visitId } } : {}),
            OR: [{ waitingCustomer: { is: null } }, { waitingCustomer: { is: { status: "SEATED" } } }],
          },
          select: { id: true },
        });
        if (blocking) {
          return NextResponse.json({ error: "That table is still in use" }, { status: 409 });
        }
        await prisma.$transaction(async (tx) => {
          await tx.waitingCustomer.update({
            where: { id: entry.id },
            data: {
              status: "SEATED",
              tableStatus: "OCCUPIED",
              assignedAt: new Date(),
            },
          });
          await tx.table.update({
            where: { id: entry.assignedTableId! },
            data: { status: "OCCUPIED" },
          });
          if (entry.visitId) {
            await tx.order.updateMany({
              where: {
                visitId: entry.visitId,
                orderSource: "WAITING_CUSTOMER",
                status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] },
              },
              data: { orderSource: "TABLE" },
            });
          }
        }, TX);
      }
    } else if (action === "accept" || action === "prepare" || action === "ready" || action === "serve") {
      if (action === "serve") {
        const result = await serveReadyOrder(restaurantId, id);
        if ("error" in result && result.error) {
          return NextResponse.json({ error: result.error }, { status: result.status });
        }
      } else {
        const next = action === "accept" || action === "prepare" ? "PREPARING" : "READY";
        const allowed = action === "ready" ? ["PREPARING", "ACCEPTED"] : ["NEW", "ACCEPTED"];
        const updated = await prisma.order.updateMany({
          where: { id, restaurantId, status: { in: allowed } },
          data: { status: next },
        });
        if (updated.count !== 1) {
          return NextResponse.json({ error: "Order could not be updated" }, { status: 409 });
        }
      }
    } else if (action === "ack") {
      const existing = await prisma.tableRequest.findFirst({
        where: { id, restaurantId, status: "PENDING" },
      });
      if (!existing) return NextResponse.json({ error: "Request not found" }, { status: 404 });
      if (existing.type === "SERVE" && existing.orderId) {
        const result = await serveReadyOrder(restaurantId, existing.orderId);
        if ("error" in result && result.error) {
          return NextResponse.json({ error: result.error }, { status: result.status });
        }
      } else {
        await prisma.tableRequest.update({
          where: { id: existing.id },
          data: { status: existing.type === "SERVE" ? "COMPLETED" : "ACKNOWLEDGED" },
        });
      }
    } else if (action === "complete-bill") {
      const result = await completeBill(restaurantId, id);
      if ("error" in result && result.error) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
    }

    return NextResponse.json(await loadServiceFloor(restaurantId));
  } catch (error) {
    console.error("Service floor action error:", error);
    return NextResponse.json({ error: "Could not update the floor" }, { status: 500 });
  }
}
