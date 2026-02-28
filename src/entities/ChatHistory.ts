import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from "typeorm";

@Entity("chat_history")
export class ChatHistory {
    @PrimaryGeneratedColumn()
    id: number;

    // We index the sender_id because we will query it every time a message arrives
    @Index()
    @Column()
    sender_id: string; // The Instagram PSID (Scoped ID)

    @Column({ type: "text" })
    message: string;

    @Column()
    role: "user" | "assistant";

    @CreateDateColumn()
    createdAt: Date;
}