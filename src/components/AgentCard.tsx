import { formatAgentMessage } from '../parser/formatReport'
import type { AgentFollowUp } from '../parser/types'
import { CopyButton } from './CopyButton'

export function AgentCard({ agent }: { agent: AgentFollowUp }) {
  const message = formatAgentMessage(agent)
  return (
    <article className="card agent-card">
      <header>
        <div>
          <h3>{agent.agentName}</h3>
          <span className="muted">
            {agent.pendingInstall.length} pending install · {agent.canceled.length} canceled
          </span>
        </div>
        <CopyButton text={message} label="Copy Agent Message" />
      </header>
      <pre>{message}</pre>
    </article>
  )
}
