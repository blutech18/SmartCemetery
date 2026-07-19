const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function resetAllPasswords() {
  const accounts = [
    { email: 'admin@cemetery.gov.ph', newPassword: 'AdminPassword123!' },
    { email: 'staff@cemetery.gov.ph', newPassword: 'StaffPassword123!' },
    { email: 'visitor@example.com', newPassword: 'VisitorPassword123!' }
  ];

  for (const account of accounts) {
    try {
      const passwordHash = await bcrypt.hash(account.newPassword, 12);
      await prisma.user.update({
        where: { email: account.email },
        data: { passwordHash }
      });
      console.log(`Password for ${account.email} reset successfully.`);
    } catch (e) {
      console.error(`Failed to reset password for ${account.email}. It might not exist in the database.`);
    }
  }
}

resetAllPasswords()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
