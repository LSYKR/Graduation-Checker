import type { LLMProvider } from "../ports/llm-provider";
export type Intent = "requirements" | "planning" | "certification" | "clarification";
export interface Plan { intent: Intent; confidence: number; clarify: boolean }
export interface RouteResult { plan: Plan | null; provider: "small" | "large" | "disabled"; reason: string }
export function validatePlan(text: string): Plan {
  const value = JSON.parse(text);
  if (!value || !["requirements","planning","certification","clarification"].includes(value.intent) || typeof value.confidence!=="number" || !Number.isFinite(value.confidence) || value.confidence<0 || value.confidence>1 || typeof value.clarify!=="boolean") throw new Error("invalid-plan");
  return {intent:value.intent,confidence:value.confidence,clarify:value.clarify};
}
export async function routeQuestion(question:string, small:LLMProvider|null, large?:LLMProvider, observe:(event:{provider:string;reason:string;durationMs:number})=>void=()=>{}) :Promise<RouteResult> {
  const started=Date.now();let reason="disabled";
  const messages = [{role:"system" as const,content:'Classify the question only. Never decide graduation. Return JSON {"intent":"requirements|planning|certification|clarification","confidence":0.0,"clarify":false}. If priorities conflict, clarify=true. /no_think'},{role:"user" as const,content:question}];
  const candidates=small?[{provider:small,name:"small" as const},...(large?[{provider:large,name:"large" as const}]:[])]:[];
  for(const candidate of candidates){
    if(messages.reduce((n,m)=>n+m.content.length+16,0)+256>candidate.provider.getCapabilities().contextTokens){reason="context-limit";continue;}
    try {
      const plan=validatePlan((await candidate.provider.chat({messages,structured:true,maxOutputTokens:256})).content);
      if(plan.clarify){observe({provider:candidate.name,reason:"clarification",durationMs:Date.now()-started});return {plan,provider:candidate.name,reason:"clarification"};}
      if(large && candidate.name==="small" && (plan.confidence<0.7 || plan.intent==="planning")){reason=plan.confidence<0.7?"low-confidence":"complex-planning";continue;}
      observe({provider:candidate.name,reason:reason==="disabled"?"classified":reason,durationMs:Date.now()-started});return {plan,provider:candidate.name,reason:"classified"};
    }catch{reason="invalid-or-unavailable";}
  }
  observe({provider:"disabled",reason,durationMs:Date.now()-started});return {plan:null,provider:"disabled",reason};
}
