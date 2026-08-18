-- CreateEnum
CREATE TYPE "item_kind" AS ENUM ('AUDIO', 'VIDEO', 'IMAGE', 'TEXT');

-- CreateTable
CREATE TABLE "libraries" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "libraries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "library_items" (
    "id" UUID NOT NULL,
    "library_id" UUID NOT NULL,
    "kind" "item_kind" NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "text_content" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "library_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "libraries_owner_id_idx" ON "libraries"("owner_id");

-- CreateIndex
CREATE INDEX "library_items_library_id_kind_position_idx" ON "library_items"("library_id", "kind", "position");

-- AddForeignKey
ALTER TABLE "libraries" ADD CONSTRAINT "libraries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_items" ADD CONSTRAINT "library_items_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
