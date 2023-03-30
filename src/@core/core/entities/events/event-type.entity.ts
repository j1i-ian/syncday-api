/**
 * @property ONE_ON_ONE Good for: coffee chats, 1:1 interviews, etc.
 * @property ONE_ON_GROUP Good for: webinars, online classes, etc.
 * @property COLLECTIVE Good for: panel interviews, group sales calls, etc.
 * @property ROUND_ROBIN Good for: distributing incoming sales leads
 */
export enum EventType {

    ONE_ON_ONE = 'one_on_one',

    ONE_ON_GROUP = 'one_on_group',

    COLLECTIVE = 'collective',

    ROUND_ROBIN = 'round_robin'
}
