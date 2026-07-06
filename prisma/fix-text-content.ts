import { PrismaClient } from '@prisma/client';
import { fixTextContent } from './lib/fix-text-content';

const prisma = new PrismaClient();

async function main() {
  const stats = await fixTextContent(prisma);
  const total = stats.reduce((sum, item) => sum + item.fixed, 0);

  if (total === 0) {
    console.log('未发现需要修复的文本。');
    return;
  }

  console.log('文本修复完成：');
  for (const item of stats) {
    if (item.fixed > 0) {
      console.log(`  - ${item.table}: ${item.fixed} 处`);
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
