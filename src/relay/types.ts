/**
 * Relay routing types.
 *
 * Data structures for routing transactions through MEV relays (Jito, etc.)
 * with fallback to standard RPC.
 */

/**
 * Result of sending a transaction via relay.
 */
export interface RelaySendResult {
  signature: string;
  relayName: string;
}

/**
 * Relay client interface.
 * Sends transactions through a relay to avoid frontrunning.
 */
export interface RelayClient {
  readonly name: string;

  /**
   * Send a transaction via this relay.
   *
   * @param base64 Base64-encoded serialized transaction
   * @returns Signature and relay name, or error
   */
  sendTransaction(base64: string): Promise<RelaySendResult>;
}

/**
 * Configuration for relay routing.
 */
export interface RelayRoutingConfig {
  preferRelay: boolean; // If true, try relay first; if false, use RPC directly
  fallbackToRpc: boolean; // If true, fall back to RPC if relay fails
}

/**
 * Type indicating which route was used to send a transaction.
 */
export type TransactionRoute = "relay" | "rpc";

/**
 * Result of routing a transaction (either relay or RPC).
 */
export interface RoutedTransactionResult {
  signature: string;
  route: TransactionRoute;
  endpointId?: string; // RPC endpoint ID (if route="rpc")
  relayName?: string; // Relay name (if route="relay")
}
