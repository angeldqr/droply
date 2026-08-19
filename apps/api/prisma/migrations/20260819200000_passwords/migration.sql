-- Recuperar la contrasena y cortarle el acceso a una cuenta.
ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMP(3);

CREATE TABLE "password_resets" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "password_resets_token_hash_key" ON "password_resets"("token_hash");
CREATE INDEX "password_resets_user_id_idx" ON "password_resets"("user_id");

ALTER TABLE "password_resets"
    ADD CONSTRAINT "password_resets_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
