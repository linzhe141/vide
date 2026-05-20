export type BranchKind = 'main' | 'fork' | 'regenerate'

export type BranchPayload = {
  branchName: string
  workflowId?: string
  type?: Exclude<BranchKind, 'main'>
}

export type BranchMeta = {
  rawName: string
  label: string
  workflowId: string | null
  type: BranchKind
}

export function parseBranchMeta(rawName: string): BranchMeta {
  if (rawName === 'main') {
    return {
      rawName,
      label: 'Main',
      workflowId: null,
      type: 'main',
    }
  }

  try {
    const data = JSON.parse(rawName) as BranchPayload
    const label = data.branchName?.trim() || rawName
    const type =
      data.type === 'fork' || data.type === 'regenerate'
        ? data.type
        : label.toLowerCase().includes('regenerate')
          ? 'regenerate'
          : 'fork'

    return {
      rawName,
      label,
      workflowId: data.workflowId ?? null,
      type,
    }
  } catch {
    return {
      rawName,
      label: rawName,
      workflowId: null,
      type: 'fork',
    }
  }
}

export function createBranchPayload(payload: {
  branchName: string
  workflowId: string
  type: Exclude<BranchKind, 'main'>
}) {
  return JSON.stringify(payload)
}
