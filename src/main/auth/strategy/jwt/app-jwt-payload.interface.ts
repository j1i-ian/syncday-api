export interface AppJwtPayload {
    id: number;
    email: string;
    profileImage: string | null;
    nickname: string;
    iat: number;
    exp: number;
}
