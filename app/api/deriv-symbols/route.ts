import { NextResponse } from "next/server";
import WebSocket, { RawData } from "ws";

export const runtime = "nodejs";

export async function GET() {
  return new Promise<NextResponse>((resolve) => {
    const ws = new WebSocket(
      "wss://ws.binaryws.com/websockets/v3"
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
          active_symbols: "brief",
          req_id: 1,
        })
      );
    });

    ws.on("message", (data: RawData) => {
      clearTimeout(timeout);

      try {
        const msg = JSON.parse(data.toString());

        if (msg.error) {
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

        if (msg.msg_type === "active_symbols") {
          const symbols = (msg.active_symbols || []).map(
            (item: any) => ({
              symbol:
                item.underlying_symbol ??
                item.symbol ??
                null,

              name:
                item.underlying_symbol_name ??
                item.display_name ??
                null,

              type:
                item.underlying_symbol_type ??
                item.symbol_type ??
                null,

              market: item.market ?? null,
            })
          );

          ws.close();

          resolve(
            NextResponse.json({
              ok: true,
              feed: "READY",
              count: symbols.length,
              symbols,
            })
          );

          return;
        }

        ws.close();

        resolve(
          NextResponse.json({
            ok: true,
            feed: "NO_SYMBOLS",
            msg_type: msg.msg_type ?? null,
          })
        );
      } catch {
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
