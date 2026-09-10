import { prisma } from "@/lib/prisma";
import { PRESET_ROLES, serializePermissions } from "@/lib/permissions";

/** Создаёт системные пресеты, если их ещё нет. Существующие не перезаписывает. */
export async function ensureSystemAccessRoles() {
  for (const preset of PRESET_ROLES) {
    const existing = await prisma.accessRole.findFirst({
      where: { system: true, storeId: null, name: preset.name },
    });
    if (existing) continue;
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
