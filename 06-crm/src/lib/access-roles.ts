import { prisma } from "@/lib/prisma";
import { PRESET_ROLES, serializePermissions } from "@/lib/permissions";

/** Создаёт системные пресеты «Продавец» / «Администратор точки», если их ещё нет. */
export async function ensureSystemAccessRoles() {
  for (const preset of PRESET_ROLES) {
    const existing = await prisma.accessRole.findFirst({
      where: { system: true, storeId: null, name: preset.name },
    });
    if (existing) {
      await prisma.accessRole.update({
        where: { id: existing.id },
        data: {
          homePage: preset.homePage,
          permissions: serializePermissions(preset.permissions),
        },
      });
    } else {
      await prisma.accessRole.create({
        data: {
          name: preset.name,
          storeId: null,
          homePage: preset.homePage,
          permissions: serializePermissions(preset.permissions),
          system: true,
        },
      });
    }
  }
}
