import { db } from "./db";

export interface RevenueSummary {
  totalPara: number;
  completedCount: number;
}

/** Revenue (pazar) = sum of prices of COMPLETED appointments in [from, to). Backend only. */
export async function getRevenue(salonId: string, from: Date, to: Date): Promise<RevenueSummary> {
  const result = await db.appointment.aggregate({
    where: { salonId, status: "COMPLETED", startTime: { gte: from, lt: to } },
    _sum: { price: true },
    _count: true,
  });
  return { totalPara: result._sum.price ?? 0, completedCount: result._count };
}
