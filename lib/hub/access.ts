export function canReadHubRecord({ recordUserId, recordWorkspaceId, userId, workspaceId, membershipStatus }: { recordUserId: string; recordWorkspaceId: string; userId: string; workspaceId: string; membershipStatus: string }) {
  return recordUserId === userId && recordWorkspaceId === workspaceId && membershipStatus === "active";
}
