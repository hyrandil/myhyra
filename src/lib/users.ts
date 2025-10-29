import { prisma } from '@/lib/prisma';

export async function getDefaultUser() {
  const email = process.env.DEFAULT_USER_EMAIL?.trim() || 'demo@example.com';

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  return user;
}
