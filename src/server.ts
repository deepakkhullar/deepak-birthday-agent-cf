// Trigger Cloudflare rebuild

import { createWorkersAI } from "workers-ai-provider";
import { routeAgentRequest } from "agents";
import {
AIChatAgent,
type OnChatMessageOptions
} from "@cloudflare/ai-chat";
import {
convertToModelMessages,
pruneMessages,
stepCountIs,
streamText,
tool
} from "ai";
import { z } from "zod";

export class ChatAgent extends AIChatAgent<Env> {
// Persist conversation history for the agent
maxPersistedMessages = 100;

// Enable recovery of interrupted chat sessions
chatRecovery = true;

async onChatMessage(
_onFinish: unknown,
options?: OnChatMessageOptions
) {
const workersai = createWorkersAI({
binding: this.env.AI
});

const result = streamText({
model: workersai("@cf/zai-org/glm-4.7-flash", {
sessionAffinity: this.sessionAffinity
}),

system: `You are the assistant for Deepak's 50th birthday website.

For every question about the birthday event, use the getEventInfo tool.

Answer only using information returned by getEventInfo.

If the venue is "TBD", answer "TBD" exactly.

Do not turn "TBD" into "I do not know".

Do not guess or invent any birthday-event details.

Keep answers concise and friendly.`,

messages: pruneMessages({
messages: await convertToModelMessages(this.messages),
toolCalls: "before-last-2-messages",
reasoning: "before-last-message"
}),

tools: {
getEventInfo: tool({
description:
"Get the official details for Deepak's 50th birthday party, including the date, venue, and what guests should expect.",

inputSchema: z.object({}),

execute: async () => {
const response = await fetch(
"https://leym7y6u38.execute-api.us-west-2.amazonaws.com/event-info"
);

if (!response.ok) {
return {
error: `Unable to retrieve event information. HTTP status: ${response.status}`
};
}

const eventInfo = await response.json();

return eventInfo;
}
})
},

stopWhen: stepCountIs(10),

abortSignal: options?.abortSignal
});

return result.toUIMessageStreamResponse();
}
}

export default {
async fetch(request: Request, env: Env) {
return (
(await routeAgentRequest(request, env)) ||
new Response("Not found", {
status: 404
})
);
}
} satisfies ExportedHandler<Env>;
