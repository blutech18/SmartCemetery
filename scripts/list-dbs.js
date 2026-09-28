const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:@localhost:3307/mysql"
    }
  }
});

async function main() {
  const dbs = await prisma.$queryRawUnsafe('SHOW DATABASES;');
  console.log("Databases:", dbs);
}

main().catch(console.error).finally(() => prisma.$disconnect());
