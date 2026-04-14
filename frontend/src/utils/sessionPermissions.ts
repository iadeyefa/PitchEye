export type SessionCreationAccess = "owner_only" | "staff_only" | "all_members";

export type TeamSessionPermissionShape = {
    admin_id?: string;
    session_creation_access?: string;
};

export function normalizeSessionCreationAccess(value?: string): SessionCreationAccess {
    if (value === "owner_only" || value === "all_members" || value === "staff_only") {
        return value;
    }
    return "staff_only";
}

export function canUserCreateTeamSessions(
    role: string | undefined,
    team: TeamSessionPermissionShape | null | undefined,
    userId: string | undefined,
): boolean {
    if (!team) return true;

    const access = normalizeSessionCreationAccess(team.session_creation_access);
    const isOwner = Boolean(userId && team.admin_id && team.admin_id === userId);

    if (access === "owner_only") return isOwner;
    if (access === "all_members") return true;
    return isOwner || role === "admin" || role === "coach";
}

export function describeSessionCreationAccess(value?: string): string {
    const access = normalizeSessionCreationAccess(value);

    if (access === "owner_only") return "Only the team owner can create sessions.";
    if (access === "all_members") return "All team members can create sessions.";
    return "The team owner, admins, and coaches can create sessions.";
}
