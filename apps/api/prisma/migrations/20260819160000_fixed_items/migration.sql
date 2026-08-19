-- Un envio clavado a una hora exacta del horario.
-- La clave primaria (schedule_id, minute) es la regla: una hora, una sola cosa.
CREATE TABLE "schedule_fixed_items" (
    "schedule_id" UUID NOT NULL,
    "minute" INTEGER NOT NULL,
    "item_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_fixed_items_pkey" PRIMARY KEY ("schedule_id","minute")
);

CREATE INDEX "schedule_fixed_items_item_id_idx" ON "schedule_fixed_items"("item_id");

ALTER TABLE "schedule_fixed_items"
    ADD CONSTRAINT "schedule_fixed_items_schedule_id_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "schedule_fixed_items"
    ADD CONSTRAINT "schedule_fixed_items_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "library_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
