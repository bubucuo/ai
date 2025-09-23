import { useState, useRef, useEffect, useOptimistic } from "react";
import styles from "./App.module.css";
import LoadingSpinner from "./components/LoadingSpinner";
import type { Message } from "./components/ChatMessage";
import ChatMessage from "./components/ChatMessage";
import { loadSessionHistoryAction } from "./service/loadSessionHistoryAction";
import { sendChatAction, type ChatParams } from "./service/sendChatAction";
import { flushSync } from "react-dom";

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (currentMessages: Message[], newMessage: string) => [
      ...currentMessages,
      {
        type: "user" as const,
        content: newMessage,
        id: Date.now().toString(),
        timestamp: Date.now(),
        sending: true, // 乐观更新标记
      },
    ]
  );

  const [inputText, setInputText] = useState("");
  const [selectedTool, setSelectedTool] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("Chinese");
  const [codeLanguage, setCodeLanguage] = useState("Python");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string>("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // 使用 React 19 的并发特性
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      scrollToBottom();
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [optimisticMessages]);

  // Session restoration with error handling
  useEffect(() => {
    async function restoreSession() {
      const savedSessionId = localStorage.getItem("chatSessionId");
      if (savedSessionId) {
        setSessionId(savedSessionId);
        try {
          const history = await loadSessionHistoryAction(savedSessionId);
          setMessages(history);
        } catch (error) {
          console.error("Failed to restore session:", error);
          localStorage.removeItem("chatSessionId");
        }
      }
    }

    restoreSession();
  }, []);

  // Auto-save session ID
  useEffect(() => {
    if (sessionId) {
      localStorage.setItem("chatSessionId", sessionId);
    }
  }, [sessionId]);

  // Enhanced new session function
  function startNewSession() {
    setSessionId("");
    setMessages([]);
    localStorage.removeItem("chatSessionId");
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === "Enter") {
      e.preventDefault();
      // 简单触发表单提交，让 form action 处理
      e.currentTarget.form?.requestSubmit();
    }
  };

  // Form action for optimistic updates (React 19 pattern)
  async function formAction(formData: FormData) {
    const message = formData.get("message") as string;
    if (!message.trim()) return;

    // 乐观更新 - 立即显示用户消息
    addOptimisticMessage(message.trim());

    flushSync(() => {
      setInputText(""); // 清空状态
      setIsLoading(true);
    });

    await sendMessage(message.trim());
  }

  // Enhanced message sending function
  async function sendMessage(messageText: string) {
    const userMessage: Message = {
      type: "user",
      content: messageText,
      id: Date.now().toString(),
      timestamp: Date.now(),
      sending: false, // 真实消息不再是发送中状态
    };

    const params: ChatParams = {
      message: messageText,
      tool: selectedTool,
      session_id: sessionId,
    };

    if (selectedTool === "translate") {
      params.target_language = targetLanguage;
    } else if (selectedTool === "code") {
      params.language = codeLanguage;
    }

    try {
      const data = await sendChatAction(params);

      // Update session ID if new session
      if (data.session_id && data.session_id !== sessionId) {
        setSessionId(data.session_id);
      }

      const aiMessage: Message = {
        type: "ai",
        content: data.reply,
        id: (Date.now() + 1).toString(),
        timestamp: Date.now(),
      };

      // Update actual state - 乐观更新会自动被替换
      setMessages((prev) => [...prev, userMessage, aiMessage]);
    } catch (error) {
      console.error("Error:", error);
      const errorMessage: Message = {
        type: "ai",
        content: `出错了: ${
          error instanceof Error ? error.message : "未知错误"
        }`,
        id: (Date.now() + 1).toString(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <header>
        <h2>🤖 AI Assistant</h2>
        <p className={styles.subtitle}>Powered by React 19 & HuggingFace</p>
      </header>

      <div className={styles.toolbar}>
        <button
          onClick={startNewSession}
          className={styles.button}
          style={{ marginRight: "10px" }}
          type="button"
        >
          🗨️ New Chat
        </button>

        <label className={styles.label}>
          Tools:
          <select
            value={selectedTool}
            onChange={(e) => setSelectedTool(e.target.value)}
            className={styles.select}
          >
            <option value="">💬 General Chat</option>
            <option value="summarize">📄 Text Summary</option>
            <option value="translate">🌍 Translation</option>
            <option value="code">💻 Code Generation</option>
            <option value="explain">💡 Explanation</option>
          </select>
        </label>

        {selectedTool === "translate" && (
          <label className={styles.label}>
            Target Language:
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className={styles.select}
            >
              <option value="Chinese">🇨🇳 Chinese</option>
              <option value="English">🇺🇸 English</option>
              <option value="Japanese">🇯🇵 Japanese</option>
            </select>
          </label>
        )}

        {selectedTool === "code" && (
          <label className={styles.label}>
            Language:
            <select
              value={codeLanguage}
              onChange={(e) => setCodeLanguage(e.target.value)}
              className={styles.select}
            >
              <option value="Python">🐍 Python</option>
              <option value="JavaScript">⚡ JavaScript</option>
              <option value="Java">☕ Java</option>
            </select>
          </label>
        )}
      </div>

      <div className={`${styles.messages} markdown-body`}>
        <div style={{ fontSize: "12px", color: "#666", margin: "10px" }}>
          Debug: messages.length={messages.length}, optimisticMessages.length=
          {optimisticMessages.length}, isLoading={isLoading}
        </div>

        {/* 消息列表 - 直接渲染，支持乐观更新 */}
        <div className="messages-container">
          {optimisticMessages.map((msg, index) => (
            <ChatMessage key={msg.id || index} message={msg} index={index} />
          ))}
        </div>

        {/* 简单的加载状态 - 不需要 Suspense */}
        {isLoading && <LoadingSpinner />}

        <div ref={messagesEndRef} />
      </div>

      <form action={formAction} className={styles.inputArea}>
        <textarea
          name="message"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="💭 Enter your message... (Click Send button to submit)"
          className={styles.textarea}
          disabled={isLoading}
          rows={3}
          aria-label="Chat message input"
        />

        <div className={styles.buttonGroup}>
          <button
            type="submit"
            className={styles.button}
            disabled={isLoading || !inputText.trim()}
            aria-label="Send message"
          >
            {isLoading ? "🤔 Thinking..." : "🚀 Send"}
          </button>

          {sessionId && (
            <span className={styles.sessionInfo}>
              Session: {sessionId.slice(0, 8)}...
            </span>
          )}
        </div>
      </form>
    </div>
  );
}

export default App;
