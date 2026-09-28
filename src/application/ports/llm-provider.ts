export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface ChatRequest { messages: ChatMessage[]; structured?: boolean; maxOutputTokens?: number }
export interface ChatResponse { content: string }
export interface ProviderHealth { healthy: boolean; code: "ok" | "unavailable" }
export interface ModelCapabilities { structuredOutput: boolean; contextTokens: number; outputTokens: number }
export interface LLMProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  healthCheck(): Promise<ProviderHealth>;
  getCapabilities(): ModelCapabilities;
}
