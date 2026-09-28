const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "mysql://root:@localhost:3307/mysql"
    }
  }
});

async function main() {
  await prisma.$queryRawUnsafe('CREATE DATABASE IF NOT EXISTS cemetery_map;');
  console.log("Database cemetery_map created successfully!");
}

main().catch(console.error).finally(() => prisma.$disconnect());
