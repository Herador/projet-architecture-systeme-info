import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import "../styles/Messaging.css";

const API_URL = "http://localhost:3000"; // Ton Gateway ou URL Interaction Service

export default function Messaging() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Scroll automatique vers le bas des messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages) scrollToBottom();
  }, [messages]);

  // 1. Charger les conversations de l'utilisateur
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("token");
    axios
      .get(`${API_URL}/interactions/user/${user.id}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setConversations(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Erreur chargement conversations:", err);
        setLoading(false);
      });
  }, [user]);

  // 2. Charger les messages quand on sélectionne une conversation
  useEffect(() => {
    if (!selectedConv) return;
    const token = localStorage.getItem("token");
    axios
      .get(`${API_URL}/interactions/conversations/${selectedConv.id}/messages?limit=50`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setMessages(res.data))
      .catch(console.error);
  }, [selectedConv]);

  // 3. Envoyer un message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConv) return;

    const token = localStorage.getItem("token");
    try {
      const res = await axios.post(
        `${API_URL}/interactions/conversations/${selectedConv.id}/messages`,
        {
          content: newMessage,
          sender_id: user.id
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessages([...messages, res.data]);
      setNewMessage("");
    } catch (err) {
      alert("Erreur lors de l'envoi du message");
    }
  };

  if (!user) return <p className="msg-info">Veuillez vous connecter.</p>;

  return (
    <div className="messaging-page">
      <div className="messaging-central-zone">

        {/* LISTE DES CONVERSATIONS (1/3) */}
        <div className="conversations-sidebar">
          <h2 className="sidebar-title">Messages</h2>
          <div className="conv-list">
            {conversations.map((conv) => {
              // Déterminer le nom du correspondant
              const correspondent = user.id === conv.owner_id ? conv.tenant_username : conv.owner_username;

              return (
                <div
                  key={conv.id}
                  className={`conv-item ${selectedConv?.id === conv.id ? "active" : ""}`}
                  onClick={() => setSelectedConv(conv)}
                >
                  {/* Titre de l'annonce en gras */}  
                  <p className="conv-property-title">{conv.property_title || "Annonce supprimée"}</p>
                  {/* Nom du correspondant en dessous */}
                  <p className="conv-correspondent">Avec : {correspondent}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* PARTIE 2/3 : FENÊTRE DE CHAT */}
        <div className="chat-window">
          {selectedConv ? (
            <>
              <div className="chat-header">
                {/* En-tête dynamique */}
                <h3>{selectedConv.property_title}</h3>
                <p style={{ fontSize: "0.8rem", color: "#6b7280", margin: 0 }}>
                  Interlocuteur : {user.id === selectedConv.owner_id ? selectedConv.tenant_username : selectedConv.owner_username}
                </p>
              </div>

              <div className="messages-container">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`message-bubble ${msg.sender_id === user.id ? "mine" : "theirs"}`}
                  >
                    <p className="msg-content">{msg.content}</p>
                    <span className="msg-date">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              <form className="chat-input-area" onSubmit={handleSendMessage}>
                <input
                  type="text"
                  placeholder={`Répondre à ${user.id === selectedConv.owner_id ? selectedConv.tenant_username : selectedConv.owner_username}...`}
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <button type="submit">Envoyer</button>
              </form>
            </>
          ) : (
            <div className="no-chat-selected">
              <p>Sélectionnez une conversation pour commencer à discuter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}