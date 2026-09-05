# Prisma P0 — розница Hub

Добавлять к существующим `Store`, `Customer`, `Sale`, `User`.

```prisma
model ProductGroup {
  id       String   @id @default(cuid())
  name     String
  parentId String?
  parent   ProductGroup?  @relation("GroupTree", fields: [parentId], references: [id])
  children ProductGroup[] @relation("GroupTree")
  products Product[]
}

model Product {
  id              String   @id @default(cuid())
  code            String   @unique
  barcode         String?
  sku             String?
  name            String
  groupId         String?
  unit            String   @default("шт")
  warrantyDays    Int      @default(365)
  serialTracked   Boolean  @default(false)
  purchasePrice   Int      @default(0)
  retailPrice     Int      @default(0)
  repairPrice     Int      @default(0)
  preorderPrice   Int      @default(0)
  minStock        Int      @default(0)
  description     String?
  supplierId      String?
  active          Boolean  @default(true)
  createdAt       DateTime @default(now())
  group           ProductGroup? @relation(fields: [groupId], references: [id])
  supplier        Supplier?     @relation(fields: [supplierId], references: [id])
  balances        StockBalance[]
  serials         ProductSerial[]
}

model ProductSerial {
  id        String  @id @default(cuid())
  productId String
  storeId   String
  serial    String
  status    String  @default("in_stock") // in_stock | sold | written_off
  product   Product @relation(fields: [productId], references: [id])
  @@unique([productId, serial])
}

model StockBalance {
  id        String  @id @default(cuid())
  storeId   String
  productId String
  qty       Int     @default(0)
  product   Product @relation(fields: [productId], references: [id])
  @@unique([storeId, productId])
}

model Supplier {
  id       String    @id @default(cuid())
  name     String
  phone    String?
  products Product[]
}

enum StockDocType {
  receipt
  transfer
  customer_return
  supplier_return
  inventory
  writeoff
}

model StockDocument {
  id          String      @id @default(cuid())
  number      String
  type        StockDocType
  storeId     String
  toStoreId   String?     // transfer
  supplierId  String?
  userId      String?
  comment     String?
  totalAmount Int         @default(0)
  postedAt    DateTime?
  createdAt   DateTime    @default(now())
  lines       StockLine[]
}

model StockLine {
  id         String @id @default(cuid())
  documentId String
  productId  String
  qty        Int
  price      Int    @default(0)
  serial     String?
  document   StockDocument @relation(fields: [documentId], references: [id], onDelete: Cascade)
}
```

Sale v2: заменить плоский `Sale.note` на `SaleLine` (productId, qty, price, discountType, discountValue).
Старый `Sale` оставить совместимым на переходный период или мигрировать в seed.
