use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde_json::json;
use tokio::sync::broadcast;
use tracing::{error, info, warn};

use crate::state::SharedState;

/// Axum route handler that upgrades HTTP connections to WebSockets.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<SharedState>,
) -> impl IntoResponse {
    info!("Incoming WebSocket connection request");
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

/// Manages bidirectional WebSocket communication for a connected client session.
async fn handle_socket(socket: WebSocket, state: SharedState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.ws_sender.subscribe();

    info!("WebSocket connection established with Next.js client");

    // Send an initial handshake acknowledgment message to the client
    let init_msg = json!({
        "type": "CONNECTED",
        "status": "ready",
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    
    if let Err(e) = sender.send(Message::Text(init_msg.to_string())).await {
        error!("Failed to send initial WS handshake: {}", e);
        return;
    }

    // Task 1: Forward broadcasted engine events (WsEvent) -> WebSocket Client + 30s Heartbeat Ping
    let mut send_task = tokio::spawn(async move {
        let mut heartbeat_interval = tokio::time::interval(std::time::Duration::from_secs(30));
        heartbeat_interval.tick().await; // Skip initial instant tick

        loop {
            tokio::select! {
                _ = heartbeat_interval.tick() => {
                    if sender.send(Message::Ping(vec![])).await.is_err() {
                        warn!("WS heartbeat ping failed, dropping dead client connection");
                        break;
                    }
                }
                event_res = rx.recv() => {
                    match event_res {
                        Ok(event) => {
                            match serde_json::to_string(&event) {
                                Ok(json_str) => {
                                    if sender.send(Message::Text(json_str)).await.is_err() {
                                        break;
                                    }
                                }
                                Err(e) => {
                                    error!("Failed to serialize WsEvent to JSON: {}", e);
                                }
                            }
                        }
                        Err(broadcast::error::RecvError::Lagged(skipped)) => {
                            warn!("WebSocket client lagged behind, skipped {} events", skipped);
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            info!("WS broadcast channel closed");
                            break;
                        }
                    }
                }
            }
        }
    });

    // Task 2: Listen for client incoming messages (Pings/Close frames)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Close(_) => {
                    info!("Client sent WS close frame");
                    break;
                }
                Message::Ping(payload) => {
                    // Axum automatically handles PONG, but logging for telemetry
                    tracing::trace!("Received WS Ping from client ({} bytes)", payload.len());
                }
                _ => {}
            }
        }
    });

    // Abort the remaining task if either sending or receiving fails/closes
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };

    info!("WebSocket client connection closed cleanly");
}