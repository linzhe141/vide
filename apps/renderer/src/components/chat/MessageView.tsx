import type { SessionMessage, Workflow } from "@/store/sessionStore/types";
import { UserInputMessage } from "./messages/UserInputMessage";
import { AssistantTextMessage } from "./messages/AssistantTextMessage";
import { AssistantReasonMessage } from "./messages/AssistantReasonMessage";
import { ToolCallMessage } from "./messages/ToolCallMessage";
import { AskUserQuestionMessage, AskUserQuestionUserSlectedReultPrefix } from "./messages/AskUserQuestionMessage";
import { MarkdownRenderer } from "../markdown/MarkdownRenderer";

export function MessageView({ workflow, message }: { workflow: Workflow; message: SessionMessage }) {
  switch (message.role) {
    case 'user':
      return message.content.startsWith(AskUserQuestionUserSlectedReultPrefix) ? null : (
        <UserInputMessage message={message} workflow={workflow} />
      )

    case 'assistant-text':
      return <AssistantTextMessage workflow={workflow} message={message} />

    case 'assistant-reason':
      return <AssistantReasonMessage message={message} />

    case 'tool-call':
      return <ToolCallMessage workflow={workflow} message={message} />

    case 'tool-result':
      return null

    case 'ask-user':
      return <AskUserQuestionMessage workflowId={workflow.id} message={message} />

    case 'error':
      return (
        <div className='rounded-[24px] border border-red-500/20 bg-red-500/6 px-4 py-3 text-sm text-red-600 dark:text-red-400'>
          <MarkdownRenderer animation={false}>
            {JSON.stringify(message.error, null, 2)}
          </MarkdownRenderer>
        </div>
      )
  }
}