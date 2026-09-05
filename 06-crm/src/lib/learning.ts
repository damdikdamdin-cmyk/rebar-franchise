import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseRoles } from "@/lib/access";

export async function enrollByRole(userId: string, role: Role) {
  const courses = await prisma.course.findMany({ select: { id: true, autoRoles: true } });
  const matching = courses.filter((c) => parseRoles(c.autoRoles).includes(role));
  for (const course of matching) {
    await prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId: course.id } },
      update: {},
      create: { userId, courseId: course.id },
    });
  }
}

export function courseProgress(enrollment: {
  progress: Array<{ completedAt: Date | null }>;
  course: { lessons: Array<{ id: string }> };
}) {
  const total = enrollment.course.lessons.length;
  const done = enrollment.progress.filter((p) => p.completedAt).length;
  return { total, done, pct: total ? Math.round((done / total) * 100) : 0 };
}
