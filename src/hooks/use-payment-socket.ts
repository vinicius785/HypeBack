import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { getAuthToken } from "@/lib/utils/api";

export interface PaymentConfirmedEvent {
  charge_id: string;
  amount_cents: number;
  amount: string;
}

interface UsePaymentSocketOptions {
  chargeId: string;
  onConfirmed: (event: PaymentConfirmedEvent) => void;
}

function getSocketBaseUrl(): string {
  const serverUrl = import.meta.env.VITE_SERVER_URL as string;
  return serverUrl.replace(/\/api\/backoffice\/?$/, "");
}

export function usePaymentSocket({ chargeId, onConfirmed }: UsePaymentSocketOptions) {
  const onConfirmedRef = useRef(onConfirmed);
  useEffect(() => { onConfirmedRef.current = onConfirmed; }, [onConfirmed]);

  useEffect(() => {
    const token = getAuthToken();
    const baseUrl = getSocketBaseUrl();

    const socket: Socket = io(`${baseUrl}/payments`, {
      auth: { token: `Bearer ${token}` },
      reconnectionAttempts: 3,
    });

    socket.on("connect", () => {
      socket.emit("subscribe:charge", { charge_id: chargeId });
    });

    socket.on("payment:confirmed", (event: PaymentConfirmedEvent) => {
      onConfirmedRef.current(event);
      socket.disconnect();
    });

    return () => {
      socket.disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chargeId]);
}
