-- CreateTable
CREATE TABLE "account_chats" (
    "user_id" UUID NOT NULL,
    "chat_id" TEXT,
    "link_code_hash" TEXT,
    "link_code_expires_at" TIMESTAMP(3),
    "linked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_chats_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "habits" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "position" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "habits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_entries" (
    "id" UUID NOT NULL,
    "habit_id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "chat_id" TEXT NOT NULL,
    "note" TEXT,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "touched_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),

    CONSTRAINT "habit_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_entry_photos" (
    "id" UUID NOT NULL,
    "entry_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_entry_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_chats_chat_id_key" ON "account_chats"("chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "account_chats_link_code_hash_key" ON "account_chats"("link_code_hash");

-- CreateIndex
CREATE INDEX "habits_owner_id_position_idx" ON "habits"("owner_id", "position");

-- CreateIndex
CREATE INDEX "habit_entries_habit_id_opened_at_idx" ON "habit_entries"("habit_id", "opened_at");

-- CreateIndex
CREATE INDEX "habit_entries_owner_id_opened_at_idx" ON "habit_entries"("owner_id", "opened_at");

-- CreateIndex
CREATE INDEX "habit_entry_photos_entry_id_idx" ON "habit_entry_photos"("entry_id");

-- AddForeignKey
ALTER TABLE "account_chats" ADD CONSTRAINT "account_chats_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habits" ADD CONSTRAINT "habits_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_entries" ADD CONSTRAINT "habit_entries_habit_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_entry_photos" ADD CONSTRAINT "habit_entry_photos_entry_id_fkey" FOREIGN KEY ("entry_id") REFERENCES "habit_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Una sola anotacion abierta por chat.
--
-- Prisma no sabe declarar indices parciales, asi que este va escrito a mano y
-- no se puede quitar del esquema: es lo que hace que la anotacion abierta pueda
-- **ser** el estado de la conversacion, sin una tabla de sesiones aparte. Sin
-- el, dos mensajes a la vez abririan dos anotaciones y lo que el usuario cuenta
-- se repartiria entre las dos.
CREATE UNIQUE INDEX "habit_entries_una_abierta_por_chat"
  ON "habit_entries" ("chat_id")
  WHERE "closed_at" IS NULL;
