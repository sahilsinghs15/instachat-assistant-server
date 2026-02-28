import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1772278059514 implements MigrationInterface {
    name = 'InitialMigration1772278059514'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_history" ("id" SERIAL NOT NULL, "sender_id" character varying NOT NULL, "message" text NOT NULL, "role" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_cf76a7693b0b075dd86ea05f21d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_3b564f0f05b29af807d430bb94" ON "chat_history" ("sender_id") `);
        await queryRunner.query(`CREATE TABLE "settings" ("id" SERIAL NOT NULL, "key" character varying NOT NULL, "value" character varying NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_c8639b7626fa94ba8265628f214" UNIQUE ("key"), CONSTRAINT "PK_0669fe20e252eb692bf4d344975" PRIMARY KEY ("id"))`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "settings"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_3b564f0f05b29af807d430bb94"`);
        await queryRunner.query(`DROP TABLE "chat_history"`);
    }

}
