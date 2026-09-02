import { NextResponse } from "next/server";
import WebSocket, { RawData } from "ws";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const symbol = searchParams.get("symbol") || "1HZ100V";

  return new Promise<NextResponse>((resolve) => {
    const ws = new WebSocket(
      "wss://api.derivws.com/trading/v1/options/ws/public"
    );

    const timeout = setTimeout(() => {
      ws.close();

      resolve(
        NextResponse.json(
          {
            ok: false,
            feed: "ERROR",
            reason: "Deriv WebSocket timeout",
          },
          { status: 504 }
        )
      );
    }, 10000);

    ws.on("open", () => {
      ws.send(
        JSON.stringify({
          ticks: symbol,
          subscribe: 1,
          req_id: 1,
        })
      );
    });

    ws.on("message", (data: RawData) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.error) {
          clearTimeout(timeout);
          ws.close();

          resolve(
            NextResponse.json(
              {
                ok: false,
                feed: "ERROR",
                error: msg.error,
              },
              { status: 502 }
            )
          );

          return;
        }

        if (msg.msg_type === "tick" && msg.tick) {
          clearTimeout(timeout);

          const quote = String(msg.tick.quote);

          const lastDigit = Number(
            quote.replace(".", "").slice(-1)
          );

          ws.close();

          resolve(
            NextResponse.json({
              ok: true,
              feed: "READY",
              symbol: msg.tick.symbol,
              quote: msg.tick.quote,
              epoch: msg.tick.epoch,
              pip_size: msg.tick.pip_size,
              last_digit: lastDigit,
            })
          );

          return;
        }
      } catch {
        clearTimeout(timeout);
        ws.close();

        resolve(
          NextResponse.json(
            {
              ok: false,
              feed: "ERROR",
              reason: "Invalid response from Deriv",
            },
            { status: 502 }
          )
        );
      }
    });

    ws.on("error", (error: Error) => {
      clearTimeout(timeout);

      resolve(
        NextResponse.json(
          {
            ok: false,
            feed: "ERROR",
            reason: "WebSocket connection failed",
            error: error.message,
          },
          { status: 502 }
        )
      );
    });
  });
}
