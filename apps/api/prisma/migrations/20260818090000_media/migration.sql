-- AlterTable
ALTER TABLE "library_items" ADD COLUMN     "file_name" TEXT,
ADD COLUMN     "media_ready_at" TIMESTAMP(3),
ADD COLUMN     "mime_type" TEXT,
ADD COLUMN     "size_bytes" INTEGER,
ADD COLUMN     "storage_key" TEXT;
