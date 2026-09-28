const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

// Safety guard: this script resets EVERY user's password to a known value and
// clears all rate-limit buckets. Require an explicit opt-in so it can never be
// run by accident against a real database.
if (process.env.CONFIRM_RESET_ALL_PASSWORDS !== 'yes') {
  console.error(
    'Refusing to run: this resets every user password to a shared known value.\n' +
      'Re-run with CONFIRM_RESET_ALL_PASSWORDS=yes on a disposable/dev database only.'
  );
  process.exit(1);
}

async function main() {
  const p = new PrismaClient();
  
  try {
    // 1. Clear all rate limit buckets
    const cleared = await p.rateLimitBucket.deleteMany({});
    console.log(`Cleared ${cleared.count} rate limit buckets`);
    
    // 2. Reset passwords to "Password123!"
    const newPassword = "Password123!";
    const hash = await bcrypt.hash(newPassword, 12);
    
    const users = await p.user.findMany({ select: { id: true, email: true, name: true } });
    for (const user of users) {
      await p.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      });
      console.log(`Reset password for ${user.email} (${user.name})`);
    }
    
    console.log(`\nAll passwords reset to: ${newPassword}`);
  } finally {
    await p.$disconnect();
  }
}

main().catch(console.error);
