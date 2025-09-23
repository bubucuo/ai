import styles from "../App.module.css";

export interface Message {
  type: "user" | "ai";
  content: string;
  id?: string;
  timestamp?: number;
  sending?: boolean; // 乐观更新时标记正在发送
}

// Message component with React 19 optimizations
export default function ChatMessage({
  message,
  index,
}: {
  message: Message;
  index: number;
}) {
  return (
    <div
      key={message.id || index}
      className={`${styles.message} ${
        message.type === "user" ? styles.userMessage : styles.aiMessage
      }`}
      dangerouslySetInnerHTML={{
        __html:
          message.type === "user"
            ? "You: " +
              message.content +
              (message.sending ? " (Sending...)" : "")
            : "AI: " + message.content,
      }}
    />
  );
}
