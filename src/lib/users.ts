import { prisma } from '@/lib/prisma';

export async function getDefaultUser() {
  const email = process.env.DEFAULT_USER_EMAIL;
  if (!email) {
    throw new Error('DEFAULT_USER_EMAIL is not configured');
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email },
  });

  return user;
}
