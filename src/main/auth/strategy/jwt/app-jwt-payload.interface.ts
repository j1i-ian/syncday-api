export interface AppJwtPayload {
    id: number;
    uuid: string;
    email: string;
    profileImage: string | null;
    nickname: string;
    iat: number;
    exp: number;
}
