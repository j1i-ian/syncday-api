export interface Rooms {
    name: string;
    participants: string[];
}

export interface BreakoutRoom {
    enable: boolean;
    rooms: Rooms[];
}
