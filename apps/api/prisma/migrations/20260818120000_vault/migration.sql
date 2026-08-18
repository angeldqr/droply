-- El baul es una biblioteca marcada, no una tabla aparte.
ALTER TABLE "libraries" ADD COLUMN "is_vault" BOOLEAN NOT NULL DEFAULT false;

-- Uno por cuenta. Parcial, porque las bibliotecas normales si se repiten.
CREATE UNIQUE INDEX "libraries_owner_id_vault_key" ON "libraries"("owner_id") WHERE "is_vault";
