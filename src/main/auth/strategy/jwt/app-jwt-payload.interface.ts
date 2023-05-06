export interface AppJwtPayload {
    id: number;
    uuid: string;
    email: string;
    profileImage: string | null;
    name: string;
    iat: number;
    exp: number;
}
