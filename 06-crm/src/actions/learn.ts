"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { notifyUsers } from "@/lib/notify";

export async function enroll(formData: FormData) {
  const user = await requireUser();
  const courseId = String(formData.get("courseId") ?? "");
  await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId } },
    update: {},
    create: { userId: user.id, courseId },
  });
  revalidatePath("/learn");
}

export async function toggleChecklistItem(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const index = Number(formData.get("index"));
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { course: true } });
  if (!lesson) return;
  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } },
    update: {},
    create: { userId: user.id, courseId: lesson.courseId },
  });
  const progress = await prisma.lessonProgress.findUnique({ where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } } });
  const set = new Set((progress?.checked ?? "").split(",").filter(Boolean).map(Number));
  if (set.has(index)) set.delete(index);
  else set.add(index);
  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    update: { checked: [...set].sort().join(",") },
    create: { enrollmentId: enrollment.id, lessonId, checked: [...set].sort().join(",") },
  });
  revalidatePath(`/learn/${lesson.course.slug}`);
}

export async function completeLesson(formData: FormData) {
  const user = await requireUser();
  const lessonId = String(formData.get("lessonId") ?? "");
  const undo = formData.get("undo") === "1";
  const lesson = await prisma.lesson.findUnique({ where: { id: lessonId }, include: { course: { include: { lessons: true } } } });
  if (!lesson) return;
  const enrollment = await prisma.enrollment.upsert({
    where: { userId_courseId: { userId: user.id, courseId: lesson.courseId } },
    update: {},
    create: { userId: user.id, courseId: lesson.courseId },
  });
  await prisma.lessonProgress.upsert({
    where: { enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId } },
    update: { completedAt: undo ? null : new Date() },
    create: { enrollmentId: enrollment.id, lessonId, completedAt: undo ? null : new Date() },
  });

  const done = await prisma.lessonProgress.count({ where: { enrollmentId: enrollment.id, completedAt: { not: null } } });
  const allDone = done >= lesson.course.lessons.length;
  await prisma.enrollment.update({ where: { id: enrollment.id }, data: { completedAt: allDone ? new Date() : null } });

  if (allDone && !undo) {
    const me = await prisma.user.findUnique({ where: { id: user.id }, include: { partner: true } });
    const watchers = await prisma.user.findMany({
      where: {
        OR: [{ role: { in: ["founder", "uk_admin"] } }, { id: me?.partner?.curatorUserId ?? "__none__" }],
      },
      select: { id: true },
    });
    await notifyUsers(
      watchers.map((w) => w.id),
      `${me?.name} завершил курс «${lesson.course.title}»`,
      me?.partner ? `${me.partner.city} · ${me.partner.name}` : undefined,
      "/learn/progress",
    );
  }
  revalidatePath(`/learn/${lesson.course.slug}`);
  revalidatePath("/learn");
}
