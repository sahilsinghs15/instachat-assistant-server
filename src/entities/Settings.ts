import { Entity, PrimaryGeneratedColumn, Column, UpdateDateColumn } from "typeorm";

@Entity("settings")
export class Settings {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ unique: true })
    key: string; // e.g., "is_ai_active"

    @Column()
    value: string; // "true" or "false"

    @UpdateDateColumn()
    updatedAt: Date;
}