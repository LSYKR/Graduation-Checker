import type { ChatRequest, ChatResponse, LLMProvider, ModelCapabilities, ProviderHealth } from "../../application/ports/llm-provider";
import { loadEnvironment, type Environment } from "../../shared/config/environment";
export class RemoteProvider implements LLMProvider {
  constructor(protected readonly config: Environment, private readonly style: "ollama" | "openai-compatible", private readonly transport: typeof fetch = fetch) {}
  getCapabilities(): ModelCapabilities { return { structuredOutput: true, contextTokens: this.config.contextTokens, outputTokens: this.config.outputTokens }; }
  async healthCheck(): Promise<ProviderHealth> {
    try {
      const response = await this.transport(`${this.config.baseUrl}${this.style === "ollama" ? "/api/tags" : "/v1/models"}`, { redirect: "error", signal: AbortSignal.timeout(this.config.timeoutMs), headers: this.headers() });
      await response.body?.cancel(); return {healthy:response.ok,code:response.ok?"ok":"unavailable"};
    } catch { return { healthy: false, code: "unavailable" }; }
  }
  private headers() { return {"Content-Type":"application/json",...(this.config.apiKey?{Authorization:`Bearer ${this.config.apiKey}`}:{})}; }
  async chat(request: ChatRequest): Promise<ChatResponse> {
    const maxOutputTokens = Math.min(request.maxOutputTokens ?? this.config.outputTokens, this.config.outputTokens);
    // Count Unicode code units conservatively as tokens; no tokenizer dependency.
    if (request.messages.reduce((n,m)=>n+m.content.length+16,0)+maxOutputTokens > this.config.contextTokens) throw new Error("context-limit");
    const compatible=this.style==="openai-compatible";
    for(let attempt=0;attempt<=this.config.retries;attempt++) {
      let retryable=true;
      try {
        const response=await this.transport(`${this.config.baseUrl}${compatible?"/v1/chat/completions":"/api/chat"}`,{
          method:"POST",redirect:"error",signal:AbortSignal.timeout(this.config.timeoutMs),headers:this.headers(),
          body:JSON.stringify(compatible?{model:this.config.model,messages:request.messages,temperature:0,max_tokens:maxOutputTokens,...(request.structured?{response_format:{type:"json_object"}}:{})}:{model:this.config.model,messages:request.messages,stream:false,...(request.structured?{format:"json"}:{}),options:{temperature:0,num_predict:maxOutputTokens,num_ctx:this.config.contextTokens}})
        });
        retryable=response.status===429 || response.status>=500;
        if(!response.ok) { await response.body?.cancel(); throw new Error("provider-http-error"); }
        retryable=false;
        const reader=response.body?.getReader();if(!reader)throw new Error("empty-provider-response");
        let text="",size=0;const decoder=new TextDecoder();
        try {while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536){await reader.cancel();throw new Error("provider-output-limit");}text+=decoder.decode(part.value,{stream:true});} text+=decoder.decode();}finally{reader.releaseLock();}
        const data=JSON.parse(text);const content=compatible?data.choices?.[0]?.message?.content:data.message?.content;
        if(typeof content!=="string" || !content.trim() || content.length>maxOutputTokens*16)throw new Error("invalid-provider-output");
        return {content};
      } catch {
        if(!retryable || attempt===this.config.retries)throw new Error("provider-unavailable");
        await new Promise(resolve=>setTimeout(resolve,100*(attempt+1)));
      }
    }
    throw new Error("provider-unavailable");
  }
}
export class OllamaProvider extends RemoteProvider { constructor(config: Environment, transport?: typeof fetch) { super(config,"ollama",transport); } }
export class OpenAICompatibleProvider extends RemoteProvider { constructor(config: Environment, transport?: typeof fetch) { super(config,"openai-compatible",transport); } }
export class MockProvider implements LLMProvider {
  constructor(private readonly content='{"intent":"requirements","confidence":1,"clarify":false}') {}
  async chat():Promise<ChatResponse>{return {content:this.content};}
  async healthCheck():Promise<ProviderHealth>{return {healthy:true,code:"ok"};}
  getCapabilities():ModelCapabilities{return {structuredOutput:true,contextTokens:8192,outputTokens:512};}
}
export function createLLMProvider(config=loadEnvironment()):LLMProvider|null {
  if(config.provider==="disabled")return null;
  if(config.provider==="mock")return new MockProvider();
  return config.provider==="ollama"?new OllamaProvider(config):new OpenAICompatibleProvider(config);
}
