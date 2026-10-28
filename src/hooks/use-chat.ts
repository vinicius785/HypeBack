import { useEffect, useState, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getApiUrl, getAuthToken, getWorkspaceId } from "@/lib/utils/api";
import { getInfluencerMessages } from "@/shared/services/chat";
import type { ChatMessage } from "@/shared/types";

interface UseChatOptions {
  campaignId: string;
  influencerId: number | string;
  campaignUserId: number;
  enabled?: boolean;
}

export function useChat({
  campaignId,
  influencerId,
  campaignUserId,
  enabled = true,
}: UseChatOptions) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await getInfluencerMessages(
        campaignId,
        String(influencerId)
      );
      const reversed = response.reverse();
      setMessages(reversed);
      setError(null);
    } catch {
      setError("Erro ao carregar histórico de mensagens");
    } finally {
      setIsLoading(false);
    }
  }, [campaignId, influencerId]);

  useEffect(() => {
    if (!enabled || !campaignId || !campaignUserId) {
      return;
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(campaignId)) {
      setError("ID da campanha inválido");
      return;
    }

    const token = getAuthToken();
    if (!token) {
      setError("Token de autenticação não encontrado");
      return;
    }

    const workspaceId = getWorkspaceId();
    if (!workspaceId) {
      setError("Workspace ID não encontrado");
      return;
    }

    const apiBaseUrl = getApiUrl("");
    let baseUrl = apiBaseUrl;

    if (baseUrl.endsWith("/api/backoffice") || baseUrl.endsWith("/api/backoffice/")) {
      baseUrl = baseUrl.replace(/\/api\/backoffice\/?$/, "");
    }

    const isHttps = baseUrl.startsWith("https");
    const protocol = isHttps ? "wss" : "ws";
    const host = baseUrl.replace(/^https?:\/\//, "");
    const socketUrl = `${protocol}://${host}/chat`;

    const newSocket = io(socketUrl, {
      auth: {
        token,
        workspaceId,
      },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
      timeout: 20000,
      extraHeaders: {
        "Workspace-Id": workspaceId,
      },
    });

    newSocket.on("connect", () => {
      setIsConnected(true);
      setError(null);
      newSocket.emit("join_room", { campaignId, campaignUserId });
    });

    newSocket.on("disconnect", (reason: string) => {
      setIsConnected(false);
      if (reason === "io server disconnect") {
        newSocket.connect();
      }
    });

    newSocket.on("connect_error", () => {
      setError("Erro ao conectar ao chat. Tentando reconectar...");
      setIsConnected(false);
    });

    newSocket.on("reconnect", () => {
      setIsConnected(true);
      setError(null);
    });

    newSocket.on("reconnect_failed", () => {
      setError("Falha ao reconectar. Verifique sua conexão.");
    });

    newSocket.on("joined_room", () => {
      setError(null);
    });

    newSocket.on("new_message", (message: ChatMessage) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });

      if (message.sender_id !== String(influencerId)) {
        newSocket.emit("mark_as_read", { messageId: message.id });
      }
    });

    newSocket.on("error", (err: { message: string }) => {
      let errorMessage = err.message;
      if (err.message.includes("não encontrada") || err.message.includes("não encontrado")) {
        errorMessage = "Campanha não encontrada. Verifique se você tem acesso a esta campanha.";
      } else if (err.message.includes("não autenticado") || err.message.includes("autenticação")) {
        errorMessage = "Erro de autenticação. Por favor, faça login novamente.";
      } else if (err.message.includes("Acesso negado") || err.message.includes("permissão")) {
        errorMessage = "Você não tem permissão para acessar este chat.";
      }
      setError(errorMessage);
    });

    setSocket(newSocket);
    loadHistory();

    return () => {
      if (newSocket.connected) {
        newSocket.emit("leave_room", { campaignId, campaignUserId });
      }
      newSocket.disconnect();
    };
  }, [enabled, campaignId, campaignUserId, influencerId, loadHistory]);

  const sendMessage = useCallback(
    (text: string, attachments: string[] = []) => {
      if (!socket || !isConnected) {
        setError("Não conectado ao servidor");
        return;
      }

      if (!text.trim() && attachments.length === 0) {
        return;
      }

      socket.emit("send_message", {
        campaignId,
        campaignUserId,
        message: text.trim(),
        attachments,
      });
    },
    [socket, isConnected, campaignId, campaignUserId]
  );

  const markAsRead = useCallback(
    (messageId: string) => {
      if (socket && isConnected) {
        socket.emit("mark_as_read", { messageId });
      }
    },
    [socket, isConnected]
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return {
    messages,
    isConnected,
    isLoading,
    error,
    sendMessage,
    markAsRead,
    reloadHistory: loadHistory,
    messagesEndRef,
  };
}
