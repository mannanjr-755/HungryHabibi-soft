import { formatEstimate, tableRemainingMinutes, waitlistMinutes, type GuestPhase } from "@/lib/estimate";
import { prisma } from "@/lib/prisma";

const WAITING = ["WAITING", "CALLED", "RESERVED"] as const;
const TX = { maxWait: 20_000, timeout: 30_000 };

export async function loadServiceFloor(restaurantId: string) {
  const [waitlist, visits, orders, requests] = await Promise.all([
    prisma.waitingCustomer.findMany({
      where: { restaurantId, status: { in: [...WAITING] } },
      include: { assignedTable: { select: { tableNumber: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.visit.findMany({
      where: { restaurantId, status: "ACTIVE" },
      include: {
        table: { select: { tableNumber: true, status: true } },
        waitingCustomer: true,
        orders: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, orderNumber: true, status: true, total: true, updatedAt: true, orderSource: true },
        },
        tableRequests: { where: { status: "PENDING" }, select: { type: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.order.findMany({
      where: {
        restaurantId,
        status: { in: ["NEW", "ACCEPTED", "PREPARING", "READY"] },
      },
      include: {
        items: { select: { itemName: true, quantity: true } },
        table: { select: { tableNumber: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.tableRequest.findMany({
      where: { restaurantId, status: "PENDING" },
      include: {
        table: { select: { tableNumber: true } },
        order: { select: { id: true, orderNumber: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const activeTables = visits
    .filter((visit) => {
      const status = visit.waitingCustomer?.status;
      return !status || !WAITING.includes(status as (typeof WAITING)[number]);
    })
    .map((visit) => {
      const order = visit.orders[0] ?? null;
      const pending = new Set(visit.tableRequests.map((request) => request.type));
      let lifecycle = "SEATED";
      if (pending.has("BILL")) lifecycle = "BILL";
      else if (pending.has("SERVE")) lifecycle = "SERVE REQUEST";
      else if (order?.status === "READY") lifecycle = "READY";
      else if (order?.status === "NEW" || order?.status === "ACCEPTED") lifecycle = "ORDERING";
      else if (order?.status === "PREPARING") lifecycle = "PREPARING";
      else if (order?.status === "SERVED") lifecycle = "SERVED";
      const phase: GuestPhase =
        lifecycle === "BILL" ? "BILLING" : lifecycle === "PREPARING" ? "PREPARING" : lifecycle === "READY" || lifecycle === "SERVE REQUEST" ? "SERVING" : lifecycle === "ORDERING" ? "ORDERING" : "SEATED";
      const elapsed = order ? (Date.now() - new Date(order.updatedAt).getTime()) / 60000 : 0;
      const estimateMinutes = tableRemainingMinutes(phase, elapsed);
      return {
        id: visit.id,
        tableNumber: visit.table.tableNumber,
        guest: visit.guestLabel || "Guest",
        lifecycle,
        since: visit.createdAt.toISOString(),
        orderNumber: order?.orderNumber ?? null,
        preorder: order?.orderSource === "WAITING_CUSTOMER",
        estimateMinutes,
        estimateText: formatEstimate(estimateMinutes),
      };
    });

  return {
    waitlist: waitlist.map((entry) => {
      const sameTable = waitlist.filter((row) => row.assignedTableId === entry.assignedTableId);
      const position = Math.max(1, sameTable.findIndex((row) => row.id === entry.id) + 1);
      const seated = activeTables.find((table) => table.tableNumber === entry.assignedTable?.tableNumber);
      const ready = entry.status === "CALLED";
      return {
        id: entry.id,
        tableNumber: entry.assignedTable?.tableNumber ?? null,
        guest: entry.customerName || "Guest",
        status: ready ? "READY" : entry.status,
        position,
        joinedAt: entry.createdAt.toISOString(),
        estimateText: ready
          ? "Ready for guest"
          : formatEstimate(waitlistMinutes(seated?.estimateMinutes ?? 0, position)),
      };
    }),
    activeTables,
    newOrders: orders.filter((order) => order.status === "NEW").map(serializeOrder),
    preparing: orders
      .filter((order) => order.status === "ACCEPTED" || order.status === "PREPARING")
      .map(serializeOrder),
    ready: orders.filter((order) => order.status === "READY").map(serializeOrder),
    serviceRequests: requests
      .filter((request) => request.type === "SERVE" || request.type === "WAITER")
      .map(serializeRequest),
    billRequests: requests.filter((request) => request.type === "BILL").map(serializeRequest),
    serverTime: new Date().toISOString(),
  };
}

function serializeOrder(order: {
  id: string;
  orderNumber: string;
  status: string;
  total: number;
  createdAt: Date;
  orderSource?: string;
  table: { tableNumber: number } | null;
  items: { itemName: string; quantity: number }[];
}) {
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    total: order.total,
    tableNumber: order.table?.tableNumber ?? null,
    createdAt: order.createdAt.toISOString(),
    preorder: order.orderSource === "WAITING_CUSTOMER",
    items: order.items.map((item) => ({ name: item.itemName, quantity: item.quantity })),
  };
}

function serializeRequest(request: {
  id: string;
  type: string;
  message: string;
  createdAt: Date;
  orderId: string | null;
  table: { tableNumber: number };
  order: { id: string; orderNumber: string } | null;
}) {
  return {
    id: request.id,
    type: request.type,
    message: request.message,
    tableNumber: request.table.tableNumber,
    orderId: request.order?.id ?? request.orderId,
    orderNumber: request.order?.orderNumber ?? null,
    createdAt: request.createdAt.toISOString(),
  };
}

export async function serveReadyOrder(restaurantId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, restaurantId },
  });
  if (!order) return { error: "Order not found", status: 404 as const };
  if (order.status !== "READY" && order.status !== "SERVED") {
    return { error: "Order is not ready to serve", status: 409 as const };
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: order.id },
      data: { status: "SERVED" },
    });
    await tx.tableRequest.updateMany({
      where: {
        restaurantId,
        status: "PENDING",
        type: "SERVE",
        OR: [{ orderId: order.id }, ...(order.visitId ? [{ visitId: order.visitId }] : [])],
      },
      data: { status: "COMPLETED" },
    });
  }, TX);

  return { ok: true as const };
}

export async function completeBill(restaurantId: string, requestId: string) {
  const request = await prisma.tableRequest.findFirst({
    where: { id: requestId, restaurantId, type: "BILL" },
    include: { table: true },
  });
  if (!request) return { error: "Bill request not found", status: 404 as const };

  const visit = request.visitId
    ? await prisma.visit.findFirst({
        where: { id: request.visitId, restaurantId, status: "ACTIVE" },
        include: { orders: true, waitingCustomer: true },
      })
    : await prisma.visit.findFirst({
        where: { restaurantId, tableId: request.tableId, status: "ACTIVE" },
        include: { orders: true, waitingCustomer: true },
        orderBy: { createdAt: "desc" },
      });

  if (!visit) {
    await prisma.tableRequest.update({
      where: { id: request.id },
      data: { status: "COMPLETED" },
    });
    return { ok: true as const };
  }

  const orderIds = visit.orders.map((order) => order.id);
  const paid = orderIds.length
    ? await prisma.payment.aggregate({
        where: { restaurantId, orderId: { in: orderIds }, status: "PAID" },
        _sum: { amount: true },
      })
    : { _sum: { amount: 0 } };
  const total = visit.orders.reduce((sum, order) => sum + order.total, 0);
  const due = Math.max(0, total - (paid._sum.amount ?? 0));

  await prisma.$transaction(async (tx) => {
    if (due > 0 && orderIds[0]) {
      await tx.payment.create({
        data: {
          restaurantId,
          orderId: orderIds[0],
          amount: due,
          method: "CASH",
          status: "PAID",
          note: `Bill for table ${request.table.tableNumber}`,
        },
      });
    }
    if (orderIds.length) {
      await tx.order.updateMany({
        where: { id: { in: orderIds }, status: { not: "REPORTED" } },
        data: { status: "COMPLETED" },
      });
    }
    await tx.tableRequest.updateMany({
      where: { visitId: visit.id, status: "PENDING" },
      data: { status: "COMPLETED" },
    });
    await tx.tableRequest.update({
      where: { id: request.id },
      data: { status: "COMPLETED" },
    });
    await tx.visit.update({
      where: { id: visit.id },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
    if (visit.waitingCustomer) {
      await tx.waitingCustomer.update({
        where: { id: visit.waitingCustomer.id },
        data: { status: "COMPLETED" },
      });
    }
    const stillSeated = await tx.visit.findFirst({
      where: {
        tableId: visit.tableId,
        status: "ACTIVE",
        NOT: { id: visit.id },
        OR: [{ waitingCustomer: { is: null } }, { waitingCustomer: { is: { status: "SEATED" } } }],
      },
      select: { id: true },
    });
    if (!stillSeated) {
      await tx.table.update({
        where: { id: visit.tableId },
        data: { status: "AVAILABLE" },
      });
      const called = await tx.waitingCustomer.findFirst({
        where: { assignedTableId: visit.tableId, status: "CALLED" },
        select: { id: true },
      });
      if (!called) {
        const next = await tx.waitingCustomer.findFirst({
          where: { assignedTableId: visit.tableId, status: { in: ["WAITING", "RESERVED"] } },
          orderBy: { createdAt: "asc" },
        });
        if (next) {
          await tx.waitingCustomer.update({ where: { id: next.id }, data: { status: "CALLED" } });
        }
      }
    }
  }, TX);

  return { ok: true as const };
}
