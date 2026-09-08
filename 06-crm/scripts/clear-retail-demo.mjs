import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const r = {};
  r.changeLog = (await prisma.changeLog.deleteMany()).count;
  r.saleLine = (await prisma.saleLine.deleteMany()).count;
  r.cashTxn = (await prisma.cashTxn.deleteMany()).count;
  r.sale = (await prisma.sale.deleteMany()).count;
  r.orderLine = (await prisma.orderLine.deleteMany()).count;
  r.order = (await prisma.order.deleteMany()).count;
  r.stockLine = (await prisma.stockLine.deleteMany()).count;
  r.stockDocument = (await prisma.stockDocument.deleteMany()).count;
  r.productSerial = (await prisma.productSerial.deleteMany()).count;
  r.stockBalance = (await prisma.stockBalance.deleteMany()).count;
  r.product = (await prisma.product.deleteMany()).count;
  r.cashRegisterReset = (await prisma.cashRegister.updateMany({ data: { balance: 0 } })).count;
  console.log(JSON.stringify(r, null, 2));
}
main().finally(() => prisma.$disconnect());
