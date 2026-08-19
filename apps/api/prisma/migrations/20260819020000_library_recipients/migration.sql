-- CreateTable
CREATE TABLE "library_recipients" (
    "library_id" UUID NOT NULL,
    "recipient_id" UUID NOT NULL,

    CONSTRAINT "library_recipients_pkey" PRIMARY KEY ("library_id","recipient_id")
);

-- CreateIndex
CREATE INDEX "library_recipients_recipient_id_idx" ON "library_recipients"("recipient_id");

-- AddForeignKey
ALTER TABLE "library_recipients" ADD CONSTRAINT "library_recipients_library_id_fkey" FOREIGN KEY ("library_id") REFERENCES "libraries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "library_recipients" ADD CONSTRAINT "library_recipients_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "recipients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
