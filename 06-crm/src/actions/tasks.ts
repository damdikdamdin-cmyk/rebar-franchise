"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { isUk } from "@/lib/access";
import { notifyUsers } from "@/lib/notify";

export async function createTask(formData: FormData) {
  const user = await requireUser();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  const assigneeId = String(formData.get("assigneeId") ?? "") || user.id;
  const due = String(formData.get("dueAt") ?? "");
  const partnerId = String(formData.get("partnerId") ?? "") || null;

  // Партнёр может ставить задачи только внутри своего контура
  if (!isUk(user.role)) {
    const assignee = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!assignee || (assignee.partnerId !== user.partnerId && assignee.id !== user.id)) return;
  }

  const task = await prisma.task.create({
    data: {
      title,
      body: String(formData.get("body") ?? "").trim() || null,
      assigneeId,
      createdById: user.id,
      dueAt: due ? new Date(due) : null,
      leadId: String(formData.get("leadId") ?? "") || null,
      partnerId: partnerId ?? (isUk(user.role) ? null : user.partnerId),
      storeId: String(formData.get("storeId") ?? "") || null,
    },
  });
  if (assigneeId !== user.id) {
    await notifyUsers([assigneeId], `Новая задача: ${title}`, `От ${user.name ?? "коллеги"}`, `/tasks?focus=${task.id}`);
  }
  const back = String(formData.get("back") ?? "");
  revalidatePath("/tasks");
  if (back) {
    revalidatePath(back);
    redirect(back);
  }
}

export async function setTaskStatus(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as TaskStatus;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;
  const allowed = isUk(user.role) || task.assigneeId === user.id || task.createdById === user.id;
  if (!allowed) return;
  await prisma.task.update({
    where: { id },
    data: { status, completedAt: status === "done" ? new Date() : null },
  });
  if (status === "done" && task.createdById && task.createdById !== user.id) {
    await notifyUsers([task.createdById], `Задача выполнена: ${task.title}`, user.name ?? undefined, "/tasks");
  }
  const back = String(formData.get("back") ?? "");
  revalidatePath("/tasks");
  revalidatePath("/");
  if (back) revalidatePath(back);
}
