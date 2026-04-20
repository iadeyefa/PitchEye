export type JoinedSessionGame = {
    id: number;
    title: string;
    session_code: string;
    game_time: string;
    created_by?: string;
    qr_code_active?: boolean;
    can_accept_uploads?: boolean;
    session_started?: boolean;
    owned_by_current_user?: boolean;
};

const storageKey = (userId: string) => `pitcheye.joined-sessions.${userId}`;

const readCodes = (userId?: string | null) => {
    if (!userId || typeof window === "undefined") return [];

    try {
        const raw = window.localStorage.getItem(storageKey(userId));
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .map((value) => String(value || "").trim().toUpperCase())
            .filter(Boolean);
    } catch {
        return [];
    }
};

const writeCodes = (userId: string, codes: string[]) => {
    if (typeof window === "undefined") return;

    const normalized = Array.from(
        new Set(
            codes
                .map((value) => String(value || "").trim().toUpperCase())
                .filter(Boolean),
        ),
    );
    window.localStorage.setItem(storageKey(userId), JSON.stringify(normalized));
};

export const getJoinedSessionCodes = (userId?: string | null) => readCodes(userId);

export const hasJoinedSessionCode = (userId: string | null | undefined, sessionCode: string) => {
    const normalized = String(sessionCode || "").trim().toUpperCase();
    if (!userId || !normalized) return false;
    return readCodes(userId).includes(normalized);
};

export const addJoinedSessionCode = (userId: string, sessionCode: string) => {
    const normalized = String(sessionCode || "").trim().toUpperCase();
    if (!userId || !normalized) return;

    writeCodes(userId, [...readCodes(userId), normalized]);
};

export const removeJoinedSessionCode = (userId: string, sessionCode: string) => {
    const normalized = String(sessionCode || "").trim().toUpperCase();
    if (!userId || !normalized) return;

    writeCodes(
        userId,
        readCodes(userId).filter((value) => value !== normalized),
    );
};

export const resolveJoinedSessions = async (
    accessToken: string,
    userId?: string | null,
) => {
    const sessionCodes = getJoinedSessionCodes(userId);
    if (!sessionCodes.length) return [];

    const responses = await Promise.all(
        sessionCodes.map(async (sessionCode) => {
            const response = await fetch(`http://localhost:8000/api/games/join/${sessionCode}/`, {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            if (response.status === 404 || response.status === 410) {
                if (userId) removeJoinedSessionCode(userId, sessionCode);
                return null;
            }

            if (!response.ok) {
                throw new Error(`Unable to load joined session ${sessionCode}`);
            }

            const payload = await response.json();
            return payload as JoinedSessionGame;
        }),
    );

    return responses.filter(Boolean) as JoinedSessionGame[];
};

export const mergeGamesById = <T extends { id: number }>(primary: T[], extra: T[]) => {
    const merged = new Map<number, T>();
    primary.forEach((game) => merged.set(game.id, game));
    extra.forEach((game) => {
        if (!merged.has(game.id)) {
            merged.set(game.id, game);
        }
    });
    return Array.from(merged.values());
};
