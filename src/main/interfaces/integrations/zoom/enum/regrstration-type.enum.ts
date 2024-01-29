// eslint-disable-next-line no-shadow
export enum RegistrationType {
    // Attendees register once and can attend any meeting occurrence.
    Once = 1,
    // Attendees must register for each meeting occurrence.
    Must = 2,
    // Attendees register once and can select one or more meeting occurrences to attend.
    Option = 3
}
