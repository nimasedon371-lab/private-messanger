
import { useState, useEffect, useRef } from "react";
import "./Messenger.css";
import { io } from "socket.io-client";

// ==========================================
// FORMAT LAST-SEEN TIME
// ==========================================

function formatLastSeen(value) {
  if (!value) return "Last seen time unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Last seen time unavailable";
  }

  const now = new Date();

  const isToday = date.toDateString() === now.toDateString();

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  const isYesterday =
    date.toDateString() === yesterday.toDateString();

  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) return `Last seen today at ${time}`;

  if (isYesterday) return `Last seen yesterday at ${time}`;

  return `Last seen ${date.toLocaleDateString([], {
    day: "numeric",
    month: "short",
    year: "numeric",
  })} at ${time}`;
}

function Messenger() {
  const currentUser = JSON.parse(
    localStorage.getItem("user")
  );

  const [typingUser, setTypingUser] = useState("");
  const typingTimeoutRef = useRef(null);
  const socketRef = useRef(null);

  const [chats, setChats] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState({});
  const [message, setMessage] = useState("");
  const [mobileChatOpen, setMobileChatOpen] = useState(false);
  const [activePage, setActivePage] = useState("messages");

  // ==========================================
  // SOCKET CONNECTION + ONLINE STATUS
  // ==========================================

  useEffect(() => {
    if (!currentUser?.id) return;

    const socket = io("http://localhost:5000");
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);

      socket.emit("register_user", currentUser.id);
    });

    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    // Update online/offline status and last-seen time.
    const handleUserStatus = (data) => {
      const userId = Number(data.userId);
      const status = data.status;
      const lastSeen = data.lastSeen || null;

      setChats((previousChats) =>
        previousChats.map((chat) =>
          Number(chat.otherUserId) === userId
            ? {
                ...chat,
                status,
                lastSeen:
                  status === "Online" ? null : lastSeen,
              }
            : chat
        )
      );

      setContacts((previousContacts) =>
        previousContacts.map((contact) =>
          Number(contact.id) === userId
            ? {
                ...contact,
                status,
                lastSeen:
                  status === "Online" ? null : lastSeen,
              }
            : contact
        )
      );

      setSelectedChat((previousChat) =>
        previousChat &&
        Number(previousChat.otherUserId) === userId
          ? {
              ...previousChat,
              status,
              lastSeen:
                status === "Online" ? null : lastSeen,
            }
          : previousChat
      );
    };

    socket.on("user_status", handleUserStatus);

    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }

      socket.off("user_status", handleUserStatus);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [currentUser?.id]);

  // ==========================================
  // RECEIVE TYPING INDICATOR EVENTS
  // ==========================================

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) return;

    const handleUserTyping = (data) => {
      if (
        Number(data.conversationId) === Number(selectedChat?.id) &&
        Number(data.userId) !== Number(currentUser.id)
      ) {
        setTypingUser(data.userName || "Someone");
      }
    };

    const handleUserStoppedTyping = (data) => {
      if (
        Number(data.conversationId) === Number(selectedChat?.id) &&
        Number(data.userId) !== Number(currentUser.id)
      ) {
        setTypingUser("");
      }
    };

    socket.on("user_typing", handleUserTyping);
    socket.on("user_stopped_typing", handleUserStoppedTyping);

    return () => {
      socket.off("user_typing", handleUserTyping);
      socket.off("user_stopped_typing", handleUserStoppedTyping);
    };
  }, [selectedChat, currentUser.id]);

  // ==========================================
  // CLEAR TYPING WHEN CHANGING CHATS
  // ==========================================

  useEffect(() => {
    setTypingUser("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  }, [selectedChat?.id]);

  // ==========================================
  // JOIN SELECTED CONVERSATION
  // ==========================================

  useEffect(() => {
    if (!selectedChat || !socketRef.current) return;

    socketRef.current.emit(
      "join_conversation",
      selectedChat.id
    );

    console.log("Joined conversation:", selectedChat.id);
  }, [selectedChat]);

  // ==========================================
  // RECEIVE REAL-TIME MESSAGES
  // ==========================================

  useEffect(() => {
    const socket = socketRef.current;

    if (!socket) return;

    const handleNewMessage = (messageData) => {
      console.log("New real-time message:", messageData);

      const conversationId = messageData.conversation_id;

      const isOwnMessage =
        Number(messageData.sender_id) === Number(currentUser.id);

      const newMessage = {
        id: messageData.id,
        sender: isOwnMessage ? "You" : selectedChat?.name || "User",
        text: messageData.content,
        time: new Date(messageData.created_at).toLocaleTimeString(
          [],
          {
            hour: "2-digit",
            minute: "2-digit",
          }
        ),
        received: !isOwnMessage,
      };

      setMessages((previousMessages) => {
        const existingMessages =
          previousMessages[conversationId] || [];

        const alreadyExists = existingMessages.some(
          (item) => Number(item.id) === Number(newMessage.id)
        );

        if (alreadyExists) return previousMessages;

        return {
          ...previousMessages,
          [conversationId]: [
            ...existingMessages,
            newMessage,
          ],
        };
      });

      setChats((previousChats) =>
        previousChats.map((chat) =>
          Number(chat.id) === Number(conversationId)
            ? {
                ...chat,
                lastMessage: messageData.content,
                time: new Date(
                  messageData.created_at
                ).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }
            : chat
        )
      );
    };

    socket.on("new_message", handleNewMessage);

    return () => {
      socket.off("new_message", handleNewMessage);
    };
  }, [selectedChat, currentUser.id]);

  // ==========================================
  // LOAD CONVERSATIONS
  // ==========================================

  useEffect(() => {
    if (!currentUser?.id) return;

    const loadConversations = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/conversations/user/${currentUser.id}`
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(
            "Failed to load conversations:",
            data.message
          );
          return;
        }

        const loadedChats = data.data.map((conversation) => ({
          id: conversation.conversation_id,

          name:
            conversation.full_name ||
            conversation.username,

          initials: conversation.full_name
            ? conversation.full_name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .toUpperCase()
            : conversation.username[0].toUpperCase(),

          status: conversation.is_online ? "Online" : "Offline",

          lastSeen: conversation.last_seen || null,

          otherUserId: conversation.other_user_id,

          lastMessage: "No messages yet",
          time: "",
          unread: 0,
        }));

        setChats(loadedChats);

        if (loadedChats.length > 0) {
          setSelectedChat((previousChat) => {
            if (!previousChat) return loadedChats[0];

            return (
              loadedChats.find(
                (chat) =>
                  Number(chat.id) === Number(previousChat.id)
              ) || loadedChats[0]
            );
          });
        }
      } catch (error) {
        console.error("Load conversations error:", error);
      }
    };

    loadConversations();
  }, [currentUser?.id]);

  // ==========================================
  // LOAD CONTACTS
  // ==========================================

  useEffect(() => {
    if (!currentUser?.id) return;

    const loadContacts = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/contacts/user/${currentUser.id}`
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(
            "Failed to load contacts:",
            data.message
          );
          return;
        }

        const loadedContacts = data.data.map((contact) => ({
          id: contact.id,

          name:
            contact.full_name ||
            contact.username,

          username: contact.username,

          initials: contact.full_name
            ? contact.full_name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .toUpperCase()
            : contact.username[0].toUpperCase(),

          status: contact.is_online ? "Online" : "Offline",

          lastSeen: contact.last_seen || null,
        }));

        setContacts(loadedContacts);
      } catch (error) {
        console.error("Load contacts error:", error);
      }
    };

    loadContacts();
  }, [currentUser?.id]);

  // ==========================================
  // LOAD MESSAGES
  // ==========================================

  useEffect(() => {
    if (!selectedChat) return;

    const loadMessages = async () => {
      try {
        const response = await fetch(
          `http://localhost:5000/api/messages/${selectedChat.id}`
        );

        const data = await response.json();

        if (!response.ok) {
          console.error(
            "Failed to load messages:",
            data.message
          );
          return;
        }

        const loadedMessages = data.data.map((item) => ({
          id: item.id,

          sender:
            Number(item.sender_id) === Number(currentUser.id)
              ? "You"
              : selectedChat.name,

          text: item.content,

          time: new Date(item.created_at).toLocaleTimeString(
            [],
            {
              hour: "2-digit",
              minute: "2-digit",
            }
          ),

          received:
            Number(item.sender_id) !== Number(currentUser.id),
        }));

        setMessages((previousMessages) => ({
          ...previousMessages,
          [selectedChat.id]: loadedMessages,
        }));
      } catch (error) {
        console.error("Load messages error:", error);
      }
    };

    loadMessages();
  }, [selectedChat, currentUser.id]);

  // ==========================================
  // SEND MESSAGE
  // ==========================================

  const sendMessage = async () => {
    const trimmedMessage = message.trim();

    if (!trimmedMessage || !selectedChat) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.emit("typing_stop", {
        conversationId: selectedChat.id,
        userId: currentUser.id,
      });
    }

    try {
      const response = await fetch(
        "http://localhost:5000/api/messages",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversation_id: selectedChat.id,
            sender_id: currentUser.id,
            content: trimmedMessage,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to send message");
        return;
      }

      if (socketRef.current) {
        socketRef.current.emit("send_message", data.data);
      }

      setMessage("");
    } catch (error) {
      console.error("Send message error:", error);
      alert("Unable to connect to the server.");
    }
  };

  // ==========================================
  // ENTER TO SEND
  // ==========================================

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  // ==========================================
  // SEND TYPING STATUS
  // ==========================================

  const handleTypingChange = (event) => {
    const value = event.target.value;

    setMessage(value);

    if (!selectedChat || !socketRef.current) return;

    const typingData = {
      conversationId: selectedChat.id,
      userId: currentUser.id,
      userName:
        currentUser.full_name ||
        currentUser.username ||
        "Someone",
    };

    if (value.trim()) {
      socketRef.current.emit("typing_start", typingData);
    } else {
      socketRef.current.emit("typing_stop", typingData);
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (value.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current?.emit("typing_stop", typingData);
        typingTimeoutRef.current = null;
      }, 1500);
    }
  };

  // ==========================================
  // OPEN EXISTING CHAT
  // ==========================================

  const openChat = (chat) => {
    setSelectedChat(chat);
    setActivePage("messages");
    setMobileChatOpen(true);
  };

  // ==========================================
  // OPEN CONTACT / CREATE CONVERSATION
  // ==========================================

  const openContact = async (contact) => {
    try {
      const response = await fetch(
        "http://localhost:5000/api/conversations/private",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: currentUser.id,
            other_user_id: contact.id,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || "Failed to create conversation");
        return;
      }

      const conversationResponse = await fetch(
        `http://localhost:5000/api/conversations/user/${currentUser.id}`
      );

      const conversationData = await conversationResponse.json();

      if (!conversationResponse.ok) {
        alert("Conversation was created, but could not be loaded.");
        return;
      }

      const loadedChats = conversationData.data.map(
        (conversation) => ({
          id: conversation.conversation_id,

          name:
            conversation.full_name ||
            conversation.username,

          initials: conversation.full_name
            ? conversation.full_name
                .split(" ")
                .map((word) => word[0])
                .join("")
                .toUpperCase()
            : conversation.username[0].toUpperCase(),

          status: conversation.is_online ? "Online" : "Offline",

          lastSeen: conversation.last_seen || null,

          otherUserId: conversation.other_user_id,

          lastMessage: "No messages yet",
          time: "",
          unread: 0,
        })
      );

      setChats(loadedChats);

      const openedChat = loadedChats.find(
        (chat) =>
          Number(chat.otherUserId) === Number(contact.id)
      );

      if (openedChat) {
        setSelectedChat(openedChat);
        setActivePage("messages");
        setMobileChatOpen(true);
      }
    } catch (error) {
      console.error("Start conversation error:", error);
      alert("Unable to connect to the server.");
    }
  };

  // ==========================================
  // LOGOUT
  // ==========================================

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  };

  // ==========================================
  // HELPER: DISPLAY CHAT STATUS
  // ==========================================

  const getChatStatusText = (user) => {
    if (user.status === "Online") {
      return "Online";
    }

    if (user.lastSeen) {
      return formatLastSeen(user.lastSeen);
    }

    return "Offline";
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="messenger-app">
      {/* SIDEBAR */}
      <aside
        className={`messenger-sidebar ${
          mobileChatOpen ? "mobile-hidden" : ""
        }`}
      >
        {/* HEADER */}
        <div className="sidebar-header">
          <div>
            <h2>
              {activePage === "messages" ? "Messages" : "Contacts"}
            </h2>
            <p>Private Messenger</p>
          </div>

          <button
            className="logout-button"
            onClick={handleLogout}
            title="Logout"
          >
            ↪
          </button>
        </div>

        {/* SEARCH */}
        <div className="message-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder={
              activePage === "messages"
                ? "Search messages"
                : "Search contacts"
            }
          />
        </div>

        {/* MESSAGES LIST */}
        {activePage === "messages" && (
          <div className="conversation-list">
            {chats.length === 0 ? (
              <p style={{ padding: "20px", color: "#777" }}>
                No conversations yet.
              </p>
            ) : (
              chats.map((chat) => (
                <button
                  key={chat.id}
                  className={`conversation-item ${
                    Number(selectedChat?.id) === Number(chat.id)
                      ? "active"
                      : ""
                  }`}
                  onClick={() => openChat(chat)}
                >
                  <div className="avatar">
                    {chat.initials}

                    {chat.status === "Online" && (
                      <span className="online-dot"></span>
                    )}
                  </div>

                  <div className="conversation-info">
                    <div className="conversation-top">
                      <strong>{chat.name}</strong>
                      <span>{chat.time}</span>
                    </div>

                    <div className="conversation-bottom">
                      <span>
                        {chat.status === "Online"
                          ? "Online"
                          : chat.lastSeen
                            ? formatLastSeen(chat.lastSeen)
                            : chat.lastMessage}
                      </span>

                      {chat.unread > 0 && (
                        <b className="unread-count">
                          {chat.unread}
                        </b>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* CONTACTS LIST */}
        {activePage === "contacts" && (
          <div className="conversation-list">
            <div
              style={{
                padding: "8px 12px",
                color: "#6b7280",
                fontSize: "12px",
                fontWeight: "600",
              }}
            >
              {contacts.length} contacts
            </div>

            {contacts.length === 0 ? (
              <p style={{ padding: "20px", color: "#777" }}>
                No contacts found.
              </p>
            ) : (
              contacts.map((contact) => (
                <button
                  key={contact.id}
                  type="button"
                  className="conversation-item"
                  onClick={() => openContact(contact)}
                >
                  <div className="avatar">
                    {contact.initials}

                    {contact.status === "Online" && (
                      <span className="online-dot"></span>
                    )}
                  </div>

                  <div className="conversation-info">
                    <div className="conversation-top">
                      <strong>{contact.name}</strong>
                    </div>

                    <div className="conversation-bottom">
                      <span>
                        {contact.status === "Online"
                          ? "Online"
                          : contact.lastSeen
                            ? formatLastSeen(contact.lastSeen)
                            : `@${contact.username}`}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}

        {/* NAVIGATION */}
        <div className="sidebar-nav">
          <button
            type="button"
            className={`nav-item ${
              activePage === "messages" ? "active" : ""
            }`}
            onClick={() => {
              setActivePage("messages");
              setMobileChatOpen(false);
            }}
          >
            <span>💬</span>
            Messages
          </button>

          <button
            type="button"
            className={`nav-item ${
              activePage === "contacts" ? "active" : ""
            }`}
            onClick={() => {
              setActivePage("contacts");
              setMobileChatOpen(false);
            }}
          >
            <span>👥</span>
            Contacts
          </button>

          <button type="button" className="nav-item">
            <span>🔔</span>
            Notifications
          </button>

          <button type="button" className="nav-item">
            <span>👤</span>
            Profile
          </button>
        </div>
      </aside>

      {/* CHAT AREA */}
      {selectedChat ? (
        <main
          className={`chat-area ${
            !mobileChatOpen ? "mobile-hidden" : ""
          }`}
        >
          {/* CHAT HEADER */}
          <header className="chat-header">
            <button
              className="mobile-back"
              onClick={() => setMobileChatOpen(false)}
            >
              ←
            </button>

            <div className="avatar chat-avatar">
              {selectedChat.initials}

              {selectedChat.status === "Online" && (
                <span className="online-dot"></span>
              )}
            </div>

            <div className="chat-user-info">
              <h3>{selectedChat.name}</h3>

              <span
                className={
                  selectedChat.status === "Online"
                    ? "online-status"
                    : "offline-status"
                }
              >
                {getChatStatusText(selectedChat)}
              </span>
            </div>

            <div className="chat-actions">
              <button title="Search">⌕</button>
              <button title="Call">☎</button>
              <button title="More">⋮</button>
            </div>
          </header>

          {/* MESSAGES */}
          <section className="messages-area">
            <div className="messages-container">
              {(messages[selectedChat.id] || []).map((item) => (
                <div
                  key={item.id}
                  className={`message-row ${
                    item.received ? "received" : "sent"
                  }`}
                >
                  <div className="message-bubble">
                    <p>{item.text}</p>

                    <span className="message-time">
                      {item.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* TYPING INDICATOR */}
          {typingUser && (
            <div className="typing-indicator">
              <span>{typingUser} is typing</span>

              <span className="typing-dots" aria-hidden="true">
                <i></i>
                <i></i>
                <i></i>
              </span>
            </div>
          )}

          {/* MESSAGE INPUT */}
          <footer className="message-input-area">
            <button className="input-action" title="Attachment">
              +
            </button>

            <button className="input-action" title="Image">
              ▧
            </button>

            <textarea
              value={message}
              onChange={handleTypingChange}
              onKeyDown={handleKeyDown}
              placeholder="Type a message..."
              rows="1"
            />

            <button className="input-action" title="Emoji">
              ☺
            </button>

            <button className="send-button" onClick={sendMessage}>
              ➤
            </button>
          </footer>
        </main>
      ) : (
        <main className="chat-area">
          <div style={{ margin: "auto", color: "#777" }}>
            Select a conversation
          </div>
        </main>
      )}
    </div>
  );
}

export default Messenger;